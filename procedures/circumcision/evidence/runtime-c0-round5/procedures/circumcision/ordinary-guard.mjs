// A backend permission, not a local percentage estimate, authorizes included use.
export class OrdinaryUsageGuard{
 constructor(){this.baseline=null;}
 check(response){
  const buckets=response.rateLimitsByLimitId?Object.values(response.rateLimitsByLimitId):[response.rateLimits];
  const windows=buckets.filter(Boolean).flatMap(b=>[b.primary,b.secondary]).filter(Boolean);
  if(response.ordinaryUsageAllowed!==true||!windows.length||windows.some(w=>!Number.isFinite(w.usedPercent)||w.usedPercent>=95))throw Error('Ordinary allowance unavailable or near its limit; controller deferred');
  const credits=JSON.stringify([response.rateLimits?.credits??null,...Object.entries(response.rateLimitsByLimitId??{}).sort(([a],[b])=>a.localeCompare(b)).map(([key,b])=>[key,b.credits??null])]);
  if(this.baseline===null)this.baseline=credits;
  if(credits!==this.baseline)throw Error('Credit state changed; controller stopped for inspection');
  return {ordinaryUsageAllowed:true,windows:windows.map(w=>({usedPercent:w.usedPercent,windowDurationMins:w.windowDurationMins})),creditStateUnchanged:true};
 }
}
