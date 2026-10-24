import test from 'node:test';
import assert from 'node:assert/strict';
import {filterShellMotion,triangleSeparation,CONTACT_GAP_MM} from '../contact.mjs';
import {properTriangleIntersection} from '../mesh-audit.mjs';

test('100 deterministic deforming face pairs retain separation along sampled accepted paths',()=>{
 let state=71;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
 const faces=[{nodes:[0,1,2],active:true},{nodes:[3,4,5],active:true}];
 for(let trial=0;trial<100;trial++){
  const old=[[-2,-1,3],[2,-1,3],[0,2,3],[-2,1,0],[2,1,0],[0,-2,0]];
  const nodes=old.map((p,i)=>({p:p.map((v,k)=>v+(random()-.5)*(k===2?12:6)),inv:trial%3===0&&i>2?0:1}));
  for(let i=0;i<6;i++)if(!nodes[i].inv)nodes[i].p=[...old[i]];
  filterShellMotion(nodes,faces,old,{});
  // Independent proper-crossing diagnostic plus a finite-gap check at 65
  // samples. These are stress controls, not a general CCD correctness proof.
  for(let sample=0;sample<=64;sample++){
   const t=sample/64,p=nodes.map((n,i)=>n.p.map((v,k)=>old[i][k]+t*(v-old[i][k]))),a=p.slice(0,3),b=p.slice(3);
   assert.equal(properTriangleIntersection(a,b),null,`Crossing at ${trial}:${sample}`);
   assert.ok(triangleSeparation(a,b).distance>=CONTACT_GAP_MM-1e-6,`Gap at ${trial}:${sample}`);
  }
 }
});
