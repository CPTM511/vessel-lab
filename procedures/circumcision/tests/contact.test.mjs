import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTACT_GAP_MM,triangleSeparation,sweptTriangleContact,filterShellMotion} from '../contact.mjs';
const tri=[[0,0,0],[2,0,0],[0,2,0]];
const shift=(t,delta)=>t.map(p=>p.map((v,i)=>v+delta[i]));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('shell separation and a rigid support plane remain satisfied together while sliding',()=>{
 const old=[...shift(tri,[0,0,.1]),...shift(tri,[0,0,.13000009])];
 const faces=[{nodes:[0,1,2],active:true},{nodes:[3,4,5],active:true}];
 const proposal=()=>old.map((p,i)=>({p:[p[0]+.02,p[1],i<3?.1:.105],inv:1,alive:true}));
 const uncoupled=proposal();filterShellMotion(uncoupled,faces,old);
 assert.ok(Math.min(...uncoupled.map(n=>n.p[2]))<.099,'Fixture must expose the conflicting independent projections');
 const nodes=proposal(),stats=filterShellMotion(nodes,faces,old,{}, {margin:.1,query:p=>({distance:p[2],normal:[0,0,1]})});
 assert.ok(stats.rigidContacts>0);assert.equal(stats.limited,false);
 assert.ok(nodes.every(n=>n.p[2]>=.1-1e-9));
 assert.ok(triangleSeparation(nodes.slice(0,3).map(n=>n.p),nodes.slice(3).map(n=>n.p)).distance>=CONTACT_GAP_MM-1e-7);
 for(let i=0;i<nodes.length;i++)near(nodes[i].p[0],old[i][0]+.02);
});

test('rigid support projection leaves fixed nodes and unconstrained tangential motion unchanged',()=>{
 const old=[[0,0,.1],[2,0,.1]],nodes=[{p:[.04,0,-.2],inv:1,alive:true},{p:[2,0,.1],inv:0,alive:true}];
 const stats=filterShellMotion(nodes,[],old,{}, {margin:.1,query:p=>({distance:p[2],normal:[0,0,1]})});
 assert.ok(stats.rigidContacts>0);assert.equal(stats.limited,false);
 near(nodes[0].p[0],.04);assert.ok(nodes[0].p[2]>=.1);assert.deepEqual(nodes[1].p,old[1]);
});

