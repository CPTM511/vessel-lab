// Verify an actual interrupted record without converting it into episode success.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'..');
const source=path.join(root,'evidence/c0-seed-11-attempt-01');
const verify=(dir,mode=true)=>spawnSync(process.execPath,[path.join(root,'verify-controller.mjs'),dir,...(mode?['--aborted-access']:[])],{encoding:'utf8'});

test('interrupted evidence verifies only its executed prefix',()=>{
 const result=verify(source);assert.equal(result.status,0,result.stderr);
 const data=JSON.parse(result.stdout);assert.equal(data.recordVerified,true);assert.equal(data.episodeSucceeded,false);
 assert.equal(data.moves,9);assert.equal(data.images,16);assert.equal(data.toolRequests,17);
 assert.equal(data.rejectedMechanicalCommands,1);assert.equal(data.unexecutedRequests,1);
 assert.equal(data.finalAccessCheckAvailable,false);assert.equal(data.recordedPrivateChecksVerified,false);
});
test('default successful-episode verification rejects the interrupted record',()=>assert.notEqual(verify(source,false).status,0));

for(const kind of ['wrong failure cause','completion claim','accepted final request','missing earlier result','changed image'])test('interruption verification rejects '+kind,()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'c0-interruption-'));
 try{
  fs.cpSync(source,dir,{recursive:true});
  const file=path.join(dir,'agent.jsonl'),rows=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);
  if(kind==='wrong failure cause'){const error=JSON.stringify({code:-32603,message:'Another unrelated error'});rows.at(-1).error=error;rows.at(-2).error=error;}
  if(kind==='completion claim')rows.splice(-1,0,{type:'turn_completed',turn:{status:'completed'}});
  if(kind==='accepted final request')rows.at(-2).accepted=true;
  if(kind==='missing earlier result')rows.splice(rows.findIndex(r=>r.type==='tool_result'),1);
  if(kind==='changed image')fs.writeFileSync(path.join(dir,rows.find(r=>r.type==='tool_result').frame.filename),'corrupt');
  fs.writeFileSync(file,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  assert.notEqual(verify(dir).status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
