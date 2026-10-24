import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {sweptTriangleContact,triangleSeparation} from '../contact.mjs';
const tri=[[0,0,0],[2,0,0],[0,2,0]],start=tri.map(p=>[p[0],p[1],.03000005]);
test('near-band departing witnesses are not false time-zero impacts',()=>{
 for(const c of JSON.parse(fs.readFileSync(new URL('./fixtures/departing-contact.json',import.meta.url)))){
  assert.equal(sweptTriangleContact(c.oldA,c.nextA,c.oldB,c.nextB),null);
  for(let i=0;i<=1000;i++){const f=(p,q)=>p.map((v,k)=>v+i/1000*(q[k]-v));assert.ok(triangleSeparation(c.oldA.map((p,j)=>f(p,c.nextA[j])),c.oldB.map((p,j)=>f(p,c.nextB[j]))).distance>.03);}
 }
});
test('near-band approach is still detected immediately',()=>{
 const hit=sweptTriangleContact(start,start.map(p=>[p[0],p[1],p[2]-.1]),tri,tri);assert.ok(hit);assert.equal(hit.time,0);
});
test('a departing closest vertex does not hide later approach by another vertex',()=>{
 const end=start.map((p,i)=>[p[0],p[1],p[2]+(i===2?-.1:.1)]),hit=sweptTriangleContact(start,end,tri,tri);assert.ok(hit);assert.ok(hit.time>=0&&hit.time<1e-5);
});
