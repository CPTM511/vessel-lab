import test from 'node:test';
import assert from 'node:assert/strict';
import {defineScenario} from '../scenario.mjs';
import {TissueSim,protectedQueries,glansQuery,distance} from '../mechanics.mjs';
import {auditSelfIntersections} from '../mesh-audit.mjs';
import {C0} from '../evaluation.mjs';

test('declared cases have distinct authored sizes and reproducible initial instruments',()=>{
 const cases=[11,29,83].map(defineScenario);
 assert.deepEqual(cases.map(c=>c.scale),[.92,1,1.08]);
 for(const c of cases)assert.deepEqual(c,defineScenario(c.seed));
 for(let i=0;i<cases.length;i++)for(let j=i+1;j<cases.length;j++){
  assert.ok(Math.abs(cases[i].scale-cases[j].scale)>.079);
  assert.ok(distance(cases[i].initialArms.left.position,cases[j].initialArms.left.position)>2);
 }
 for(const seed of [0,1,0x9e3779b9,0xffffffff]){
  const c=defineScenario(seed);assert.ok(c.scale>=.9&&c.scale<=1.1);
  assert.ok(Object.values(c.initialArms).every(a=>a.position.every(Number.isFinite)));
 }
 for(const invalid of [-1,2**32,1.5,NaN,Infinity,'11'])assert.throws(()=>defineScenario(invalid));
});

test('scaled cases preserve the target topology, area scaling and unchanged C0 gates',()=>{
 const cases=[11,29,83].map(seed=>new TissueSim(seed)),reference=cases[1];
 for(const s of cases){
  assert.deepEqual(s.task.target,reference.task.target);
  assert.deepEqual(s.task.pairNodes,reference.task.pairNodes);
  assert.ok(Math.abs(s.metrics().area.targetInitialAreaMm2/s.scale**2-reference.metrics().area.targetInitialAreaMm2)<1e-7);
  assert.equal(s.assessment().passed,false);
  assert.ok(s.assessment().failedGates.includes('targetDetached'));
 }
 assert.deepEqual(C0,{target:.95,offTarget:.01,edgeGapMm:1,releaseSeconds:5,clearanceMm:3});
});

test('all declared initial cases are separated and instruments are clear before the first action',()=>{
 for(const seed of [11,29,83]){
  const s=new TissueSim(seed);
  for(const n of s.nodes)assert.ok(glansQuery(n.p,s.scale).distance>=0);
  assert.ok(Object.values(auditSelfIntersections(s).properCrossings).every(n=>n===0));
  for(const a of Object.values(s.arms)){
   assert.ok(s.nearestSurface(a.position).distance>1);
   for(const p of s.instrumentSamples(a))assert.ok(protectedQueries(p,s.scale).every(q=>q.distance>.5));
  }
  const r=s.step({revision:0,duration:.05});
  assert.equal(r.metrics.protectedIntersections,0);
  assert.equal(r.metrics.maxDisplacementMm,0);
 }
});
