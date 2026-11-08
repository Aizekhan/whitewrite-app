// Storage rules test — runs storage.rules in Google's Rules Test API (no emulator), like rules.test.mjs.
// Run: npm run test:rules   (needs `gcloud auth login` with access to the whitewrite-app project)
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const PROJECT = 'whitewrite-app';
const D = '/databases/(default)/documents';
const O = '/b/whitewrite-app.firebasestorage.app/o/';
const rules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8', shell: true }).trim();

// w1: owner u1 (Worldbuilder); u2 custom (views mechanics + characters), u3 viewer
const TEAM = { u2: { role: 'custom', view: ['mechanics', 'w-characters'], edit: [], viewKinds: ['characters'], editKinds: [] }, u3: { role: 'viewer', view: [], edit: [] } };
const get = (p, data) => ({ function: 'firestore.get', args: [{ exactValue: D + p }], result: { value: { data } } });
const mocks = [
  get('/worlds/w1', { owner: 'u1', team: TEAM }),
  get('/users/u1', { plan: 'worldbuilder' }),
  get('/worlds/w1/games/g1/cards/mech1', { section: 'mechanics' }),
  get('/worlds/w1/games/g1/cards/lvl1', { section: 'levels' }),
  get('/worlds/w1/entities/hero', { kind: 'characters' }),
  get('/worlds/w1/entities/city', { kind: 'locations' }),
];
const R = (name, expectation, uid, path) => ({ name, tc: { expectation, functionMocks: mocks, request: { auth: uid ? { uid } : null, path: O + path, method: 'get' } } });

const cases = [
  R('the owner reads any card file', 'ALLOW', 'u1', 'worlds/w1/games/g1/files/lvl1/a.png'),
  R('a viewer reads any card file', 'ALLOW', 'u3', 'worlds/w1/games/g1/files/lvl1/a.png'),
  R('a member with chosen sections reads a file of their section', 'ALLOW', 'u2', 'worlds/w1/games/g1/files/mech1/a.png'),
  R('a member with chosen sections CANNOT read a file of another section', 'DENY', 'u2', 'worlds/w1/games/g1/files/lvl1/a.png'),
  R('a member with chosen sections reads a dossier file of their kind', 'ALLOW', 'u2', 'worlds/w1/files/hero/p.png'),
  R('a member with chosen sections CANNOT read a dossier file of another kind', 'DENY', 'u2', 'worlds/w1/files/city/p.png'),
  R('a member without «Космологія» CANNOT read the sky map', 'DENY', 'u2', 'worlds/w1/files/cosmos/m.png'),
  R('the owner reads the sky map', 'ALLOW', 'u1', 'worlds/w1/files/cosmos/m.png'),
  R('a stranger CANNOT read a card file', 'DENY', 'u9', 'worlds/w1/games/g1/files/mech1/a.png'),
  R('a member reads the world cover', 'ALLOW', 'u2', 'worlds/w1/cover/c.jpg'),
  R('a signed-in user reads the animation library', 'ALLOW', 'u9', 'library/anims/human.glb'),
];

const r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`, {
  method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT },
  body: JSON.stringify({ source: { files: [{ name: 'storage.rules', content: rules }] }, testSuite: { testCases: cases.map((c) => c.tc) } }),
});
const j = await r.json();
if (!r.ok) { console.error(JSON.stringify(j, null, 2)); process.exit(1); }
let fails = 0;
(j.testResults || []).forEach((res, i) => {
  const ok = res.state === 'SUCCESS';
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + cases[i].name + (ok ? '' : ' — ' + (res.debugMessages || []).join('; ') + ' ' + JSON.stringify(res.errorPosition || '')));
});
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
