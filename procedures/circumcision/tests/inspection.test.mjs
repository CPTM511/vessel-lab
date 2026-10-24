import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';

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
  const freshState=await fetch(base+'/api/state').then(r=>r.json());
  const reset=await fetch(base+'/api/mechanics/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:freshState.session,revision:freshState.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test',seed:11})}).then(r=>r.json());
  const noFrame=await fetch(base+'/api/step',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:reset.session,revision:reset.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test',action:{revision:0,duration:.05,left:{jaw:0}}})});
  assert.equal(noFrame.status,409);assert.match((await noFrame.json()).error,/Fresh actual Godot frame/);
  assert.equal((await fetch(base+'/api/state').then(r=>r.json())).mechanics.revision,0);
  assert.equal((await post({session:reset.session,revision:reset.revision,commandId:crypto.randomUUID(),source:'scripted-inspection-test',retraction:1})).status,409);
  // A prerecorded JPEG is a transport test fixture only, never live evidence.
  const image='data:image/jpeg;base64,'+fs.readFileSync(new URL('fixtures/inspection.jpg',import.meta.url)).toString('base64');
  assert.equal(reset.controlSource,'scripted-mechanics-test');
  const frame={controlSource:'scripted-mechanics-test',session:reset.session,revision:reset.revision,mechanicsRevision:0,cutFaceCount:0,activeAttachments:0,assessmentPassed:false,mechanicsEnabled:true,mode:'covered',retraction:0,renderer:'forward_plus',image,uiImage:image};
  const upload=body=>fetch(base+'/api/frame',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await upload({...frame,controlSource:'manual-mechanics'})).status,409);
  assert.equal((await upload({...frame,cutFaceCount:1})).status,409);
  assert.equal((await upload({...frame,image:'data:image/jpeg;base64,AAAA'})).status,400);
  assert.equal((await upload({...frame,activeAttachments:1})).status,409);
  assert.equal((await upload({...frame,assessmentPassed:true})).status,409);
  assert.equal((await upload(frame)).status,200);
  const finish=await fetch(base+'/api/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:reset.session,revision:reset.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test'})});
  assert.equal(finish.status,400);assert.match((await finish.json()).error,/C0 gates unmet/);
  assert.equal((await fetch(base+'/api/state').then(r=>r.json())).mechanics.revision,0);
  await new Promise(r=>setTimeout(r,5100));
  const stale=await fetch(base+'/api/step',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:reset.session,revision:reset.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test',action:{revision:0,duration:.05,left:{jaw:0}}})});
  assert.equal(stale.status,409);assert.match((await stale.json()).error,/Fresh actual Godot frame/);
  assert.equal((await fetch(base+'/api/state').then(r=>r.json())).mechanics.revision,0);
 }finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});
 }
});
