// Synthetic, frictionless shell contact in millimetres. No material calibration.
// Conservative advancement uses a bound on relative projected vertex speed, so it also
// detects edge/edge and coplanar contact between two linearly moving triangles.
// Constraint proposals are filtered before they become simulation state.
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const mix=(a,b,t)=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=x=>Math.max(0,Math.min(1,x));
export const CONTACT_GAP_MM=.03;
const TOL=1e-7;

function pointTriangle(p,a,b,c){
 const abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2],acx=c[0]-a[0],acy=c[1]-a[1],acz=c[2]-a[2];
 const apx=p[0]-a[0],apy=p[1]-a[1],apz=p[2]-a[2],d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;
 if(d1<=0&&d2<=0)return [1,0,0];
 const bpx=p[0]-b[0],bpy=p[1]-b[1],bpz=p[2]-b[2],d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
 if(d3>=0&&d4<=d3)return [0,1,0];
 const vc=d1*d4-d3*d2;
 if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return [1-v,v,0];}
 const cpx=p[0]-c[0],cpy=p[1]-c[1],cpz=p[2]-c[2],d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
 if(d6>=0&&d5<=d6)return [0,0,1];
 const vb=d5*d2-d1*d6;
 if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return [1-w,0,w];}
 const va=d3*d6-d5*d4;
 if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return [0,1-w,w];}
 const den=va+vb+vc;
 if(Math.abs(den)<1e-24)return null;
 const v=vb/den,w=vc/den;return [1-v-w,v,w];
}
function segmentParameters(p1,q1,p2,q2){
 const dx=q1[0]-p1[0],dy=q1[1]-p1[1],dz=q1[2]-p1[2],ex=q2[0]-p2[0],ey=q2[1]-p2[1],ez=q2[2]-p2[2];
 const rx=p1[0]-p2[0],ry=p1[1]-p2[1],rz=p1[2]-p2[2],a=dx*dx+dy*dy+dz*dz,e=ex*ex+ey*ey+ez*ez,f=ex*rx+ey*ry+ez*rz;let s=0,t=0;
 if(a<1e-24&&e<1e-24)return [0,0];
 if(a<1e-24)t=clamp(f/e);
 else{const c=dx*rx+dy*ry+dz*rz;if(e<1e-24)s=clamp(-c/a);else{const b=dx*ex+dy*ey+dz*ez,den=a*e-b*b;s=den>1e-24?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
 return [s,t];
}
const weighted=(p,w)=>[
 p[0][0]*w[0]+p[1][0]*w[1]+p[2][0]*w[2],
 p[0][1]*w[0]+p[1][1]*w[1]+p[2][1]*w[2],
 p[0][2]*w[0]+p[1][2]*w[1]+p[2][2]*w[2]
];
export function triangleSeparation(a,b){
 // Closest features of initially disjoint convex triangles. The continuous
 // query stops at a positive gap before either triangle can intersect.
 let best=Infinity,answer=null;
 const consider=(wa,wb)=>{
  if(!wa||!wb)return;
  // Keep the arithmetic order of the reference query while avoiding the
  // temporary weighted-point and delta arrays for rejected feature pairs.
  const dx=(a[0][0]*wa[0]+a[1][0]*wa[1]+a[2][0]*wa[2])-(b[0][0]*wb[0]+b[1][0]*wb[1]+b[2][0]*wb[2]);
  const dy=(a[0][1]*wa[0]+a[1][1]*wa[1]+a[2][1]*wa[2])-(b[0][1]*wb[0]+b[1][1]*wb[1]+b[2][1]*wb[2]);
  const dz=(a[0][2]*wa[0]+a[1][2]*wa[1]+a[2][2]*wa[2])-(b[0][2]*wb[0]+b[1][2]*wb[1]+b[2][2]*wb[2]);
  const d2=dx*dx+dy*dy+dz*dz;
  if(d2<best){best=d2;answer={distance:Math.sqrt(d2),a:wa,b:wb,delta:[dx,dy,dz]};}
 };
 for(let i=0;i<3;i++){
  const w=[0,0,0];w[i]=1;
  consider(w,pointTriangle(a[i],...b));consider(pointTriangle(b[i],...a),w);
 }
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){
  const [s,t]=segmentParameters(a[i],a[(i+1)%3],b[j],b[(j+1)%3]),wa=[0,0,0],wb=[0,0,0];
  wa[i]=1-s;wa[(i+1)%3]=s;wb[j]=1-t;wb[(j+1)%3]=t;consider(wa,wb);
 }
 return answer;
}

export function rotatingPlane(a0,a1,b0,b1,gap=.03){
 const s0=triangleSeparation(a0,b0),s1=triangleSeparation(a1,b1);
 if(s0.distance<=gap+1e-7||s1.distance<=gap+1e-7)return false;
 const n0=s0.delta.map(v=>v/s0.distance),n1=s1.delta.map(v=>v/s1.distance),dn=sub(n1,n0);
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){
  const d0=sub(a0[i],b0[j]),d1=sub(a1[i],b1[j]),dv=sub(d1,d0),c=dot(d0,n0),b=dot(dv,n0)+dot(d0,dn),a=dot(dv,dn);
  let min=Math.min(c,c+b+a);
  if(a>0){const t=-b/(2*a);if(t>0&&t<1)min=Math.min(min,c+t*(b+t*a));}
  if(min<=gap+1e-7)return false;
 }
 return true;
}

