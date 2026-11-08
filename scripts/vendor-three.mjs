// Vendors three.js into app/vendor/three/ (served from whitewrite.com, not unpkg): the build and only the addons the
// pages import (app/gb-3d.js) plus whatever they import in turn. Run once per three.js upgrade: node scripts/vendor-three.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.169.0';
const BASE = `https://unpkg.com/three@${VERSION}/`;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'vendor', 'three');
const ENTRY = ['build/three.module.js', 'examples/jsm/controls/OrbitControls.js', 'examples/jsm/loaders/GLTFLoader.js',
  'examples/jsm/loaders/FBXLoader.js', 'examples/jsm/loaders/OBJLoader.js', 'examples/jsm/loaders/STLLoader.js',
  'examples/jsm/exporters/GLTFExporter.js'];

const seen = new Set(), queue = [...ENTRY];
while (queue.length) {
  const rel = queue.shift();
  if (seen.has(rel)) continue;
  seen.add(rel);
  const r = await fetch(BASE + rel);
  if (!r.ok) throw new Error(rel + ': ' + r.status);
  const src = await r.text();
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.writeFileSync(path.join(OUT, rel), src);
  // relative imports only — 'three' itself is the import map's
  for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
    queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1] || m[2])));
  }
}
fs.writeFileSync(path.join(OUT, 'VERSION'), VERSION + '\n' + [...seen].sort().join('\n') + '\n');
console.log(`three@${VERSION}: ${seen.size} files → app/vendor/three/`);
