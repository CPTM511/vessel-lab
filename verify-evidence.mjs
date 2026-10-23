// Offline check: no model call, network, API key or cost.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {VesselSim,VERSION} from './sim.mjs';
const file=process.argv[2];
if(!file){console.error('Usage: node verify-evidence.mjs <session-agent.jsonl>');process.exit(1);}
const rows=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse),dir=path.dirname(file);
const session=path.basename(file).replace(/-agent\.jsonl$/,'');
const eventFile=path.join(dir,session+'.jsonl');
const engineRows=fs.readFileSync(eventFile,'utf8').trim().split('\n').map(JSON.parse);
const sim=new VesselSim(engineRows.find(x=>x.type==='reset').seed);
let actions=0,frames=0,movements=0;
for(const e of engineRows.filter(x=>x.type==='action')){
 const c=e.command;
 if(c.action)sim.step(c.action);else if(e.result.checks)sim.finish();else sim.cutThread();
 assert.equal(sim.revision,e.revision);
 for(const key of ['arms','needle','tail','status'])assert.deepEqual(sim.observe()[key],e.state[key]);
 if(e.state.version===VERSION)assert.deepEqual(sim.metrics(),e.state.metrics);
 actions++;
}
for(const e of rows.filter(x=>x.type==='tool')){
 const bytes=fs.readFileSync(path.join(dir,e.frameFile));
 const hash=crypto.createHash('sha256').update('data:image/jpeg;base64,'+bytes.toString('base64')).digest('hex');
 assert.equal(hash,e.frameHash);assert.ok(e.engine.startsWith('Godot '));
 if(e.tool==='step'){
  const engine=engineRows.find(x=>x.type==='action'&&x.command.commandId===e.callId);
  assert.ok(engine,'Model action must correspond to an actual applied engine command');
  assert.deepEqual(engine.command.action,e.args);assert.equal(engine.revision,e.afterRevision);movements++;
 }
 frames++;
}
const model=rows.find(x=>x.type==='model_session'),pre=rows.find(x=>x.type==='subscription_preflight'),post=rows.find(x=>x.type==='verification');
assert.equal(model.model,'gpt-6-astra');assert.equal(pre.account.type,'chatgpt');
assert.ok(post,'A completed verification record is required');assert.equal(post.allowance.creditBalanceUnchanged,true);
assert.equal(post.allowance.ordinaryUsageAllowed,true);
const report={valid:true,model:model.model,account:pre.account,task:post.task,actions,modelMovements:movements,verifiedGodotFrames:frames,subscription:post.allowance,finalResult:sim.result,limitations:'Local logs are reproducible evidence, not a third-party attestation or clinical validation.'};
console.log(JSON.stringify(report,null,2));
