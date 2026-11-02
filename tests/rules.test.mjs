// Firestore rules test — runs firestore.rules in Google's Rules Test API (no emulator, no Java needed).
// Run: npm run test:rules   (needs `gcloud auth login` with access to the whitewrite-app project)
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const PROJECT = 'whitewrite-app';
const D = '/databases/(default)/documents';
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8', shell: true }).trim();

// get() mocks: world w1 belongs to u1; u1 is on Worldbuilder, u2 owns nothing, u3 owns w1? no — u3 is Free
const mocks = (plan = 'worldbuilder') => [
  { function: 'get', args: [{ exactValue: D + '/worlds/w1' }], result: { value: { data: { owner: 'u1' } } } },
  { function: 'get', args: [{ exactValue: D + '/users/u1' }], result: { value: { data: { plan } } } },
  { function: 'get', args: [{ exactValue: D + '/users/u2' }], result: { value: { data: { plan: 'worldbuilder' } } } },
];
const G = D + '/worlds/w1/games/g1';
const T = (name, expectation, method, path, uid = 'u1', plan, data) => ({ name, tc: {
  expectation, functionMocks: mocks(plan),
  request: Object.assign({ auth: uid ? { uid } : null, path, method }, data ? { resource: { data } } : {}),
  resource: method === 'create' || method === 'get' ? undefined : { data: {} } } });

// community: `res` is the doc itself, `parent` mocks get(community/w1) for the items rule
const P = (name, expectation, method, path, uid, res, parent) => ({ name, tc: {
  expectation, functionMocks: parent ? [{ function: 'get', args: [{ exactValue: D + '/community/w1' }], result: { value: { data: parent } } }] : [],
  request: Object.assign({ auth: uid ? { uid } : null, path: D + path, method }, method !== 'get' && res ? { resource: { data: res } } : {}),
  resource: res && method !== 'create' ? { data: res } : undefined } });

