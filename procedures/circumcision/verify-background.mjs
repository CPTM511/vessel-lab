// Verify recorded background rendering; no model inference or pixel reconstruction.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {sourceManifest,sha256} from './manifest.mjs';
const file=path.resolve(process.argv[2]),dir=path.dirname(file),report=JSON.parse(fs.readFileSync(file));
assert.equal(report.kind,'scripted anatomy inspection in unlocked background; no model inference');
assert.equal(report.condition,'unlocked background');assert.equal(report.passed,true);
assert.deepEqual(report.source,sourceManifest(),'Runtime source mismatch');
assert.equal(report.foregroundCriterion,'Known foreground process differs from the measured renderer process');
assert.ok(Number.isInteger(report.rendererPid)&&report.rendererPid>0);assert.equal(report.samples.length,20);
assert.equal(report.initial.retraction,0);assert.equal(report.final.retraction,0);assert.equal(report.final.mode,report.initial.mode);
for(const [index,row] of report.samples.entries()){
 assert.equal(row.mode,index%2?'covered':'ventral');assert.equal(row.controlSource,'scripted-inspection-test');assert.equal(row.renderer,'forward_plus');
 assert.ok(Number.isFinite(row.latencyMs)&&row.latencyMs>=0&&row.latencyMs<5000,'Feedback deadline exceeded');
 assert.equal(row.revision,report.initial.revision+index+1);assert.equal(row.filename,`frame-${String(index+1).padStart(3,'0')}.jpg`);
 const bytes=fs.readFileSync(path.join(dir,row.filename));assert.ok(bytes.length>1000&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217);
 assert.equal(sha256('data:image/jpeg;base64,'+bytes.toString('base64')),row.imageHash);
 if(index)assert.notEqual(row.imageHash,report.samples[index-1].imageHash,'Adjacent changing views must change pixels');
 for(const host of [row.before,row.after]){
  assert.equal(host.screenLocked,false);assert.equal(host.userSessionLocked,false);
  assert.ok(Number.isInteger(host.frontmostPid)&&host.frontmostPid>0);
  assert.notEqual(host.frontmostPid,report.rendererPid,'Measured renderer was foreground');
  assert.ok(host.frontmostBundle&&host.frontmostBundle!=='unknown'&&!/loginwindow/i.test(host.frontmostBundle));
 }
}
assert.equal(report.final.revision,report.samples.at(-1).revision);
console.log(JSON.stringify({verified:true,kind:report.kind,samples:20,maximumLatencyMs:Math.max(...report.samples.map(row=>row.latencyMs)),renderer:'forward_plus',sourceDigest:report.source.digest,condition:report.condition,foregroundCriterion:report.foregroundCriterion,scope:'Recorded source, JPEG integrity, revision sequence, deadlines and host-state fields; no independent pixel reconstruction, model episode or system-sleep claim'},null,2));
