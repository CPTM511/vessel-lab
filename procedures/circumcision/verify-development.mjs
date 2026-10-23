// Reproduce numerical development and its geometric defects. This is not model evidence.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {TissueSim} from './mechanics.mjs';import {auditSelfIntersections} from './mesh-audit.mjs';
const file=path.resolve(process.argv[2]??'evidence/resection-development.json'),dir=path.dirname(file),data=JSON.parse(fs.readFileSync(file));
assert.match(data.canonicalTrajectory,/^[a-z0-9-]+\/trajectory\.json$/);
const trajectoryFile=path.join(dir,data.canonicalTrajectory),bytes=fs.readFileSync(trajectoryFile),trajectory=JSON.parse(bytes),record=JSON.parse(fs.readFileSync(path.join(path.dirname(trajectoryFile),'report.json')));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),wire=v=>JSON.parse(JSON.stringify(v));
assert.equal(sha(bytes),record.trajectoryHash);
const allowed=new Set(['mechanics.mjs','cutting.mjs','task-definition.mjs','evaluation.mjs','attachments.mjs','inspector.mjs','launch.mjs','probe-mechanics.mjs','probe-trajectory.mjs','godot/main.gd','godot/anatomy.gd','godot/project.godot','godot/data/tissue-rest.json','docs/PROTOCOL.md']);
function sources(){assert.equal(Object.keys(record.sourceHashes).length,allowed.size);for(const [file,hash] of Object.entries(record.sourceHashes)){assert.ok(allowed.has(file));assert.equal(sha(fs.readFileSync(path.join(import.meta.dirname,file))),hash,'Source differs: '+file);}}
sources();
const sim=new TissueSim(trajectory.seed),initial=auditSelfIntersections(sim),branches=new Map();let verified=0;
for(const action of trajectory.actions){
 const result=wire(sim.step(action));
 for(const entry of data.experiments){
  if(entry.canonicalTrajectoryPrefix===sim.revision){assert.deepEqual(result.metrics,entry.metrics,entry.id);assert.deepEqual(result.assessment,entry.assessment,entry.id);verified++;}
  if(entry.alternateActionsAfterCommonPrefix?.prefixLength===sim.revision)branches.set(sim.revision,structuredClone(sim));
 }
 if(sim.revision%240===0)console.error('Numerical replay: '+sim.revision+'/'+trajectory.actions.length);
}
assert.deepEqual(wire(sim.assessment()),trajectory.expectedAssessment);
const endpoint=auditSelfIntersections(sim);
for(const entry of data.experiments.filter(e=>!e.canonicalTrajectoryPrefix)){
 const b=entry.alternateActionsAfterCommonPrefix,s=Object.assign(Object.create(TissueSim.prototype),structuredClone(branches.get(b.prefixLength)));
 for(const action of b.actions)s.step(action);
 assert.equal(s.revision,entry.actionCount);assert.deepEqual(wire(s.metrics()),entry.metrics);assert.deepEqual(wire(s.assessment()),entry.assessment);verified++;
}
sources();
if(data.meshAudit){
 assert.match(data.meshAudit,/^[a-z0-9-]+\.json$/);const expected=JSON.parse(fs.readFileSync(path.join(dir,data.meshAudit)));
 assert.deepEqual(initial,expected.initial);assert.deepEqual(endpoint,expected.endpoint);
}
console.log(JSON.stringify({verified:true,kind:'numerical scripted development only',actions:trajectory.actions.length,checkpoints:verified,c0GeometricAssessment:sim.assessment().passed,initialCrossings:initial.properCrossings,endpointCrossings:endpoint.properCrossings,prototypeComplete:false}));
