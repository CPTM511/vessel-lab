import test from 'node:test';
import assert from 'node:assert/strict';
import {TissueSim,protectedQueries,cage} from '../mechanics.mjs';
import {updateTopology} from '../cutting.mjs';
import {evaluate,recordIntegrity,releasedCondition,closureSamples} from '../evaluation.mjs';
import {planAttachment,invalidateAttachments} from '../attachments.mjs';
function refresh(s){s.topology=updateTopology(s.nodes,s.faces,s.edges,s.incident);s.lastMetrics=null;s.lastEvaluation=null;}
function cutFixture(){
 // Direct numerical fixture: never a scripted tool path or live episode.
 const s=new TissueSim(11);
 for(const f of s.faces)if(f.ring===s.task.boundaryRings[f.layer])f.active=false;
 refresh(s);return s;
}
function clearSpecimen(s){for(let id=0;id<s.nodes.length;id++)if(s.nodes[id].alive&&!s.topology.components[s.topology.componentOf[id]].anchored)s.nodes[id].p[1]+=50;refresh(s);}
const score=s=>evaluate(s,protectedQueries);
const step=(s,a={})=>s.step({revision:s.revision,duration:.02,...a});

test('nominally close intact surfaces never count as cut wound edges',()=>{
 const s=new TissueSim(11),r=score(s);
 assert.ok(r.closure.samples.every(p=>p.gapMm<1));
 assert.equal(r.closure.validSamples,0);assert.equal(r.gates.retainedEdgeApproximation,false);
 s.releaseSeconds=20;assert.equal(score(s).passed,false);assert.throws(()=>s.finish(),/C0 gates unmet/);
});

test('a real two-layer cut exposes independent retained margins and releases hidden native ties',()=>{
 const s=cutFixture(),r=score(s);
 assert.equal(r.closure.validSamples,48);assert.equal(r.closure.coveredSamples,48);
 assert.ok(s.edges.some(e=>e.releasedInterface));assert.ok(s.edges.filter(e=>e.releasedInterface).every(e=>!e.active));
 assert.equal(r.gates.resolvedTargetComponents,false);assert.equal(r.gates.releasedHold,false);assert.equal(r.passed,false);
 clearSpecimen(s);assert.equal(score(s).unresolvedComponents.length,0);
});

test('missing samples and widened edges cannot shrink the fixed scoring denominator',()=>{
 const s=cutFixture();clearSpecimen(s);
 for(const [,id] of s.task.pairNodes.slice(0,3))s.nodes[id].p[0]+=3;
 let r=score(s);assert.equal(r.closure.totalSamples,48);assert.equal(r.closure.coveredSamples,45);assert.equal(r.gates.retainedEdgeApproximation,false);
 const t=cutFixture();clearSpecimen(t);
 const removed=new Set(t.task.pairNodes.slice(0,3).flat());for(const f of t.faces)if(f.nodes.some(id=>removed.has(id)))f.active=false;refresh(t);
 r=score(t);assert.equal(r.closure.totalSamples,48);assert.ok(r.closure.validSamples<=45);assert.equal(r.gates.retainedEdgeApproximation,false);
});

test('retained collapse or an observed substep orientation reversal is a persistent failure',()=>{
 const s=cutFixture();clearSpecimen(s);const f=s.faces.find(f=>f.active&&f.layer===0&&f.ring===3),[a,b]=f.nodes;
 const before=s.nodes.map(n=>[...n.p]);[s.nodes[a].p,s.nodes[b].p]=[s.nodes[b].p,s.nodes[a].p];recordIntegrity(s,before);
 s.nodes.forEach((n,i)=>n.p=[...before[i]]);
 assert.ok(score(s).invalidRetainedFaces.length>0);assert.equal(score(s).gates.retainedIntegrity,false);
 const t=cutFixture();const ids=t.faces[0].nodes;t.nodes[ids[1]].p=[...t.nodes[ids[0]].p];assert.equal(score(t).gates.retainedIntegrity,false);
});

test('five consecutive simulated seconds must be released; terminal success freezes further actions',()=>{
 const s=cutFixture();clearSpecimen(s);
 assert.equal(releasedCondition(s,protectedQueries),true);
 for(let i=0;i<9;i++)step(s,{duration:.5});
 assert.equal(score(s).gates.releasedHold,false);assert.throws(()=>s.finish(),/releasedHold/);
 step(s,{duration:.5});const r=score(s);assert.equal(r.passed,true,JSON.stringify(r.failedGates));
 const finished=s.finish();assert.equal(finished.terminal.passed,true);
 assert.throws(()=>step(s),/terminal/);assert.throws(()=>s.finish(),/terminal/);
 s.reset(11);assert.equal(s.terminal,null);assert.equal(s.releaseSeconds,0);
});

test('closed jaws, surface proximity, a grasp or cut pulse resets released hold',()=>{
 const s=new TissueSim(11);s.releaseSeconds=4.9;step(s,{left:{jaw:0}});assert.equal(s.releaseSeconds,0);
 s.arms.left.jaw=1;s.arms.left.position=[...s.nodes[s.idx(0,24,5)].p];assert.equal(releasedCondition(s,protectedQueries),false);
 s.arms.left.position=[35,30,10];s.arms.right.position=[35,30,-10];s.arms.left.cutting=true;assert.equal(releasedCondition(s,protectedQueries),false);
});

test('local synthetic attachments require physical held cut margins and survive release',()=>{
 const s=cutFixture(),[a,b]=s.task.pairNodes[5];clearSpecimen(s);
 // Setup held points directly for this solver unit fixture, not through a controller.
 for(const [name,id] of [['left',a],['right',b]]){s.arms[name].position=[...s.nodes[id].p];s.updateJaw(name,0);}
 const tie=planAttachment(s);assert.equal(tie.anchors[0].layer!==tie.anchors[1].layer,true);
 step(s,{approximate:true});assert.equal(s.attachments.filter(a=>a.active).length,1);
 assert.throws(()=>step(s,{approximate:true}),/already have/);
 step(s,{left:{jaw:1},right:{jaw:1}});assert.equal(s.metrics().activeGrasps,0);assert.equal(s.attachments[0].active,true);
 // Cutting away its support invalidates the tie; it must not attach to missing tissue.
 const support=new Set(s.attachments[0].anchors[0].nodes);for(const f of s.faces)if(f.nodes.some(n=>support.has(n)))f.active=false;
 refresh(s);invalidateAttachments(s);assert.equal(s.attachments[0].active,false);
 const intact=new TissueSim(11);assert.throws(()=>step(intact,{approximate:true}),/holding tissue/);
 assert.throws(()=>step(intact,{approximate:true,left:{jaw:0}}),/separate stationary/);
});

test('protected hits and off-target removal independently fail an otherwise prepared fixture',()=>{
 const s=cutFixture();clearSpecimen(s);s.releaseSeconds=5;s.protectedContacts.push({structure:'glans'});assert.equal(score(s).gates.protectedVolumes,false);
 const t=cutFixture();clearSpecimen(t);for(const f of t.faces)if(f.layer===0&&f.ring<2)f.active=false;refresh(t);
 assert.ok(score(t).area.offTargetRemovedFraction>.01);assert.equal(score(t).gates.offTargetPreserved,false);
});
