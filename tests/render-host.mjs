// Scripted renderer probe. This is not a model or surgical evaluation.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {hostState} from '../host-state.mjs';
const locked=process.argv.includes('--locked'),count=Number(process.env.SAMPLES||40),base=process.env.VESSEL_URL||'http://127.0.0.1:8765';
const report={kind:'scripted Godot renderer probe',requiresLockedHost:locked,startedAt:new Date().toISOString(),samples:[],passed:false};
const file=new URL('../sessions/renderer-probe-'+Date.now()+'.json',import.meta.url);
fs.mkdirSync(new URL('../sessions/',import.meta.url),{recursive:true});
async function api(p,b){const r=await fetch(base+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined,signal:AbortSignal.timeout(4000)});const x=await r.json();if(!r.ok)throw Error(x.error);return x;}
try{
 const s=await api('/api/state');assert.equal(s.agent.running,false,'Stop the controller before this scripted test');
 await api('/api/reset',{seed:42});
 for(let i=0;i<count;i++){
  const before=hostState();if(locked){assert.equal(before.screenLocked,true);assert.equal(before.userSessionLocked,true);}
  const state=await api('/api/observe'),start=Date.now();
  await api('/api/step',{source:'scripted-render-test',commandId:crypto.randomUUID(),action:{revision:state.revision,right:{position:[2.8,3,i%2===0?.25:-.25]},duration:.05}});
  let frame;
  for(let n=0;n<100;n++){frame=await api('/api/frame?revision='+(state.revision+1));if(frame&&frame.receivedAt>=start)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(frame?.image&&frame.receivedAt>=start);
  const after=hostState();if(locked){assert.equal(after.screenLocked,true);assert.equal(after.userSessionLocked,true);}
  if(i)assert.notEqual(frame.hash,report.samples.at(-1).frameHash);
  report.samples.push({before,after,revision:frame.revision,frameHash:frame.hash,latencyMs:Date.now()-start,engine:frame.engine});
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
  await new Promise(r=>setTimeout(r,3000));
 }
 report.passed=true;
}catch(e){report.error=e.message;process.exitCode=1;}
report.endedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,samples:report.samples.length,error:report.error,report:file.pathname}));
