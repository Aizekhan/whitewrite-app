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
// v2.118.0: dossier / culture / sky files from the plan that edits the canon (Storyteller+), 20 MB below Worldbuilder, 200 MB on it;
// u4 custom edits characters + culture, u5 editor
const TEAM2 = Object.assign({}, TEAM, { u4: { role: 'custom', view: ['w-characters', 'culture'], edit: ['w-characters', 'culture'], viewKinds: ['characters'], editKinds: ['characters'] },
  u5: { role: 'editor', view: [], edit: [] } });
const wmocks = (plan) => [get('/worlds/w1', { owner: 'u1', team: TEAM2 }), get('/users/u1', { plan }),
  get('/worlds/w1/entities/hero', { kind: 'characters' }), get('/worlds/w1/entities/city', { kind: 'locations' })];
const MB = 1024 * 1024;
const W = (name, expectation, uid, path, plan, size) => ({ name, tc: { expectation, functionMocks: wmocks(plan),
  request: { auth: { uid }, path: O + path, method: 'create', resource: { size, contentType: 'image/png' } } } });
const U = (name, expectation, uid, path, contentType, size) => ({ name, tc: { expectation, functionMocks: wmocks('worldbuilder').concat([get('/worlds/w1/games/g1/cards/mech1', { section: 'mechanics' })]),
  request: { auth: { uid }, path: O + path, method: 'create', resource: { size, contentType } } } });

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
  W('Free CANNOT upload a dossier file (canon is read-only)', 'DENY', 'u1', 'worlds/w1/files/hero/p.png', 'free', MB),
  W('Storyteller uploads a dossier file', 'ALLOW', 'u1', 'worlds/w1/files/hero/p.png', 'storyteller', MB),
  W('Storyteller uploads a culture file', 'ALLOW', 'u1', 'worlds/w1/files/lore_abc/p.png', 'storyteller', MB),
  W('Storyteller CANNOT upload a dossier file over 20 MB', 'DENY', 'u1', 'worlds/w1/files/hero/p.png', 'storyteller', 25 * MB),
  W('Worldbuilder uploads a dossier file up to 200 MB', 'ALLOW', 'u1', 'worlds/w1/files/hero/p.png', 'worldbuilder', 150 * MB),
  W('an editor uploads a dossier file (owner on Storyteller)', 'ALLOW', 'u5', 'worlds/w1/files/city/p.png', 'storyteller', MB),
  W('a custom member uploads a file of the kind they edit', 'ALLOW', 'u4', 'worlds/w1/files/hero/p.png', 'novelist', MB),
  W('a custom member uploads a culture file with «Культура»', 'ALLOW', 'u4', 'worlds/w1/files/lore_abc/p.png', 'novelist', MB),
  W('a custom member CANNOT upload a file of another kind', 'DENY', 'u4', 'worlds/w1/files/city/p.png', 'novelist', MB),
  W('a viewer CANNOT upload a dossier file', 'DENY', 'u3', 'worlds/w1/files/hero/p.png', 'worldbuilder', MB),
  // audit 2026-11-19: avatars / story covers only under the shell's «<ms>_<name>» and raster; nothing a browser runs as a document
  U('the owner uploads an avatar', 'ALLOW', 'u1', 'users/u1/avatar/1763500000000_me.png', 'image/png', MB),
  U('an avatar CANNOT take any name', 'DENY', 'u1', 'users/u1/avatar/../../x.png', 'image/png', MB),
  U('an avatar CANNOT be an SVG', 'DENY', 'u1', 'users/u1/avatar/1763500000000_me.svg', 'image/svg+xml', 1000),
  U('an avatar CANNOT be over 2 MB', 'DENY', 'u1', 'users/u1/avatar/1763500000000_me.png', 'image/png', 3 * MB),
  U('a stranger CANNOT upload my avatar', 'DENY', 'u2', 'users/u1/avatar/1763500000000_me.png', 'image/png', MB),
  U('a card file CANNOT be HTML', 'DENY', 'u1', 'worlds/w1/games/g1/files/mech1/x.html', 'text/html', 1000),
  U('a card file CANNOT be SVG', 'DENY', 'u1', 'worlds/w1/games/g1/files/mech1/x.svg', 'image/svg+xml', 1000),
  U('a card takes a GLB model', 'ALLOW', 'u1', 'worlds/w1/games/g1/files/mech1/hero.glb', 'model/gltf-binary', 5 * MB),
  U('a dossier file CANNOT be JavaScript', 'DENY', 'u1', 'worlds/w1/files/hero/x.js', 'text/javascript', 1000),
  // 🎓 the demo game (games/{g}.demo) is read-only: no cover / title image; an ordinary game takes one
  { name: 'the demo game CANNOT take a cover', tc: { expectation: 'DENY', functionMocks: wmocks('worldbuilder').concat([get('/worlds/w1/games/demo1', { demo: true })]),
    request: { auth: { uid: 'u1' }, path: O + 'worlds/w1/games/demo1/cover/c.png', method: 'create', resource: { size: MB, contentType: 'image/png' } } } },
  { name: 'an ordinary game takes a cover', tc: { expectation: 'ALLOW', functionMocks: wmocks('worldbuilder').concat([get('/worlds/w1/games/g1', { title: 'G' })]),
    request: { auth: { uid: 'u1' }, path: O + 'worlds/w1/games/g1/cover/c.png', method: 'create', resource: { size: MB, contentType: 'image/png' } } } },
  U('the world cover CANNOT be an SVG', 'DENY', 'u1', 'worlds/w1/cover/1763500000000_c.svg', 'image/svg+xml', 1000),
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
