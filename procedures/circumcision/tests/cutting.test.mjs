import test from 'node:test';
import assert from 'node:assert/strict';
import {TissueSim,cage,distance} from '../mechanics.mjs';
import {segmentTriangleDistance,sweptFaces,updateTopology} from '../cutting.mjs';
import {areaAccounting} from '../task-definition.mjs';
const step=(s,a)=>s.step({revision:s.revision,duration:.02,...a});
function move(s,name,p){while(distance(s.arms[name].position,p)>.00001){const from=s.arms[name].position,d=distance(from,p);step(s,{[name]:{position:from.map((v,i)=>v+(p[i]-v)*Math.min(1,3.5/d))}});}}
const center=(s,id)=>s.faces[id].nodes.reduce((v,n)=>v.map((x,i)=>x+s.nodes[n].p[i]/3),[0,0,0]);

test('capsule sweep detects triangle interiors, edges and degenerate cases without endpoint tunneling',()=>{
 const tri=[[0,0,0],[4,0,0],[0,4,0]];
 assert.equal(segmentTriangleDistance([1,1,-2],[1,1,2],...tri),0);
 assert.equal(segmentTriangleDistance([1,1,2],[1,1,3],...tri),2);
 assert.equal(segmentTriangleDistance([-1,-1,0],[-1,-1,0],...tri),Math.sqrt(2));
 assert.equal(segmentTriangleDistance([1,1,2],[2,1,2],...tri),2);
 assert.equal(segmentTriangleDistance([1,0,0],[1,0,0],[0,0,0],[0,0,0],[0,0,0]),1);
});

test('local cutting uses geometry, remains bounded, and cannot edit the independent target mask',()=>{
 const s=new TissueSim(11),hash=s.task.hash;
 assert.throws(()=>{s.task.target[0]=true;});assert.ok(Object.isFrozen(s.task.target));
 const face=(22*cage.angular+5)*2,p=center(s,face);move(s,'left',p);
 const untouched=s.snapshot(),hitIds=sweptFaces(s.nodes,s.faces,p,p);assert.ok(hitIds.length>0&&hitIds.length<12);
 const result=step(s,{left:{cut:true}});
 assert.deepEqual(s.faces.flatMap((f,i)=>f.active?[]:[i]),hitIds);
 assert.equal(result.metrics.protectedIntersections,0);
 assert.equal(s.task.hash,hash);assert.equal(result.metrics.area.offTargetRemovedFraction,0);
 assert.ok(result.metrics.area.targetDetachedFraction>0&&result.metrics.area.targetDetachedFraction<.03);
 assert.equal(result.metrics.components.length,1);
 assert.ok(result.metrics.activeConstraintCount<untouched.metrics.activeConstraintCount);
 const removed=result.metrics.cutFaceCount;
 step(s,{left:{position:[p[0]+3,p[1],p[2]]}});assert.equal(s.metrics().cutFaceCount,removed,'Cut must not latch into a later move');
});

test('invalid cutting commands and occupied instruments are rejected atomically',()=>{
 const s=new TissueSim(11),before=s.snapshot();
 assert.throws(()=>step(s,{left:{cut:'yes'}}),/boolean/);assert.deepEqual(s.snapshot(),before);
 assert.throws(()=>step(s,{left:{cut:true},right:{position:[0,0,0]}}));assert.deepEqual(s.snapshot(),before);
 step(s,{left:{jaw:0}});const closed=s.snapshot();assert.throws(()=>step(s,{left:{cut:true}}),/open/);assert.deepEqual(s.snapshot(),closed);
 const p=center(s,(22*cage.angular+5)*2);step(s,{left:{jaw:1}});move(s,'left',p);step(s,{left:{jaw:0}});
 assert.equal(s.metrics().activeGrasps,1);assert.throws(()=>step(s,{left:{cut:true,jaw:1}}),/unoccupied/);
});

test('topology includes both layers and bending support; detached tissue remains simulated',()=>{
 // Direct topology fixture only: this is not an instrument path or procedure success.
 const s=new TissueSim(11),allArea=s.task.areas.reduce((a,b)=>a+b,0);
 for(const f of s.faces)if(f.layer===0&&f.ring===12)f.active=false;
 let top=updateTopology(s.nodes,s.faces,s.edges,s.incident);
 assert.equal(top.components.length,1,'Inner layer still connects the distal shell');
 for(const f of s.faces)if(f.layer===1&&f.ring===4)f.active=false;
 top=updateTopology(s.nodes,s.faces,s.edges,s.incident);
 assert.equal(top.components.length,2);assert.equal(top.components.filter(c=>c.anchored).length,1);
 const area=areaAccounting(s.task,s.faces,top.componentOf,top.components);
 assert.ok(Math.abs(area.targetDetachedFraction-1)<1e-12);assert.equal(area.offTargetRemovedFraction,0);
 assert.ok(area.ablatedAreaMm2<allArea*.1,'Detachment must not delete the whole distal shell');
 const detachedFaces=s.faces.filter(f=>f.active&&!top.components[top.componentOf[f.nodes[0]]].anchored);
 assert.ok(detachedFaces.length>1000);
 for(const e of s.edges)if(e.active)assert.equal(top.componentOf[e.a],top.componentOf[e.b]);
 for(const e of s.edges.filter(e=>e.kind==='bend-distance'))if(!e.support.every(g=>g.some(id=>s.faces[id].active)))assert.equal(e.active,false);
});

test('off-target loss is measured from immutable initial area; no-cut baseline is not a success',()=>{
 const s=new TissueSim(29),baseline=s.observe();
 assert.equal(baseline.metrics.area.targetDetachedFraction,0);assert.equal(baseline.capabilities.terminalScore,false);
 s.faces[0].active=false;const top=updateTopology(s.nodes,s.faces,s.edges,s.incident);
 const result=areaAccounting(s.task,s.faces,top.componentOf,top.components);
 assert.equal(result.offTargetRemovedAreaMm2,s.task.areas[0]);
 s.nodes.forEach(n=>n.p=n.p.map(v=>v*2));
 assert.deepEqual(areaAccounting(s.task,s.faces,top.componentOf,top.components),result);
});

test('cutting reproducibly releases a grasp when its actual supporting face is removed',()=>{
 const a=new TissueSim(83),b=new TissueSim(83);
 for(const s of [a,b]){
  const p=center(s,(22*cage.angular+5)*2);move(s,'left',p);step(s,{left:{jaw:0}});
  const face=s.arms.left.grasp.face;move(s,'right',p);step(s,{right:{cut:true}});
  assert.equal(s.faces[face].active,false);assert.equal(s.arms.left.grasp,null);
  assert.ok(s.events.some(e=>e.type==='grasp_released_by_cut'));
 }
 assert.deepEqual(a.snapshot(),b.snapshot());
});
