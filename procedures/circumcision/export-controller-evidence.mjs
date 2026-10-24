// Export reproducible simulation evidence without local account/session metadata.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const source=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);assert.ok(!fs.existsSync(out),'Preserve an existing evidence export');
const rows=fs.readFileSync(path.join(source,'agent.jsonl'),'utf8').trim().split('\n').map(JSON.parse),calls=new Map();
for(const r of rows)if(r.type==='model_tool_request')calls.set(r.callId,'call-'+String(calls.size+1).padStart(4,'0'));
const keep=new Set(['configuration','model_session','turn_started','turn_completed','model_message','model_tool_request','accepted_command','tool_result','tool_error','rejected_observation','verification','error']);
const selected=rows.filter(r=>keep.has(r.type)).map(row=>{
 const r=structuredClone(row);
 if(r.callId)r.callId=calls.get(r.callId);
 if(r.type==='configuration'){delete r.episode;r.evidenceScope='public-redacted';r.redactions=['access checks','session identifiers'];}
 if(r.type==='model_session')delete r.threadId;
 if(r.type==='turn_started')delete r.turnId;
 if(r.type==='turn_completed')r.turn={status:r.turn.status,error:r.turn.error??null};
 if(r.type==='accepted_command')r.result={revision:r.result.revision,mechanics:r.result.mechanics};
 if(r.type==='verification')delete r.allowance;
 return r;
});
fs.mkdirSync(out,{recursive:false});
fs.writeFileSync(path.join(out,'agent.jsonl'),selected.map(r=>JSON.stringify(r)).join('\n')+'\n');
const files=[...new Set(selected.filter(r=>r.frame).map(r=>r.frame.filename))];
for(const file of files){assert.match(file,/^(frame|error)-\d{5}\.jpg$/);fs.copyFileSync(path.join(source,file),path.join(out,file));}
console.log(JSON.stringify({exported:true,events:selected.length,images:files.length,redactions:['access checks','session identifiers']}));
