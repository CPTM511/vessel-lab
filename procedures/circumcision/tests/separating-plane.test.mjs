import test from 'node:test';import assert from 'node:assert/strict';
import {rotatingPlane,triangleSeparation} from '../contact.mjs';
const b=[[0,0,0],[2,0,0],[0,2,0]],shift=(t,d)=>t.map(p=>p.map((v,i)=>v+d[i])),rot=t=>t.map(([x,y,z])=>[x,-z,y]),mix=(a,b)=>a.map((p,i)=>p.map((v,k)=>(v+b[i][k])/2));
test('a rotating separating plane certifies separated layers throughout the linear sweep',()=>{
 const a=shift(b,[0,0,.1]);assert.equal(rotatingPlane(a,rot(a),b,rot(b)),true);
});
test('endpoint separation cannot certify interior gap loss, tunnelling or coplanar crossing',()=>{
 const close=shift(b,[0,0,.031]);assert.equal(rotatingPlane(close,rot(close),b,rot(b)),false);assert.ok(triangleSeparation(mix(close,rot(close)),mix(b,rot(b))).distance<.03);
 assert.equal(rotatingPlane(shift(b,[0,0,1]),shift(b,[0,0,-1]),b,b),false);
 assert.equal(rotatingPlane(shift(b,[-5,0,0]),shift(b,[5,0,0]),b,b),false);
});
