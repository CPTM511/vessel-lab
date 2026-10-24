// A recording may be replayed only with identical mechanical/task definitions.
// Changes to the controller or UI do not turn old evidence into new live evidence.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {TissueSim} from './mechanics.mjs';import {sourceManifest,sha256} from './manifest.mjs';
export const mechanicalFiles=['mechanics.mjs','scenario.mjs','contact.mjs','cutting.mjs','task-definition.mjs','evaluation.mjs','attachments.mjs','godot/data/tissue-rest.json','docs/PROTOCOL.md'];
export function recordingHeader(dir){const first=JSON.parse(fs.readFileSync(path.join(dir,'agent.jsonl'),'utf8').split('\n')[0]);assert.equal(first.type,'configuration');assert.equal(first.kind,'live controller attempt','Only actual model recordings are replay examples');assert.ok(Number.isInteger(first.seed));return first;}
export function readRecording(dir){
 const bytes=fs.readFileSync(path.join(dir,'agent.jsonl')),rows=bytes.toString().trim().split('\n').map(JSON.parse),config=recordingHeader(dir),files=sourceManifest().files;
 for(const file of mechanicalFiles)assert.equal(config.source.files[file],files[file],'Recording mechanics changed: '+file);
 assert.equal(config.model,'gpt-6-astra');const identity=rows.find(r=>r.type==='model_session');assert.equal(identity?.model,'gpt-6-astra');assert.equal(identity?.modelProvider,'openai');
 assert.equal(rows.find(r=>r.type==='turn_completed')?.turn.status,'completed');assert.ok(rows.some(r=>r.type==='verification'));assert.ok(!rows.some(r=>r.type==='error'),'Interrupted recordings are not replayable examples');
 const sim=new TissueSim(config.seed),wire=v=>JSON.parse(JSON.stringify(v)),requests=new Map(),accepted=new Set(),resolved=new Set(),operations=[];let imageCount=0;
 for(const row of rows){
  if(row.type==='model_tool_request'){assert.equal(row.namespace,'anatomy');assert.ok(!requests.has(row.callId));requests.set(row.callId,row);}
  if(row.type==='accepted_command'){
   const request=requests.get(row.callId);assert.ok(request);assert.deepEqual(row.args,request.args);assert.equal(row.tool,request.tool);assert.ok(!accepted.has(row.callId));accepted.add(row.callId);
   if(row.tool==='step')sim.step(row.args);else if(row.tool==='finish')sim.finish();else assert.equal(row.tool,'inspect');
   assert.deepEqual(row.result.mechanics,wire(sim.observe()));operations.push({tool:row.tool,args:row.args,observation:wire(sim.observe()),geometryHash:sha256(JSON.stringify(sim.snapshot().positions)),topologyHash:sha256(JSON.stringify({faces:sim.snapshot().faces,componentOf:sim.snapshot().componentOf,targetMask:sim.snapshot().targetMask}))});
  }
  if(row.type==='tool_result'||row.type==='rejected_observation'){
   assert.ok(requests.has(row.callId));assert.ok(!resolved.has(row.callId));resolved.add(row.callId);assert.deepEqual(row.output.observation,wire(sim.observe()));
   const f=row.frame;assert.match(f.filename,/^(frame|error)-\d{5}\.jpg$/);const jpeg=fs.readFileSync(path.join(dir,f.filename));assert.ok(jpeg.length>1000&&jpeg[0]===255&&jpeg[1]===216);assert.equal(sha256('data:image/jpeg;base64,'+jpeg.toString('base64')),f.imageHash);assert.equal(f.seed,sim.seed);assert.equal(f.mechanicsRevision,sim.revision);assert.ok(Math.abs(f.anatomyScale-sim.scale)<1e-6);imageCount++;
   if(row.type==='tool_result'){assert.equal(row.geometryHash,sha256(JSON.stringify(sim.snapshot().positions)));assert.equal(row.topologyHash,sha256(JSON.stringify({faces:sim.snapshot().faces,componentOf:sim.snapshot().componentOf,targetMask:sim.snapshot().targetMask})));}
  }
  if(row.type==='tool_error'){assert.equal(row.accepted,false);assert.ok(requests.has(row.callId));}
 }
 assert.equal(resolved.size,requests.size);assert.deepEqual(rows.find(r=>r.type==='verification').state,wire(sim.observe()));assert.ok(operations.length,'No recorded changes');
 return {kind:'Recorded playback; no model inference',seed:config.seed,originalModel:config.model,originalSourceDigest:config.source.digest,journalHash:sha256(bytes),operations,originalImages:imageCount,final:wire(sim.observe())};
}
