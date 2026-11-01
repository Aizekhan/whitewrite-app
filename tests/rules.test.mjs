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
  T('owner CANNOT write marketing posts', 'DENY', 'create', G + '/posts/p1', 'u1', 'worldbuilder', { a: 1 }),
  T('Free plan cannot write cards', 'DENY', 'create', G + '/cards/c2', 'u1', 'free', { title: 'x' }),
  T('Free plan still reads its game', 'ALLOW', 'get', G + '/cards/c2', 'u1', 'free'),
  T('a stranger cannot read', 'DENY', 'get', G + '/cards/c1', 'u2'),
  T('a stranger cannot write', 'DENY', 'create', G + '/cards/c9', 'u2', 'worldbuilder', { title: 'x' }),
  T('signed-out cannot read', 'DENY', 'get', G + '/cards/c1', null),
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
