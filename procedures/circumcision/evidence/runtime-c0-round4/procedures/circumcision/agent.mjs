import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {MODEL,toolsForTask,instructions,prompts} from './controller-spec.mjs';
import {sourceManifest,sha256} from './manifest.mjs';
import {OrdinaryUsageGuard} from './ordinary-guard.mjs';
import {hostState} from '../../host-state.mjs';
const root=import.meta.dirname,base=process.env.ANATOMY_URL||'http://127.0.0.1:8785',task=process.argv[2];
const tools=toolsForTask(task);
const token=process.env.ANATOMY_CONTROLLER_TOKEN,runDir=process.env.ANATOMY_RUN_DIR,episode=process.env.ANATOMY_EPISODE;
const installed='/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
const executable=process.env.CODEX_BIN||(fs.existsSync(installed)?installed:'codex');
const env={...process.env};for(const k of ['OPENAI_API_KEY','OPENAI_BASE_URL','OPENAI_ORG_ID','OPENAI_PROJECT_ID'])delete env[k];
const allowance=new OrdinaryUsageGuard();let child,session,finished=false,next=0,toolCount=0,moves=0,images=0;
const pending=new Map();let resolveDone,rejectDone;const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});done.catch(()=>{});
function save(type,data={}){if(runDir)fs.appendFileSync(path.join(runDir,'agent.jsonl'),JSON.stringify({type,at:new Date().toISOString(),...data})+'\n');}
async function api(route,body){
 const r=await fetch(base+route,{signal:AbortSignal.timeout(12000),method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-anatomy-controller-token':token||''},body:body?JSON.stringify({session,...body}):undefined});
 const value=await r.json();if(!r.ok){const e=Error(value.error||String(r.status));e.status=r.status;throw e;}return value;
}
const status=update=>api('/api/agent/status',update);
function rpc(method,params){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},90000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,params})+'\n');});}
function reply(id,result){if(!finished&&child?.stdin.writable)child.stdin.write(JSON.stringify({id,result})+'\n');}
async function guard(){const checked=allowance.check(await rpc('account/rateLimits/read',{}));save('allowance_check',checked);return checked;}
function active(s){if(finished||s.episode!==episode||s.session!==session)throw Error('Controller episode is no longer active');}
async function rendered(s,after=0){
 const deadline=after?after+5000:Date.now()+5000;
 while(!finished&&Date.now()<deadline){
  let f;try{f=await api('/api/frame');}catch(e){if(e.status!==503)throw e;}
  if(f&&Date.now()<=deadline&&f.mechanicsEnabled&&f.session===s.session&&f.revision===s.revision&&f.mechanicsRevision===s.mechanics.revision&&f.cutFaceCount===s.mechanics.metrics.cutFaceCount&&f.activeAttachments===s.mechanics.metrics.activeAttachments&&f.assessmentPassed===s.mechanics.assessment.passed&&f.controlSource===MODEL&&f.seed===s.mechanics.seed&&Math.abs(f.anatomyScale-s.mechanics.scale)<1e-6&&f.receivedAt>=after&&Date.now()-f.receivedAt<5000)return f;
  await new Promise(r=>setTimeout(r,80));
 }
 throw Error('Fresh actual Godot observation unavailable; controller stopped');
}
async function shutdown(error){
 if(finished)return;finished=true;
 if(error){save('error',{error});rejectDone(Error(error));}
 try{await status({phase:error?'error':'done',error:error||null,toolCount,moves,images});}catch{}
 child?.kill('SIGTERM');if(child){const proc=child;setTimeout(()=>{if(proc.exitCode===null)proc.kill('SIGKILL');},2000).unref();}
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Controller closed'));}pending.clear();
}
function fatal(message){process.exitCode=1;void shutdown(message);}
async function handleTool(message){
 const {tool,arguments:args,callId,namespace}=message.params;let before,output,accepted=false,guardPassed=false,commandStarted=0;
 const beforeHost=hostState(),started=Date.now();toolCount++;
 save('model_tool_request',{model:MODEL,namespace,tool,args,callId});
 try{
  if(namespace!=='anatomy'||!['observe','geometry','inspect','step','finish'].includes(tool))throw Error('Unsupported controller tool');
  await guard();guardPassed=true;before=await api('/api/observe');active(before);await rendered(before);active(before);
  const command={session,revision:before.revision,source:MODEL,commandId:callId};
  if(['step','inspect','finish'].includes(tool))commandStarted=Date.now();
  if(tool==='observe')output=before.mechanics;
  else if(tool==='geometry')output=await api('/api/geometry',{...command,query:args});
  else if(tool==='inspect')output=await api('/api/inspect',{...command,mode:args.mode});
  else output=await api(tool==='finish'?'/api/finish':'/api/step',{...command,...(tool==='step'?{action:args}:{})});
  accepted=['step','inspect','finish'].includes(tool);
  if(accepted){save('accepted_command',{tool,args,callId,beforeRevision:before.revision,commandStartedAt:commandStarted,result:output});if(tool==='step')moves++;}
  const current=await api('/api/state');active(current);const f=await rendered(current,commandStarted);active(current);
  const filename=`frame-${String(toolCount).padStart(5,'0')}.jpg`;fs.writeFileSync(path.join(runDir,filename),Buffer.from(f.image.split(',')[1],'base64'));images++;
  const geometryHash=sha256(JSON.stringify(current.mechanics.positions)),topologyHash=sha256(JSON.stringify({faces:current.mechanics.faces,componentOf:current.mechanics.componentOf,targetMask:current.mechanics.targetMask}));
  const observation={...(tool==='geometry'?{geometry:output}:{}),observation:structuredClone(current.mechanics)};
  // The returned ordinary observation omits the full mesh; geometry is explicitly queried.
  for(const field of ['positions','faces','componentOf','targetMask','woundPairNodes'])delete observation.observation[field];
  save('tool_result',{model:MODEL,tool,args,callId,success:true,beforeRevision:before.revision,afterRevision:current.revision,output:observation,geometryHash,topologyHash,frame:{filename,imageHash:f.imageHash,revision:f.revision,mechanicsRevision:f.mechanicsRevision,seed:f.seed,anatomyScale:f.anatomyScale,renderer:f.renderer,driver:f.driver,receivedAt:f.receivedAt},beforeHost,afterHost:hostState(),latencyMs:Date.now()-started,commandToFrameMs:commandStarted?f.receivedAt-commandStarted:null});
  await status({phase:'observing',toolCount,moves,images});
  reply(message.id,{contentItems:[{type:'inputText',text:JSON.stringify(observation)},{type:'inputImage',imageUrl:f.image}],success:true});
 }catch(e){
  save('tool_error',{tool,args,callId,accepted,error:e.message,beforeRevision:before?.revision});
  const fatalError=finished||accepted||!guardPassed||/allowance|Credit state|observation unavailable|episode is no longer|lease is not active|Unsupported controller/.test(e.message);
  if(fatalError){reply(message.id,{contentItems:[{type:'inputText',text:JSON.stringify({error:e.message})}],success:false});await shutdown(e.message);return;}
  try{
   const current=await api('/api/observe');active(current);const f=await rendered(current),filename=`error-${String(toolCount).padStart(5,'0')}.jpg`;
   fs.writeFileSync(path.join(runDir,filename),Buffer.from(f.image.split(',')[1],'base64'));images++;
   const out={error:e.message,observation:current.mechanics};save('rejected_observation',{callId,output:out,frame:{filename,imageHash:f.imageHash,revision:f.revision,mechanicsRevision:f.mechanicsRevision,seed:f.seed,anatomyScale:f.anatomyScale}});
   reply(message.id,{contentItems:[{type:'inputText',text:JSON.stringify(out)},{type:'inputImage',imageUrl:f.image}],success:false});
  }catch(problem){await shutdown(problem.message);}
 }
}
async function main(){
 if(!token||!runDir||!episode||!prompts[task])throw Error('Start the controller through the local Godot service');
 const current=await api('/api/observe');session=current.session;active(current);
 save('configuration',{kind:process.env.ANATOMY_PROTOCOL_TEST==='1'?'protocol test double; no model inference':'live controller attempt',model:MODEL,task,episode,seed:current.mechanics.seed,scenario:current.mechanics.scenario,source:sourceManifest(),instructionsHash:sha256(instructions),toolsHash:sha256(JSON.stringify(tools)),promptHash:sha256(prompts[task]),node:process.version,reasoning:'Inherited without an effort override',host:hostState()});
 await rendered(current);await status({phase:'checking access',toolCount,moves,images});
 child=spawn(executable,['app-server','--listen','stdio://','-c','forced_login_method="chatgpt"'],{cwd:root,env,stdio:['pipe','pipe','pipe']});
 child.on('error',e=>fatal(e.message));child.stderr.on('data',()=>{});
 let queue=Promise.resolve();
 readline.createInterface({input:child.stdout}).on('line',line=>{
  let m;try{m=JSON.parse(line);}catch{return;}
  if(m.id!==undefined&&!m.method&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);return;}
  if(m.method==='item/tool/call'){queue=queue.then(()=>handleTool(m)).catch(e=>fatal(e.message));return;}
  if(m.id!==undefined&&m.method){save('unexpected_request',{method:m.method});if(child.stdin.writable)child.stdin.write(JSON.stringify({id:m.id,error:{code:-32601,message:'Only anatomy tools are authorized'}})+'\n');fatal('Unexpected app-server request: '+m.method);return;}
  if(m.method==='item/started'&&['commandExecution','fileChange','mcpToolCall','webSearch','collabAgentToolCall'].includes(m.params.item?.type)){fatal('Unexpected non-simulation tool: '+m.params.item.type);return;}
  if(m.method==='item/completed'&&m.params.item?.type==='agentMessage')save('model_message',{text:m.params.item.text});
  if(m.method==='turn/completed'){save('turn_completed',{turn:m.params.turn});m.params.turn.status==='completed'?resolveDone(m.params.turn):rejectDone(Error(JSON.stringify(m.params.turn.error||m.params.turn)));}
  if(m.method==='error')save('runtime_error',{error:m.params});
 });
 child.on('exit',code=>{if(!finished)rejectDone(Error('Codex app-server exited '+code));});
 await rpc('initialize',{clientInfo:{name:'vessel_lab_adult',title:'Vessel Lab Adult Research',version:'0.1.0'},capabilities:{experimentalApi:true}});child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
 const account=await rpc('account/read',{refreshToken:false});if(account.account?.type!=='chatgpt')throw Error('A local ChatGPT login is required; API authentication is disabled');
 save('access_preflight',{accountType:account.account.type,allowance:await guard()});
 const started=await rpc('thread/start',{model:MODEL,modelProvider:'openai',allowProviderModelFallback:false,ephemeral:true,cwd:root,environments:[],selectedCapabilityRoots:[],sandbox:'read-only',baseInstructions:instructions,developerInstructions:'Only the anatomy dynamic tools are authorized. No software work, external services, delegation, scripted trajectory or human intervention is available during this experiment.',dynamicTools:tools});
 save('model_session',{requestedModel:MODEL,model:started.model,modelProvider:started.modelProvider,reasoningEffort:started.reasoningEffort??null,threadId:started.thread.id,ephemeral:true});
 if(started.model!==MODEL||started.modelProvider!=='openai')throw Error('Requested model or provider mismatch; refusing fallback');
 await status({phase:'running',reasoningEffort:started.reasoningEffort??null});await guard();
 const turn=await rpc('turn/start',{threadId:started.thread.id,input:[{type:'text',text:prompts[task]}],environments:[]});save('turn_started',{turnId:turn.turn.id});
 await done;await queue;const post=await guard(),end=await api('/api/observe');active(end);save('verification',{model:MODEL,task,toolCount,moves,images,allowance:post,state:end.mechanics});await shutdown();
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void shutdown('Stopped by user');});
main().catch(e=>{process.exitCode=1;void shutdown(e.message);});
