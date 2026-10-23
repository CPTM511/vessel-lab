// SCRIPTED test fixture, never exposed as a model tool or represented as AI autonomy.
import {dist} from '../sim.mjs';
export function runReference(sim, {tie=true, trim=true, release=true}={}) {
 const actions=[];
 const step=action=>{const a={...action,revision:sim.revision};sim.step(a);actions.push({kind:'step',action:a});};
 const move=(name,target)=>{
  const from=[...sim.arms[name].position],count=Math.ceil(dist(from,target)/2.7)||1;
  for(let i=1;i<=count;i++)step({duration:.7,[name]:{position:from.map((v,k)=>v+(target[k]-v)*i/count)}});
 };
 for(let j=0;j<24;j++){
  const a=j*Math.PI/12,y=sim.radius*Math.cos(a),z=sim.radius*Math.sin(a),sign=j%2===0?1:-1;
  move('right',[sign*1.5,y,z]);move('right',[-sign*1.5,y,z]);
 }
 move('left',sim.tail);step({duration:.1,left:{jaw:0}});
 const n=[...sim.needle.position];
 move('left',[n[0]+.5,n[1]+7,n[2]]);
 if(tie){
  move('left',[n[0]+.5,n[1]+1.6,n[2]]);
  for(let i=1;i<=20;i++)move('left',[n[0]+.5,n[1]+1.6*Math.cos(i*Math.PI/8),n[2]+1.6*Math.sin(i*Math.PI/8)]);
 }
 if(trim){move('right',sim.cutPosition);sim.cutThread();actions.push({kind:'cut'});}
 if(release)step({duration:.2,left:{jaw:1},right:{jaw:1}});
 return actions;
}
