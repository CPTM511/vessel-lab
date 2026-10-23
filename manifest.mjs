import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=import.meta.dirname;
const sources=['agent.mjs','server.mjs','sim.mjs','launch.mjs','replay.mjs','evaluate.mjs','verify-evidence.mjs','manifest.mjs','host-state.mjs','godot/main.gd','godot/main.tscn','godot/project.godot'];
export const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
export function sourceManifest(){const files=Object.fromEntries(sources.map(f=>[f,sha256(fs.readFileSync(path.join(root,f)))]));return {algorithm:'sha256',files,digest:sha256(JSON.stringify(files))};}
