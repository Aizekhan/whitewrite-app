// The notes import on the real AI (GDD refocus §3.5): every sample of tests/fixtures/import-placement.json goes through the same prompt and
// post-processing as «Імпорт .md» (functions/src/gamedev.js importPrompt / cleanImport) and the cards are checked against the sections they
// must land in. Costs tokens of the key you pass — run it after changing the GDD schema or the import prompt, not in `npm test`.
//   $env:ANTHROPIC_API_KEY = "<key>"; node scripts/import-placement-live.mjs        (PowerShell)
//   ANTHROPIC_API_KEY=<key> node scripts/import-placement-live.mjs                  (bash)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const GDD = require('../functions/gdd-schema.js');
const { AI_MODELS } = require('../functions/ai-models.js');
const { cleanImport, importPrompt } = require('../functions/src/gamedev.js')._gdd;
const { samples } = require('../tests/fixtures/import-placement.json');

const key = process.env.ANTHROPIC_API_KEY;
if (!key) { console.error('Set ANTHROPIC_API_KEY first (see the top of this file).'); process.exit(2); }
const model = AI_MODELS.claude.sonnet; // the import's paid default
const shelves = GDD.SECTIONS.filter((s) => s.write).map((s) => ({ id: s.id, kind: 'game', name: s.en, fields: [], groups: [] }));

async function ask(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ? j.error.message : 'HTTP ' + r.status);
  const t = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}

let ok = 0, all = 0;
for (const x of samples) {
  const prompt = importPrompt(x.md, shelves, [], { title: 'Test world', rules: [] }, 'Ukrainian', []);
  let cards = [];
  try { cards = cleanImport(await ask(prompt), shelves, [], { rules: [] }, []).cards; } catch (e) { console.log(`ERROR ${x.id}: ${e.message}`); all += x.expect.length || 1; continue; }
  const got = cards.map((c) => `[${c.section}] ${c.title}`).join(' · ') || '(no cards)';
  const checks = x.expect.map((e) => ({ want: e, hit: cards.some((c) => c.section === e.section && new RegExp(e.title, 'i').test(c.title)) }))
    .concat((x.forbid || []).map((e) => ({ want: { ...e, not: true }, hit: !cards.some((c) => c.section === e.section && new RegExp(e.title, 'i').test(c.title)) })));
  checks.forEach((c) => { all++; if (c.hit) ok++; console.log(`${c.hit ? 'PASS' : 'FAIL'} ${x.id}: ${c.want.not ? 'not ' : ''}${c.want.section} /${c.want.title}/ — got ${got}`); });
}
console.log(`\n${ok}/${all} placed right (${model})`);
process.exit(ok === all ? 0 : 1);
