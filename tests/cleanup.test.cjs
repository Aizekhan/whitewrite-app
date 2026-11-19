// After a game / world is deleted (functions/src/cleanup.js): its tokens, keys, secrets, showcases, files and leftover
// subcollections go — and nothing of a neighbour game or world. Run: npm test
const path = require('path');
const F = (p) => require.resolve(path.join(__dirname, '../functions', p));
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

const store = new Set(), deletedFiles = [];
const ID = { __id: true };
const snap = (p) => ({ id: p.split('/').pop(), ref: doc(p), exists: store.has(p) });
const query = (c, filters) => ({ where: (f, op, v) => query(c, filters.concat([[f, op, v]])),
  get: async () => ({ docs: [...store].filter((k) => k.split('/').length === 2 && k.startsWith(c + '/')).filter((k) => filters.every(([f, op, v]) => {
    const id = k.split('/')[1], x = f === ID ? id : (data[k] || {})[f];
    return op === '==' ? x === v : op === '>=' ? x >= v : op === '<' ? x < v : false; })).map(snap) }) });
const data = {};
function doc(p) { return { path: p, id: p.split('/').pop(), get: async () => snap(p), delete: async () => { store.delete(p); }, collection: (c) => col(p + '/' + c) }; }
function col(p) { return { doc: (id) => doc(p + '/' + id), where: (f, op, v) => query(p, [[f, op, v]]) }; }
const db = { collection: col, bulkWriter: () => { const ops = []; return { delete: (r) => ops.push(r), close: async () => ops.forEach((r) => store.delete(r.path)) }; },
  recursiveDelete: async (r) => { [...store].filter((k) => k === r.path || k.startsWith(r.path + '/')).forEach((k) => store.delete(k)); } };
const admin = { firestore: { FieldPath: { documentId: () => ID } },
  storage: () => ({ bucket: () => ({ deleteFiles: async ({ prefix }) => { deletedFiles.push(prefix); } }) }) };
require.cache[F('src/common.js')] = { loaded: true, exports: { admin, db } };
const { cleanGame, cleanWorld, cleanProject } = require(F('src/cleanup.js'))._cleanup;

const put = (p, d) => { store.add(p); if (d) data[p] = d; };
(async () => {
  // two games in w (g and g2 — a prefix of each other's secrets must not leak), one in another world
  for (const g of ['g', 'g2']) {
    put(`mcpKeys/m_${g}`, { worldId: 'w', gameId: g }); put(`ingestKeys/i_${g}`, { worldId: 'w', gameId: g });
    put(`repoTokens/w__${g}`); put(`integrationKeys/w__${g}`); put(`marketingSecrets/w__${g}__tg`); put(`marketingQueue/w__${g}__p1`);
    put(`community/w__${g}`); put(`community/w__${g}/likes/u1`); put(`worlds/w/games/${g}/cards/c1`);
    put(`community_reports/w__${g}__u9`, { pubId: `w__${g}` });
  }
  put('mcpKeys/m_x', { worldId: 'x', gameId: 'g' }); put('repoTokens/x__g'); put('backupTokens/w'); put('backupTokens/x');
  put('community/w'); put('community/x'); put('worlds/w/entities/e1'); put('worlds/x/entities/e1'); put('integrationKeys/w', { worldId: 'w' });

  await cleanGame('w', 'g');
  const left = (p) => store.has(p);
  check(!left('mcpKeys/m_g') && !left('ingestKeys/i_g') && !left('repoTokens/w__g') && !left('integrationKeys/w__g'), 'the game\'s MCP, ingest, integration keys and GitHub token are gone');
  check(!left('marketingSecrets/w__g__tg') && !left('marketingQueue/w__g__p1'), 'its marketing secrets and queue are gone');
  check(!left('community/w__g') && !left('community/w__g/likes/u1') && !left('worlds/w/games/g/cards/c1'), 'its showcase (with likes) and leftover subcollections are gone');
  check(deletedFiles.includes('worlds/w/games/g/'), 'its Storage files are deleted by prefix');
  check(!left('community_reports/w__g__u9') && left('community_reports/w__g2__u9'), 'the reports on its showcase go, a neighbour game’s stay');
  check(left('mcpKeys/m_g2') && left('marketingSecrets/w__g2__tg') && left('repoTokens/w__g2') && left('community/w__g2') && left('worlds/w/games/g2/cards/c1'),
    'the neighbour game g2 keeps everything (g is a prefix of g2)');
  check(left('mcpKeys/m_x') && left('repoTokens/x__g'), 'the same game id in another world is untouched');

  await cleanWorld('w');
  check(!left('mcpKeys/m_g2') && !left('repoTokens/w__g2') && !left('marketingSecrets/w__g2__tg') && !left('integrationKeys/w') && !left('backupTokens/w'),
    'the world\'s keys, tokens and secrets are gone (all its games)');
  check(!left('community/w') && !left('community/w__g2') && !left('worlds/w/entities/e1') && deletedFiles.includes('worlds/w/'), 'its showcases, subcollections and files are gone');
  check(left('community/x') && left('backupTokens/x') && left('worlds/x/entities/e1') && left('mcpKeys/m_x'), 'another world keeps everything');

  put('projects/p1'); put('projects/p1/scenes/s1'); put('projects/p1/scenes/s2'); put('projects/p2/scenes/s1');
  store.delete('projects/p1'); // the client deleted the story document
  await cleanProject('p1');
  check(!left('projects/p1/scenes/s1') && !left('projects/p1/scenes/s2') && deletedFiles.includes('projects/p1/'), 'a deleted story loses its scenes and its cover files');
  check(left('projects/p2/scenes/s1'), 'another story keeps its scenes');

  const idx = require('fs').readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
  check(/exports\.gameDeleted = cleanup\.gameDeleted/.test(idx) && /exports\.worldDeleted = cleanup\.worldDeleted/.test(idx) && /exports\.projectDeleted = cleanup\.projectDeleted/.test(idx), 'all three triggers are exported');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
