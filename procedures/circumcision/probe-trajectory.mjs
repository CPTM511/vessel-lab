// Render every bounded action from an explicit scripted fixture. Never model evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {hostState} from '../../host-state.mjs';
import {auditSelfIntersections} from './mesh-audit.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const input=option('--trajectory'),base=option('--url','http://127.0.0.1:8785');
if(!input)throw Error('Pass --trajectory with an explicit numerical scripted record');
const out=path.resolve(option('--output','evidence/trajectory-'+Date.now()));
const fixture=JSON.parse(await fs.readFile(input,'utf8'));
assert.match(fixture.kind,/scripted/);
const actions=[...(fixture.prefixActions??[]),...fixture.actions].map(row=>row.action??row);
const expectedAssessment=fixture.expectedAssessment??fixture.assessment,seed=fixture.seed??11;
const auditRevisions=fixture.auditRevisions??[];
assert.ok(Array.isArray(auditRevisions)&&auditRevisions.every(n=>Number.isInteger(n)&&n>0&&n<=actions.length));
assert.ok(expectedAssessment,'The scripted fixture must declare its expected endpoint');
assert.ok(actions.length>0);actions.forEach((a,i)=>assert.equal(a.revision,i));
await fs.mkdir(out,{recursive:true});
// Exclusive evidence ownership also prevents accidentally overwriting a failed attempt.
const journal=await fs.open(path.join(out,'steps.jsonl'),'wx');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const sourceFiles=['mechanics.mjs','contact.mjs','mesh-audit.mjs','cutting.mjs','task-definition.mjs','evaluation.mjs','attachments.mjs','inspector.mjs','launch.mjs','probe-mechanics.mjs','probe-trajectory.mjs','godot/main.gd','godot/anatomy.gd','godot/project.godot','godot/data/tissue-rest.json','docs/PROTOCOL.md'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,sha(await fs.readFile(path.join(import.meta.dirname,f)))])));
const trajectory={kind:'scripted low-level actions; not autonomous inference',seed,actions,auditRevisions,expectedAssessment};
const trajectoryBytes=JSON.stringify(trajectory,null,2)+'\n';await fs.writeFile(path.join(out,'trajectory.json'),trajectoryBytes);
const report={kind:'scripted instrument trajectory development fixture; no model inference',schema:'scripted-trajectory-v1',seed,startedAt:new Date().toISOString(),sourceHashes,trajectoryHash:sha(trajectoryBytes),steps:[],passed:false};
const persist=()=>fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
async function api(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;}
async function currentFrame(state,start){
 for(let i=0;i<100;i++){
  const r=await fetch(base+'/api/frame',{signal:AbortSignal.timeout(3000)});
  if(r.ok){const f=await r.json();if(f.revision===state.revision&&f.session===state.session&&f.mechanicsEnabled&&f.mechanicsRevision===state.mechanics.revision&&f.cutFaceCount===state.mechanics.metrics.cutFaceCount&&f.activeAttachments===state.mechanics.metrics.activeAttachments&&f.assessmentPassed===state.mechanics.assessment.passed&&f.receivedAt>=start)return f;}
  await new Promise(r=>setTimeout(r,80));
 }
 throw Error('No fresh matching mechanical Godot frame');
}
let state,stopRequested=null;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopRequested=signal;});
const meshAudit=s=>auditSelfIntersections({revision:s.revision,nodes:s.positions.map(p=>({p})),faces:s.faces,topology:{componentOf:s.componentOf,components:s.metrics.components}});
try{
 const before=await api('/api/state'),start=Date.now();
 state=await api('/api/mechanics/reset',{session:before.session,revision:before.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test',seed});
 await currentFrame(state,start);state=await api('/api/state');
 for(const action of actions){
  const before=hostState(),start=Date.now();let accepted;
  try{accepted=await api('/api/step',{session:state.session,revision:state.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test',action});}
  catch(e){report.rejectedRequests=[{action,error:e.message}];throw e;}
  const frame=await currentFrame(accepted,start);assert.equal(frame.controlSource,'scripted-mechanics-test');state=await api('/api/state');
  const filename=`frame-${String(report.steps.length+1).padStart(4,'0')}.jpg`;
  await fs.writeFile(path.join(out,filename),Buffer.from(frame.image.split(',')[1],'base64'));
  const row={action,observation:accepted.mechanics,geometryHash:sha(JSON.stringify(state.mechanics.positions)),topologyHash:sha(JSON.stringify({faces:state.mechanics.faces,componentOf:state.mechanics.componentOf,targetMask:state.mechanics.targetMask})),frame:{filename,controlSource:frame.controlSource,imageHash:frame.imageHash,revision:frame.revision,mechanicsRevision:frame.mechanicsRevision,cutFaceCount:frame.cutFaceCount,activeAttachments:frame.activeAttachments,assessmentPassed:frame.assessmentPassed,renderer:frame.renderer,driver:frame.driver},latencyMs:Date.now()-start,before,after:hostState()};
  report.steps.push(row);await journal.write(JSON.stringify(row)+'\n');
  if(report.steps.length%48===0||report.steps.length===actions.length||auditRevisions.includes(report.steps.length)){
   const audit=meshAudit(state.mechanics);report.meshChecks??=[];report.meshChecks.push(audit);report.meshAudit=audit;
   assert.equal(Object.values(audit.properCrossings).reduce((a,b)=>a+b,0),0,'Actual mesh has non-adjacent crossings');
  }
  if(report.steps.length%48===0){await persist();await fs.writeFile(path.join(out,'latest-ui.jpg'),Buffer.from(frame.uiImage.split(',')[1],'base64'));console.log(JSON.stringify({steps:report.steps.length,total:actions.length,latencyMs:row.latencyMs,cuts:accepted.mechanics.metrics.cutFaceCount}));}
  if(stopRequested)throw Error('Interrupted by '+stopRequested+' after recording the accepted action and actual frame');
  assert.ok(row.latencyMs<5000,'Action and actual feedback exceeded five seconds');
  assert.equal(accepted.mechanics.metrics.protectedIntersections,0);
  assert.equal(accepted.mechanics.assessment.invalidRetainedFaces.length,0);
  assert.ok(accepted.mechanics.metrics.area.offTargetRemovedFraction<=.01);
 }
 assert.deepEqual(state.mechanics.assessment,expectedAssessment,'Actual endpoint differs from numerical fixture');
 report.finalMetrics=state.mechanics.metrics;report.finalAssessment=state.mechanics.assessment;
 const endFrame=await api('/api/frame');await fs.writeFile(path.join(out,'final-ui.jpg'),Buffer.from(endFrame.uiImage.split(',')[1],'base64'));
 if(state.mechanics.assessment.passed){
  const start=Date.now();const accepted=await api('/api/finish',{session:state.session,revision:state.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test'});
  const frame=await currentFrame(accepted,start);await fs.writeFile(path.join(out,'terminal-ui.jpg'),Buffer.from(frame.uiImage.split(',')[1],'base64'));report.finishRequest={accepted:true,observation:accepted.mechanics};
 }else{
  try{await api('/api/finish',{session:state.session,revision:state.revision,commandId:crypto.randomUUID(),source:'scripted-mechanics-test'});throw Error('Incomplete trajectory incorrectly accepted');}
  catch(e){assert.match(e.message,/C0 gates unmet/);report.finishRequest={expectedRejection:true,error:e.message};}
 }
 report.passed=true;
}catch(e){report.error=e.message;process.exitCode=1;}
report.endedAt=new Date().toISOString();await persist();await journal.close();
console.log(JSON.stringify({passed:report.passed,procedurePassed:report.finalAssessment?.passed,steps:report.steps.length,error:report.error,maxLatencyMs:Math.max(...report.steps.map(s=>s.latencyMs)),output:out}));
