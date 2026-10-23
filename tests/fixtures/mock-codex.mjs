#!/usr/bin/env node
// Protocol/lifecycle test double. Never contacts a model service.
import readline from 'node:readline';
import fs from 'node:fs';
if(process.env.VESSEL_TEST_RECORD)fs.writeFileSync(process.env.VESSEL_TEST_RECORD,JSON.stringify({pid:process.pid,token:process.env.VESSEL_CONTROLLER_TOKEN}));
process.on('SIGTERM',()=>{if(process.env.VESSEL_TEST_MODE!=='stop')process.exit();});
const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
readline.createInterface({input:process.stdin}).on('line',l=>{
 const m=JSON.parse(l);if(m.id===undefined)return;
 let result={};
 if(m.method==='account/read')result={account:{type:'chatgpt',planType:'test'}};
 if(m.method==='account/rateLimits/read')result={ordinaryUsageAllowed:process.env.VESSEL_TEST_MODE!=='quota',rateLimits:{primary:{usedPercent:1,windowDurationMins:10080},credits:{balance:'test'}}};
 if(m.method==='thread/start')result={model:'gpt-6-astra',modelProvider:'TEST DOUBLE',thread:{id:'mock-thread'}};
 if(m.method==='turn/start')result={turn:{id:'mock-turn'}};
 send({id:m.id,result});
});
setInterval(()=>{},1000);
