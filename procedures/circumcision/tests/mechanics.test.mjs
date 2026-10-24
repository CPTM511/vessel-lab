import test from 'node:test';
import assert from 'node:assert/strict';
import {TissueSim,distance,glansQuery,protectedQueries,cage} from '../mechanics.mjs';
const step=(s,changes)=>s.step({revision:s.revision,duration:.05,...changes});
function move(s,name,p){let guard=0;while(distance(s.arms[name].position,p)>.001){const from=s.arms[name].position,d=distance(from,p),q=from.map((v,i)=>v+(p[i]-v)*Math.min(1,3.5/d));step(s,{[name]:{position:q}});if(++guard>100)throw Error('Fixture motion failed');}}

test('invalid bilateral commands and stale revisions are atomic',()=>{
 const s=new TissueSim(11),before=s.snapshot();
 assert.throws(()=>step(s,{left:{position:s.arms.left.position.map((v,i)=>v-(i===1?1:0))},right:{position:[100,0,0]}}));
 assert.deepEqual(s.snapshot(),before);
 assert.throws(()=>s.step({revision:2,duration:.1}));
 assert.throws(()=>step(s,{right:{rotationDeg:[21,0,0]}}),/20 degrees/);
 assert.deepEqual(s.snapshot(),before);
});
test('rest state is stable, fixed boundaries do not drift, and grasp requires proximity',()=>{
 const s=new TissueSim(11);step(s,{left:{jaw:0}});
 assert.equal(s.metrics().activeGrasps,0);assert.equal(s.metrics().maxDisplacementMm,0);
 assert.ok(s.events.some(e=>e.type==='grasp_missed'));
 for(const n of s.nodes.filter(n=>n.fixed))assert.deepEqual(n.p,n.rest);
});
test('barycentric grasp moves actual tissue; releasing removes constraints without a visual morph',()=>{
 const s=new TissueSim(11);const id=s.idx(0,cage.axial,5),p=[...s.nodes[id].p];
 move(s,'left',p);step(s,{left:{jaw:0}});
 assert.equal(s.metrics().activeGrasps,1);
 const original=s.nodes.map(n=>[...n.p]);
 const desired=[p[0]+3,p[1]+1,p[2]];step(s,{left:{position:desired}});
 assert.ok(s.metrics().maxDisplacementMm>2);
 assert.ok(s.nodes.some((n,i)=>distance(n.p,original[i])>1));
 assert.ok(s.metrics().graspErrors[0].error<.1);
 for(const n of s.nodes.filter(n=>n.fixed))assert.deepEqual(n.p,n.rest);
 assert.equal(s.metrics().protectedIntersections,0);
 step(s,{left:{jaw:1}});assert.equal(s.metrics().activeGrasps,0);
 assert.ok(s.nodes.every(n=>n.p.every(Number.isFinite)));
});
test('protected anatomy uses independent geometry and swept instrument violations remain recorded',()=>{
 assert.ok(glansQuery([0,0,0]).distance<0);
 assert.ok(protectedQueries([-30,-5.7,0]).some(q=>q.structure==='urethra'&&q.distance<0));
 const s=new TissueSim(11);move(s,'right',[0,16,0]);move(s,'right',[0,8,0]);
 assert.ok(s.protectedContacts.some(c=>c.structure==='glans'));
 const count=s.protectedContacts.length;move(s,'right',[0,20,0]);assert.ok(s.protectedContacts.length>=count);
});
test('the same seed and low-level sequence reproduce tissue positions',()=>{
 const a=new TissueSim(29),b=new TissueSim(29);
 for(const s of [a,b]){step(s,{left:{position:s.arms.left.position.map((v,i)=>v-(i===1?1:0)),rotationDeg:[0,10,0]}});step(s,{right:{position:s.arms.right.position.map((v,i)=>v-(i===1?1:0))}});}
 assert.deepEqual(a.snapshot(),b.snapshot());
});
