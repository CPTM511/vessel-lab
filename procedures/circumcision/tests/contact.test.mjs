import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTACT_GAP_MM,triangleSeparation,sweptTriangleContact,filterShellMotion} from '../contact.mjs';
const tri=[[0,0,0],[2,0,0],[0,2,0]];
const shift=(t,delta)=>t.map(p=>p.map((v,i)=>v+delta[i]));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

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