export function sweptTriangleContact(a0,a1,b0,b1,gap=CONTACT_GAP_MM){
 // A fixed plane separating ALL start/end vertices separates their entire
 // linear sweep. This inexpensive certificate avoids iterative distance
 // queries for the many nearby triangles that remain on separate layers.
 for(const tri of [a0,b0]){
  let normal=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));const len=Math.hypot(...normal);
  if(len<1e-12)continue;normal=normal.map(v=>v/len);
  const pa=[...a0,...a1].map(p=>dot(p,normal)),pb=[...b0,...b1].map(p=>dot(p,normal));
  if(Math.min(...pa)-Math.max(...pb)>gap+TOL||Math.min(...pb)-Math.max(...pa)>gap+TOL)return null;
 }
 const va=a0.map((p,i)=>sub(a1[i],p)),vb=b0.map((p,i)=>sub(b1[i],p));
 if(va.every(a=>vb.every(b=>a.every((v,i)=>Math.abs(v-b[i])<1e-12))))return null;
 if(rotatingPlane(a0,a1,b0,b1,gap))return null;
 let time=0,last=null;
 for(let iteration=0;iteration<4096;iteration++){
  const a=a0.map((p,i)=>mix(p,a1[i],time)),b=b0.map((p,i)=>mix(p,b1[i],time));
  last=triangleSeparation(a,b);
  if(last.distance<1e-12)return {...last,time,conservativeLimit:false};
  const normal=last.delta.map(v=>v/last.distance);
  // Every vertex pair is separated by this supporting plane. Bound each
  // pair's closing time using its OWN projected separation and velocity.
  // Combining the smallest gap with an unrelated fast vertex makes grazing
  // contacts needlessly stall, even when one plane separates the whole sweep.
  let safe=Infinity;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
   const closing=(vb[j][0]-va[i][0])*normal[0]+(vb[j][1]-va[i][1])*normal[1]+(vb[j][2]-va[i][2])*normal[2];
   if(closing>1e-15){
    const separation=(a[i][0]-b[j][0])*normal[0]+(a[i][1]-b[j][1])*normal[1]+(a[i][2]-b[j][2])*normal[2];
    safe=Math.min(safe,(separation-gap)/closing);
   }
  }
  if(time+safe>1)return null;
  if(last.distance<=gap+TOL){
   const closestClosing=dot(sub(weighted(vb,last.b),weighted(va,last.a)),normal);
   if(last.distance<=gap||closestClosing>0)return {...last,time,conservativeLimit:false};
  }
  time+=safe*.9;
 }
 // A difficult grazing trajectory is conservatively limited, never declared
 // collision-free merely because the iteration budget was reached.
 return {...last,time,conservativeLimit:true};
}

function candidates(faces,old,next){
 const cell=4,grid=new Map(),boxes=new Map(),pairs=[],seen=new Set();
 for(let id=0;id<faces.length;id++){
  const f=faces[id];if(!f.active)continue;
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const n of f.nodes)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],old[n][k],next[n][k]);hi[k]=Math.max(hi[k],old[n][k],next[n][k]);}
  // A small margin permits reuse during local projection. Every reuse below
  // checks that the entire updated sweep is still inside these bounds.
  for(let k=0;k<3;k++){lo[k]-=CONTACT_GAP_MM+.1;hi[k]+=CONTACT_GAP_MM+.1;}
  boxes.set(id,{lo,hi});
  const a=lo.map(v=>Math.floor(v/cell)),b=hi.map(v=>Math.floor(v/cell));
  for(let x=a[0];x<=b[0];x++)for(let y=a[1];y<=b[1];y++)for(let z=a[2];z<=b[2];z++){
   const key=x+':'+y+':'+z,list=grid.get(key)||[];
   for(const other of list){
    const pair=other*faces.length+id;if(seen.has(pair))continue;seen.add(pair);
    // Shared-node faces are topological neighbours. Interlayer distance
    // constraints are NOT adjacency and never suppress shell contact.
    const adjacent=faces[other].nodes;
    if(f.nodes[0]===adjacent[0]||f.nodes[0]===adjacent[1]||f.nodes[0]===adjacent[2]||f.nodes[1]===adjacent[0]||f.nodes[1]===adjacent[1]||f.nodes[1]===adjacent[2]||f.nodes[2]===adjacent[0]||f.nodes[2]===adjacent[1]||f.nodes[2]===adjacent[2])continue;
    const box=boxes.get(other);if(lo[0]>box.hi[0]||hi[0]<box.lo[0]||lo[1]>box.hi[1]||hi[1]<box.lo[1]||lo[2]>box.hi[2]||hi[2]<box.lo[2])continue;
    pairs.push([other,id]);
   }
   list.push(id);grid.set(key,list);
  }
 }
 return {pairs,boxes};
}

