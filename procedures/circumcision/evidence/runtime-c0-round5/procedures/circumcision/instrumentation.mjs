import {protectedQueries} from './mechanics.mjs';
import {newWoundEdges} from './cutting.mjs';

// Read-only geometry samples. No recommended pose, path or automatic action.
export function geometryQuery(sim,query){
 if(!query||typeof query!=='object'||Array.isArray(query))throw Error('Geometry query must be an object');
 if(Object.keys(query).some(k=>!['faceIds','points'].includes(k)))throw Error('Unknown geometry query field');
 const ids=query.faceIds??[],points=query.points??[];
 if(!Array.isArray(ids)||ids.length>32||!ids.every(i=>Number.isInteger(i)&&i>=0&&i<sim.faces.length))throw Error('Request at most 32 valid face IDs');
 if(!Array.isArray(points)||points.length>8||!points.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))throw Error('Request at most eight finite XYZ query points');
 const wound=new Set(newWoundEdges(sim.faces).flatMap(e=>e.nodes));
 return {revision:sim.revision,units:'mm',scope:'Explicit instrumented geometry; no trajectory recommendation',faces:ids.map(id=>{const f=sim.faces[id];return {id,active:f.active,layer:f.layer,nodes:[...f.nodes],positions:f.nodes.map(n=>[...sim.nodes[n].p]),target:sim.task.target[id],components:f.nodes.map(n=>sim.topology.componentOf[n]),woundBoundaryNodes:f.nodes.filter(n=>wound.has(n))};}),points:points.map(point=>({point,nearestSurface:sim.nearestSurface(point),protected:protectedQueries(point,sim.scale)}))};
}
