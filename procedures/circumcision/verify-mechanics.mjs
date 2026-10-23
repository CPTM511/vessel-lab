// Offline verification for scripted manipulation records, not model evaluation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {TissueSim} from './mechanics.mjs';
const file=path.resolve(process.argv[2]||'evidence/closure-attempt-01/report.json');
const report=JSON.parse(fs.readFileSync(file)),root=import.meta.dirname,dir=path.dirname(file);
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const allowed=new Set(['mechanics.mjs','cutting.mjs','task-definition.mjs','evaluation.mjs','attachments.mjs','inspector.mjs','launch.mjs','probe-mechanics.mjs','godot/main.gd','godot/anatomy.gd','godot/project.godot','godot/data/tissue-rest.json','docs/PROTOCOL.md']);
assert.equal(Object.keys(report.sourceHashes).length,allowed.size,'Missing source fingerprints');
for(const [f,hash] of Object.entries(report.sourceHashes)){assert.ok(allowed.has(f),'Unexpected source path');assert.equal(sha(fs.readFileSync(path.join(root,f))),hash,'Source changed: '+f);}
assert.match(report.kind,/scripted/);assert.ok(report.steps.length>0);
const sim=new TissueSim(report.seed);
for(const [index,row] of report.steps.entries()){
 assert.equal(row.action.revision,index,'Skipped or reordered action');
 const result=sim.step(row.action);
 assert.deepEqual(result,row.observation,'Observation does not reproduce at action '+index);
 assert.equal(sha(JSON.stringify(sim.snapshot().positions)),row.geometryHash,'Mechanical geometry mismatch');
 assert.equal(sha(JSON.stringify({faces:sim.snapshot().faces,componentOf:sim.snapshot().componentOf,targetMask:sim.snapshot().targetMask})),row.topologyHash,'Topology does not reproduce');
 assert.equal(row.frame.cutFaceCount,result.metrics.cutFaceCount,'Frame cut topology mismatch');
 assert.equal(row.frame.activeAttachments,result.metrics.activeAttachments,'Frame attachment mismatch');
 assert.equal(row.frame.assessmentPassed,result.assessment.passed,'Frame assessment mismatch');
 assert.match(row.frame.filename,/^frame-\d{3}\.jpg$/);
 const bytes=fs.readFileSync(path.join(dir,row.frame.filename));
 assert.equal(bytes[0],255);assert.equal(bytes[1],216);
 assert.equal(sha('data:image/jpeg;base64,'+bytes.toString('base64')),row.frame.imageHash,'Rendered frame hash mismatch');
 assert.equal(row.frame.mechanicsRevision,result.revision,'Frame mechanical revision mismatch');
}
if(report.finishRequest?.expectedRejection)assert.throws(()=>sim.finish(),e=>e.message===report.finishRequest.error);
console.log(JSON.stringify({verified:true,kind:'scripted manipulation only',steps:report.steps.length,metrics:sim.metrics()}));
