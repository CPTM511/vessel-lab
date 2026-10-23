// Verify a sanitized episode without account or session metadata.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {VesselSim} from './sim.mjs';
import {sourceManifest,sha256} from './manifest.mjs';
const file=process.argv[2];
if(!file)throw Error('Usage: node verify-public.mjs evidence/evaluations/<episode>/episode.json');
const e=JSON.parse(fs.readFileSync(file)),dir=path.dirname(file);
assert.equal(e.kind,'sanitized live controller episode');
assert.equal(e.model,'gpt-6-astra');assert.equal(e.provider,'openai');
assert.deepEqual(e.source,sourceManifest(),'Use the recorded source revision for replay');
const sim=new VesselSim(e.seed);
for(const a of e.actions){
 assert.equal(a.source,'gpt-6-astra');
 const result=a.tool==='step'?sim.step(a.args):a.tool==='cut'?sim.cutThread():sim.finish();
 assert.deepEqual(result,a.output);assert.equal(sim.revision,a.revision);
}
for(const t of e.tools){
 const bytes=fs.readFileSync(path.join(dir,t.frame));
 assert.equal(sha256('data:image/jpeg;base64,'+bytes.toString('base64')),t.frameHash);
 assert.ok(t.engine.startsWith('Godot '));
 if(t.tool!=='observe'){
  const a=e.actions.find(a=>a.id===t.actionId);assert.ok(a);
  assert.equal(a.revision,t.afterRevision);assert.equal(a.tool,t.tool);assert.deepEqual(a.output,t.output);
  if(t.tool==='step')assert.deepEqual(a.args,t.args);
 }
}
assert.deepEqual(sim.result,e.result);
console.log(JSON.stringify({valid:true,seed:e.seed,actions:e.actions.length,frames:e.tools.length,passed:e.result?.passed??false,sourceDigest:e.source.digest}));
