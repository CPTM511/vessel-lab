import {sourceManifest} from './manifest.mjs';
// Offline verification for scripted manipulation records, not model evaluation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {TissueSim} from './mechanics.mjs';
import {auditSelfIntersections} from './mesh-audit.mjs';
const file=path.resolve(process.argv[2]||'evidence/closure-attempt-01/report.json');
const report=JSON.parse(fs.readFileSync(file)),root=import.meta.dirname,dir=path.dirname(file);
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
// Signed zero is not representable on the JSON transport used by the inspector.
const wire=v=>JSON.parse(JSON.stringify(v));
const allowed=new Set(['mechanics.mjs','scenario.mjs','cutting.mjs','task-definition.mjs','evaluation.mjs','attachments.mjs','inspector.mjs','launch.mjs','probe-mechanics.mjs','godot/main.gd','godot/anatomy.gd','godot/project.godot','godot/data/tissue-rest.json','docs/PROTOCOL.md']);
if(report.schema==='scripted-trajectory-v1')allowed.add('probe-trajectory.mjs');
if(fs.readFileSync(path.join(root,'mechanics.mjs'),'utf8').includes("from './contact.mjs'"))allowed.add('contact.mjs');
if(report.schema==='scripted-trajectory-v1'&&fs.readFileSync(path.join(root,'probe-trajectory.mjs'),'utf8').includes("from './mesh-audit.mjs'"))allowed.add('mesh-audit.mjs');
for(const file of Object.keys(sourceManifest().files))allowed.add(file);
assert.equal(Object.keys(report.sourceHashes).length,allowed.size,'Missing source fingerprints');
for(const [f,hash] of Object.entries(report.sourceHashes)){assert.ok(allowed.has(f),'Unexpected source path');assert.equal(sha(fs.readFileSync(path.join(root,f))),hash,'Source changed: '+f);}
assert.match(report.kind,/scripted/);assert.ok(report.steps.length>0);
if(report.continuation){
 const c=report.continuation;
 assert.equal(c.kind,'scripted continuation after camera-only interruption; not an independent episode');
 assert.equal(c.parentReport,'interrupted-report.json');assert.equal(c.sourceFile,'continuation-driver.mjs');
 const bytes=fs.readFileSync(path.join(dir,c.parentReport)),parent=JSON.parse(bytes);
 assert.equal(sha(bytes),c.parentReportHash,'Interrupted record changed');
 assert.equal(sha(fs.readFileSync(path.join(dir,c.sourceFile))),c.sourceHash,'Continuation driver changed');
 assert.equal(parent.passed,false);assert.equal(parent.error,'Stale revision');
 assert.deepEqual(parent.sourceHashes,report.sourceHashes);assert.equal(parent.trajectoryHash,report.trajectoryHash);
 assert.equal(c.startingMechanicalRevision,parent.steps.length);
 assert.equal(c.startingGeometryHash,parent.steps.at(-1).geometryHash);
 assert.deepEqual(report.steps.slice(0,parent.steps.length),parent.steps,'Interrupted prefix changed');
 assert.deepEqual(report.priorFailure,{error:parent.error,rejectedRequests:parent.rejectedRequests,endedAt:parent.endedAt});
}
if(report.schema==='scripted-trajectory-v1'){
 const bytes=fs.readFileSync(path.join(dir,'trajectory.json'));
 assert.equal(sha(bytes),report.trajectoryHash,'Scripted trajectory changed');
 const fixture=JSON.parse(bytes);
 assert.deepEqual(report.steps.map(s=>s.action),fixture.actions.slice(0,report.steps.length),'Recorded actions differ from the declared scripted trajectory');
 if(report.passed){assert.equal(report.steps.length,fixture.actions.length);assert.deepEqual(report.finalAssessment,fixture.expectedAssessment);}
 if(report.passed&&report.sourceHashes['mesh-audit.mjs']){
  const expected=fixture.actions.map((_,i)=>i+1).filter(n=>n%48===0||n===fixture.actions.length||(fixture.auditRevisions??[]).includes(n));
  assert.deepEqual(report.meshChecks.map(a=>a.revision),expected,'Missing declared mesh checks');
 }
 const journal=fs.readFileSync(path.join(dir,'steps.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
 assert.deepEqual(journal,report.steps,'Streaming action journal differs from final report');
}
const sim=new TissueSim(report.seed);
if(report.initial){
 assert.deepEqual(wire(sim.observe().scenario),report.initial.scenario,'Initial scenario mismatch');
 assert.equal(sha(JSON.stringify(sim.snapshot().positions)),report.initial.geometryHash,'Initial geometry mismatch');
 assert.equal(report.initial.frame.filename,'initial.jpg');
 assert.equal(report.initial.frame.seed,sim.seed);
 assert.ok(Math.abs(report.initial.frame.anatomyScale-sim.scale)<1e-6);
 assert.equal(report.initial.frame.mechanicsRevision,0);
 assert.equal(sha('data:image/jpeg;base64,'+fs.readFileSync(path.join(dir,'initial.jpg')).toString('base64')),report.initial.frame.imageHash);
}
const developmentIndex=process.argv.indexOf('--development');
const development=developmentIndex>=0?JSON.parse(fs.readFileSync(process.argv[developmentIndex+1])):null;
const branches=new Map();
if(development){
 const declared=fs.readFileSync(path.resolve(path.dirname(process.argv[developmentIndex+1]),development.canonicalTrajectory));
 assert.equal(sha(declared),report.trajectoryHash,'Development history refers to a different trajectory');
}
for(const [index,row] of report.steps.entries()){
 assert.equal(row.action.revision,index,'Skipped or reordered action');
 assert.ok(Number.isFinite(row.latencyMs)&&row.latencyMs>=0,'Missing feedback latency');
 if(report.passed)assert.ok(row.latencyMs<5000,'Successful record exceeded five-second feedback deadline');
 assert.ok(['forward_plus','gl_compatibility'].includes(row.frame.renderer),'Unknown recorded renderer');
 const result=sim.step(row.action);
 assert.deepEqual(wire(result),row.observation,'Observation does not reproduce at action '+index);
 assert.equal(sha(JSON.stringify(sim.snapshot().positions)),row.geometryHash,'Mechanical geometry mismatch');
 assert.equal(sha(JSON.stringify({faces:sim.snapshot().faces,componentOf:sim.snapshot().componentOf,targetMask:sim.snapshot().targetMask})),row.topologyHash,'Topology does not reproduce');
 assert.equal(row.frame.controlSource,'scripted-mechanics-test','Frame control source mismatch');
 assert.equal(row.frame.seed,result.seed,'Frame seed mismatch');
 assert.ok(Math.abs(row.frame.anatomyScale-result.scale)<1e-6,'Frame anatomy scale mismatch');
 assert.equal(row.frame.cutFaceCount,result.metrics.cutFaceCount,'Frame cut topology mismatch');
 assert.equal(row.frame.activeAttachments,result.metrics.activeAttachments,'Frame attachment mismatch');
 assert.equal(row.frame.assessmentPassed,result.assessment.passed,'Frame assessment mismatch');
 assert.match(row.frame.filename,/^frame-\d{3,5}\.jpg$/);
 const bytes=fs.readFileSync(path.join(dir,row.frame.filename));
 assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.equal(bytes.at(-2),255);assert.equal(bytes.at(-1),217);
 assert.equal(sha('data:image/jpeg;base64,'+bytes.toString('base64')),row.frame.imageHash,'Rendered frame hash mismatch');
 assert.equal(row.frame.mechanicsRevision,result.revision,'Frame mechanical revision mismatch');
 for(const audit of report.meshChecks??[])if(audit.revision===result.revision)assert.deepEqual(auditSelfIntersections(sim),audit,'Intermediate mesh audit differs');
 if(development?.experiments.some(e=>e.alternateActionsAfterCommonPrefix?.prefixLength===sim.revision))branches.set(sim.revision,structuredClone(sim));
}
if(report.interruption){
 const row=report.interruption;
 assert.equal(row.action.revision,report.steps.length,'Interrupted action ordering mismatch');
 const result=sim.step(row.action);
 assert.deepEqual(wire(result),row.observation,'Interrupted action does not reproduce');
 assert.equal(sha(JSON.stringify(sim.snapshot().positions)),row.geometryHash);
 assert.equal(sha(JSON.stringify({faces:sim.snapshot().faces,componentOf:sim.snapshot().componentOf,targetMask:sim.snapshot().targetMask})),row.topologyHash);
 assert.equal(row.frame.filename,'interrupted-frame.jpg');
 const bytes=fs.readFileSync(path.join(dir,row.frame.filename));
 assert.equal(sha('data:image/jpeg;base64,'+bytes.toString('base64')),row.frame.imageHash);
 assert.equal(row.frame.mechanicsRevision,result.revision);
}
if(report.finishRequest?.expectedRejection)assert.throws(()=>sim.finish(),e=>e.message===report.finishRequest.error);
if(report.finalAssessment)assert.deepEqual(sim.assessment(),report.finalAssessment,'Final assessment mismatch');
if(report.meshAudit)assert.deepEqual(auditSelfIntersections(sim),report.meshAudit,'Actual endpoint mesh audit does not reproduce');
if(report.finishRequest?.accepted){assert.equal(sim.assessment().passed,true);assert.deepEqual(wire(sim.finish()),report.finishRequest.observation);}
if(report.finishRequest?.frame){
 const request=report.finishRequest,f=request.frame;
 assert.equal(request.accepted,true);assert.equal(f.filename,'terminal.jpg');assert.equal(f.controlSource,'scripted-mechanics-test');assert.equal(f.mechanicsRevision,sim.revision);
 assert.ok(Number.isFinite(request.latencyMs)&&request.latencyMs>=0&&request.latencyMs<5000);
 const bytes=fs.readFileSync(path.join(dir,f.filename));assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.equal(bytes.at(-2),255);assert.equal(bytes.at(-1),217);
 assert.equal(sha('data:image/jpeg;base64,'+bytes.toString('base64')),f.imageHash);
}
if(development)for(const entry of development.experiments){
 let result;
 if(entry.canonicalTrajectoryPrefix){
  assert.equal(entry.actionCount,entry.canonicalTrajectoryPrefix);result=report.steps[entry.actionCount-1].observation;
 }else{
  const branch=entry.alternateActionsAfterCommonPrefix,base=branches.get(branch.prefixLength);assert.ok(base,'Missing alternate fixture prefix');
  const alternate=Object.assign(Object.create(TissueSim.prototype),structuredClone(base));
  for(const action of branch.actions)result=wire(alternate.step(action));
  assert.equal(alternate.revision,entry.actionCount);
 }
 assert.deepEqual(result.metrics,entry.metrics,'Development metrics do not reproduce: '+entry.id);
 assert.deepEqual(result.assessment,entry.assessment,'Development assessment does not reproduce: '+entry.id);
}
console.log(JSON.stringify({verified:true,kind:'scripted manipulation only',steps:report.steps.length,recoveredActions:report.interruption?1:0,meshCrossings:report.meshAudit?.properCrossings,developmentCheckpoints:development?.experiments.length??0,metrics:sim.metrics()}));
