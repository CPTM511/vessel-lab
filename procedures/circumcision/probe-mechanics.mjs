// Scripted bilateral manipulation fixture. Never count this as model evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {newWoundEdges} from './cutting.mjs';
import {hostState} from '../../host-state.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const base=option('--url','http://127.0.0.1:8785'),out=path.resolve(import.meta.dirname,option('--output','evidence/mechanics-'+Date.now()));
await fs.mkdir(out,{recursive:true});
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const sourceFiles=['mechanics.mjs','contact.mjs','cutting.mjs','task-definition.mjs','evaluation.mjs','attachments.mjs','inspector.mjs','launch.mjs','probe-mechanics.mjs','godot/main.gd','godot/anatomy.gd','godot/project.godot','godot/data/tissue-rest.json','docs/PROTOCOL.md'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,hash(await fs.readFile(path.join(import.meta.dirname,f)))])));
const report={kind:'scripted mechanical development fixture; no model inference or procedure completion',seed:11,startedAt:new Date().toISOString(),sourceHashes,cuttingFixture:args.includes('--cutting')||args.includes('--closure'),closureFixture:args.includes('--closure'),steps:[],passed:false};
async function api(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;}
async function currentFrame(state,start){
 for(let i=0;i<80;i++){
  const r=await fetch(base+'/api/frame',{signal:AbortSignal.timeout(3000)});
  if(r.ok){const f=await r.json();if(f.revision===state.revision&&f.session===state.session&&f.mechanicsEnabled&&f.mechanicsRevision===state.mechanics.revision&&f.cutFaceCount===state.mechanics.metrics.cutFaceCount&&f.activeAttachments===state.mechanics.metrics.activeAttachments&&f.assessmentPassed===state.mechanics.assessment.passed&&f.receivedAt>=start)return f;}
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error('No fresh matching mechanical Godot observation');
}
let state;
async function persist(){await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
async function command(changes){
 const before=hostState(),start=Date.now();
 const action={revision:state.mechanics.revision,duration:.05,...changes};
 let accepted;try{accepted=await api('/api/step',{session:state.session,revision:state.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test',action});}catch(e){report.rejectedRequests??=[];report.rejectedRequests.push({action,error:e.message,at:new Date().toISOString()});await persist();throw e;}
 const frame=await currentFrame(accepted,start);state=await api('/api/state');
 const filename=`frame-${String(report.steps.length+1).padStart(3,'0')}.jpg`;
 await fs.writeFile(path.join(out,filename),Buffer.from(frame.image.split(',')[1],'base64'));
 const row={action,observation:accepted.mechanics,geometryHash:hash(JSON.stringify(state.mechanics.positions)),topologyHash:hash(JSON.stringify({faces:state.mechanics.faces,componentOf:state.mechanics.componentOf,targetMask:state.mechanics.targetMask})),frame:{filename,imageHash:frame.imageHash,revision:frame.revision,mechanicsRevision:frame.mechanicsRevision,cutFaceCount:frame.cutFaceCount,activeAttachments:frame.activeAttachments,assessmentPassed:frame.assessmentPassed,renderer:frame.renderer,driver:frame.driver},latencyMs:Date.now()-start,before,after:hostState()};
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
 if(args.includes('--cutting')||args.includes('--closure')){
  await move('left',[30,16,8]);
  const face=state.mechanics.faces[(22*n+5)*2];
  const p=face.nodes.reduce((v,id)=>v.map((x,i)=>x+state.mechanics.positions[id][i]/3),[0,0,0]);
  await move('left',p);
  await command({left:{cut:true}});
  await command({left:{position:[p[0],p[1]-1.5,p[2]+2.5],cut:true}});
  report.cutMetrics=state.mechanics.metrics;
  assert.ok(report.cutMetrics.cutFaceCount>0&&report.cutMetrics.cutFaceCount<32);
  assert.equal(report.cutMetrics.area.offTargetRemovedFraction,0);
  assert.equal(report.cutMetrics.protectedIntersections,0);
  await command({left:{position:[p[0]+2,p[1]+.5,p[2]+2.5]}});
  await move('left',[30,16,12]);
  const cutFrame=await api('/api/frame');
  await fs.writeFile(path.join(out,'local-cut-ui.jpg'),Buffer.from(cutFrame.uiImage.split(',')[1],'base64'));
  assert.equal(state.mechanics.metrics.cutFaceCount,report.cutMetrics.cutFaceCount,'Cut pulse latched into withdrawal');
 }
 if(args.includes('--closure')){
  const edges=newWoundEdges(state.mechanics.faces).filter(e=>state.mechanics.metrics.components[state.mechanics.componentOf[e.nodes[0]]].anchored);
  const midpoint=e=>e.nodes.reduce((p,id)=>p.map((v,i)=>v+state.mechanics.positions[id][i]/2),[0,0,0]);
  let pair=null;
  for(const a of edges.filter(e=>e.layer===0))for(const b of edges.filter(e=>e.layer===1)){
   const p=midpoint(a),q=midpoint(b),distance=Math.hypot(...p.map((v,i)=>v-q[i]));
   if(!pair||distance<pair.distance)pair={a,b,distance};
  }
  assert.ok(pair&&pair.distance<=3,'Fixture has no local cross-layer wound pair');
  await move('right',[30,16,-8]);await move('right',[30,16,8]);
  await move('left',midpoint(pair.a));await command({left:{jaw:0}});
  await move('right',midpoint(pair.b));await command({right:{jaw:0}});
  await command({approximate:true});
  assert.equal(state.mechanics.metrics.activeAttachments,1);
  const tiedFrame=await api('/api/frame');await fs.writeFile(path.join(out,'local-attachment-ui.jpg'),Buffer.from(tiedFrame.uiImage.split(',')[1],'base64'));
  await command({left:{jaw:1},right:{jaw:1}});
  await move('left',[30,20,12]);await move('right',[30,20,-12]);
  for(let i=0;i<10;i++)await command({duration:.5});
  report.attachmentAssessment=state.mechanics.assessment;
  assert.ok(state.mechanics.metrics.releaseSeconds>=5-1e-8);
  assert.equal(state.mechanics.metrics.activeAttachments,1);
  assert.equal(state.mechanics.metrics.activeGrasps,0);
  assert.equal(state.mechanics.metrics.protectedIntersections,0);
  assert.equal(state.mechanics.assessment.passed,false,'Local attachment fixture must not complete the procedure');
  try{await api('/api/finish',{session:state.session,revision:state.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test'});throw Error('Incomplete fixture was accepted as terminal');}
  catch(e){assert.match(e.message,/C0 gates unmet/);report.finishRequest={expectedRejection:true,error:e.message};}
  const endFrame=await api('/api/frame');await fs.writeFile(path.join(out,'released-attachment-ui.jpg'),Buffer.from(endFrame.uiImage.split(',')[1],'base64'));
 }
 report.finalMetrics=state.mechanics.metrics;
 report.passed=true;
}catch(e){report.error=e.message;process.exitCode=1;}
report.endedAt=new Date().toISOString();await persist();
console.log(JSON.stringify({passed:report.passed,steps:report.steps.length,error:report.error,maxLatencyMs:Math.max(...report.steps.map(s=>s.latencyMs)),output:out}));
