import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';

// Transport-only tests: no model calls and no renderer evidence are produced here.
test('inspection state is atomic, revisioned, idempotent and origin restricted',async()=>{
 const port=18785,base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['inspector.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,ANATOMY_PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let output='';child.stderr.on('data',d=>output+=d);
 try{
  let state;
  for(let i=0;i<40;i++){try{state=await fetch(base+'/api/state').then(r=>r.json());break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert.ok(state,output||'Inspection service did not start');
  const post=async(body,origin)=>{const r=await fetch(base+'/api/inspect',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  const command={session:state.session,revision:0,commandId:crypto.randomUUID(),source:'scripted-inspection-test',mode:'retracted',retraction:1};
  assert.equal((await fetch(base+'/api/frame')).status,503);
  assert.equal((await post({...command,session:'stale'})).status,409);
  assert.equal((await post({...command,retraction:2})).status,400);
  assert.equal((await post({...command,mode:'invented'})).status,400);
  assert.equal((await post(command,'https://example.invalid')).status,403);
  assert.equal((await fetch(base+'/api/state').then(r=>r.json())).revision,0);
  const first=await post(command);assert.equal(first.status,200);assert.equal(first.body.revision,1);
  assert.deepEqual(await post(command),first);
  assert.equal((await post({...command,retraction:0})).status,409);
  assert.equal((await post({...command,commandId:crypto.randomUUID()})).status,409);
  assert.equal((await fetch(base+'/api/state').then(r=>r.json())).revision,1);
  const badFrame=await fetch(base+'/api/frame',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:state.session,revision:0})});
  assert.equal(badFrame.status,409);
  assert.equal((await fetch(base+'/api/frame')).status,503);
 }finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});
 }
});
