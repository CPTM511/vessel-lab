// Frozen synthetic material-space target. No controller action or live result is an input.
import crypto from 'node:crypto';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
export function defineTask(cage,scale){
 const boundaryRings=Object.freeze([12,4]);
 const target=Object.freeze(cage.faces.map(f=>f.ring>=boundaryRings[f.layer]));
 const areas=Object.freeze(cage.faces.map(f=>{
  const [a,b,c]=f.nodes.map(id=>cage.nodes[id].rest);
  return Math.hypot(...cross(minus(b,a),minus(c,a)))*.5*scale**2;
 }));
 const targetArea=areas.reduce((n,a,i)=>n+(target[i]?a:0),0);
 const nonTargetArea=areas.reduce((n,a,i)=>n+(target[i]?0:a),0);
 const pairNodes=Object.freeze(Array.from({length:cage.angular},(_,j)=>Object.freeze([boundaryRings[0]*cage.angular+j,(cage.axial+1+boundaryRings[1])*cage.angular+j])));
 const spec={version:'C0-target-mask-1',units:'mm',boundaryRings,target,areas,targetArea,nonTargetArea,pairNodes};
 return Object.freeze({...spec,hash:crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex')});
}

// Area accounting uses immutable rest areas and graph connectivity, not tool intent.
// This is partial accounting; closure, held release and retained integrity remain separate gates.
export function areaAccounting(task,faces,componentOf,components){
 let targetDetached=0,offTargetRemoved=0,ablated=0;
 for(let i=0;i<faces.length;i++){
  const f=faces[i],removed=!f.active||!components[componentOf[f.nodes[0]]]?.anchored;
  if(!f.active)ablated+=task.areas[i];
  if(removed){if(task.target[i])targetDetached+=task.areas[i];else offTargetRemoved+=task.areas[i];}
 }
 return {targetMaskHash:task.hash,targetInitialAreaMm2:task.targetArea,nonTargetInitialAreaMm2:task.nonTargetArea,
  targetDetachedAreaMm2:targetDetached,targetDetachedFraction:targetDetached/task.targetArea,
  offTargetRemovedAreaMm2:offTargetRemoved,offTargetRemovedFraction:offTargetRemoved/task.nonTargetArea,ablatedAreaMm2:ablated};
}
