import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {spawn} from 'node:child_process';
import {isolatedRuntime} from './fixtures/isolated-runtime.mjs';
const root=path.resolve(import.meta.dirname,'..'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(check,ms=15000){const end=Date.now()+ms;while(Date.now()<end){if(await check())return;await pause(50);}throw Error('Timed out waiting for controller test condition');}
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
for(const [index,mode] of ['quota','api','wrong_model','wrong_provider','stop','loop','missing_after_action'].entries())test(`controller ${mode}: lease, access and rendered-feedback boundaries`,async()=>{
 const port=18800+index,base=`http://127.0.0.1:${port}`,dir=fs.mkdtempSync(path.join(os.tmpdir(),'adult-controller-test-')),record=path.join(dir,'mock.json');
 const fixture=isolatedRuntime();
 const child=spawn(process.execPath,['inspector.mjs'],{cwd:fixture.root,env:{...process.env,ANATOMY_PORT:String(port),CODEX_BIN:path.join(root,'tests/fixtures/mock-codex.mjs'),ANATOMY_TEST_MODE:mode,ANATOMY_TEST_RECORD:record,ANATOMY_PROTOCOL_TEST:'1'},stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);let pump,busy=false,mock;
 async function api(route,body,token){const r=await fetch(base+route,{signal:AbortSignal.timeout(1500),method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{'x-anatomy-controller-token':token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 const image='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'tests/fixtures/inspection.jpg')).toString('base64');
 // This prerecorded JPEG only tests transport. It is never real-render evidence.
 async function frame(s){return api('/api/frame',{session:s.session,revision:s.revision,controlSource:s.controlSource,mechanicsEnabled:s.mechanicsEnabled,mechanicsRevision:s.mechanics.revision,seed:s.mechanics.seed,anatomyScale:s.mechanics.scale,cutFaceCount:s.mechanics.metrics.cutFaceCount,activeAttachments:s.mechanics.metrics.activeAttachments,assessmentPassed:s.mechanics.assessment.passed,mode:s.mode,retraction:s.retraction,renderer:'forward_plus',image,uiImage:image});}
 try{
  await wait(async()=>{try{return (await api('/api/state')).status===200;}catch{return false;}});
  let s=(await api('/api/state')).data;
  s=(await api('/api/mechanics/reset',{session:s.session,revision:s.revision,commandId:crypto.randomUUID(),source:'manual-mechanics',seed:11})).data;
  assert.equal((await api('/api/agent/start',{session:s.session,revision:s.revision,task:'loop'})).status,409,'No frame rejects start');
  assert.equal((await frame(s)).status,200);
  assert.equal((await api('/api/agent/start',{session:s.session,revision:s.revision,task:'procedure'})).status,409,'Unfrozen procedure rejects start');
  const start=await api('/api/agent/start',{session:s.session,revision:s.revision,task:'loop'});assert.equal(start.status,200);s=start.data;
  assert.equal((await api('/api/agent/start',{session:s.session,revision:s.revision,task:'loop'})).status,409,'No overlapping controllers');
  assert.equal((await api('/api/mechanics/reset',{session:s.session,revision:s.revision,commandId:crypto.randomUUID(),source:'manual-mechanics',seed:29})).status,409);
  await frame(s);
  pump=setInterval(async()=>{if(busy)return;busy=true;try{const latest=(await api('/api/state')).data;if(mode!=='missing_after_action'||latest.mechanics.revision===0)await frame(latest);}catch{}finally{busy=false;}},120);
  await wait(()=>fs.existsSync(record));mock=JSON.parse(fs.readFileSync(record));
  if(mode==='stop'){
   await wait(()=>JSON.parse(fs.readFileSync(record)).requests.some(r=>r.method==='turn/start'));
   const current=(await api('/api/state')).data;
   assert.equal((await api('/api/step',{session:s.session,revision:current.revision,source:'manual-mechanics',commandId:'manual',action:{revision:0,duration:.02}})).status,409);
   for(const action of [{revision:0,duration:.02,left:{cut:true}},{revision:0,duration:.02,approximate:true},{revision:0,duration:.1}])assert.equal((await api('/api/step',{session:s.session,revision:current.revision,source:'gpt-6-astra',commandId:crypto.randomUUID(),action},mock.token)).status,400,'Connectivity lease rejects procedure operations');
   assert.equal((await api('/api/finish',{session:s.session,revision:current.revision,source:'gpt-6-astra',commandId:crypto.randomUUID()},mock.token)).status,400);
   await api('/api/agent/stop',{session:s.session});
   assert.equal((await api('/api/step',{session:s.session,revision:current.revision,source:'gpt-6-astra',commandId:'late',action:{revision:0,duration:.02}},mock.token)).status,409,'Stop immediately revokes the lease');
  }
  await wait(async()=>!(await api('/api/state')).data.agent.running,20000);await wait(()=>!alive(mock.pid));
  const end=(await api('/api/state')).data;assert.equal(end.mechanics.revision,mode==='loop'?2:mode==='missing_after_action'?1:0);
  const data=JSON.parse(fs.readFileSync(record)),thread=data.requests.find(r=>r.method==='thread/start');
  if(thread){assert.deepEqual(thread.params.environments,[]);assert.deepEqual(thread.params.selectedCapabilityRoots,[]);assert.equal(thread.params.allowProviderModelFallback,false);assert.equal(thread.params.model,'gpt-6-astra');assert.equal(thread.params.reasoningEffort,undefined);}
  if(['quota','api','wrong_model','wrong_provider'].includes(mode))assert.ok(!data.requests.some(r=>r.method==='turn/start'));
  const journal=fs.readFileSync(path.join(fixture.root,'sessions',end.agent.runId,'agent.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.match(journal[0].kind,/test double/);
  if(mode==='loop'){assert.equal(end.agent.phase,'done');assert.equal(data.responses.filter(r=>r.result?.contentItems.some(i=>i.type==='inputImage')).length,3);assert.equal(journal.filter(r=>r.type==='tool_result').length,3);assert.equal(journal.find(r=>r.type==='verification').moves,2);}
  if(mode==='missing_after_action'){assert.match(end.agent.error,/observation unavailable/);assert.equal(journal.filter(r=>r.type==='accepted_command').length,1);assert.equal(journal.filter(r=>r.type==='tool_result'&&r.tool==='step').length,0);}
  assert.equal((await api('/api/mechanics/reset',{session:s.session,revision:end.revision,source:'manual-mechanics',commandId:crypto.randomUUID(),seed:29})).status,200);
 }finally{
  clearInterval(pump);if(child.exitCode===null&&child.signalCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited;}if(mock&&alive(mock.pid))process.kill(mock.pid,'SIGKILL');fs.rmSync(dir,{recursive:true,force:true});fixture.cleanup();
 }
 assert.equal(errors,'');
});
