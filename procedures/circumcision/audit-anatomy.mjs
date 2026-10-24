// Validate exported Godot surface samples against protected exclusion queries.
// This is numerical geometry evidence, not a rendered or model-controlled episode.
import fs from 'node:fs';import crypto from 'node:crypto';import path from 'node:path';import assert from 'node:assert/strict';
import {protectedQueries,cageHash} from './mechanics.mjs';
const filename=process.argv[2]||path.join(import.meta.dirname,'godot/data/anatomy-audit.json');
const data=JSON.parse(fs.readFileSync(filename));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
assert.equal(data.anatomyHash,sha(fs.readFileSync(new URL('godot/anatomy.gd',import.meta.url))),'Surface samples are stale; run godot/audit_anatomy.gd');
assert.deepEqual(data.rows.map(r=>r.retraction),[0,.5,1]);
const summary=[];
for(const row of data.rows)for(const name of ['frenulum','meatus','glans']){
 const samples=row[name];assert.ok(Array.isArray(samples)&&samples.length>=1000);
 let outsideNamed=0,outsideUnion=0,maxSignedBoundMm=-Infinity;
 for(const p of samples){assert.equal(p.length,3);assert.ok(p.every(Number.isFinite));const qs=protectedQueries(p),q=qs.find(q=>q.structure===(name==='meatus'?'urethra':name));assert.ok(Number.isFinite(q.distance));if(q.distance>0)outsideNamed++;if(Math.min(...qs.map(q=>q.distance))>0)outsideUnion++;maxSignedBoundMm=Math.max(maxSignedBoundMm,q.distance);}
 summary.push({inspectionMorph:row.retraction,structure:name,samples:samples.length,outsideNamed,outsideUnion,maxSignedBoundMm});
}
const passed=summary.every(r=>r.outsideNamed===0&&r.outsideUnion===0);
console.log(JSON.stringify({kind:'Numerical protected-surface coverage; no clinical or controller validation',passed,anatomyHash:data.anatomyHash,cageHash,samplesHash:sha(fs.readFileSync(filename)),summary}));if(!passed)process.exitCode=1;
