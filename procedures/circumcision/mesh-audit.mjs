// Static non-adjacent triangle crossing diagnostic. Not a contact solver.
// Coplanar overlap, near contact and continuous collision are outside this audit.
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function hit(p,q,a,b,c){
 const d=sub(q,p),e=sub(b,a),f=sub(c,a),h=cross(d,f),det=dot(e,h);if(Math.abs(det)<1e-10)return null;
 const r=sub(p,a),u=dot(r,h)/det,k=cross(r,e),v=dot(d,k)/det,t=dot(f,k)/det,eps=1e-7;
 return u>eps&&v>eps&&u+v<1-eps&&t>eps&&t<1-eps?p.map((x,i)=>x+t*d[i]):null;
}
export function properTriangleIntersection(a,b){for(let i=0;i<3;i++){const p=hit(a[i],a[(i+1)%3],...b)||hit(b[i],b[(i+1)%3],...a);if(p)return p;}return null;}
export function auditSelfIntersections(s){
 const triangles=s.faces.map(f=>f.nodes.map(n=>s.nodes[n].p)),grid=new Map(),cell=4;
 s.faces.forEach((f,id)=>{if(!f.active)return;const t=triangles[id],lo=[0,1,2].map(i=>Math.floor(Math.min(...t.map(p=>p[i]))/cell)),hi=[0,1,2].map(i=>Math.floor(Math.max(...t.map(p=>p[i]))/cell));
  for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const key=x+':'+y+':'+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(id);}
 });
 const tested=new Set(),counts={retained:0,detached:0,mixed:0},witnesses=[];
 for(const list of grid.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j],key=a*s.faces.length+b;if(tested.has(key))continue;tested.add(key);
  if(s.faces[a].nodes.some(n=>s.faces[b].nodes.includes(n)))continue;
  const point=properTriangleIntersection(triangles[a],triangles[b]);if(!point)continue;
  const anchored=id=>s.topology.components[s.topology.componentOf[s.faces[id].nodes[0]]].anchored;
  const type=anchored(a)&&anchored(b)?'retained':!anchored(a)&&!anchored(b)?'detached':'mixed';counts[type]++;
  if(witnesses.filter(x=>x.type===type).length<8)witnesses.push({faces:[a,b],layers:[s.faces[a].layer,s.faces[b].layer],type,point});
 }
 return {revision:s.revision,activeFaces:s.faces.filter(f=>f.active).length,candidatePairs:tested.size,properCrossings:counts,witnesses};
}