function planeDeficit(positions,c){
 const n=c.normal;
 return CONTACT_GAP_MM+1e-5-Math.min(...c.fa.map(i=>dot(positions[i],n)))+Math.max(...c.fb.map(i=>dot(positions[i],n)));
}
function projectContact(nodes,positions,c,versions){
 // A closest feature may be nonunique on parallel faces. Resolve every
 // supporting vertex pair along this normal instead of an arbitrary winner.
 let changed=false;
 for(const a of c.fa)for(const b of c.fb){
  const deficit=CONTACT_GAP_MM+1e-5-dot(sub(positions[a],positions[b]),c.normal),den=nodes[a].inv+nodes[b].inv;
  if(deficit<=0||den<1e-16)continue;
  for(const [id,sign] of [[a,1],[b,-1]]){
   const amount=sign*nodes[id].inv*deficit/den;let moved=false;
   for(let k=0;k<3;k++){const prev=positions[id][k];positions[id][k]+=amount*c.normal[k];moved||=positions[id][k]!==prev;}
   if(moved){changed=true;if(versions)versions[id]++;}
  }
 }
 return changed;
}

export function projectShellContacts(nodes,faces,cache){
 if(!cache.manifold?.size)return;
 const positions=nodes.map(n=>n.p);
 for(const [key,c] of cache.manifold){
  const pa=weighted(c.fa.map(i=>positions[i]),c.a),pb=weighted(c.fb.map(i=>positions[i]),c.b);
  // Drop separated/sliding anchors; the next continuous query regenerates
  // contact features as needed. These constraints carry no friction force.
  if(!faces[c.faceA].active||!faces[c.faceB].active||Math.hypot(...sub(pa,pb))>.3){cache.manifold.delete(key);continue;}
  projectContact(nodes,positions,c);
 }
}

