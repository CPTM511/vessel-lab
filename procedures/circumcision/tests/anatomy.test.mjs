import test from 'node:test';import assert from 'node:assert/strict';
import {TissueSim,glansQuery,protectedQueries,cage} from '../mechanics.mjs';
import {evaluate} from '../evaluation.mjs';

test('visible frenular-root witness is covered and records an instrument hit',()=>{
 // This Godot-authored root sample lies beyond the earlier capsule envelope.
 const witness=[-10.8000001907349,-10.7611541748047,1.79999995231628];
 const s=new TissueSim(11),p=witness.map(v=>v*s.scale);
 assert.ok(protectedQueries(p,s.scale).find(q=>q.structure==='frenulum').distance<0);
 const arm={...s.arms.left,position:p};s.sweepProtected('left',arm,arm,new Set());
 assert.ok(s.protectedContacts.some(c=>c.structure==='frenulum'));
 // This direct collision fixture bypasses step(); evaluate independently
 // instead of reading the reset observation's memoized assessment.
 assert.equal(evaluate(s,protectedQueries).gates.protectedVolumes,false);
});

test('coincident side and apical boundary queries retain usable outward normals',()=>{
 for(const p of [[23,.5,0],cage.glansSections[20][0],cage.glansSections[40][12]]){
  const q=glansQuery(p);assert.ok(Number.isFinite(q.distance));assert.ok(q.normal.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...q.normal)-1)<1e-8);
 }
 assert.deepEqual(glansQuery([23,.5,0]).normal,[1,0,0]);
});

test('anatomical protection does not remove the pre-existing capsule exclusions',()=>{
 for(const p of [[-72,-5.7,0],[-35,-5.7,1.1],[10,-2.9,0],[-10.8,-10.4,0],[9,-10.2,1.1]]){
  assert.ok(protectedQueries(p).some(q=>q.distance<0));
 }
});
