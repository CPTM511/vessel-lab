import test from 'node:test';import assert from 'node:assert/strict';
import {filterShellMotion,triangleSeparation,sweptTriangleContact,CONTACT_GAP_MM} from '../contact.mjs';
const stack=layers=>{const old=[],faces=[],tri=[[-1,-1,0],[1,-1,0],[0,1,0]];for(let i=0;i<layers;i++){faces.push({nodes:[3*i,3*i+1,3*i+2],active:true});old.push(...tri.map(p=>[p[0],p[1],i*.03000009]));}return {old,faces,nodes:old.map((p,i)=>({inv:i<3?0:1,p:[p[0]+(i<3?0:.02),p[1],p[2]-(i<3?0:.05)]}))};};
test('parallel surface contact preserves sliding instead of globally freezing the stack',()=>{
 for(const layers of [3,6,10]){const {old,faces,nodes}=stack(layers);
  const stats=filterShellMotion(nodes,faces,old,{});assert.equal(stats.limited,false);assert.deepEqual(nodes.slice(0,3).map(n=>n.p),old.slice(0,3));
  for(let i=3;i<nodes.length;i++)assert.ok(Math.abs(nodes[i].p[0]-old[i][0]-.02)<1e-12,'Normal constraints preserve tangential motion within floating-point roundoff');
  for(let a=0;a<faces.length;a++)for(let b=a+1;b<faces.length;b++){
   const fa=faces[a].nodes,fb=faces[b].nodes;
   assert.equal(sweptTriangleContact(fa.map(i=>old[i]),fa.map(i=>nodes[i].p),fb.map(i=>old[i]),fb.map(i=>nodes[i].p)),null);
   for(let k=0;k<=64;k++){const p=nodes.map((n,i)=>n.p.map((v,d)=>old[i][d]+k/64*(v-old[i][d])));assert.ok(triangleSeparation(fa.map(i=>p[i]),fb.map(i=>p[i])).distance>=CONTACT_GAP_MM-1e-9);}
  }
 }
});
test('coupled contact keeps a fixed obstacle fixed when all parallel closest features are tied',()=>{
 const {old,faces,nodes}=stack(2);const cache={};filterShellMotion(nodes,faces,old,cache);
 assert.deepEqual(nodes.slice(0,3).map(n=>n.p),old.slice(0,3));assert.ok(nodes.slice(3).every(n=>n.p[2]>=CONTACT_GAP_MM));
});
