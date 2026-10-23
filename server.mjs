import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {VesselSim} from './sim.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||8765),sim=new VesselSim();
fs.mkdirSync(path.join(root,'sessions'),{recursive:true});
let id='',log=[],frames=new Map(),agent={running:false},seen=new Map(),sockets=new Set(),agentProcess=null,controllerToken=null;
function reset(seed=42){sim.reset(seed);id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex');log=[];frames.clear();seen.clear();record('reset',{seed});}
function record(type,data){let e={type,at:new Date().toISOString(),revision:sim.revision,...data};log.push(e);fs.appendFileSync(path.join(root,'sessions',id+'.jsonl'),JSON.stringify(e)+'\n');}
function json(res,code,data){res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));}
function broadcast(){const s=JSON.stringify({state:sim.snapshot(),session:id,agent});for(const r of sockets)r.write('data: '+s+'\n\n');}
async function body(req){let b='';for await(const c of req){b+=c;if(b.length>4e6)throw Error('Body too large');}return b?JSON.parse(b):{};}
function authorizedController(req){return controllerToken&&req.headers['x-vessel-controller-token']===controllerToken;}
function stopController(){
 const proc=agentProcess;controllerToken=null;
 if(proc){agent={...agent,running:true,phase:'stopping'};try{process.kill(-proc.pid,'SIGTERM');}catch{proc.kill('SIGTERM');}
  setTimeout(()=>{try{process.kill(-proc.pid,'SIGKILL');}catch{}},2000);
 }else agent={...agent,running:false};
 broadcast();return !!proc;
}
function launchController(script,args,logFile,task){
 controllerToken=crypto.randomBytes(32).toString('hex');
 agent={running:true,phase:'starting',model:task==='replay'?null:'gpt-6-astra',task};
 const fd=fs.openSync(logFile,'a');
 const proc=spawn(process.execPath,[path.join(root,script),...args],{cwd:root,detached:true,env:{...process.env,VESSEL_URL:`http://127.0.0.1:${port}`,VESSEL_CONTROLLER_TOKEN:controllerToken},stdio:['ignore',fd,fd]});fs.closeSync(fd);agentProcess=proc;
 proc.on('error',e=>{if(agentProcess===proc){agentProcess=null;controllerToken=null;agent={...agent,running:false,phase:'error',error:e.message};broadcast();}});
 proc.on('exit',(code,signal)=>{if(agentProcess===proc){agentProcess=null;controllerToken=null;if(agent.running)agent={...agent,running:false,phase:agent.phase==='stopping'?'stopped':'error',exitCode:code,signal};broadcast();}});
 broadcast();
}
reset();
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host&&!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host))return json(res,403,{error:'Localhost only'});
  if(req.method==='POST'&&req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return json(res,403,{error:'Origin not allowed'});
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});sockets.add(res);req.on('close',()=>sockets.delete(res));broadcast();return;}
  if(url.pathname==='/api/state')return json(res,200,{state:sim.snapshot(),session:id,agent});
  if(url.pathname==='/api/observe')return json(res,200,sim.observe());
  if(url.pathname==='/api/session')return json(res,200,{id,log});
  if(req.method==='GET'&&url.pathname==='/api/frame')return json(res,200,frames.get(Number(url.searchParams.get('revision')))||null);
  if(req.method==='POST'){
   const b=await body(req);
   if(url.pathname==='/api/replay/start'){
    if(agent.running||agentProcess)throw Error('Stop the current run before replay');
    const dir=path.join(root,'sessions');
    const dirs=[dir,path.join(root,'evidence','suture'),path.join(root,'evidence','loop')];
    const files=dirs.filter(d=>fs.existsSync(d)).flatMap(d=>fs.readdirSync(d).filter(f=>f.endsWith('-agent.jsonl')).map(f=>path.join(d,f))).sort((a,b)=>path.basename(b).localeCompare(path.basename(a)));
    const latest=files.find(f=>fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(JSON.parse).some(e=>e.type==='verification'));
    const recording=b.recording?path.resolve(b.recording):(latest?latest.replace('-agent.jsonl','.jsonl'):path.join(root,'examples','astra-suture-42.jsonl'));
    if(!fs.existsSync(recording))throw Error('No completed model run is available to replay');
    launchController('replay.mjs',[recording],path.join(dir,'replay-process.log'),'replay');
    return json(res,200,{started:true,mode:'recorded replay',file:path.basename(recording)});
   }
   if(url.pathname==='/api/agent/start'){
    if(agent.running||agentProcess)throw Error('An agent is already running');
    if(['completed','failed'].includes(sim.status))throw Error('This episode has ended. Reset the scene before starting a controller run.');
    if(!frames.has(sim.revision)||Date.now()-frames.get(sim.revision).receivedAt>5000)throw Error('Open Godot and wait for a fresh rendered frame first');
    if(!['loop','suture'].includes(b.task))throw Error('Unknown experiment');
    launchController('agent.mjs',b.task==='loop'?['--loop']:[],path.join(root,'sessions',id+'-process.log'),b.task);
    broadcast();return json(res,200,{started:true,task:b.task});
   }
   if(url.pathname==='/api/agent/stop'){return json(res,200,{stopping:stopController()});}
   if(url.pathname==='/api/frame'){
    if(typeof b.image!=='string'||!b.image.startsWith('data:image/jpeg;base64,')||b.revision!==sim.revision||b.session!==id)throw Error('Invalid or stale frame');
    const frame={receivedAt:Date.now(),revision:b.revision,session:id,engine:b.engine,image:b.image,uiImage:b.uiImage,hash:crypto.createHash('sha256').update(b.image).digest('hex')};frames.set(b.revision,frame);for(const k of frames.keys())if(k<sim.revision-2)frames.delete(k);return json(res,200,{ok:true});
   }
   if(url.pathname==='/api/reset'){if((agent.running||agentProcess)&&!(agent.task==='replay'&&authorizedController(req)))throw Error('Stop agent before resetting');reset(Number(b.seed??42));broadcast();return json(res,200,sim.observe());}
   if(url.pathname==='/api/agent/status'){if(!authorizedController(req))throw Error('Controller lease is not active');agent={...agent,...b};record('agent_status',b);broadcast();return json(res,200,{ok:true});}
   if(url.pathname==='/api/step'||url.pathname==='/api/cut'||url.pathname==='/api/finish'){
    if(['gpt-6-astra','replay'].includes(b.source)&&!authorizedController(req))throw Error('Controller lease is not active');
    if(agent.running&&b.source!==(agent.task==='replay'?'replay':'gpt-6-astra'))throw Error('Manual controls locked during agent run');
    if(typeof b.commandId!=='string')throw Error('commandId required');
    if(seen.has(b.commandId))return json(res,200,seen.get(b.commandId));
    const before=sim.snapshot();let result;
    try{result=url.pathname==='/api/step'?sim.step(b.action):url.pathname==='/api/cut'?sim.cutThread():sim.finish();}
    catch(e){record('rejected_action',{source:b.source??'manual',command:b,error:e.message});return json(res,400,{error:e.message,observation:sim.observe()});}
    record('action',{source:b.source??'manual',command:b,previousRevision:before.revision,result,state:sim.snapshot()});seen.set(b.commandId,result);broadcast();return json(res,200,result);
   }
   return json(res,404,{error:'Not found'});
  }
  let rel=url.pathname==='/'?'public/index.html':'public/'+url.pathname.slice(1);
  const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'Not found'});
  const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
 }catch(e){json(res,400,{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Vessel Lab running at http://127.0.0.1:${port}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopController();server.close();setTimeout(()=>process.exit(0),2200).unref();});
