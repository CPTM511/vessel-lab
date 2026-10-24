import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const sources=['recording.mjs','replay.mjs','agent.mjs','evaluation-freeze.mjs','../../host-state.mjs','controller-lease.mjs','controller-spec.mjs','ordinary-guard.mjs','instrumentation.mjs','manifest.mjs','inspector.mjs','launch.mjs','mechanics.mjs','scenario.mjs','contact.mjs','cutting.mjs','task-definition.mjs','evaluation.mjs','attachments.mjs','godot/main.gd','godot/anatomy.gd','godot/main.tscn','godot/project.godot','godot/data/tissue-rest.json','docs/PROTOCOL.md'];
export function sourceManifest(){const files=Object.fromEntries(sources.map(f=>[f,sha256(fs.readFileSync(path.join(import.meta.dirname,f)))]));return {algorithm:'sha256',files,digest:sha256(JSON.stringify(files))};}
