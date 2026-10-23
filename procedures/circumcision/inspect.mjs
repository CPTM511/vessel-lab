// Actual Godot image capture for anatomy inspection. No model or surgical evaluation.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {hostState} from '../../host-state.mjs';
const args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const base=option('--url','http://127.0.0.1:8785');
const locked=args.includes('--locked');
const count=Number(option('--samples',locked?'40':'0'));
const out=path.resolve(import.meta.dirname,option('--output','evidence/inspection-'+Date.now()));
await fs.mkdir(out,{recursive:true});
const sourceFiles=['inspector.mjs','mechanics.mjs','cutting.mjs','task-definition.mjs','godot/data/tissue-rest.json','launch.mjs','inspect.mjs','godot/project.godot','godot/main.gd','godot/main.tscn','godot/anatomy.gd','docs/PROTOCOL.md'];
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,sha(await fs.readFile(path.join(import.meta.dirname,f)))])));
const report={kind:'scripted anatomy inspection; not model or procedure evidence',startedAt:new Date().toISOString(),requiresLockedHost:locked,sourceHashes,sourceDigest:sha(JSON.stringify(sourceHashes)),samples:[],passed:false};
async function api(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(4000)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;}
const checks=count?Array.from({length:count},(_,i)=>['covered',i%2===0?.15:.25]):[['covered',0],['retracted',1],['ventral',1],['inner',0],['protected',1],['glans',1],['outer',0]];
try{
 for(let index=0;index<checks.length;index++){
  const [mode,retraction]=checks[index];
  const before=hostState();if(locked){assert.equal(before.screenLocked,true);assert.equal(before.userSessionLocked,true);}
  const s=await api('/api/state');assert.equal(s.mechanicsEnabled,false);
  const started=Date.now();
  const command={session:s.session,revision:s.revision,mode,retraction,source:'scripted-inspection-test',commandId:crypto.randomUUID()};
  const next=await api('/api/inspect',command);let frame;
  for(let i=0;i<70;i++){
   const r=await fetch(base+'/api/frame',{signal:AbortSignal.timeout(3000)});
   if(r.ok){const f=await r.json();if(f.session===s.session&&f.revision===next.revision&&f.receivedAt>=started){frame=f;break;}}
   await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(frame,'No actual current-revision Godot frame');
  assert.equal(frame.mode,mode);assert.equal(frame.retraction,retraction);assert.equal(sha(frame.image),frame.imageHash);
  const after=hostState();if(locked){assert.equal(after.screenLocked,true);assert.equal(after.userSessionLocked,true);}
  const latencyMs=Date.now()-started;
  const filename=count?`frame-${String(index+1).padStart(3,'0')}.jpg`:`${mode}.jpg`;
  await fs.writeFile(path.join(out,filename),Buffer.from(frame.image.split(',')[1],'base64'));
  if(!count)await fs.writeFile(path.join(out,mode+'-ui.jpg'),Buffer.from(frame.uiImage.split(',')[1],'base64'));
  report.samples.push({mode,retraction,revision:next.revision,latencyMs,renderer:frame.renderer,driver:frame.driver,imageHash:frame.imageHash,filename,width:frame.width,height:frame.height,surfaces:frame.surfaces,triangles:frame.triangles,before,after});
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  assert.ok(latencyMs<5000,`Fresh-frame deadline exceeded: ${latencyMs} ms`);
  if(index>0)assert.notEqual(frame.imageHash,report.samples[index-1].imageHash,'Changing inspection state must change actual rendered pixels');
  if(count)await new Promise(r=>setTimeout(r,2300));
 }
 report.passed=true;
}catch(e){report.error=e.message;process.exitCode=1;}
report.endedAt=new Date().toISOString();
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,samples:report.samples.length,maxLatencyMs:Math.max(...report.samples.map(x=>x.latencyMs)),error:report.error,output:out}));
