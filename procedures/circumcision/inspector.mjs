import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {TissueSim} from './mechanics.mjs';

// Geometry inspection and manual mechanical development; no autonomous procedure yet.
const modes=new Set(['covered','retracted','ventral','inner','outer','glans','protected']);
const port=Number(process.env.ANATOMY_PORT||8785);
const state={session:crypto.randomUUID(),revision:0,mode:'covered',retraction:0,stage:'anatomy-inspection',mechanicsEnabled:false};
let frame=null;let mechanics=null;const commands=new Map();
const current=(geometry=true)=>({...state,...(mechanics?{mechanics:geometry?mechanics.snapshot():mechanics.observe()}: {})});
fs.mkdirSync(new URL('sessions/',import.meta.url),{recursive:true});
const auditFile=new URL('sessions/transport-'+new Date().toISOString().replaceAll(':','-')+'.jsonl',import.meta.url);
function respond(res,status,body){if(res.audit)fs.appendFileSync(auditFile,JSON.stringify({at:new Date().toISOString(),...res.audit,status,response:body})+'\n');res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`)return respond(res,403,{error:'Untrusted host'});
  if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return respond(res,403,{error:'Untrusted origin'});
  if(req.method==='GET'&&req.url==='/api/state')return respond(res,200,current());
  if(req.method==='GET'&&req.url==='/api/frame')return respond(res,frame?200:503,frame??{error:'No actual Godot frame received'});
  if(req.method!=='POST')return respond(res,404,{error:'Unknown route'});
  let data='';for await(const chunk of req){data+=chunk;if(data.length>8_000_000)return respond(res,413,{error:'Request too large'});}
  let body;try{body=JSON.parse(data);}catch{return respond(res,400,{error:'Invalid JSON'});}
  if(!body||typeof body!=='object'||Array.isArray(body))return respond(res,400,{error:'Object required'});
  if(req.url!=='/api/frame')res.audit={route:req.url,request:body};
  if(body.session!==state.session)return respond(res,409,{error:'Stale session'});
  if(['/api/inspect','/api/mechanics/reset','/api/inspection/reset','/api/step'].includes(req.url)){
   const key=body.commandId;
   if(typeof key!=='string'||!key||key.length>128)return respond(res,400,{error:'commandId required'});
   const digest=crypto.createHash('sha256').update(JSON.stringify({route:req.url,body})).digest('hex');
   if(commands.has(key)){const old=commands.get(key);return respond(res,old.digest===digest?200:409,old.digest===digest?old.state:{error:'Conflicting commandId'});}
   if(body.revision!==state.revision)return respond(res,409,{error:'Stale revision'});
   if(req.url==='/api/mechanics/reset'){
    if(!['manual-mechanics','scripted-mechanics-test'].includes(body.source))return respond(res,400,{error:'Explicit mechanics source required'});
    const candidate=new TissueSim(body.seed??11);mechanics=candidate;state.mechanicsEnabled=true;state.stage='mechanics-development';state.retraction=0;state.mode='covered';
   }else if(req.url==='/api/inspection/reset'){
    if(!['manual-inspection','scripted-inspection-test'].includes(body.source))return respond(res,400,{error:'Explicit inspection source required'});
    mechanics=null;state.mechanicsEnabled=false;state.stage='anatomy-inspection';state.retraction=0;state.mode='covered';
   }else if(req.url==='/api/step'){
    if(!mechanics)return respond(res,409,{error:'Enable the mechanics sandbox first'});
    if(!['manual-mechanics','scripted-mechanics-test'].includes(body.source))return respond(res,400,{error:'No autonomous controller is enabled'});
    if(!frame||Date.now()-frame.receivedAt>5000)return respond(res,409,{error:'Fresh actual Godot frame required before mechanical action'});
    try{mechanics.step(body.action);}catch(e){return respond(res,400,{error:e.message});}
   }else {
    if(mechanics&&body.retraction!==undefined)return respond(res,409,{error:'Visual retraction morph is disabled during mechanics'});
   if(body.mode!==undefined&&!modes.has(body.mode))return respond(res,400,{error:'Unknown inspection mode'});
   if(body.retraction!==undefined&&(!Number.isFinite(body.retraction)||body.retraction<0||body.retraction>1))return respond(res,400,{error:'Retraction morph must be in [0,1]'});
   if(body.mode===undefined&&body.retraction===undefined)return respond(res,400,{error:'No inspection change'});
   if(body.source!=='manual-inspection'&&body.source!=='scripted-inspection-test')return respond(res,400,{error:'Inspection source must be explicitly labeled'});
   if(body.mode!==undefined)state.mode=body.mode;
   if(body.retraction!==undefined)state.retraction=body.retraction;
   }
   state.revision++;frame=null;const output=current(false);commands.set(key,{digest,state:output});
   if(commands.size>2000)commands.delete(commands.keys().next().value);
   return respond(res,200,output);
  }
  if(req.url==='/api/frame'){
   if(body.revision!==state.revision)return respond(res,409,{error:'Stale frame revision'});
   if(mechanics&&body.mechanicsRevision!==mechanics.revision)return respond(res,409,{error:'Frame mechanics revision mismatch'});
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
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
