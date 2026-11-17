// MCP GDD tools of v2.142 (GDD refocus — Claude Code keeps the GDD itself): link_cards (card.links with a role, a hero's prefab),
// archive_card (never deletes; links to it listed), link_project_asset (checked against the project index when there is one),
// card_file_upload (which files go on which card, the GLB rule, the plan's file limit, a file the card already has) and the
// card-refs «link» kind that shows the links in «🔗 Що зачепить зміна» / get_card used_by.
// Run: npm test
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');
const pick = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('no ' + from); return src.slice(a, b); };
const REFS = require('../functions/card-refs.js'), KIT = require('../functions/asset-kit.js');
const DEL = { del: true };
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS', delete: () => DEL } } };
let plan = { fileMB: 200 }, quota = { bytes: 0, quota: 10 * 1073741824 };
const db = { collection: (c) => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ plan: 'worldbuilder' }) }) }) }) };
const req = (m) => (m === './storage-quota' ? { _quota: { usage: async () => quota } } : require(m));
const T = new Function('NV', 'admin', 'GDD', 'REFS', 'KIT', 'db', 'getPlanBudget', 'require', 'crypto',
  pick('const str =', '// ---------- tools') + pick('async function narrative', '// 🎙') +
  pick('// ---------- ✎ writes on the user', 'async function callTool') + pick('// 📦 card_file_upload', 'async function authKey') +
  'function rpcError(code, message) { const e = new Error(message); e.rpcCode = code; return e; }' +
  ';return { linkCards, archiveCard, linkAsset, fileTicket, fileSlotFor, refCard };')(require('../functions/narrative-validate.js'), admin,
  require('../functions/gdd-schema.js'), REFS, KIT, db, () => plan, req, require('crypto'));

const writes = [];
let kAssets = [];
const gref = { collection: (col) => ({
  doc: (id) => ({ set: async (body, opt) => { writes.push({ col, id, body, merge: !!(opt && opt.merge) }); }, get: async () => { const a = kAssets.find((x) => x.guid === id); return { exists: !!a, data: () => a }; } }),
  limit: () => ({ get: async () => ({ size: col === 'kAssets' ? kAssets.length : 0, docs: [] }) }),
  where: (f, op, v) => ({ limit: () => ({ get: async () => { const a = kAssets.filter((x) => x[f] === v); return { size: a.length, docs: a.map((x) => ({ data: () => x })) }; } }) }),
  get: async () => ({ docs: col === 'quests' ? [{ id: 'q1', data: () => ({ title: 'Hunt', giver: 'c:e1', stages: [] }) }] : [] }) }) };
const mk = () => ({ gref, game: {}, plan: {}, tasks: [],
  entities: [{ id: 'char_a', kind: 'characters', name: 'Ada' }],
  cards: [
    { id: 'e1', section: 'enemies', title: 'Wolf', fields: {} },
    { id: 'l1', section: 'levels', title: 'Forest', fields: {} },
    { id: 'a1', section: 'assets', title: 'Wolf model', fields: {} },
    { id: 's1', section: 'audio', title: 'Howl', fields: {}, defs: [{ key: 'snd', label: 'Звук', type: 'audio' }], files: [{ name: 'howl.wav', sha256: 'a'.repeat(64), url: 'u' }] },
    { id: 'char_a', section: 'characters', canonRef: 'char_a', title: 'Ada', fields: {} },
  ],
  archived: [{ id: 'old1', section: 'enemies', title: 'Old wolf', archived: { reason: 'cut' } }] });
const key = { prefix: 'wwk_ab12', uid: 'u1', worldId: 'w1', gameId: 'g1' };
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const err = async (f) => { try { await f(); return ''; } catch (e) { return e.message; } };
const last = () => writes[writes.length - 1];

