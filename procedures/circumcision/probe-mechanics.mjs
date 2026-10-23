// Scripted bilateral manipulation fixture. Never count this as model evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {hostState} from '../../host-state.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const base=option('--url','http://127.0.0.1:8785'),out=path.resolve(import.meta.dirname,option('--output','evidence/mechanics-'+Date.now()));
await fs.mkdir(out,{recursive:true});
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const sourceFiles=['mechanics.mjs','inspector.mjs','launch.mjs','probe-mechanics.mjs','godot/main.gd','godot/anatomy.gd','godot/project.godot','godot/data/tissue-rest.json','docs/PROTOCOL.md'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,hash(await fs.readFile(path.join(import.meta.dirname,f)))])));
const report={kind:'scripted mechanical development fixture; no model inference or procedure completion',seed:11,startedAt:new Date().toISOString(),sourceHashes,steps:[],passed:false};
async function api(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;}
async function currentFrame(state,start){
 for(let i=0;i<80;i++){
  const r=await fetch(base+'/api/frame',{signal:AbortSignal.timeout(3000)});
  if(r.ok){const f=await r.json();if(f.revision===state.revision&&f.session===state.session&&f.mechanicsEnabled&&f.mechanicsRevision===state.mechanics.revision&&f.receivedAt>=start)return f;}
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error('No fresh matching mechanical Godot observation');
}
let state;
async function persist(){await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
async function command(changes){
 const before=hostState(),start=Date.now();
 const action={revision:state.mechanics.revision,duration:.05,...changes};
 const accepted=await api('/api/step',{session:state.session,revision:state.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test',action});
 const frame=await currentFrame(accepted,start);state=await api('/api/state');
 const filename=`frame-${String(report.steps.length+1).padStart(3,'0')}.jpg`;
 await fs.writeFile(path.join(out,filename),Buffer.from(frame.image.split(',')[1],'base64'));
 const row={action,observation:accepted.mechanics,geometryHash:hash(JSON.stringify(state.mechanics.positions)),frame:{filename,imageHash:frame.imageHash,revision:frame.revision,mechanicsRevision:frame.mechanicsRevision,renderer:frame.renderer,driver:frame.driver},latencyMs:Date.now()-start,before,after:hostState()};
 report.steps.push(row);await persist();
 assert.ok(row.latencyMs<5000,'Mechanical action and rendered feedback exceeded five seconds');
 return state.mechanics;
}
async function move(name,target){
 let guard=0;
 while(Math.hypot(...state.mechanics.arms[name].position.map((v,i)=>v-target[i]))>.001){
  const p=state.mechanics.arms[name].position,d=Math.hypot(...p.map((v,i)=>v-target[i]));
  const q=p.map((v,i)=>v+(target[i]-v)*Math.min(1,3.5/d));await command({[name]:{position:q}});
  if(++guard>60)throw Error('Fixture translation did not converge');
 }
}
try{
 const s=await api('/api/state'),start=Date.now();
 const reset=await api('/api/mechanics/reset',{session:s.session,revision:s.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test',seed:11});
 await currentFrame(reset,start);state=await api('/api/state');
 const n=state.mechanics.cage.angular,k=state.mechanics.cage.axial;
 const left=[...state.mechanics.positions[k*n+5]],right=[...state.mechanics.positions[k*n+n-5]];
 await move('left',left);await command({left:{jaw:0}});
 await move('right',right);await command({right:{jaw:0}});
 assert.equal(state.mechanics.metrics.activeGrasps,2);
 await command({left:{position:[left[0]+3,left[1]+1,left[2]]}});
 await command({right:{position:[right[0]+2,right[1]+1,right[2]],rotationDeg:[0,0,10]}});
 report.heldMetrics=state.mechanics.metrics;
 assert.ok(report.heldMetrics.maxDisplacementMm>2);
 assert.ok(report.heldMetrics.graspErrors.every(x=>x.error<.1));
 assert.equal(report.heldMetrics.protectedIntersections,0);
 const heldFrame=await api('/api/frame');
 await fs.writeFile(path.join(out,'bilateral-grasp-ui.jpg'),Buffer.from(heldFrame.uiImage.split(',')[1],'base64'));
 await command({left:{jaw:1},right:{jaw:1}});
 await command({duration:.2});
 assert.equal(state.mechanics.metrics.activeGrasps,0);
 assert.equal(state.mechanics.metrics.protectedIntersections,0);
 report.finalMetrics=state.mechanics.metrics;
 report.passed=true;
}catch(e){report.error=e.message;process.exitCode=1;}
report.endedAt=new Date().toISOString();await persist();
console.log(JSON.stringify({passed:report.passed,steps:report.steps.length,error:report.error,maxLatencyMs:Math.max(...report.steps.map(s=>s.latencyMs)),output:out}));
