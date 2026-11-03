// The commit gate (git commit-msg hook, scripts/git-hooks/commit-msg; installed by `npm install` → "prepare"):
// the CLAUDE.md rules as checks, so a forgotten part of a change stops the commit instead of being remembered later.
//   1. a service change (app/, functions/, rules) comes with ARCHITECTURE.md
//   2. a user-facing change comes with the Knowledge base (app/kb.js)
//   3. the fast connection tests pass: card references, the paid registry, framework gaps, MCP ↔ KB, functions ↔ ARCHITECTURE
// A part that truly does not apply is skipped CONSCIOUSLY, with a reason in the commit message:
//   [skip-arch: why]   [skip-kb: why]        (the reason is at least 8 characters)
// Usage: node scripts/change-gate.mjs <commit message file>      (no file → only the checks, as in a dry run)
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const msg = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : '';
if (/^(Merge|Revert) /.test(msg)) process.exit(0);
const staged = execSync('git diff --cached --name-only --diff-filter=ACMRD', { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
if (!staged.length) process.exit(0);

const skip = (k) => { const m = msg.match(new RegExp('\\[' + k + ':\\s*([^\\]]{8,})\\]')); return m ? m[1].trim() : ''; };
const has = (f) => staged.includes(f);
const problems = [];

// service code: what the CLAUDE.md rules are about (built copies, tests and docs are not)
const service = staged.filter((f) => (/^app\//.test(f) && !/^app\/firebase\/(ai-models|paid-features|narrative-validate|setup-guides|style-guide|mechanics|forge|world-fill|card-refs)\.js$/.test(f) && f !== 'app/kb.js')
  || (/^functions\//.test(f) && !/^functions\/(package(-lock)?\.json|legal\/)/.test(f)) || /^(firestore|storage)\.rules$/.test(f));
const userFacing = service.filter((f) => !/^functions\/src\/(common|cost-watch|model-watch|token-service)\.js$/.test(f));

if (service.length && !has('ARCHITECTURE.md') && !skip('skip-arch'))
  problems.push('ARCHITECTURE.md is not in the commit (changed: ' + service.slice(0, 4).join(', ') + (service.length > 4 ? ' …' : '') + ').\n   Update it (Version / Last updated + the section), or add [skip-arch: <why>] to the message.');
if (userFacing.length && !has('app/kb.js') && !skip('skip-kb'))
  problems.push('app/kb.js (Knowledge base, uk + en) is not in the commit (changed: ' + userFacing.slice(0, 4).join(', ') + (userFacing.length > 4 ? ' …' : '') + ').\n   Add / change / remove the article, or add [skip-kb: <why>] to the message.');

// fast tests — the connections between parts of the service
const TESTS = ['tests/connections.test.cjs', 'tests/card-refs.test.cjs', 'tests/paid-gates.test.cjs', 'tests/framework-gaps.test.cjs'];
if (service.length || staged.some((f) => /^tests\//.test(f))) {
  for (const t of TESTS) {
    const r = spawnSync(process.execPath, [t], { encoding: 'utf8' });
    if (r.status !== 0) problems.push(t + ' failed:\n' + (r.stdout + r.stderr).split('\n').filter((l) => /^FAIL|→/.test(l.trim())).slice(0, 12).map((l) => '   ' + l.trim()).join('\n'));
  }
}

if (problems.length) {
  console.error('\n✋ Commit gate (scripts/change-gate.mjs — the CLAUDE.md rules):\n\n' + problems.map((p, i) => (i + 1) + '. ' + p).join('\n\n') +
    '\n\nFix it and commit again. Never bypass with --no-verify.\n');
  process.exit(1);
}
const skipped = ['skip-arch', 'skip-kb'].filter(skip);
if (skipped.length) console.log('Commit gate: skipped consciously — ' + skipped.map((k) => k + ' (' + skip(k) + ')').join('; '));
