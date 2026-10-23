// Reapply recorded model commands. This is explicitly a recording, not a new AI run.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base=process.env.VESSEL_URL||'http://127.0.0.1:8765';
const file=process.argv[2];
if(!file)throw Error('Usage: node replay.mjs <session.jsonl>');
const rows=fs.readFileSync(path.resolve(file),'utf8').trim().split('\n').map(JSON.parse);
async function api(endpoint,body){const r=await fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;}
let stopped=false;
async function stop(error){if(stopped)return;stopped=true;await api('/api/agent/status',{running:false,phase:error?'replay error':'replay done',error:error||null});}
async function main(){
 await api('/api/reset',{seed:rows.find(x=>x.type==='reset').seed});
 await api('/api/agent/status',{running:true,phase:'证据回放 · 无模型调用',task:'replay',model:null,toolCount:0});
 let count=0;
 for(const row of rows.filter(x=>x.type==='action')){
  if(stopped)break;
  const c=row.command,endpoint=c.action?'/api/step':row.result.checks?'/api/finish':'/api/cut';
  await api(endpoint,{...c,source:'replay',commandId:crypto.randomUUID()});
  await api('/api/agent/status',{toolCount:++count});
  await new Promise(r=>setTimeout(r,500));
 }
 await stop();
}
process.on('SIGTERM',()=>stop('Replay stopped').finally(()=>process.exit()));
main().catch(e=>stop(e.message).finally(()=>{console.error(e.message);process.exitCode=1;}));