test('continuous shell contact stops fast tunnelling through a fixed triangle',()=>{
 const hit=sweptTriangleContact(shift(tri,[0,0,4]),shift(tri,[0,0,-4]),tri,tri);
 near(hit.time,(4-CONTACT_GAP_MM)/8);near(hit.distance,CONTACT_GAP_MM);
 assert.equal(hit.conservativeLimit,false);
});
test('edge/edge contact is detected when every vertex projects outside the other triangle',()=>{
 const a=[[-2,-1,0],[2,-1,0],[0,2,0]],b=[[-2,1,0],[2,1,0],[0,-2,0]];
 const hit=sweptTriangleContact(shift(a,[0,0,1]),shift(a,[0,0,-1]),b,b);
 near(hit.time,(1-CONTACT_GAP_MM)/2);
 assert.equal(hit.a.filter(w=>w>1e-8).length,2);
 assert.equal(hit.b.filter(w=>w>1e-8).length,2);
});
test('coplanar sliding collision and a separating trajectory are distinguished',()=>{
 const other=shift(tri,[3,0,0]);
 const hit=sweptTriangleContact(tri,shift(tri,[4,0,0]),other,other);
 near(hit.time,(1-CONTACT_GAP_MM)/4);
 assert.equal(sweptTriangleContact(tri,shift(tri,[-4,0,0]),other,other),null);
});
test('common rigid translation creates no contact and preserves separation',()=>{
 const other=shift(tri,[0,0,1]),delta=[20,-10,7];
 assert.equal(sweptTriangleContact(tri,shift(tri,delta),other,shift(other,delta)),null);
 near(triangleSeparation(tri,other).distance,1);
});
test('a recorded grazing path is certified without exhausting conservative advancement',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('fixtures/contact-grazing.json',import.meta.url)));
 assert.equal(sweptTriangleContact(c.oldA,c.nextA,c.oldB,c.nextB),null);
});
test('collision response preserves fixed points and exposes conservative limiting',()=>{
 const old=[...shift(tri,[0,0,1]),...tri],nodes=old.map((p,i)=>({p:i<3?shift([p],[0,0,-2])[0]:[...p],inv:i<3?1:0}));
 const faces=[{nodes:[0,1,2],active:true},{nodes:[3,4,5],active:true}];
 const stats=filterShellMotion(nodes,faces,old);
 assert.ok(stats.contacts>0);assert.deepEqual(nodes.slice(3).map(n=>n.p),tri);
 assert.ok(triangleSeparation(nodes.slice(0,3).map(n=>n.p),tri).distance>=CONTACT_GAP_MM-1e-7);
 assert.ok(nodes.slice(0,3).every(n=>n.p[2]>0));
});
test('cut faces are absent from collision and shared vertices define adjacency',()=>{
 const old=[...shift(tri,[0,0,1]),...tri];
 const next=()=>old.map((p,i)=>({p:i<3?shift([p],[0,0,-2])[0]:[...p],inv:1}));
 let nodes=next();assert.equal(filterShellMotion(nodes,[{nodes:[0,1,2],active:true},{nodes:[3,4,5],active:false}],old).contacts,0);
 assert.equal(nodes[0].p[2],-1);
 nodes=next();assert.equal(filterShellMotion(nodes,[{nodes:[0,1,2],active:true},{nodes:[0,4,5],active:true}],old).contacts,0);
});
test('reused broad-phase bounds rebuild when a previously distant face moves into contact',()=>{
 const old=[...shift(tri,[0,0,4]),...tri],nodes=old.map((p,i)=>({p:[...p],inv:i<3?1:0}));
 const faces=[{nodes:[0,1,2],active:true},{nodes:[3,4,5],active:true}],cache={};
 for(let i=0;i<3;i++)nodes[i].p[2]=3;
 assert.equal(filterShellMotion(nodes,faces,old,cache).contacts,0);
 const before=nodes.map(n=>[...n.p]);for(let i=0;i<3;i++)nodes[i].p[2]=-3;
 assert.ok(filterShellMotion(nodes,faces,before,cache).contacts>0);
 assert.ok(nodes.slice(0,3).every(n=>n.p[2]>0));
});

test('sampled residual slope preserves frictionless tangent motion with coupled shell contact',()=>{
 const slope=10,len=Math.hypot(slope,1),normal=[-slope/len,0,1/len];
 const lower=[[0,0,.1],[1,0,slope+.1],[0,1,.1]];
 const old=[...lower,...lower.map(p=>p.map((v,k)=>v+.03000009*normal[k]))];
 const nodes=old.map((p,i)=>({p:p.map((v,k)=>v+(k===0?.02:0)-(i>=3?.025*normal[k]:0)),inv:1,alive:true}));
 const stats=filterShellMotion(nodes,[{nodes:[0,1,2],active:true},{nodes:[3,4,5],active:true}],old,{},
  {margin:.1,query:p=>({distance:p[2]-slope*p[0],normal:[0,0,1]})});
 assert.equal(stats.limited,false);
 assert.ok(nodes.every(n=>n.p[2]-slope*n.p[0]>=.1-1e-9));
 assert.ok(triangleSeparation(nodes.slice(0,3).map(n=>n.p),nodes.slice(3).map(n=>n.p)).distance>=CONTACT_GAP_MM-1e-7);
 for(let i=0;i<nodes.length;i++){
  const d=nodes[i].p.map((v,k)=>v-old[i][k]);
  assert.ok(Math.abs(d[0]+slope*d[2]-.02)<1e-8,'A frictionless normal correction must preserve tangential displacement');
 }
});

test('finite-difference contact handles a bounded query domain without nonfinite state',()=>{
 const old=[[0,0,.1]],nodes=[{p:[0,0,-.01],inv:1,alive:true}];
 const stats=filterShellMotion(nodes,[],old,{}, {margin:.1,query:p=>p[0]<0?null:{distance:p[2],normal:[0,0,1]}});
 assert.equal(stats.limited,false);assert.ok(nodes[0].p.every(Number.isFinite));assert.ok(nodes[0].p[2]>=.1);
});
