const r=await fetch((process.env.VESSEL_URL||'http://127.0.0.1:8765')+'/api/agent/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:process.argv.includes('--loop')?'loop':'suture'})});
console.log(await r.text());if(!r.ok)process.exitCode=1;
