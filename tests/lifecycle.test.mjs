import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(check,ms=6000){const end=Date.now()+ms;while(Date.now()<end){if(await check())return;await pause(50);}throw Error('Timed out waiting for test condition');}
function alive(pid){try{process.kill(pid,0);return true;}catch{return false;}}
for(const [i,mode] of ['quota','stop'].entries())test(`controller ${mode}: fail closed without actions or orphan child`,async()=>{
 const port=18765+i,base=`http://127.0.0.1:${port}`,dir=fs.mkdtempSync(path.join(os.tmpdir(),'vessel-lifecycle-')),record=path.join(dir,'child.json');
 const proc=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),CODEX_BIN:path.join(root,'tests/fixtures/mock-codex.mjs'),VESSEL_TEST_MODE:mode,VESSEL_TEST_RECORD:record},stdio:'pipe'});let logs='';proc.stderr.on('data',d=>logs+=d);
 async function api(p,b){const r=await fetch(base+p,{method:b?'POST':'GET',headers:{'content-type':'application/json'},body:b?JSON.stringify(b):undefined,signal:AbortSignal.timeout(1000)});return {status:r.status,data:await r.json()};}
 let child;
 try{
  await wait(async()=>{try{return (await api('/api/state')).status===200;}catch{return false;}});
  assert.equal((await api('/api/agent/start',{task:'loop'})).status,400,'No renderer must reject start');
  const state=(await api('/api/state')).data;
  const putFrame=()=>api('/api/frame',{session:state.session,revision:0,engine:'Godot TEST DOUBLE',image:'data:image/jpeg;base64,dGVzdA=='});
  await putFrame();
  if(mode==='stop'){await pause(5100);assert.equal((await api('/api/agent/start',{task:'loop'})).status,400,'Expired renderer must reject start');await putFrame();}
  assert.equal((await api('/api/agent/start',{task:'loop'})).status,200);
  await wait(()=>fs.existsSync(record));child=JSON.parse(fs.readFileSync(record));
  if(mode==='stop'){
   await wait(()=>fs.readFileSync(path.join(root,'sessions',state.session+'-agent.jsonl'),'utf8').includes('model_session'));
   await api('/api/agent/stop',{});
   const late=await fetch(base+'/api/step',{method:'POST',headers:{'content-type':'application/json','x-vessel-controller-token':child.token},body:JSON.stringify({source:'gpt-6-astra',commandId:crypto.randomUUID(),action:{revision:0,duration:.1}})});
   assert.equal(late.status,400,'Stop must immediately revoke action authority');
  }
  await wait(async()=>!(await api('/api/state')).data.agent.running);
  await wait(()=>!alive(child.pid));
  const end=(await api('/api/state')).data;assert.equal(end.state.revision,0);
  if(mode==='quota')assert.match(end.agent.error,/ordinary allowance/);
  assert.equal((await api('/api/reset',{seed:7})).status,200);
 }finally{
  proc.kill('SIGTERM');await new Promise(r=>proc.once('exit',r));
  if(child&&alive(child.pid))process.kill(child.pid,'SIGKILL');
  fs.rmSync(dir,{recursive:true,force:true});
 }
 assert.equal(logs,'');
});
