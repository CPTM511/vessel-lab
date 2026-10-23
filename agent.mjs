import {spawn} from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {sourceManifest,sha256} from './manifest.mjs';
import {hostState} from './host-state.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const base=process.env.VESSEL_URL||'http://127.0.0.1:8765';
const task=process.argv.includes('--loop')?'loop':'suture';
const MODEL='gpt-6-astra';
let child,threadId,turnId,finished=false;
const env={...process.env};for(const k of ['OPENAI_API_KEY','OPENAI_BASE_URL','OPENAI_ORG_ID','OPENAI_PROJECT_ID'])delete env[k];
const local='/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
const executable=process.env.CODEX_BIN||(fs.existsSync(local)?local:'codex');
const evidence=[];let evidencePath;
function save(type,data){const e={type,at:new Date().toISOString(),...data};evidence.push(e);if(evidencePath)fs.appendFileSync(evidencePath,JSON.stringify(e)+'\n');}
async function api(url,body){const r=await fetch(base+url,body?{signal:AbortSignal.timeout(5000),method:'POST',headers:{'Content-Type':'application/json','x-vessel-controller-token':process.env.VESSEL_CONTROLLER_TOKEN||''},body:JSON.stringify(body)}:{signal:AbortSignal.timeout(5000)});const j=await r.json();if(!r.ok)throw Error(j.error||r.status);return j;}
async function status(s){await api('/api/agent/status',s);}
async function frame(revision){for(let i=0;i<80;i++){const f=await api('/api/frame?revision='+revision);if(f&&f.session===session&&f.engine?.startsWith('Godot')&&Date.now()-f.receivedAt<5000)return f;await new Promise(r=>setTimeout(r,100));}throw Error('No rendered Godot camera frame. Open Godot before running the visual agent.');}
let next=0;const pending=new Map();
function rpc(method,params){return new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},90000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,params})+'\n');});}
function reply(id,result){if(finished||!child?.stdin.writable)return;child.stdin.write(JSON.stringify({id,result})+'\n');}
function safeAccount(a){return {type:a?.type,plan:a?.planType};}
let initialCredits;
async function guard(){
 const r=await rpc('account/rateLimits/read',{});
 const buckets=r.rateLimitsByLimitId?Object.values(r.rateLimitsByLimitId):[r.rateLimits];
 const windows=buckets.filter(Boolean).flatMap(b=>[b.primary,b.secondary]).filter(Boolean);
 if(r.ordinaryUsageAllowed!==true||!windows.length||windows.some(w=>w.usedPercent>=95))throw Error('Subscription-only guard: ordinary allowance unavailable or near its limit. No credit/API fallback.');
 const balance=r.rateLimits?.credits?.balance;
 if(initialCredits===undefined)initialCredits=balance;
 if(initialCredits!==undefined&&balance!==initialCredits)throw Error('Credit balance changed: pausing for inspection. No additional run will start.');
 return {ordinaryUsageAllowed:r.ordinaryUsageAllowed,windows:windows.map(w=>({usedPercent:w.usedPercent,windowDurationMins:w.windowDurationMins})),creditBalanceUnchanged:balance===initialCredits};
}
const armSchema={type:'object',properties:{position:{type:'array',items:{type:'number'},minItems:3,maxItems:3},jaw:{type:'number',minimum:0,maximum:1}},additionalProperties:false};
const tools=[{type:'namespace',name:'vessel',description:'The only control interface for a local, nonclinical digital vessel suturing benchmark.',tools:[
 {type:'function',name:'observe',description:'Read the actual rendered camera image plus proprioception and explicitly instrumented contact events. Observe again after an action to close the feedback loop.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {type:'function',name:'step',description:'Choose the next bounded movement of either or both robot end effectors. Absolute xyz coordinates in mm, maximum movement 3 mm per arm per call. Jaw 0=closed, 1=open. The engine only interpolates this chosen movement, computes contacts, and solves constraints. duration 0.05–1 simulated seconds. Supply current revision to reject stale commands.',inputSchema:{type:'object',properties:{revision:{type:'integer'},left:armSchema,right:armSchema,duration:{type:'number',minimum:.05,maximum:1}},required:['revision','duration'],additionalProperties:false}},
 {type:'function',name:'cut',description:'Actuate the fixed bench cutter. The needle-side thread must physically be within 1 mm of the cutter and the knot must be secured. No arm movement is performed by this tool.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {type:'function',name:'finish',description:'End this episode and run the independent five-second release/closure test. All tools must be released. Calling this ends the episode even if it fails.',inputSchema:{type:'object',properties:{},additionalProperties:false}}
]}];
let toolCount=0,moves=0,images=0;
async function handleTool(m){
 const {tool,arguments:args,callId,namespace}=m.params;
 try{
  if(namespace&&namespace!=='vessel')throw Error('Unsupported namespace');
  if(finished)throw Error('Controller stopped');
  await guard();if(finished)throw Error('Controller stopped');toolCount++;
  const before=await api('/api/observe');await frame(before.revision);if(finished)throw Error('Controller stopped');let out;
  if(tool==='observe')out=before;
  else if(tool==='step'){out=await api('/api/step',{commandId:callId,source:MODEL,action:args});moves++;}
  else if(tool==='cut')out=await api('/api/cut',{commandId:callId,source:MODEL});
  else if(tool==='finish')out=await api('/api/finish',{commandId:callId,source:MODEL});
  else throw Error('Tool is not allowed');
  const now=await api('/api/observe'),f=await frame(now.revision);images++;
  const imgFile=path.join(root,'sessions',`${session}-${String(toolCount).padStart(3,'0')}.jpg`);
  fs.writeFileSync(imgFile,Buffer.from(f.image.split(',')[1],'base64'));
  save('tool',{model:MODEL,tool,args,callId,beforeRevision:before.revision,afterRevision:now.revision,output:out,engine:f.engine,frameHash:f.hash,frameFile:path.basename(imgFile),frameReceivedAt:f.receivedAt,host:hostState()});
  console.log(JSON.stringify({tool,revision:now.revision,bridges:now.instrumentation.bridgeCount,task}));
  await status({running:true,phase:'observing',model:MODEL,task,toolCount,moves,images});
  reply(m.id,{contentItems:[{type:'inputText',text:JSON.stringify(out)},{type:'inputImage',imageUrl:f.image}],success:true});
 }catch(e){save('tool_error',{tool,args,error:e.message});reply(m.id,{contentItems:[{type:'inputText',text:JSON.stringify({error:e.message})}],success:false});
  if(/Subscription-only|Credit balance|No rendered/.test(e.message)){await shutdown(e.message);}
 }
}
let session;
async function shutdown(error){
 if(finished)return;finished=true;
 if(error)save('error',{error});
 try{await status({running:false,phase:error?'error':'done',error:error||null,model:MODEL,task,toolCount,moves,images});}catch{}
 child?.kill();
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Controller closed'));}pending.clear();
}
async function main(){
 if(!process.env.VESSEL_CONTROLLER_TOKEN)throw Error('Start the controller through the local service or npm run agent.');
 const current=await api('/api/state');session=current.session;
 evidencePath=path.join(root,'sessions',session+'-agent.jsonl');
 save('configuration',{model:MODEL,task,seed:current.state.seed??null,source:sourceManifest(),node:process.version,reasoning:'inherited from local Codex configuration',host:hostState()});
 await frame(current.state.revision);
 await status({running:true,phase:'checking subscription',model:MODEL,task,toolCount:0,moves:0});
 child=spawn(executable,['app-server','--listen','stdio://','-c','forced_login_method="chatgpt"'],{cwd:root,env,stdio:['pipe','pipe','pipe']});
 child.on('error',e=>shutdown(e.message));
 child.stderr.on('data',()=>{});
 const done=new Promise((resolve,reject)=>{
  let toolQueue=Promise.resolve();
  readline.createInterface({input:child.stdout}).on('line',line=>{
   let m;try{m=JSON.parse(line)}catch{return;}
   if(m.id!==undefined&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);return;}
   if(m.method==='item/tool/call'){toolQueue=toolQueue.then(()=>handleTool(m)).catch(reject);return;}
   if(m.id!==undefined&&m.method){reply(m.id,{decision:'decline'});save('unexpected_request',{method:m.method});return;}
   if(m.method==='item/agentMessage/delta')process.stdout.write(m.params.delta||'');
   if(m.method==='item/completed'&&m.params.item?.type==='agentMessage')save('message',{text:m.params.item.text});
   if(m.method==='turn/completed'){save('turn_completed',{turn:m.params.turn});m.params.turn.status==='completed'?resolve(m.params.turn):reject(Error(JSON.stringify(m.params.turn.error||m.params.turn)));}
   if(m.method==='error')save('runtime_error',{error:m.params});
  });
  child.on('exit',code=>{if(!finished)reject(Error('Codex app-server exited '+code));});
 });
 done.catch(()=>{});
 await rpc('initialize',{clientInfo:{name:'vessel_lab',title:'Vessel Lab',version:'0.1.0'},capabilities:{experimentalApi:true}});
 child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
 const account=await rpc('account/read',{refreshToken:false});if(account.account?.type!=='chatgpt')throw Error('Only ChatGPT subscription login is accepted. Run codex login; no API keys are accepted.');
 save('subscription_preflight',{account:safeAccount(account.account),allowance:await guard(),requestedModel:MODEL});
 const instructions=`You are a controller for a local synthetic robotics simulation, NOT a medical advisor. Write all visible narration and final reports in English. Use only vessel namespace tools. Do not use shell, code execution, file tools, web, or delegation. You must choose every movement yourself and inspect returned images/state. No hidden trajectory generator exists. State is explicitly instrumented (not a vision-only benchmark). Distances are mm. Tissue is a fixture-supported annular-lip approximation; a needle tip sweeping across either moving lip plane at radial distance close to the tube radius creates a puncture. Consecutive punctures on opposite lips at similar angular position produce a slack thread bridge, not automatic closure. Thread tail can be held by moving an open jaw into contact and closing it. With needle and tail held by opposite hands, withdrawing the tail consumes bridge slack. A geometric knot is recognized after the held tail winds nearly one full revolution around the needle in the y-z plane at radius 0.5–3 mm with axial separation <2 mm, followed by tightening. This is a disclosed simplified rule, not real knot mechanics. Unsupported/unsecured thread slips after release. No automatic complete-suture command is available. The cutter is fixed and must be reached physically. Instrumented closure metrics are available after each step. Independent terminal checks require at least 95% of the 24 circumferential sample gaps to be <= 10% of radius, secured knot, trimmed thread, released tools and damage <0.2. Closure at only the punctured locations may leave gaps elsewhere. No more punctures are added after a secured knot. Do not tie until closure metrics are sufficient. Needle has a fixed orientation in this prototype and tools are kinematic xyz+jaw controls. Do not claim clinical validity. Current coordinate calibration and sensors appear in observe. You control the experiment and should choose your own trajectory using feedback. Do not finish until you intend to end the episode.`;
 const started=await rpc('thread/start',{model:MODEL,allowProviderModelFallback:false,cwd:root,ephemeral:true,environments:[],sandbox:'read-only',baseInstructions:instructions,developerInstructions:'Only the vessel tools are authorized. Do not perform software engineering or contact any service. There are no human interventions during the episode.',dynamicTools:tools});
 save('controller_configuration',{instructionsHash:sha256(instructions),toolsHash:sha256(JSON.stringify(tools)),effectiveReasoningEffort:started.reasoningEffort??null});
 threadId=started.thread.id;save('model_session',{model:started.model,modelProvider:started.modelProvider,threadId,ephemeral:true});
 if(started.model!==MODEL)throw Error('Requested model mismatch; refusing fallback');
 const prompt=task==='loop'?'Verify the real visual control loop. Call observe, then make at least two small, safe movements with the needle-holding arm, choosing the displacements based on the returned observation. Inspect the new observation/image after each. Avoid puncturing tissue in this connectivity test. Do not call finish. Report what actually changed, then end your turn.':'Complete the simplified vessel suturing benchmark from its current state using only your own low-level arm commands and feedback. Work around the circumference to achieve closure, secure the thread using the published geometric knot rule, trim at the bench cutter, release both tools, and call finish for independent evaluation. Observe first. If a command fails, diagnose and adjust rather than repeating unchanged. If you cannot finish, report the exact unfinished stage honestly.';
 save('task_configuration',{promptHash:sha256(prompt)});
 const turn=await rpc('turn/start',{threadId,input:[{type:'text',text:prompt}],environments:[]});turnId=turn.turn.id;
 await done;const allowance=await guard();save('verification',{requestedModel:MODEL,task,toolCount,moves,images,allowance,state:await api('/api/observe')});await shutdown();
}
process.on('SIGTERM',()=>shutdown('Stopped by user').then(()=>process.exit(0)));
process.on('SIGINT',()=>shutdown('Stopped by user').then(()=>process.exit(0)));
main().catch(async e=>{console.error(e.message);await shutdown(e.message);process.exitCode=1;});
