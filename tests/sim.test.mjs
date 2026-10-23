import test from 'node:test';
import assert from 'node:assert/strict';
import {VesselSim} from '../sim.mjs';
import {runReference} from './reference-fixture.mjs';

test('unsafe, nonfinite and stale actions leave state unchanged',()=>{
 const s=new VesselSim(),before=s.snapshot();
 for(const action of [
  {right:{position:[8,3,0]}}, {right:{position:[NaN,3,0]}},
  {left:{jaw:0},right:{jaw:2}}, {duration:0}, {revision:99}
 ]){assert.throws(()=>s.step(action));assert.deepEqual(s.snapshot(),before);}
});
test('empty scene fails independent finish; terminal episode cannot be modified',()=>{
 const s=new VesselSim(),r=s.finish();assert.equal(r.passed,false);
 assert.equal(r.checks.closure,false);assert.equal(r.checks.secured,false);
 assert.throws(()=>s.step({}));assert.throws(()=>s.finish());assert.throws(()=>s.cutThread());
});
test('slack thread does not push tissue apart; needle through empty lumen makes no bridge',()=>{
 const s=new VesselSim(),g=s.initialGap;
 s.step({right:{position:[-.1,s.radius,0]},duration:.5});
 s.step({right:{position:[-1.5,s.radius,0]},duration:.5});
 assert.equal(s.stitches.length,1);assert.ok(Math.abs(s.metrics().meanGap-g)<1e-8);
 const empty=new VesselSim();
 empty.step({right:{position:[2.8,0,0]},duration:.5});
 empty.step({right:{position:[0,0,0]},duration:.5});
 empty.step({right:{position:[-2,0,0]},duration:.5});
 assert.equal(empty.stitches.length,0);
 assert.throws(()=>empty.cutThread(),/No secured knot/);
});
test('SCRIPTED low-level fixture completes across fixed seeds, with deterministic replay',()=>{
 for(const seed of [1,42,2026]){
  const s=new VesselSim(seed),actions=runReference(s),result=s.finish();
  assert.equal(result.passed,true,JSON.stringify({seed,result}));
  assert.equal(result.metrics.lumenAreaRatio,null);
  const replay=new VesselSim(seed);
  for(const a of actions){if(a.kind==='step')replay.step(a.action);else replay.cutThread();}
  assert.deepEqual(replay.finish(),result);
 }
});
test('release without a knot loses closure and fails the terminal test',()=>{
 const s=new VesselSim();runReference(s,{tie:false,trim:false});
 assert.equal(s.knot,false);const result=s.finish();
 assert.equal(result.passed,false);assert.equal(result.checks.closure,false);
 assert.equal(result.checks.secured,false);assert.equal(result.checks.threadTrimmed,false);
});
test('successful closure still fails if the tools are not released',()=>{
 const s=new VesselSim();runReference(s,{release:false});const r=s.finish();
 assert.equal(r.checks.closure,true);assert.equal(r.checks.secured,true);
 assert.equal(r.checks.released,false);assert.equal(r.passed,false);
});
