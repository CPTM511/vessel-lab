// Replay recorded controller decisions and verify their state/frame associations.
// Pixels are hash checked, not reconstructed by this numerical verifier.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';


const dir=path.resolve(process.argv[2]),lines=fs.readFileSync(path.join(dir,'agent.jsonl'),'utf8').trim().split('\n'),rows=lines.map(JSON.parse),wire=x=>JSON.parse(JSON.stringify(x));
const recordedDigest=rows.find(r=>r.type==='configuration')?.source?.digest;
const historicalRuntimes={'d5dc3ac1de7d5f322460c8b5aaad7eed6a34a65474cd95c75fd9f59e325acc8b':'round1','80eebb1d781e2070099d52036405363937cf8884b32cbebd7a8c886b91818320':'round2','b51db9fee0baa0223c905a8f4ed3b734dc8862c255e730079e327089474386ae':'round3','202783f0a2e1a853c317984c0acd9e87da63fad189379674348fa3fbbdb38c1f':'round4','541fa1f89ec5546454acb94e5c8c6cf773ee0ffd11dc18fce5f63cc1e2149d4e':'round5'};
const runtime=historicalRuntimes[recordedDigest]?'./evidence/runtime-c0-'+historicalRuntimes[recordedDigest]+'/procedures/circumcision/':'./';
const {TissueSim}=await import(runtime+'mechanics.mjs'),{geometryQuery}=await import(runtime+'instrumentation.mjs');
const {sourceManifest,sha256}=await import(runtime+'manifest.mjs'),{MODEL,instructions,toolsForTask,prompts,ACTION_FRAME_DEADLINE_MS,RUNTIME_FEEDBACK_SCHEMA,actionTiming}=await import(runtime+'controller-spec.mjs');
const abortedAccess=process.argv.includes('--aborted-access');
const incomplete=process.argv.includes('--incomplete');
const frameFailure=process.argv.includes('--frame-failure');
assert.ok([abortedAccess,incomplete,frameFailure].filter(Boolean).length<=1,'Select one record-verification mode');
const configs=rows.filter(r=>r.type==='configuration');assert.equal(configs.length,1);const config=configs[0];
assert.equal(config.runtimeFeedbackSchema,RUNTIME_FEEDBACK_SCHEMA);
assert.equal(config.kind,'live controller attempt','Protocol doubles are not live model evidence');assert.equal(config.model,MODEL);assert.deepEqual(config.source,sourceManifest(),'Executed source differs');
assert.equal(config.instructionsHash,sha256(instructions));assert.equal(config.toolsHash,sha256(JSON.stringify(toolsForTask(config.task))));assert.equal(config.promptHash,sha256(prompts[config.task]));
const publicRecord=config.evidenceScope==='public-redacted';
if(publicRecord)assert.deepEqual(config.redactions,['access checks','session identifiers']);
const model=rows.find(r=>r.type==='model_session');assert.equal(model?.requestedModel,MODEL);assert.equal(model?.model,MODEL);assert.equal(model?.modelProvider,'openai');
if(!publicRecord)assert.equal(rows.find(r=>r.type==='access_preflight')?.accountType,'chatgpt');
assert.ok(rows.some(r=>r.type==='turn_started'));
const errors=rows.filter(r=>r.type==='error');let accessFailure=null;
if(abortedAccess){
 assert.equal(config.task,'procedure');assert.equal(errors.length,1,'Expected one explicit access-check interruption');
 accessFailure=errors[0].error;const parsed=JSON.parse(accessFailure);assert.equal(parsed.code,-32603);assert.match(parsed.message,/^failed to fetch codex rate limits: error sending request/);
 assert.ok(!rows.some(r=>r.type==='turn_completed'||r.type==='verification'),'An aborted record must not claim completion');
}else if(frameFailure){
 assert.equal(config.task,'procedure');assert.equal(errors.length,1);
 assert.equal(errors[0].error,'Fresh actual Godot observation unavailable; controller stopped');
 assert.ok(!rows.some(r=>r.type==='turn_completed'||r.type==='verification'));
}else{
 assert.equal(rows.find(r=>r.type==='turn_completed')?.turn.status,'completed');
 assert.equal(errors.length,0,'Failed run is preserved but cannot pass completion verification');
}
const allowance=rows.filter(r=>r.type==='allowance_check');if(!publicRecord)assert.ok(allowance.length>=3);
for(const r of allowance){assert.equal(r.ordinaryUsageAllowed,true);assert.equal(r.creditStateUnchanged,true);assert.ok(r.windows.length);assert.ok(r.windows.every(w=>Number.isFinite(w.usedPercent)&&w.usedPercent<95));}
const sim=new TissueSim(config.seed),requests=new Map(),acceptedRows=new Map(),accepted=new Set(),resolved=new Set(),images=new Set(),frameHashes=[];let moves=0,worldRevision=null,maxFeedbackMs=0,rejected=0,lastActionTiming=null;
const accessAborts=[];
function image(frame){assert.match(frame.filename,/^(frame|error)-\d{5}\.jpg$/);assert.ok(!images.has(frame.filename));images.add(frame.filename);const bytes=fs.readFileSync(path.join(dir,frame.filename));assert.ok(bytes.length>1000&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217);assert.equal(sha256('data:image/jpeg;base64,'+bytes.toString('base64')),frame.imageHash);assert.equal(frame.seed,sim.seed);assert.ok(Math.abs(frame.anatomyScale-sim.scale)<1e-6);assert.equal(frame.mechanicsRevision,sim.revision);frameHashes.push(frame.imageHash);}
for(const row of rows){
 if(row.type==='model_tool_request'){assert.equal(row.model,MODEL);assert.equal(row.namespace,'anatomy');assert.ok(!requests.has(row.callId));requests.set(row.callId,row);}
 if(row.type==='accepted_command'){
  const req=requests.get(row.callId);assert.ok(req);assert.deepEqual(row.args,req.args);assert.equal(row.tool,req.tool);assert.ok(!accepted.has(row.callId));accepted.add(row.callId);acceptedRows.set(row.callId,row);
  if(worldRevision===null)worldRevision=row.beforeRevision;assert.equal(row.beforeRevision,worldRevision);
  if(row.tool==='step'){if(config.task==='loop'){assert.ok(row.args.duration<=.05);for(const name of ['left','right'])if(row.args[name]){assert.deepEqual(Object.keys(row.args[name]),['position']);assert.ok(Math.hypot(...row.args[name].position.map((v,i)=>v-sim.arms[name].position[i]))<=1.000001);}}sim.step(row.args);moves++;}
  else if(row.tool==='finish'){assert.equal(config.task,'procedure');sim.finish();}
  else assert.equal(row.tool,'inspect');
  worldRevision++;assert.equal(row.result.revision,worldRevision);assert.deepEqual(row.result.mechanics,wire(sim.observe()),'Accepted command state does not reproduce');
 }
 if(row.type==='tool_result'){
  const req=requests.get(row.callId);assert.ok(req);assert.ok(!resolved.has(row.callId));resolved.add(row.callId);assert.deepEqual(row.args,req.args);assert.equal(row.tool,req.tool);assert.equal(row.success,true);
  if(worldRevision===null)worldRevision=row.beforeRevision;assert.equal(row.afterRevision,worldRevision);assert.equal(row.frame.revision,worldRevision);
  if(RUNTIME_FEEDBACK_SCHEMA){
   if(accepted.has(row.callId)){
    const a=acceptedRows.get(row.callId);assert.ok(Number.isFinite(a.responseReceivedAt)&&a.responseReceivedAt>=a.commandStartedAt&&a.responseReceivedAt<=Date.parse(a.at));
    lastActionTiming=actionTiming(a.tool,a.args,a.commandStartedAt,a.responseReceivedAt,row.frame.receivedAt);
   }
   assert.deepEqual(row.output.runtime,{schema:RUNTIME_FEEDBACK_SCHEMA,actionFrameDeadlineMs:ACTION_FRAME_DEADLINE_MS,lastAction:lastActionTiming},'Runtime feedback differs from recorded timestamps');
  }else assert.equal(row.output.runtime,undefined);
  assert.deepEqual(row.output.observation,wire(sim.observe()),'Model observation does not reproduce');
  if(row.tool==='geometry')assert.deepEqual(row.output.geometry,wire(geometryQuery(sim,row.args)));
  assert.equal(row.geometryHash,sha256(JSON.stringify(sim.snapshot().positions)));assert.equal(row.topologyHash,sha256(JSON.stringify({faces:sim.snapshot().faces,componentOf:sim.snapshot().componentOf,targetMask:sim.snapshot().targetMask})));
  assert.ok(['forward_plus','gl_compatibility'].includes(row.frame.renderer));image(row.frame);
  if(accepted.has(row.callId)){assert.ok(row.commandToFrameMs>=0&&row.commandToFrameMs<=5000);maxFeedbackMs=Math.max(maxFeedbackMs,row.commandToFrameMs);}else assert.ok(['observe','geometry'].includes(row.tool));
 }
 if(row.type==='tool_error'){
  if(frameFailure&&row.accepted){
   assert.equal(row,rows.at(-2));assert.equal(row.error,errors[0].error);
   const req=requests.get(row.callId);assert.ok(req);assert.deepEqual(row.args,req.args);assert.equal(row.tool,req.tool);
   assert.ok(accepted.has(row.callId));assert.ok(!resolved.has(row.callId));
   assert.equal(row.beforeRevision,worldRevision-1);continue;
  }
  assert.ok(!row.accepted,'An accepted command lost its rendered result');const req=requests.get(row.callId);assert.ok(req);
  assert.equal(row.tool,req.tool);assert.deepEqual(row.args,req.args);
  if(abortedAccess&&row.error===accessFailure){assert.ok(!accepted.has(row.callId));assert.ok(!resolved.has(row.callId));accessAborts.push(row.callId);}
  else {if(req.tool==='step')assert.throws(()=>sim.step(req.args),e=>e.message===row.error);else if(req.tool==='finish')assert.throws(()=>sim.finish(),e=>e.message===row.error);else throw Error('Unexpected rejected controller tool');rejected++;}
 }
 if(row.type==='rejected_observation'){assert.ok(requests.has(row.callId));assert.ok(!resolved.has(row.callId));resolved.add(row.callId);assert.deepEqual(row.output.observation,wire(sim.observe()));image(row.frame);}
}
if(abortedAccess){
 assert.equal(accessAborts.length,1);assert.equal(accessAborts[0],[...requests.keys()].at(-1),'Only the next requested operation may be interrupted');
 assert.deepEqual([...requests.keys()].filter(id=>!resolved.has(id)),accessAborts,'Unexplained unresolved calls');
 for(const id of accepted)assert.ok(resolved.has(id),'An accepted command is missing its actual image');
 assert.equal(sim.terminal,null,'Aborted-before-action evidence cannot certify Finish');
 assert.equal(rows.at(-1).type,'error');assert.equal(rows.at(-2).type,'tool_error');assert.equal(rows.at(-2).callId,accessAborts[0]);
 assert.equal(rows.at(-2).beforeRevision,undefined,'This failure must precede access to the simulation');
 if(!publicRecord){
  const indices=rows.flatMap((r,i)=>r.type==='model_tool_request'?[i]:[]);
  for(let i=0;i<indices.length;i++){
   const checks=rows.slice(indices[i]+1,indices[i+1]??rows.length).filter(r=>r.type==='allowance_check');
   assert.equal(checks.length,i===indices.length-1?0:1,'Each completed call must have its own affirmative access check; the final check failed');
  }
 }
 console.log(JSON.stringify({recordVerified:true,episodeSucceeded:false,kind:'Actual controller access-check interruption; not a completed procedure',model:MODEL,reasoningEffort:model.reasoningEffort,seed:sim.seed,sourceDigest:config.source.digest,moves,toolRequests:requests.size,images:images.size,unexecutedRequests:accessAborts.length,rejectedMechanicalCommands:rejected,maxCommandToFrameMs:maxFeedbackMs,finalRevision:sim.revision,assessmentPassed:sim.assessment().passed,recordedPrivateChecksVerified:!publicRecord,finalAccessCheckAvailable:false,scope:'Exact replay of the accepted prefix and actual image associations. The final requested operation was not executed. No successful procedure or complete post-run access check is established.'},null,2));
 process.exit(0);
}
if(frameFailure){
 const last=rows.at(-2);assert.equal(rows.at(-1).type,'error');assert.equal(last.type,'tool_error');assert.equal(last.accepted,true);
 assert.equal(last.callId,[...requests.keys()].at(-1));assert.deepEqual([...requests.keys()].filter(id=>!resolved.has(id)),[last.callId]);
 assert.equal(sim.terminal,null);assert.ok(!rows.some(r=>r.type==='accepted_command'&&r.tool==='finish'));
 if(!publicRecord){const indices=rows.flatMap((r,i)=>r.type==='model_tool_request'?[i]:[]);for(let i=0;i<indices.length;i++)assert.equal(rows.slice(indices[i]+1,indices[i+1]??rows.length).filter(r=>r.type==='allowance_check').length,1);}
 console.log(JSON.stringify({recordVerified:true,episodeSucceeded:false,kind:'Actual controller stopped after accepted command without timely rendered feedback',sourceDigest:config.source.digest,model:MODEL,seed:sim.seed,moves,images:images.size,toolRequests:requests.size,acceptedWithoutImage:1,maxCommandToFrameMs:maxFeedbackMs,finalRevision:sim.revision,failedGates:sim.assessment().failedGates,finalAccessCheckAvailable:false,scope:'All accepted states replay exactly; prior actual images are verified. The final accepted command has no timely model-delivered image. This is a failed episode.'},null,2));process.exit(0);
}
assert.equal(resolved.size,requests.size,'Unresolved model call');const end=rows.find(r=>r.type==='verification');assert.ok(end);assert.deepEqual(end.state,wire(sim.observe()));assert.equal(end.moves,moves);assert.equal(end.images,images.size);assert.equal(end.toolCount,requests.size);if(!publicRecord){assert.equal(end.allowance.ordinaryUsageAllowed,true);assert.equal(end.allowance.creditStateUnchanged,true);}
if(config.task==='loop'){assert.equal(moves,2);assert.equal(sim.metrics().cutFaceCount,0);assert.equal(sim.metrics().activeAttachments,0);assert.equal(sim.metrics().protectedIntersections,0);assert.equal(sim.metrics().activeGrasps,0);assert.equal(sim.terminal,null);assert.ok(new Set(frameHashes).size>=3,'Expected distinct actual observations');}
else if(incomplete){
 assert.equal(config.task,'procedure');assert.equal(sim.assessment().passed,false,'Incomplete mode cannot relabel a successful episode');assert.equal(sim.terminal,null,'An incomplete record must not contain accepted Finish');
 assert.ok(!rows.some(r=>r.type==='accepted_command'&&r.tool==='finish'));
 const assessment=sim.assessment();
 console.log(JSON.stringify({recordVerified:true,episodeSucceeded:false,kind:'Actual controller completed turn with unmet C0 gates',model:MODEL,reasoningEffort:model.reasoningEffort,seed:sim.seed,sourceDigest:config.source.digest,privateAccessChecksVerified:!publicRecord,moves,toolCalls:requests.size,images:images.size,rejected,maxCommandToFrameMs:maxFeedbackMs,finalRevision:sim.revision,assessmentPassed:false,failedGates:assessment.failedGates,metrics:{cutFaces:sim.metrics().cutFaceCount,targetDetachedFraction:assessment.area.targetDetachedFraction,offTargetRemovedFraction:assessment.area.offTargetRemovedFraction,protectedIntersections:sim.metrics().protectedIntersections,retainedEdgeCoverage:assessment.closure.coverage,releasedSeconds:assessment.release.seconds},scope:'Completed model turn and exact numerical/image-association verification, with an unsuccessful procedure outcome. Not clinical validation.'},null,2));
 process.exit(0);
}
else {assert.equal(sim.assessment().passed,true);assert.ok(sim.terminal,'No accepted Finish');}
console.log(JSON.stringify({verified:true,kind:config.task==='loop'?'Actual model connectivity check; not a procedure episode':'Actual model C0 episode',model:MODEL,reasoningEffort:model.reasoningEffort,seed:sim.seed,sourceDigest:config.source.digest,privateAccessChecksVerified:!publicRecord,moves,toolCalls:requests.size,images:images.size,rejected,maxCommandToFrameMs:maxFeedbackMs,finalRevision:sim.revision,assessmentPassed:sim.assessment().passed,scope:'Exact numerical replay and recorded JPEG integrity/association; not independent image reconstruction or clinical validation'},null,2));
