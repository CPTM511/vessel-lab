// Verify scripted renderer records without counting them as model evidence.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {sourceManifest,sha256} from './manifest.mjs';
const file=path.resolve(process.argv[2]),r=JSON.parse(fs.readFileSync(file)),dir=path.dirname(file),allowed=new Set([...Object.keys(sourceManifest().files),'inspect.mjs']);
assert.equal(r.kind,'scripted anatomy inspection; not model or procedure evidence');assert.equal(r.passed,true);assert.equal(sha256(JSON.stringify(r.sourceHashes)),r.sourceDigest);assert.equal(Object.keys(r.sourceHashes).length,allowed.size);
for(const [f,h] of Object.entries(r.sourceHashes)){assert.ok(allowed.has(f));assert.equal(sha256(fs.readFileSync(path.join(import.meta.dirname,f))),h,'Source mismatch '+f);}
const views=[['covered',0],['retracted',1],['ventral',1],['inner',0],['protected',1],['glans',1],['meatus',1],['outer',0]],expected=r.requiresLockedHost?40:8;assert.equal(r.samples.length,expected);
for(const [i,row] of r.samples.entries()){
 const [mode,morph]=r.requiresLockedHost?['covered',i%2===0?.15:.25]:views[i];assert.equal(row.mode,mode);assert.equal(row.retraction,morph);assert.ok(row.latencyMs>=0&&row.latencyMs<5000);assert.ok(['forward_plus','gl_compatibility'].includes(row.renderer));assert.match(row.filename,/^(frame-\d{3}|covered|retracted|ventral|inner|protected|glans|meatus|outer)\.jpg$/);const b=fs.readFileSync(path.join(dir,row.filename));assert.ok(b.length>1000&&b[0]===255&&b[1]===216&&b.at(-2)===255&&b.at(-1)===217);assert.equal(sha256('data:image/jpeg;base64,'+b.toString('base64')),row.imageHash);
 if(i){assert.equal(row.revision,r.samples[i-1].revision+1);assert.notEqual(row.imageHash,r.samples[i-1].imageHash);}
 if(r.requiresLockedHost)for(const host of [row.before,row.after]){assert.equal(host.screenLocked,true);assert.equal(host.userSessionLocked,true);}
}
console.log(JSON.stringify({verified:true,kind:r.kind,samples:r.samples.length,requiresLockedHost:r.requiresLockedHost,maximumLatencyMs:Math.max(...r.samples.map(x=>x.latencyMs)),renderers:[...new Set(r.samples.map(x=>x.renderer))],sourceDigest:r.sourceDigest,scope:'Source and recorded JPEG integrity with state/lock/deadline checks; no model or procedure result'},null,2));
