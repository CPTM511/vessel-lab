// Replay recorded decisions through the service, producing new actual Godot frames.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {readRecording} from './recording.mjs';import {sourceManifest,sha256} from './manifest.mjs';import {hostState} from '../../host-state.mjs';
const base=process.env.ANATOMY_URL,token=process.env.ANATOMY_CONTROLLER_TOKEN,episode=process.env.ANATOMY_EPISODE,runDir=process.env.ANATOMY_RUN_DIR,recordDir=path.join(import.meta.dirname,'evidence/controller-loop-01');let stopped=false,session,steps=0,images=0;
function log(type,value={}){if(!runDir)return;fs.appendFileSync(path.join(runDir,'playback.jsonl'),JSON.stringify({type,at:new Date().toISOString(),...value})+'\n');}
async function api(route,body){if(stopped)throw Error('Playback stopped');const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-anatomy-controller-token':token},body:body?JSON.stringify({session,...body}):undefined,signal:AbortSignal.timeout(12000)});const value=await r.json();if(!r.ok)throw Error(value.error);return value;}
function active(s){assert.equal(s.episode,episode,'Playback episode replaced');assert.equal(s.session,session);}
async function frame(s,after=Date.now()){
 while(!stopped&&Date.now()-after<=5000){let f;try{f=await api('/api/frame');}catch(e){if(!/No actual Godot frame/.test(e.message))throw e;}
  if(f&&f.session===session&&f.revision===s.revision&&f.mechanicsRevision===s.mechanics.revision&&f.controlSource==='recorded-playback'&&f.seed===s.mechanics.seed&&Math.abs(f.anatomyScale-s.mechanics.scale)<1e-6&&f.cutFaceCount===s.mechanics.metrics.cutFaceCount&&f.activeAttachments===s.mechanics.metrics.activeAttachments&&f.assessmentPassed===s.mechanics.assessment.passed&&f.receivedAt>=after&&Date.now()-f.receivedAt<5000&&Date.now()-after<=5000)return f;
  await new Promise(r=>setTimeout(r,80));
 }throw Error('Fresh actual Godot playback frame unavailable');
}
async function main(){
 assert.ok(base&&token&&episode&&runDir,'Start playback from the local service');let s=await api('/api/observe');session=s.session;active(s);await api('/api/agent/status',{phase:'verifying recording'});
 const recording=readRecording(recordDir);assert.equal(s.mechanics.seed,recording.seed);assert.equal(s.mechanics.revision,0);
 log('configuration',{kind:process.env.ANATOMY_PROTOCOL_TEST==='1'?'Playback protocol test double; no actual renderer':'Recorded playback with new actual Godot images; no model inference',source:sourceManifest(),originalSourceDigest:recording.originalSourceDigest,journalHash:recording.journalHash,seed:recording.seed,operationCount:recording.operations.length});
 await frame(s,Date.now()-1);await api('/api/agent/status',{phase:'replaying',toolCount:0,moves:0,images:0});
 for(const [i,operation] of recording.operations.entries()){
  s=await api('/api/observe');active(s);await frame(s,Date.now()-500);const beforeHost=hostState(),start=Date.now(),commandId='playback-'+i;
  log('recorded_command',{operation});const result=await api('/api/'+(operation.tool==='inspect'?'inspect':operation.tool),{revision:s.revision,commandId,source:'recorded-playback',...(operation.tool==='step'?{action:operation.args}:operation.tool==='inspect'?operation.args:{})});
  log('accepted_command',{operation,result});assert.deepEqual(result.mechanics,operation.observation);const f=await frame(result,start);s=await api('/api/state');active(s);
  assert.equal(sha256(JSON.stringify(s.mechanics.positions)),operation.geometryHash);assert.equal(sha256(JSON.stringify({faces:s.mechanics.faces,componentOf:s.mechanics.componentOf,targetMask:s.mechanics.targetMask})),operation.topologyHash);
  const filename='frame-'+String(i+1).padStart(5,'0')+'.jpg';fs.writeFileSync(path.join(runDir,filename),Buffer.from(f.image.split(',')[1],'base64'));images++;if(operation.tool==='step')steps++;
  log('rendered_result',{operation,frame:{filename,imageHash:f.imageHash,revision:f.revision,mechanicsRevision:f.mechanicsRevision,seed:f.seed,anatomyScale:f.anatomyScale,renderer:f.renderer,driver:f.driver,controlSource:f.controlSource},beforeHost,afterHost:hostState(),commandToFrameMs:f.receivedAt-start});
  await api('/api/agent/status',{phase:'replaying',toolCount:i+1,moves:steps,images});
 }
 assert.deepEqual(s.mechanics.positions?Object.fromEntries(Object.entries(s.mechanics).filter(([k])=>!['positions','faces','componentOf','targetMask','woundPairNodes'].includes(k))):s.mechanics,recording.final);
 log('verification',{kind:'Recorded playback; no inference',steps,images,assessment:recording.final.assessment});await api('/api/agent/status',{phase:'done',toolCount:recording.operations.length,moves:steps,images});
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopped=true;log('stopped');process.exit(0);});
main().catch(async e=>{log('error',{error:e.message});try{await api('/api/agent/status',{phase:'error',error:e.message});}catch{}process.exitCode=1;});
