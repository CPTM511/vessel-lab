import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(check){for(let i=0;i<300;i++){if(await check())return;await pause(50);}throw Error('Playback test timeout');}
for(const [i,mode] of ['complete','missing','stop'].entries())test('playback '+mode+' preserves source labels, exclusivity and frame requirements',async()=>{
 const port=18830+i,base='http://127.0.0.1:'+port,child=spawn(process.execPath,['inspector.mjs'],{cwd:root,env:{...process.env,ANATOMY_PORT:String(port),ANATOMY_PROTOCOL_TEST:'1',CODEX_BIN:'/no-model-may-run-in-playback'},stdio:['ignore','ignore','pipe']});let errors='',pump,busy=false;child.stderr.on('data',d=>errors+=d);
 async function api(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 const image='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'tests/fixtures/inspection.jpg')).toString('base64');
 async function frame(s){return api('/api/frame',{session:s.session,revision:s.revision,controlSource:s.controlSource,mechanicsEnabled:s.mechanicsEnabled,mechanicsRevision:s.mechanics?.revision,seed:s.mechanics?.seed,anatomyScale:s.mechanics?.scale,cutFaceCount:s.mechanics?.metrics.cutFaceCount,activeAttachments:s.mechanics?.metrics.activeAttachments,assessmentPassed:s.mechanics?.assessment.passed,mode:s.mode,retraction:s.retraction,renderer:'forward_plus',image,uiImage:image});}
 try{
  await wait(async()=>{try{return (await api('/api/state')).status===200;}catch{return false;}});let s=(await api('/api/state')).data;
  assert.equal((await api('/api/playback/start',{session:s.session,revision:s.revision})).status,409);await frame(s);
  const start=await api('/api/playback/start',{session:s.session,revision:s.revision});assert.equal(start.status,200);s=start.data;assert.equal(s.controlSource,'recorded-playback');assert.equal(s.agent.model,null);
  assert.equal((await api('/api/playback/start',{session:s.session,revision:s.revision})).status,409);assert.equal((await api('/api/agent/start',{session:s.session,revision:s.revision,task:'loop'})).status,409);
  assert.equal((await api('/api/mechanics/reset',{session:s.session,revision:s.revision,source:'manual-mechanics',commandId:'during-playback',seed:29})).status,409);
  if(mode==='stop')await api('/api/agent/stop',{session:s.session});else{
   await frame(s);pump=setInterval(async()=>{if(busy)return;busy=true;try{const v=(await api('/api/state')).data;if(mode!=='missing'||v.mechanics.revision===0)await frame(v);}catch{}finally{busy=false;}},100);
  }
  await wait(async()=>!(await api('/api/state')).data.agent.running);const end=(await api('/api/state')).data;
  assert.equal(end.mechanics.revision,mode==='complete'?2:mode==='missing'?1:0);assert.equal(end.controlSource,'recorded-playback');
  if(mode==='complete'){assert.equal(end.agent.phase,'done');const rows=fs.readFileSync(path.join(root,'sessions',end.agent.runId,'playback.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.match(rows[0].kind,/test double/);assert.equal(rows.filter(r=>r.type==='rendered_result').length,2);assert.equal(rows.at(-1).type,'verification');}
  if(mode==='missing')assert.match(end.agent.error,/playback frame unavailable/);
  assert.equal((await api('/api/mechanics/reset',{session:s.session,revision:end.revision,source:'manual-mechanics',commandId:'after-playback',seed:29})).status,200);
 }finally{clearInterval(pump);child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
 assert.equal(errors,'');
});