const cases = [
  T('owner writes a card', 'ALLOW', 'create', G + '/cards/c1', 'u1', 'worldbuilder', { title: 'x' }),
  T('owner writes the plan (gates)', 'ALLOW', 'update', G + '/plan/current', 'u1', 'worldbuilder', { gates: {} }),
  T('owner writes a task review', 'ALLOW', 'update', G + '/tasks/G1.1', 'u1', 'worldbuilder', { status: 'done' }),
  T('owner writes the game doc', 'ALLOW', 'update', G, 'u1', 'worldbuilder', { title: 'x' }),
  T('owner reads telemetry', 'ALLOW', 'get', G + '/telemetry/e1'),
  T('owner CANNOT forge telemetry', 'DENY', 'create', G + '/telemetry/e1', 'u1', 'worldbuilder', { t: 1 }),
  T('owner CANNOT forge daily metrics', 'DENY', 'update', G + '/telemetryDaily/2026-11-02', 'u1', 'worldbuilder', { n: 1 }),
  T('owner CANNOT write the executor log', 'DENY', 'create', G + '/executions/x1', 'u1', 'worldbuilder', { type: 'claimed' }),
  T('owner may delete the executor log (deleting the game)', 'ALLOW', 'delete', G + '/executions/x1'),
  T('owner CANNOT write a future server collection (activity)', 'DENY', 'create', G + '/activity/s1', 'u1', 'worldbuilder', { a: 1 }),
  T('owner CANNOT write a future server collection (knowledge)', 'DENY', 'create', G + '/knowledge/k1', 'u1', 'worldbuilder', { a: 1 }),
  T('owner re-marks an activity entry privacy', 'ALLOW', 'update', G + '/activity/s1/entries/e1', 'u1', 'worldbuilder', { privacy: 'marketing_approved', reviewedAt: 1 }),
  T('owner CANNOT rewrite an activity entry text', 'DENY', 'update', G + '/activity/s1/entries/e1', 'u1', 'worldbuilder', { privacy: 'internal', text: 'forged' }),
  T('owner CANNOT set an unknown privacy', 'DENY', 'update', G + '/activity/s1/entries/e1', 'u1', 'worldbuilder', { privacy: 'public' }),
  T('owner CANNOT create activity entries', 'DENY', 'create', G + '/activity/s1/entries/e2', 'u1', 'worldbuilder', { privacy: 'internal' }),
  T('a stranger cannot re-mark privacy', 'DENY', 'update', G + '/activity/s1/entries/e1', 'u2', 'worldbuilder', { privacy: 'internal' }),
  T('owner may delete knowledge assets (deleting the game)', 'ALLOW', 'delete', G + '/kAssets/a1'),
  T('owner may delete an activity entry (deleting the game)', 'ALLOW', 'delete', G + '/activity/s1/entries/e1'),
  T('owner CANNOT write the environment report', 'DENY', 'create', G + '/env/current', 'u1', 'worldbuilder', { os: 'x' }),
  T('owner reads marketing posts', 'ALLOW', 'get', G + '/posts/p1'),
  T('owner CANNOT approve a post by writing it', 'DENY', 'update', G + '/posts/p1', 'u1', 'worldbuilder', { status: 'approved' }),
  T('owner CANNOT turn marketing on by writing its state', 'DENY', 'update', G + '/marketing/state', 'u1', 'worldbuilder', { enabled: true, paidUntil: 9e15 }),
  T('owner CANNOT add a channel directly', 'DENY', 'create', G + '/channels/tg_1', 'u1', 'worldbuilder', { platform: 'telegram' }),
  T('owner may delete posts (deleting the game)', 'ALLOW', 'delete', G + '/posts/p1'),
  T('nobody reads channel secrets', 'DENY', 'get', D + '/marketingSecrets/w1__g1__tg_1'),
  T('nobody writes the publishing queue', 'DENY', 'create', D + '/marketingQueue/w1__g1__p1', 'u1', 'worldbuilder', { at: 1 }),
  T('owner CANNOT write marketing posts', 'DENY', 'create', G + '/posts/p1', 'u1', 'worldbuilder', { a: 1 }),
  T('Free plan cannot write cards', 'DENY', 'create', G + '/cards/c2', 'u1', 'free', { title: 'x' }),
  T('Free plan still reads its game', 'ALLOW', 'get', G + '/cards/c2', 'u1', 'free'),
  T('a stranger cannot read', 'DENY', 'get', G + '/cards/c1', 'u2'),
  T('a stranger cannot write', 'DENY', 'create', G + '/cards/c9', 'u2', 'worldbuilder', { title: 'x' }),
  T('signed-out cannot read', 'DENY', 'get', G + '/cards/c1', null),
  // quests & dialogues: a game-design decision — games/{g}/quests, /dialogues, Worldbuilder only
  T('Worldbuilder writes a game quest', 'ALLOW', 'create', G + '/quests/q1', 'u1', 'worldbuilder', { title: 'x' }),
  T('Worldbuilder writes a game dialogue', 'ALLOW', 'update', G + '/dialogues/d1', 'u1', 'worldbuilder', { title: 'x' }),
  T('Novelist cannot write game quests', 'DENY', 'create', G + '/quests/q2', 'u1', 'novelist', { title: 'x' }),
  T('Free cannot write dialogues', 'DENY', 'create', G + '/dialogues/d2', 'u1', 'free', { title: 'x' }),
  T('Free still reads its quests', 'ALLOW', 'get', G + '/quests/q1', 'u1', 'free'),
  T('world-level quests are closed', 'DENY', 'create', D + '/worlds/w1/quests/q3', 'u1', 'worldbuilder', { title: 'x' }),
  T('Novelist still cannot write game cards', 'DENY', 'create', G + '/cards/c5', 'u1', 'novelist', { title: 'x' }),
  T('a stranger cannot read quests', 'DENY', 'get', G + '/quests/q1', 'u2'),
  T('a stranger cannot write dialogues', 'DENY', 'create', G + '/dialogues/d9', 'u2', 'worldbuilder', { title: 'x' }),
  // Спільнота: public showcases — anyone reads what is not hidden, only the server writes
  P('a guest reads a showcase', 'ALLOW', 'get', '/community/w1', null, { owner: 'u1', hidden: false }),
  P('a guest CANNOT read a hidden showcase', 'DENY', 'get', '/community/w1', null, { owner: 'u1', hidden: true }),
  P('the owner reads their hidden showcase', 'ALLOW', 'get', '/community/w1', 'u1', { owner: 'u1', hidden: true }),
  P('a guest reads showcase items', 'ALLOW', 'get', '/community/w1/items/i0001', null, null, { owner: 'u1', hidden: false }),
  P('a guest CANNOT read items of a hidden showcase', 'DENY', 'get', '/community/w1/items/i0001', null, null, { owner: 'u1', hidden: true }),
  P('the owner CANNOT write a showcase directly', 'DENY', 'update', '/community/w1', 'u1', { owner: 'u1', hidden: false, likes: 999 }),
  P('a user CANNOT write a like directly', 'DENY', 'create', '/community/w1/likes/u2', 'u2'),
  P('a user reads their own like', 'ALLOW', 'get', '/community/w1/likes/u2', 'u2', { at: 1 }),
  P('a guest reads the home page cards', 'ALLOW', 'get', '/community_home/current', null, { top: [] }),
  P('a user CANNOT read reports', 'DENY', 'get', '/community_reports/w1__u2', 'u2', { uid: 'u2' }),
  // «Історія токенів»: the owner reads their ledger, nobody writes it from the client
  P('the owner reads their token ledger', 'ALLOW', 'get', '/users/u2/ledger/e1', 'u2', { type: 'spend', amount: -5 }),
  P('a stranger CANNOT read a token ledger', 'DENY', 'get', '/users/u2/ledger/e1', 'u3', { type: 'spend', amount: -5 }),
  P('the owner CANNOT write their token ledger', 'DENY', 'create', '/users/u2/ledger/e2', 'u2', { type: 'topup', amount: 99999 }),
  // «Співтворці»: own posts only, one per type, the server owns hidden / reports
  P('a user posts their offer', 'ALLOW', 'create', '/collab/u2_offer', 'u2', { owner: 'u2', type: 'offer', author: 'A', title: '3D', roles: ['art3d'], text: 'x', contact: 'd', pubId: '', hidden: false, reports: 0 }),
  P('a user CANNOT post under another id', 'DENY', 'create', '/collab/u3_offer', 'u2', { owner: 'u2', type: 'offer', author: 'A', title: '3D', roles: ['art3d'], text: 'x', contact: 'd', pubId: '', hidden: false, reports: 0 }),
  P('a user CANNOT post a wrong type id', 'DENY', 'create', '/collab/u2_seek', 'u2', { owner: 'u2', type: 'offer', author: 'A', title: '3D', roles: ['art3d'], text: 'x', contact: 'd', pubId: '', hidden: false, reports: 0 }),
  P('a user CANNOT create a hidden-flag post', 'DENY', 'create', '/collab/u2_offer', 'u2', Object.assign({ owner: 'u2', type: 'offer', author: 'A', title: '3D', roles: ['art3d'], text: 'x', contact: 'd', pubId: '', hidden: false, reports: 0 }, { hidden: true })),
  P('a user CANNOT add extra fields', 'DENY', 'create', '/collab/u2_offer', 'u2', Object.assign({ owner: 'u2', type: 'offer', author: 'A', title: '3D', roles: ['art3d'], text: 'x', contact: 'd', pubId: '', hidden: false, reports: 0 }, { promoted: true })),
  P('a guest CANNOT post', 'DENY', 'create', '/collab/u2_offer', null, { owner: 'u2', type: 'offer', author: 'A', title: '3D', roles: ['art3d'], text: 'x', contact: 'd', pubId: '', hidden: false, reports: 0 }),
  P('a guest reads posts', 'ALLOW', 'get', '/collab/u2_offer', null, { owner: 'u2', type: 'offer', author: 'A', title: '3D', roles: ['art3d'], text: 'x', contact: 'd', pubId: '', hidden: false, reports: 0 }),
  P('a guest CANNOT read a hidden post', 'DENY', 'get', '/collab/u2_offer', null, Object.assign({ owner: 'u2', type: 'offer', author: 'A', title: '3D', roles: ['art3d'], text: 'x', contact: 'd', pubId: '', hidden: false, reports: 0 }, { hidden: true })),
  P('a stranger CANNOT delete a post', 'DENY', 'delete', '/collab/u2_offer', 'u3', { owner: 'u2', type: 'offer', author: 'A', title: '3D', roles: ['art3d'], text: 'x', contact: 'd', pubId: '', hidden: false, reports: 0 }),
  P('the owner deletes their post', 'ALLOW', 'delete', '/collab/u2_offer', 'u2', { owner: 'u2', type: 'offer', author: 'A', title: '3D', roles: ['art3d'], text: 'x', contact: 'd', pubId: '', hidden: false, reports: 0 }),
];

const r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`, {
  method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT },
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rules }] }, testSuite: { testCases: cases.map((c) => c.tc) } }),
});
const j = await r.json();
if (!r.ok) { console.error(JSON.stringify(j, null, 2)); process.exit(1); }
let fails = 0;
(j.testResults || []).forEach((res, i) => {
  const ok = res.state === 'SUCCESS';
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + cases[i].name + (ok ? '' : ' — ' + (res.debugMessages || []).join('; ')));
});
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
