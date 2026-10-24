#!/usr/bin/env node
// JSON-RPC transport and lifecycle test double. No model service is contacted.
import fs from 'node:fs';import readline from 'node:readline';
const mode=process.env.ANATOMY_TEST_MODE,record=process.env.ANATOMY_TEST_RECORD;
const state={pid:process.pid,token:process.env.ANATOMY_CONTROLLER_TOKEN,kind:'protocol test double',requests:[],responses:[]};
const save=()=>fs.writeFileSync(record,JSON.stringify(state));save();
process.on('SIGTERM',()=>{if(mode!=='stop')process.exit();});
const send=x=>process.stdout.write(JSON.stringify(x)+'\n');let count=0;
const call=(tool,args={},id=null)=>send({id:id??'tool-'+(count+1),method:'item/tool/call',params:{tool,arguments:args,callId:'call-'+(++count),namespace:'anatomy'}});
readline.createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);if(m.id===undefined)return;
 if(!m.method){
  state.responses.push(m);save();if(!['loop','missing_after_action'].includes(mode))return;
  if(!m.result?.success)return;
  const data=JSON.parse(m.result.contentItems.find(x=>x.type==='inputText').text),s=data.observation;
  if(count<3){const p=[...s.arms.left.position];p[1]+=.5;call('step',{revision:s.revision,duration:.02,left:{position:p}});}
  else send({method:'turn/completed',params:{turn:{id:'mock-turn',status:'completed'}}});
  return;
 }
 state.requests.push({method:m.method,params:m.params});save();let result={};
 if(m.method==='account/read')result={account:{type:mode==='api'?'apiKey':'chatgpt'}};
 if(m.method==='account/rateLimits/read')result={ordinaryUsageAllowed:mode!=='quota',rateLimits:{primary:{usedPercent:1,windowDurationMins:300},credits:{balance:'test'}}};
 if(m.method==='thread/start')result={model:mode==='wrong_model'?'gpt-6-sol':'gpt-6-astra',modelProvider:mode==='wrong_provider'?'custom':'openai',thread:{id:'mock-thread'},reasoningEffort:'inherited-test-value'};
 if(m.method==='turn/start')result={turn:{id:'mock-turn'}};
 if(m.method==='turn/start'&&mode==='loop')call('observe',{},m.id);
 send({id:m.id,result});
 if(m.method==='turn/start'&&mode==='missing_after_action')call('observe');
});
setInterval(()=>{},1000);
