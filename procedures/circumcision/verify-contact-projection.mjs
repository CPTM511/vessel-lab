// Reconstruct the published lock states and compare an identical stationary command.
// This is a numerical counterfactual, not a new autonomous episode.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {TissueSim as Baseline} from './evidence/runtime-c0-round5/procedures/circumcision/mechanics.mjs';
import {sourceManifest as baselineSource} from './evidence/runtime-c0-round5/procedures/circumcision/manifest.mjs';
import {TissueSim,glansQuery} from './mechanics.mjs';
import {sourceManifest} from './manifest.mjs';
import {auditSelfIntersections} from './mesh-audit.mjs';
const source=sourceManifest(),prior=baselineSource();
assert.deepEqual(Object.keys(source.files).filter(f=>source.files[f]!==prior.files[f]),['contact.mjs']);
const rows=fs.readFileSync(new URL('evidence/c0-round5-seed83-attempt01/agent.jsonl',import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
assert.equal(rows.find(r=>r.type==='configuration').source.digest,prior.digest);
const original=new Baseline(83),results=[];
for(const row of rows.filter(r=>r.type==='accepted_command'&&r.tool==='step')){
 original.step(row.args);assert.deepEqual(JSON.parse(JSON.stringify(original.observe())),row.result.mechanics);
 if(![133,144,160].includes(original.revision))continue;
 const state=structuredClone(original),comparison=[];
 for(const [variant,Class] of [['baseline',Baseline],['corrected',TissueSim]]){
  const sim=new Class(83);Object.assign(sim,structuredClone(state));const before=sim.nodes.map(n=>[...n.p]),time=sim.time;
  sim.step({revision:sim.revision,duration:.1});
  const moved=Math.max(...sim.nodes.map((n,i)=>Math.hypot(...n.p.map((v,k)=>v-before[i][k]))));
  assert.ok(Math.abs(sim.time-time-.1)<1e-10,'Counterfactual must preserve elapsed simulated time');
  const crossings=auditSelfIntersections(sim).properCrossings;assert.deepEqual(crossings,{retained:0,detached:0,mixed:0});
  const minimumRigidResidualMm=Math.min(...sim.nodes.filter(n=>n.inv&&n.alive&&n.p[0]>=-9.7*sim.scale&&n.p[0]<=23.2*sim.scale&&Math.hypot(n.p[1],n.p[2])<15*sim.scale).map(n=>glansQuery(n.p,sim.scale).distance));
  assert.ok(minimumRigidResidualMm>=.1-1e-9);assert.equal(sim.metrics().protectedIntersections,0);assert.equal(sim.assessment().area.offTargetRemovedFraction,0);
  if(variant==='baseline')assert.equal(moved,0);else assert.ok(moved>1e-4,'Correction must resolve the recorded zero-motion state');
  comparison.push({variant,maxNodeDisplacementMm:moved,minimumRigidResidualMm,crossings,failedGates:sim.assessment().failedGates});
 }
 results.push({revision:original.revision,comparison});
}
assert.equal(results.length,3);
const report={verified:true,kind:'Numerical same-state same-command counterfactual; not autonomy or clinical validation',source,baselineDigest:prior.digest,results};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({verified:true,states:results.length,sourceDigest:source.digest,baselineDigest:prior.digest}));
