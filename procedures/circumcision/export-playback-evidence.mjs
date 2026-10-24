import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const source=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);assert.ok(!fs.existsSync(out),'Preserve existing evidence');const rows=fs.readFileSync(path.join(source,'playback.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
for(const row of rows)if(row.type==='accepted_command')row.result={revision:row.result.revision,mechanics:row.result.mechanics};
fs.mkdirSync(out);fs.writeFileSync(path.join(out,'playback.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');for(const r of rows.filter(r=>r.frame)){assert.match(r.frame.filename,/^frame-\d{5}\.jpg$/);fs.copyFileSync(path.join(source,r.frame.filename),path.join(out,r.frame.filename));}
console.log(JSON.stringify({exported:true,images:rows.filter(r=>r.frame).length,redactions:['session identifiers']}));
