import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceManifest,sha256} from '../manifest.mjs';
import {MODEL,instructions,tools,prompts} from '../controller-spec.mjs';
import {isolatedRuntime} from './fixtures/isolated-runtime.mjs';

test('freeze requires exact source, model, protocol, declared seeds and controller contract',async()=>{
 const fixture=isolatedRuntime();
 try {
  const {checkEvaluationFreeze}=await import(pathToFileURL(path.join(fixture.root,'evaluation-freeze.mjs')));
  const filename=path.join(fixture.root,'evaluation-freeze.json');
  assert.throws(()=>checkEvaluationFreeze(),/not frozen/);
  const valid={protocol:'C0',model:MODEL,seeds:[11,29,83],sourceDigest:sourceManifest().digest,instructionsHash:sha256(instructions),toolsHash:sha256(JSON.stringify(tools)),promptHash:sha256(prompts.procedure)};
  const write=value=>fs.writeFileSync(filename,JSON.stringify(value));
  write(valid);assert.deepEqual(checkEvaluationFreeze(),valid);
  for(const [key,value] of Object.entries({protocol:'C1',model:'another-model',seeds:[11,29],sourceDigest:'changed',instructionsHash:'changed',toolsHash:'changed',promptHash:'changed'})) {
   write({...valid,[key]:value});assert.throws(()=>checkEvaluationFreeze(),/does not match/,key);
  }
  write(valid);
  fs.appendFileSync(path.join(fixture.root,'mechanics.mjs'),'\n// Deliberate test-only source mutation.\n');
  assert.throws(()=>checkEvaluationFreeze(),/does not match/,'Changed runtime source rejects the previously valid freeze');
 } finally {fixture.cleanup();}
});
