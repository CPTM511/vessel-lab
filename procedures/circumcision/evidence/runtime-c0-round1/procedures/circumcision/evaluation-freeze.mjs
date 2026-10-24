import fs from 'node:fs';
import {sourceManifest,sha256} from './manifest.mjs';
import {MODEL,instructions,tools,prompts} from './controller-spec.mjs';
export function checkEvaluationFreeze(){
 const file=new URL('evaluation-freeze.json',import.meta.url);
 if(!fs.existsSync(file))throw Error('Procedure evaluation is not frozen; complete the recorded preflight gates first');
 const freeze=JSON.parse(fs.readFileSync(file));
 if(freeze.protocol!=='C0'||freeze.model!==MODEL||JSON.stringify(freeze.seeds)!=='[11,29,83]'||freeze.sourceDigest!==sourceManifest().digest||freeze.instructionsHash!==sha256(instructions)||freeze.toolsHash!==sha256(JSON.stringify(tools))||freeze.promptHash!==sha256(prompts.procedure))throw Error('Evaluation freeze does not match current source and instructions');
 return freeze;
}
