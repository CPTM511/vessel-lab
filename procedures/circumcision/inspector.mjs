import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {TissueSim} from './mechanics.mjs';
import {ControllerLease} from './controller-lease.mjs';
import path from 'node:path';
import {recordingHeader} from './recording.mjs';
import {geometryQuery} from './instrumentation.mjs';
import {checkEvaluationFreeze} from './evaluation-freeze.mjs';

// Local inspection, bounded mechanics and a single revocable model controller.
const modes=new Set(['covered','retracted','ventral','inner','outer','glans','protected','meatus']);
const port=Number(process.env.ANATOMY_PORT||8785);
const lease=new ControllerLease(import.meta.dirname,`http://127.0.0.1:${port}`);
let freezeReady=false;try{checkEvaluationFreeze();freezeReady=true;}catch{}
const state={session:crypto.randomUUID(),episode:null,revision:0,mode:'covered',retraction:0,stage:'anatomy-inspection',mechanicsEnabled:false,controlSource:'manual-inspection'};
let frame=null;let mechanics=null;const commands=new Map();
const current=(geometry=true)=>({...state,agent:{...lease.snapshot(),procedureReady:freezeReady},...(mechanics?{mechanics:geometry?mechanics.snapshot():mechanics.observe()}: {})});
fs.mkdirSync(new URL('sessions/',import.meta.url),{recursive:true});
const auditFile=new URL('sessions/transport-'+new Date().toISOString().replaceAll(':','-')+'.jsonl',import.meta.url);
function respond(res,status,body){if(res.audit)fs.appendFileSync(auditFile,JSON.stringify({at:new Date().toISOString(),...res.audit,status,response:body})+'\n');res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`)return respond(res,403,{error:'Untrusted host'});
  if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return respond(res,403,{error:'Untrusted origin'});
  if(req.method==='GET'&&req.url==='/api/observe')return respond(res,200,current(false));
  if(req.method==='GET'&&req.url==='/api/state')return respond(res,200,current());
  if(req.method==='GET'&&req.url==='/api/frame')return respond(res,frame?200:503,frame??{error:'No actual Godot frame received'});
  if(req.method!=='POST')return respond(res,404,{error:'Unknown route'});
  let data='';for await(const chunk of req){data+=chunk;if(data.length>8_000_000)return respond(res,413,{error:'Request too large'});}
  let body;try{body=JSON.parse(data);}catch{return respond(res,400,{error:'Invalid JSON'});}
  if(!body||typeof body!=='object'||Array.isArray(body))return respond(res,400,{error:'Object required'});
  if(req.url!=='/api/frame')res.audit={route:req.url,request:body};
  if(body.session!==state.session)return respond(res,409,{error:'Stale session'});
  if(req.url==='/api/agent/stop')return respond(res,200,{stopping:lease.stop(),agent:lease.snapshot()});
  if(req.url==='/api/agent/status'){
   if(!lease.authorized(req))return respond(res,409,{error:'Controller lease is not active'});
   lease.update(body);return respond(res,200,{accepted:true});
  }
  if(req.url==='/api/playback/start'){
   if(lease.running)return respond(res,409,{error:'An execution is already running'});
   if(body.revision!==state.revision)return respond(res,409,{error:'Stale revision'});
   if(!frame||Date.now()-frame.receivedAt>5000)return respond(res,409,{error:'Fresh actual Godot frame required before playback'});
   const recording=recordingHeader(path.join(import.meta.dirname,'evidence/controller-loop-01'));
   mechanics=new TissueSim(recording.seed);state.episode=crypto.randomUUID();state.mechanicsEnabled=true;state.stage='mechanics-development';state.retraction=0;state.mode='covered';state.controlSource='recorded-playback';state.revision++;frame=null;
   lease.start('playback',state.episode);return respond(res,200,current(false));
  }
  if(req.url==='/api/agent/start'){
   if(lease.running)return respond(res,409,{error:'A controller is already running'});
   if(!mechanics||mechanics.revision!==0||mechanics.terminal)return respond(res,409,{error:'Reset mechanics before starting an independent controller run'});
   if(body.revision!==state.revision)return respond(res,409,{error:'Stale revision'});
   if(!frame||Date.now()-frame.receivedAt>5000)return respond(res,409,{error:'Fresh actual Godot frame required before controller start'});
   if(!['loop','procedure'].includes(body.task))return respond(res,400,{error:'Unknown controller task'});
   if(body.task==='procedure'){try{checkEvaluationFreeze();}catch(e){return respond(res,409,{error:e.message});}}
   state.controlSource='gpt-6-astra';state.revision++;frame=null;
   lease.start(body.task,state.episode);return respond(res,200,current(false));
  }
  const mutations=['/api/inspect','/api/mechanics/reset','/api/inspection/reset','/api/step','/api/finish'];
  if(mutations.includes(req.url)||req.url==='/api/geometry'){
   if(['gpt-6-astra','recorded-playback'].includes(body.source)&&(!lease.authorized(req)||(body.source==='recorded-playback')!==(lease.info.task==='playback')))return respond(res,409,{error:'Controller lease is not active'});
   if(lease.running&&!['gpt-6-astra','recorded-playback'].includes(body.source))return respond(res,409,{error:'Manual controls locked during controller run'});
   if(lease.running&&req.url.endsWith('/reset'))return respond(res,409,{error:'Stop the controller before reset'});
  }
  if(req.url==='/api/geometry'){
   if(!mechanics)return respond(res,409,{error:'Enable mechanics first'});
   if(body.revision!==state.revision)return respond(res,409,{error:'Stale revision'});
   try{return respond(res,200,geometryQuery(mechanics,body.query));}catch(e){return respond(res,400,{error:e.message});}
  }

  if(['/api/inspect','/api/mechanics/reset','/api/inspection/reset','/api/step','/api/finish'].includes(req.url)){
   const key=body.commandId;
   if(typeof key!=='string'||!key||key.length>128)return respond(res,400,{error:'commandId required'});
   const digest=crypto.createHash('sha256').update(JSON.stringify({route:req.url,body})).digest('hex');
   if(commands.has(key)){const old=commands.get(key);return respond(res,old.digest===digest?200:409,old.digest===digest?old.state:{error:'Conflicting commandId'});}
   if(body.revision!==state.revision)return respond(res,409,{error:'Stale revision'});
   if(req.url==='/api/mechanics/reset'){
    if(!['manual-mechanics','scripted-mechanics-test'].includes(body.source))return respond(res,400,{error:'Explicit mechanics source required'});
    const candidate=new TissueSim(body.seed??11);mechanics=candidate;state.episode=crypto.randomUUID();state.mechanicsEnabled=true;state.stage='mechanics-development';state.retraction=0;state.mode='covered';
   }else if(req.url==='/api/inspection/reset'){
    if(!['manual-inspection','scripted-inspection-test'].includes(body.source))return respond(res,400,{error:'Explicit inspection source required'});
    mechanics=null;state.episode=null;state.mechanicsEnabled=false;state.stage='anatomy-inspection';state.retraction=0;state.mode='covered';
   }else if(req.url==='/api/step'||req.url==='/api/finish'){
    if(!mechanics)return respond(res,409,{error:'Enable the mechanics sandbox first'});
    if(!['manual-mechanics','scripted-mechanics-test','gpt-6-astra','recorded-playback'].includes(body.source))return respond(res,400,{error:'Explicit mechanical source required'});
    if(!frame||Date.now()-frame.receivedAt>5000)return respond(res,409,{error:'Fresh actual Godot frame required before mechanical action'});
    if(body.source==='gpt-6-astra'&&lease.info.task==='loop'){
     const action=body.action;
     if(req.url==='/api/finish'||!action||Object.keys(action).some(k=>!['revision','duration','left','right'].includes(k))||!Number.isFinite(action.duration)||action.duration>.05||['left','right'].some(name=>action[name]&&(Object.keys(action[name]).some(k=>k!=='position')||!Array.isArray(action[name].position)||action[name].position.length!==3||Math.hypot(...action[name].position.map((v,i)=>v-mechanics.arms[name].position[i]))>1.000001)))return respond(res,400,{error:'Connectivity test permits only small translations; reset and freeze before procedure evaluation'});
    }

    try{if(req.url==='/api/finish')mechanics.finish();else mechanics.step(body.action);}catch(e){return respond(res,400,{error:e.message});}
   }else {
    if(mechanics&&body.retraction!==undefined)return respond(res,409,{error:'Visual retraction morph is disabled during mechanics'});
   if(body.mode!==undefined&&!modes.has(body.mode))return respond(res,400,{error:'Unknown inspection mode'});
   if(body.retraction!==undefined&&(!Number.isFinite(body.retraction)||body.retraction<0||body.retraction>1))return respond(res,400,{error:'Retraction morph must be in [0,1]'});
   if(body.mode===undefined&&body.retraction===undefined)return respond(res,400,{error:'No inspection change'});
   if(!['manual-inspection','scripted-inspection-test','gpt-6-astra','recorded-playback'].includes(body.source))return respond(res,400,{error:'Inspection source must be explicitly labeled'});
   if(body.mode!==undefined)state.mode=body.mode;
   if(body.retraction!==undefined)state.retraction=body.retraction;
   }
   state.controlSource=body.source;state.revision++;frame=null;const output=current(false);commands.set(key,{digest,state:output});
   if(commands.size>2000)commands.delete(commands.keys().next().value);
   return respond(res,200,output);
  }
  if(req.url==='/api/frame'){
   if(body.revision!==state.revision)return respond(res,409,{error:'Stale frame revision'});
   if(mechanics&&body.mechanicsRevision!==mechanics.revision)return respond(res,409,{error:'Frame mechanics revision mismatch'});
   if(mechanics&&(body.seed!==mechanics.seed||Math.abs(body.anatomyScale-mechanics.scale)>1e-6||!Number.isFinite(body.anatomyScale)))return respond(res,409,{error:'Frame scenario mismatch'});
   if(mechanics&&body.cutFaceCount!==mechanics.metrics().cutFaceCount)return respond(res,409,{error:'Frame cutting topology mismatch'});
   if(mechanics&&(body.activeAttachments!==mechanics.metrics().activeAttachments||body.assessmentPassed!==mechanics.assessment().passed))return respond(res,409,{error:'Frame attachment or assessment mismatch'});
   if(body.controlSource!==state.controlSource)return respond(res,409,{error:'Frame control source mismatch'});
   if(body.mechanicsEnabled!==state.mechanicsEnabled)return respond(res,409,{error:'Frame phase mismatch'});
   if(body.mode!==state.mode||body.retraction!==state.retraction)return respond(res,409,{error:'Frame inspection state mismatch'});
   if(!/^data:image\/jpeg;base64,/.test(body.image)||!/^data:image\/jpeg;base64,/.test(body.uiImage))return respond(res,400,{error:'Actual JPEG frames required'});
   const validJpeg=value=>{const b=Buffer.from(value.split(',')[1],'base64');return b.length>1000&&b[0]===255&&b[1]===216&&b[b.length-2]===255&&b[b.length-1]===217;};
   if(!validJpeg(body.image)||!validJpeg(body.uiImage)||!['forward_plus','gl_compatibility'].includes(body.renderer))return respond(res,400,{error:'Invalid rendered JPEG or unsupported renderer'});
   frame={...body,receivedAt:Date.now(),imageHash:crypto.createHash('sha256').update(body.image).digest('hex')};
   return respond(res,200,{accepted:true});
  }
  return respond(res,404,{error:'Unknown route'});
 }catch(e){respond(res,500,{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Adult anatomy inspection service: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{lease.stop();server.close();setTimeout(()=>process.exit(0),2200).unref();});