export function filterShellMotion(nodes,faces,old,cache={},rigid=null){
 let proposed=nodes.map(n=>[...n.p]);const stats={contacts:0,rigidContacts:0,passes:0,limited:false,advance:1};
 if(proposed.every((p,i)=>p.every((v,k)=>v===old[i][k])))return stats;
 let broadphase=cache.broadphase;
 const versions=new Uint32Array(nodes.length),queries=new Map(),bounds=new Map(),activeConstraints=new Map(),rigidConstraints=new Map();
 const rigidContacts=positions=>{
  if(!rigid)return [];const found=[];
  for(let i=0;i<nodes.length;i++){if(!nodes[i].inv||nodes[i].alive===false)continue;const q=rigid.query(positions[i]);if(q&&q.distance<rigid.margin-1e-9){
   if(!q.normal.every(Number.isFinite)||Math.abs(Math.hypot(...q.normal)-1)>1e-6)throw Error('Rigid contact requires a finite unit normal');
   found.push({node:i,normal:q.normal,bound:dot(positions[i],q.normal)+rigid.margin+1e-5-q.distance});
  }}return found;
 };
 const boxFor=id=>{
  const ids=faces[id].nodes,previous=bounds.get(id);
  if(previous&&ids.every((n,k)=>previous.versions[k]===versions[n]))return previous.box;
  const box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(const n of ids)for(let k=0;k<3;k++){box[k]=Math.min(box[k],old[n][k],proposed[n][k]);box[k+3]=Math.max(box[k+3],old[n][k],proposed[n][k]);}
  bounds.set(id,{versions:ids.map(n=>versions[n]),box});return box;
 };
 const limit=contacts=>{
  // A bounded fallback may constrain motion, but must never silently allow
  // interpenetration. Repeating an unchanged proposal cannot resolve it.
  let time=contacts.length?Math.max(0,Math.min(...contacts.map(c=>c.time))*.9):0;
  // A smaller shell-safe fraction must also preserve the sampled rigid
  // endpoint constraint. If it cannot, retain the valid previous state.
  if(rigid)for(let attempt=0;attempt<20;attempt++){const limited=old.map((p,i)=>mix(p,proposed[i],time));if(!rigidContacts(limited).length)break;time=attempt===19?0:time*.5;}
  cache.lastLimit=contacts.slice(0,2).map(c=>({...c,oldA:c.fa.map(i=>old[i]),oldB:c.fb.map(i=>old[i]),nextA:c.fa.map(i=>proposed[i]),nextB:c.fb.map(i=>proposed[i])}));
  for(let i=0;i<nodes.length;i++)nodes[i].p=mix(old[i],proposed[i],time);
  stats.limited=true;stats.advance=time;return stats;
 };
 for(let pass=0;pass<12;pass++){
  const contacts=[],rigidHits=rigidContacts(proposed);stats.passes++;
  let rebuild=!broadphase;
  if(broadphase){
   checkBounds:for(const [id,box] of broadphase.boxes){
    if(!faces[id].active)continue;
    for(const n of faces[id].nodes)for(let k=0;k<3;k++){
     const v=proposed[n][k];
     if(Math.min(v,old[n][k])<box.lo[k]+CONTACT_GAP_MM||Math.max(v,old[n][k])>box.hi[k]-CONTACT_GAP_MM){rebuild=true;break checkBounds;}
    }
   }
  }
  if(rebuild)cache.broadphase=broadphase=candidates(faces,old,proposed);
  for(const [a,b] of broadphase.pairs){
   if(!faces[a].active||!faces[b].active)continue;
   const fa=faces[a].nodes,fb=faces[b].nodes;
   const key=a*faces.length+b,previous=queries.get(key);
   let reusable=!!previous;
   if(reusable)for(let k=0;k<6;k++)if(versions[k<3?fa[k]:fb[k-3]]!==previous.versions[k]){reusable=false;break;}
   let hit;
   if(reusable)hit=previous.hit;
   else{
    const ba=boxFor(a),bb=boxFor(b);
    const separated=ba[0]>bb[3]+CONTACT_GAP_MM+TOL||bb[0]>ba[3]+CONTACT_GAP_MM+TOL||ba[1]>bb[4]+CONTACT_GAP_MM+TOL||bb[1]>ba[4]+CONTACT_GAP_MM+TOL||ba[2]>bb[5]+CONTACT_GAP_MM+TOL||bb[2]>ba[5]+CONTACT_GAP_MM+TOL;
    hit=separated?null:sweptTriangleContact(fa.map(i=>old[i]),fa.map(i=>proposed[i]),fb.map(i=>old[i]),fb.map(i=>proposed[i]));
    queries.set(key,{versions:[versions[fa[0]],versions[fa[1]],versions[fa[2]],versions[fb[0]],versions[fb[1]],versions[fb[2]]],hit});
   }
   if(hit)contacts.push({...hit,fa,fb,faceA:a,faceB:b});
  }
  if(!contacts.length&&!rigidHits.length){for(let i=0;i<nodes.length;i++)nodes[i].p=proposed[i];return stats;}
  stats.contacts+=contacts.length;stats.rigidContacts+=rigidHits.length;
  if(pass===11)return limit(contacts);
  let changed=false;
  for(const c of rigidHits)rigidConstraints.set(c.node,c);
  for(const c of contacts){
   if(c.distance<1e-12)throw Error('Shell contact started from an intersecting configuration');
   c.normal=c.delta.map(v=>v/c.distance);
   cache.manifold??=new Map();
   cache.manifold.set(c.faceA*faces.length+c.faceB,{faceA:c.faceA,faceB:c.faceB,fa:c.fa,fb:c.fb,a:c.a,b:c.b,normal:c.normal});
   activeConstraints.set(c.faceA*faces.length+c.faceB,c);
  }
  // Resolve interacting contact planes together before the next full sweep.
  // Retain planes within this proposal; later contacts must not undo earlier ones.
  for(let iteration=0;iteration<256;iteration++){
   let moved=false;
   for(const c of activeConstraints.values())moved=projectContact(nodes,proposed,c,versions)||moved;
   for(const c of rigidConstraints.values()){const deficit=c.bound-dot(proposed[c.node],c.normal);if(deficit<=0)continue;
    const p=proposed[c.node];let changedNode=false;for(let k=0;k<3;k++){const previous=p[k];p[k]+=deficit*c.normal[k];changedNode||=p[k]!==previous;}if(changedNode){versions[c.node]++;moved=true;}
   }
   changed||=moved;
   let deficit=0;
   for(const c of activeConstraints.values())deficit=Math.max(deficit,planeDeficit(proposed,c));
   for(const c of rigidConstraints.values())deficit=Math.max(deficit,c.bound-dot(proposed[c.node],c.normal));
   if(!moved||deficit<1e-9)break;
  }
  if(!changed)return limit(contacts);
 }
}
