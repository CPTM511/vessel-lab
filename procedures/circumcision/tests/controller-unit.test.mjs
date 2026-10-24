import test from 'node:test';
import assert from 'node:assert/strict';
import {OrdinaryUsageGuard} from '../ordinary-guard.mjs';
import {TissueSim} from '../mechanics.mjs';
import {geometryQuery} from '../instrumentation.mjs';
const limits=()=>({ordinaryUsageAllowed:true,rateLimits:{primary:{usedPercent:12,windowDurationMins:300},credits:{balance:'unchanged'}}});
test('ordinary permission, usable windows and unchanged credits are all required',()=>{
 for(const response of [{...limits(),ordinaryUsageAllowed:false},{...limits(),ordinaryUsageAllowed:null},{rateLimits:limits().rateLimits},{ordinaryUsageAllowed:true,rateLimits:{}},{ordinaryUsageAllowed:true,rateLimits:{primary:{usedPercent:95}}},{ordinaryUsageAllowed:true,rateLimits:{primary:{usedPercent:NaN}}}])assert.throws(()=>new OrdinaryUsageGuard().check(response),/allowance/);
 const guard=new OrdinaryUsageGuard();assert.equal(guard.check(limits()).creditStateUnchanged,true);
 const changed=limits();changed.rateLimits.credits.balance='changed';assert.throws(()=>guard.check(changed),/Credit state changed/);
 const multi=limits();multi.rateLimitsByLimitId={codex:{primary:{usedPercent:1}},astra:{secondary:{usedPercent:100}}};assert.throws(()=>new OrdinaryUsageGuard().check(multi),/allowance/);
});
test('geometry sensors are bounded and cannot modify the specimen or propose actions',()=>{
 const sim=new TissueSim(11),before=sim.snapshot();const result=geometryQuery(sim,{faceIds:[0,1200],points:[[34,25,16]]});
 assert.equal(result.faces.length,2);assert.deepEqual(result.faces[1].positions,sim.faces[1200].nodes.map(id=>sim.nodes[id].p));
 assert.equal(result.faces[1].target,sim.task.target[1200]);assert.ok(result.points[0].protected.length>0);assert.deepEqual(sim.snapshot(),before);
 for(const q of [{faceIds:[-1]},{faceIds:Array(33).fill(0)},{points:[[NaN,0,0]]},{points:Array(9).fill([0,0,0])},{path:true},[]])assert.throws(()=>geometryQuery(sim,q));
});
