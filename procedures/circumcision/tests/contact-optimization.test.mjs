// Preserve frozen contact arithmetic and candidate visitation order.
import fs from 'node:fs';import assert from 'node:assert/strict';import {test} from 'node:test';
test('optimized contact preserves frozen pair ordering and near-gap results',async()=>{
const load=async p=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(p,'utf8')+'\nexport {candidates};').toString('base64'));
const old=await load(new URL('../evidence/runtime-c0-round3/procedures/circumcision/contact.mjs',import.meta.url)),candidate=await load(new URL('../contact.mjs',import.meta.url));let seed=7123;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);for(let k=0;k<30;k++){const positions=Array.from({length:180},()=>Array.from({length:3},()=>rnd()*16-8));const next=positions.map(p=>p.map(v=>v+rnd()*.6-.3));const faces=Array.from({length:240},()=>({nodes:Array.from({length:3},()=>Math.floor(rnd()*180)),active:rnd()>.1}));assert.deepEqual(candidate.candidates(faces,positions,next).pairs,old.candidates(faces,positions,next).pairs);}
for(let k=0;k<150;k++){
 const z=k%3===0?.03+(rnd()-.5)*1e-6:rnd()+.01;
 const a=[[0,0,0],[1+rnd(),0,0],[0,1+rnd(),0]],b=[[rnd(),rnd(),z],[1+rnd(),rnd(),z],[rnd(),1+rnd(),z]];
 const next=t=>t.map(p=>p.map(v=>v+(rnd()-.5)*.08)),an=next(a),bn=next(b);
 assert.deepEqual(candidate.triangleSeparation(a,b),old.triangleSeparation(a,b));
 assert.equal(candidate.rotatingPlane(a,an,b,bn),old.rotatingPlane(a,an,b,bn));
 assert.deepEqual(candidate.sweptTriangleContact(a,an,b,bn),old.sweptTriangleContact(a,an,b,bn));
}
});
