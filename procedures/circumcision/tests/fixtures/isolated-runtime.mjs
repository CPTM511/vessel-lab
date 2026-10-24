import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sourceManifest} from '../../manifest.mjs';

// Copy exact runtime files, deliberately excluding any final evaluation freeze.
// Protocol tests must not depend on or change the working checkout's freeze.
export function isolatedRuntime() {
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'adult-isolated-runtime-'));
 const source=path.resolve(import.meta.dirname,'../..');
 const root=path.join(temporary,'procedures','circumcision');
 for(const file of Object.keys(sourceManifest().files)) {
  const destination=path.resolve(root,file);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(path.resolve(source,file),destination);
 }
 return {root,cleanup:()=>fs.rmSync(temporary,{recursive:true,force:true})};
}
