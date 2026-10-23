import test from 'node:test';import assert from 'node:assert/strict';
import {properTriangleIntersection,auditSelfIntersections} from '../mesh-audit.mjs';
const a=[[0,0,0],[2,0,0],[0,2,0]],b=[[.5,.5,-1],[.5,.5,1],[1.5,.5,.5]];
test('proper interior crossings are detected in either triangle order',()=>{
 assert.ok(properTriangleIntersection(a,b));assert.ok(properTriangleIntersection(b,a));
 assert.equal(properTriangleIntersection(a,b.map(p=>[p[0],p[1],p[2]+3])),null);
});
test('coplanar overlap is explicitly outside the diagnostic',()=>{
 assert.equal(properTriangleIntersection(a,a.map(p=>[p[0]+.2,p[1]+.2,p[2]])),null);
});
test('broad phase finds crossings between retained and detached faces',()=>{
 const sim={revision:0,nodes:[...a,...b].map(p=>({p})),faces:[{nodes:[0,1,2],layer:0,active:true},{nodes:[3,4,5],layer:1,active:true}],topology:{componentOf:[0,0,0,1,1,1],components:[{anchored:true},{anchored:false}]}};
 assert.deepEqual(auditSelfIntersections(sim).properCrossings,{retained:0,detached:0,mixed:1});
 sim.faces[1].active=false;assert.equal(auditSelfIntersections(sim).properCrossings.mixed,0);
});
