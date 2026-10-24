// Exact replay of exported numerical fixtures; no renderer or model is invoked.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const [recordPath,runtimePath,outputPath]=process.argv.slice(2);
assert.ok(recordPath&&runtimePath&&outputPath,'Usage: node verify-numerical.mjs <record.json> <exact-runtime-directory> <verification.json>');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),wire=x=>JSON.parse(JSON.stringify(x));
const bytes=fs.readFileSync(recordPath),record=JSON.parse(bytes),runtime=path.resolve(runtimePath);
assert.equal(record.schema,'s1-numerical-v1');
assert.equal(record.kind,'scripted numerical feasibility; no rendered or model evidence');
assert.ok([11,29].includes(record.seed));
const files=['mechanics.mjs','contact.mjs','mesh-audit.mjs','cutting.mjs','task-definition.mjs','evaluation.mjs','attachments.mjs','inspector.mjs','launch.mjs','probe-mechanics.mjs','probe-trajectory.mjs','godot/main.gd','godot/anatomy.gd','godot/project.godot','godot/data/tissue-rest.json','docs/PROTOCOL.md','scenario.mjs'];
assert.deepEqual(Object.keys(record.sourceHashes).sort(),files.sort(),'Missing or unexpected runtime fingerprints');
for(const file of files)assert.equal(sha(fs.readFileSync(path.join(runtime,file))),record.sourceHashes[file],'Source mismatch: '+file);
const {TissueSim}=await import(pathToFileURL(path.join(runtime,'mechanics.mjs')));
const {auditSelfIntersections}=await import(pathToFileURL(path.join(runtime,'mesh-audit.mjs')));
const sim=new TissueSim(record.seed),checks=new Map(),experiments=new Map();
for(const c of record.checkpoints){assert.ok(Number.isInteger(c.revision)&&c.revision>0&&c.revision<=record.actions.length);assert.ok(!checks.has(c.revision));checks.set(c.revision,c);}
for(const e of record.experiments){assert.ok(Number.isInteger(e.actionCount)&&e.actionCount>0&&e.actionCount<=record.actions.length);assert.ok(!experiments.has(e.actionCount));experiments.set(e.actionCount,e);}
let maximumActionMs=0,checked=0,checkedExperiments=0;const started=Date.now();
for(const [index,action] of record.actions.entries()){
 assert.equal(action.revision,index,'Skipped or reordered numerical action');
 const before=performance.now();sim.step(action);maximumActionMs=Math.max(maximumActionMs,performance.now()-before);
 const c=checks.get(sim.revision);
 if(c){if(c.metrics)assert.deepEqual(wire(sim.metrics()),c.metrics);if(c.assessment)assert.deepEqual(wire(sim.assessment()),c.assessment);if(c.audit)assert.deepEqual(auditSelfIntersections(sim),c.audit);checked++;}
 const e=experiments.get(sim.revision);
 if(e){assert.deepEqual(wire(sim.metrics()),e.metrics,'Experiment metrics changed: '+e.id);assert.deepEqual(wire(sim.assessment()),e.assessment,'Experiment assessment changed: '+e.id);checkedExperiments++;}
 if(sim.revision%240===0)console.error(JSON.stringify({seed:record.seed,revision:sim.revision,total:record.actions.length}));
}
assert.equal(checked,checks.size);assert.equal(checkedExperiments,experiments.size);
assert.deepEqual(wire(sim.metrics()),record.expectedMetrics);assert.deepEqual(wire(sim.assessment()),record.expectedAssessment);assert.equal(sim.assessment().passed,true);
const verification={verified:true,kind:'exact scripted numerical replay; no rendering or model inference',seed:record.seed,steps:sim.revision,recordHash:sha(bytes),verifierHash:sha(fs.readFileSync(import.meta.filename)),sourceCommit:record.sourceCommit,sourceHashes:record.sourceHashes,checkpoints:checked,experiments:checkedExperiments,maximumActionMs,elapsedMs:Date.now()-started,assessment:wire(sim.assessment()),metrics:wire(sim.metrics())};
fs.writeFileSync(outputPath,JSON.stringify(verification,null,2)+'\n');
console.log(JSON.stringify({verified:true,seed:record.seed,steps:sim.revision,checkpoints:checked,experiments:checkedExperiments}));