(async () => {
  // 🔗 link_cards
  let ctx = mk(), out = await T.linkCards(ctx, key, { from: 'c:e1', to: 'c:l1', role: 'appears_in' });
  check(out.linked + ' ' + last().id + ' ' + last().body.links.map((l) => l.to + ':' + l.role).join(), 'true e1 c:l1:appears_in', 'a link lands on the first card with its role');
  check((await T.linkCards(ctx, key, { from: 'c:e1', to: 'c:l1', role: 'appears_in' })).already, true, 'the same link twice is not added again');
  const G = { cards: ctx.cards, entities: ctx.entities, quests: [], dialogues: [], tasks: [], plan: null };
  const into = REFS.usedBy(G, 'c:l1', 'uk'), from = REFS.usedBy(G, 'c:e1', 'uk');
  check(into.some((r) => r.kind === 'link' && r.side === 'in' && r.extra === 'зʼявляється в' && r.role === 'appears_in'), true, 'the level sees the enemy that appears in it (card-refs link kind)');
  check(from.some((r) => r.kind === 'link' && r.side === 'out' && r.from.key === 'c:l1'), true, 'the enemy sees its level on the out side');
  await T.linkCards(ctx, key, { from: 'c:e1', to: 'c:l1', role: 'appears_in', remove: true });
  check(last().body.links.length, 0, 'remove: true takes the link away');
  check(/role must be/.test(await err(() => T.linkCards(mk(), key, { from: 'c:e1', to: 'c:l1', role: 'loves' }))), true, 'only the known roles');
  check(/itself/.test(await err(() => T.linkCards(mk(), key, { from: 'c:e1', to: 'c:e1', role: 'related' }))), true, 'no link to itself');
  check(/archived/.test(await err(() => T.linkCards(mk(), key, { from: 'c:e1', to: 'c:old1', role: 'related' }))), true, 'an archived card is named as archived');
  await T.linkCards(mk(), key, { from: 'c:e1', to: 'c:a1', role: 'prefab' });
  check(last().body.prefab, 'a1', 'role prefab writes the hero\'s own prefab field');
  check(/assets/.test(await err(() => T.linkCards(mk(), key, { from: 'c:e1', to: 'c:l1', role: 'prefab' }))), true, 'a prefab is an assets card');
  await T.linkCards(mk(), key, { from: 'e:char_a', to: 'c:l1', role: 'appears_in' });
  check(last().id + ' ' + last().body.canonRef, 'char_a char_a', 'a canon card keeps its canonRef when linked');

  // 🗄 archive_card
  ctx = mk(); out = await T.archiveCard(ctx, key, { ref: 'c:e1', reason: 'replaced by the boss', merged_into: 'c:a1' });
  check(last().body.archived.reason + '|' + last().body.archived.into + '|' + last().body.archived.by, 'replaced by the boss|c:a1|claude_code', 'the card is marked archived, not deleted');
  check(writes.some((w) => w.body === null), false, 'nothing is deleted');
  check((out.still_linked || []).length, 1, 'the quest that still points at it is listed');
  check(ctx.cards.some((c) => c.id === 'e1'), false, 'it leaves the session\'s card list');
  check(/canon/.test(await err(() => T.archiveCard(mk(), key, { ref: 'e:char_a', reason: 'x' }))), true, 'a canon entity is not archived from a game');
  check(/reason/.test(await err(() => T.archiveCard(mk(), key, { ref: 'c:l1' }))), true, 'a reason is required');
  const G2 = { cards: [{ id: 'x', section: 'enemies', links: [{ to: 'c:l1', role: 'uses' }], archived: { reason: 'r' } }], quests: [], dialogues: [], tasks: [] };
  check(REFS.usedBy(G2, 'c:l1', 'en').length, 0, 'an archived card points at nothing (card-refs live)');

  // 🔗 link_project_asset
  kAssets = [];
  out = await T.linkAsset(mk(), key, { ref: 'c:e1', path: 'src\\server\\Wolf.lua' });
  check(out.asset.path + ' ' + out.asset.verified + ' ' + !!out.note, 'src/server/Wolf.lua false true', 'without a project index the path is kept as given (Roblox / Rojo)');
  check(/relative/.test(await err(() => T.linkAsset(mk(), key, { ref: 'c:e1', path: 'C:/game/x.prefab' }))), true, 'an absolute path is refused');
  kAssets = [{ guid: 'f'.repeat(32), path: 'Assets/Wolf.prefab', name: 'Wolf', type: 'prefab' }];
  out = await T.linkAsset(mk(), key, { ref: 'c:e1', guid: 'F'.repeat(32) });
  check(out.asset.path + ' ' + out.asset.verified, 'Assets/Wolf.prefab true', 'with an index the asset is found by its GUID');
  out = await T.linkAsset(mk(), key, { ref: 'c:e1', path: 'Assets/Wolf.prefab' });
  check(out.asset.guid, 'f'.repeat(32), 'and by its path');
  check(/project index/.test(await err(() => T.linkAsset(mk(), key, { ref: 'c:e1', path: 'Assets/None.prefab' }))), true, 'an asset the index does not have is refused');

  // 📦 card_file_upload: where a file goes
  const c = (id) => mk().cards.find((x) => x.id === id);
  check(T.fileSlotFor(c('a1'), 'wolf.glb').field, 'kit:model', 'a GLB on an asset card fills the model slot');
  check(T.fileSlotFor(c('a1'), 'wolf_LOD1.glb').field, 'kit:lod', 'a LOD by its name');
  check(T.fileSlotFor(c('a1'), 'Wolf.rbxm').field, 'kit:prefab', 'a Roblox model is the engine prefab / package');
  check(T.fileSlotFor(c('a1'), 'wolf_normal.png').field, 'kit:normal', 'a texture fills its map slot');
  check(T.fileSlotFor(c('s1'), 'howl2.ogg').field, 'snd', 'a sound goes into the sound card\'s sound field');
  check(/«Звук і музика»/.test(T.fileSlotFor(c('l1'), 'howl.wav').err || ''), true, 'a sound elsewhere is refused');
  check(/takes no model/.test(T.fileSlotFor(c('e1'), 'wolf.glb').err || ''), true, 'an enemy card takes no model (its prefab card does)');
  check(/package goes/.test(T.fileSlotFor(c('l1'), 'level.zip').err || ''), true, 'a package on a level card is refused');
  check(/GLB/.test(await err(() => T.fileTicket(mk(), key, { ref: 'c:a1', file_name: 'wolf.fbx', size_bytes: 10 }))), true, 'FBX is refused with the GLB way');
  check(/card_image_upload/.test(await err(() => T.fileTicket(mk(), key, { ref: 'c:a1', file_name: 'wolf.exe', size_bytes: 10 }))), true, 'an unknown kind of file is refused');
  plan = { fileMB: 20 };
  check(/20 MB/.test(await err(() => T.fileTicket(mk(), key, { ref: 'c:a1', file_name: 'wolf.glb', size_bytes: 30 * 1048576 }))), true, 'the plan\'s file limit before any upload');
  plan = { fileMB: 200 }; quota = { bytes: 10 * 1073741824 - 5, quota: 10 * 1073741824 };
  check(/storage is full/.test(await err(() => T.fileTicket(mk(), key, { ref: 'c:a1', file_name: 'wolf.glb', size_bytes: 100 }))), true, 'a full storage quota refuses it');
  quota = { bytes: 0, quota: 10 * 1073741824 };
  out = await T.fileTicket(mk(), key, { ref: 'c:s1', file_name: 'howl.wav', size_bytes: 100, sha256: 'A'.repeat(64) });
  check(out.already + ' ' + out.file, 'true howl.wav', 'a file the card already holds (sha256) is not uploaded again');

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
