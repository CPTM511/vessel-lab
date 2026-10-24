// Failed episodes must retain their outcome under record verification.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {test} from 'node:test';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
function verify(dir,mode){return spawnSync(process.execPath,[path.join(root,'verify-controller.mjs'),dir,...(mode?[mode]:[])],{encoding:'utf8'});}
for(const [folder,mode,moves,images] of [['c0-seed-29-attempt-01','--incomplete',24,31],['c0-round2-seed11-attempt01','--frame-failure',75,140],['c0-round3-seed11-attempt01','--frame-failure',100,153],['c0-round4-seed11-attempt01','--frame-failure',89,157]]){
 const source=path.join(root,'evidence',folder);
 test(folder+' verifies failure without success',()=>{const r=verify(source,mode);assert.equal(r.status,0,r.stderr);const v=JSON.parse(r.stdout);assert.equal(v.recordVerified,true);assert.equal(v.episodeSucceeded,false);assert.equal(v.moves,moves);assert.equal(v.images,images);});
 test(folder+' cannot pass default success verification',()=>assert.notEqual(verify(source).status,0));
 for(const mutation of ['source','image','missing result'])test(folder+' rejects '+mutation,()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'c0-failed-'));try{fs.cpSync(source,dir,{recursive:true});const f=path.join(dir,'agent.jsonl'),rows=fs.readFileSync(f,'utf8').trim().split('\n').map(JSON.parse);
 if(mutation==='source')rows.find(r=>r.type==='configuration').source.files['contact.mjs']='changed';
 if(mutation==='image')fs.writeFileSync(path.join(dir,rows.find(r=>r.type==='tool_result').frame.filename),'corrupt');
 if(mutation==='missing result')rows.splice(rows.findIndex(r=>r.type==='tool_result'),1);
 fs.writeFileSync(f,rows.map(JSON.stringify).join('\n')+'\n');assert.notEqual(verify(dir,mode).status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}});
}
