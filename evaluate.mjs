// Sequential, declared live-model evaluation. No trajectory or automatic retry.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {sourceManifest} from './manifest.mjs';
const root=import.meta.dirname,base=process.env.VESSEL_URL||'http://127.0.0.1:8765';
const seeds=[1,7,42,99,2026],source=sourceManifest();
const file=process.argv[2]||path.join(root,'sessions',`evaluation-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
const report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {kind:'independent live model evaluation',model:'gpt-6-astra',seeds,source,startedAt:new Date().toISOString(),attempts:[]};
if(JSON.stringify(report.source)!==JSON.stringify(source))throw Error('Source changed; declare a new evaluation set. Preserve the old report.');
const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function api(p,b){const r=await fetch(base+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined,signal:AbortSignal.timeout(5000)});const x=await r.json();if(!r.ok)throw Error(x.error);return x;}
save();console.log(JSON.stringify({evaluation:file,seeds,digest:source.digest}));
try{
 for(const seed of seeds){
  const previous=report.attempts.find(a=>a.seed===seed);
  if(previous){if(previous.passed)continue;throw Error('Existing unfinished or failed attempt requires diagnosis; no automatic retry.');}
  if((await api('/api/state')).agent.running)throw Error('Another controller is active');
  await api('/api/reset',{seed});
  let s=await api('/api/state'),frame;
  for(let n=0;n<100;n++){frame=await api('/api/frame?revision=0');if(frame?.session===s.session&&Date.now()-frame.receivedAt<5000)break;await pause(100);}
  if(!frame||frame.session!==s.session)throw Error('No current Godot frame');
  const attempt={seed,session:s.session,startedAt:new Date().toISOString(),passed:false};report.attempts.push(attempt);save();
  await api('/api/agent/start',{task:'suture'});
  console.log(JSON.stringify({seed,session:s.session,started:true}));
  while(true){await pause(3000);s=await api('/api/state');if(s.session!==attempt.session)throw Error('Session changed during evaluation');if(!s.agent.running)break;}
  attempt.endedAt=new Date().toISOString();attempt.status=s.state.status;attempt.result=s.state.result;attempt.controller=s.agent;save();
  try{attempt.verification=JSON.parse(execFileSync(process.execPath,['verify-evidence.mjs',path.join(root,'sessions',attempt.session+'-agent.jsonl')],{cwd:root,encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe']}));}catch(e){attempt.verificationError=e.stderr?.toString()||e.message;}
  attempt.passed=!!(attempt.result?.passed&&attempt.verification?.valid&&attempt.verification.sourceDigest===source.digest);save();
  console.log(JSON.stringify({seed,passed:attempt.passed,result:attempt.result,verificationError:attempt.verificationError}));
  if(!attempt.passed)throw Error(`Seed ${seed} failed. Preserve and diagnose this attempt before changing anything.`);
 }
 report.completedAt=new Date().toISOString();report.passed=report.attempts.length===seeds.length&&report.attempts.every(a=>a.passed);save();
}catch(e){report.error=e.message;save();console.error(e.message);process.exitCode=1;}
