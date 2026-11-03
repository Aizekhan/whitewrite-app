// ============================================================================
// Setup guides for Claude Code — SINGLE SOURCE for the MCP tool get_guide and the Game Bible's settings
// (copy buttons). app/firebase/setup-guides.js is a COPY made by scripts/build-app.mjs — edit THIS file.
// ============================================================================
// Agent-facing text is English (Claude Code reads it); the Bible explains it to the author in uk/en.
// Unity CLI facts were checked against docs.unity.com on 2026-11-01 (ARCHITECTURE.md §5 «Setup guides»):
// the CLI is experimental/beta — every check has the classic Unity.exe batchmode fallback.

const KNOWLEDGE_SCHEMA = 'whitewrite.knowledge/1';
const ACTIVITY_SCHEMA = 'whitewrite.activity/1';
const UNITY_CLI_CHECKED = '1.0.0-beta.14 (2026-10-21)';

const SOURCES = {
  cli: 'https://docs.unity.com/en-us/unity-cli/use-unity-cli',
  cliRef: 'https://docs.unity.com/en-us/unity-cli/unity-cli-reference',
  editorCli: 'https://docs.unity.com/en-us/engine/current/manual/unity-editor/command-line-arguments/editor',
  testCli: 'https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html',
};

const GATE_RULE = 'If get_next_task (or list_tasks) says the next milestone waits for a gate (locked_by_gate), tell the author which gate and stop: ' +
  'gates are approved by the author in the Game Bible. Never work around a gate, never start tasks of a locked milestone.';

const GUIDES = {
  setup: {
    title: 'First run: connect this Unity project to WhiteWrite',
    markdown: `# First run — connecting the project

1. **MCP**: this session is already connected if you can read this. Call \`get_project_overview\` and tell the author the game title you see — they confirm it is the right game.
2. **Repository**: if the project is in Git, make sure the author connected the same repository in WhiteWrite (Game Bible → ⚙ Project settings → GitHub). Do not ask for or store tokens.
3. **Unity environment**: call \`get_guide {topic:"unity_env"}\`, run its checks, send the result with \`report_unity_environment\`.
4. **Project Knowledge**: call \`get_guide {topic:"knowledge"}\` and index the project read-only.
5. **Framework compatibility** (only if Packages/manifest.json has \`com.aizekhan.rpg-framework\`): run
   \`Unity.exe -batchmode -quit -projectPath "<project>" -executeMethod RPGFramework.Editor.Utilities.FrameworkValidation.ValidateFromCommandLine -logFile -\`
   Framework ≥ 0.32.0: exit 0 = clean, 1 = errors found, 2 = the check itself failed; report errors and warnings from the log to the author.
   Older framework (the method is missing): run \`...FrameworkValidation.ValidateAllData\` instead — it always exits 0, so read the log after
   "=== RPG Framework Validation Results ===": any "Found N error(s):" with N > 0 is a failure.
   Then \`git status --porcelain\` must be empty (no unexpected changes).
6. **End-to-end check**: \`get_next_task\` → make the smallest safe change it asks for → run its tests → \`submit_task_result\` with every acceptance criterion and evidence.

Rules:
- WhiteWrite is the source of truth for the design. Technical choices are yours; changing the GDD, a card, the plan or the architecture goes through \`submit_change_request\`.
- ${GATE_RULE}
- Never write keys, tokens or upload URLs into files, commits or logs.`,
  },

  unity_env: {
    title: 'Unity / developer environment check',
    markdown: `# Unity environment check (Unity CLI ${UNITY_CLI_CHECKED}, experimental — classic Editor command line as fallback)

Sources: ${SOURCES.cli} · ${SOURCES.cliRef} · ${SOURCES.editorCli} · ${SOURCES.testCli}

## Install (only if missing — ask the author first)
- Windows 10 21H1+: \`winget install Unity.CLI\` (Unity Hub also installs it). Unity Hub: \`winget install --id Unity.UnityHub -e\`.
- macOS 14+: \`brew install --cask unity-cli\`
- Linux (Ubuntu 22.04+, RHEL 9): \`curl -fsSL https://unity.com/install.sh | bash\`
- Sign in: \`unity auth login\` (browser). Editor: \`unity install <version>\` (e.g. the project's version from ProjectSettings/ProjectVersion.txt).

## Checks — run each, keep the exit code and a one-line result
| id | command | ok when |
|---|---|---|
| editor | \`unity editors -i --format json\` | the project's Editor version is installed |
| cli | \`unity --version\` and \`unity doctor\` | both exit 0 |
| project | files \`ProjectSettings/ProjectVersion.txt\` and \`Packages/manifest.json\` exist | both exist |
| validation | framework games: \`Unity.exe -batchmode -quit -projectPath "<p>" -executeMethod RPGFramework.Editor.Utilities.FrameworkValidation.ValidateFromCommandLine -logFile -\` (framework ≥ 0.32.0; older: \`ValidateAllData\`, which always exits 0 — judge by "Found N error(s)" in the log); others: skip | exit 0 (1 = errors found, 2 = the check failed), and \`git status --porcelain\` is empty |
| tests | \`unity test --timeout 1800 --format json\` (exit 0 = passed, 8 = ran with failures) or \`Unity.exe -runTests -batchmode -projectPath "<p>" -testPlatform EditMode -testResults results.xml\` (no \`-quit\` with \`-runTests\`; read the XML) | tests ran |
| logs | you can read the exit code and the JSON / NUnit XML / -logFile output | yes |

Unity CLI exit codes: 0 ok · 1 error · 2 usage · 3 auth (\`unity auth login\`, or \`--no-cloud\`) · 4 needs configuration · 6 operation failed · 7 Unity service unavailable (retry) · 8 tests ran with failures.

## Report
Call \`report_unity_environment\` with { os, editor{version,path_hint}, cli{name:"unity", version}, project{found, unity_version, packages_ok}, checks:[{id, ok, detail, exit_code}] }.
Never send absolute paths with the user's name — a hint like "Hub default" is enough. Never change project files during the check.

## RPG Framework capabilities (framework games, framework ≥ 0.40.0)
Read \`capabilities.json\` of the installed framework — \`Library/PackageCache/com.aizekhan.rpg-framework@<hash>/capabilities.json\` (the hash from \`Packages/packages-lock.json\`, or glob \`com.aizekhan.rpg-framework@*\`), or \`Packages/com.aizekhan.rpg-framework/capabilities.json\` for an embedded package — and send it unchanged with \`report_framework_capabilities {manifest}\`. WhiteWrite checks the game's mechanics against exactly this version (gaps: what the framework lacks → the author decides: game code or a request to the framework). Send it again after every framework update. No file (older framework) — skip; WhiteWrite falls back to its own list.`,
  },

  knowledge: {
    title: 'Project Knowledge: index this Unity project (read-only)',
    markdown: `# Project Knowledge — schema ${KNOWLEDGE_SCHEMA}

Index this Unity project for WhiteWrite **read-only**: do not change, import or re-save any file, do not open the Unity Editor (the framework's batch-mode index below only reads files — that is allowed).

## Shortcut for RPG Framework ≥ 0.32.0
Run \`Unity.exe -batchmode -quit -projectPath "<project>" -executeMethod RPGFramework.Tools.ProjectIndex.ProjectIndexCommand.ExportFromCommandLine -indexOutput <tmp file>\` (exit 0 = written). It only reads files and writes the index outside Assets (default Library/RPGFramework/ProjectIndex.json). Its JSON ("rpgframework.project-index/1": project, framework modules and users, assets with GUIDs and refs, scenes, prefabs, scripts, assemblies, problems) is the source for the records below — map it, add descriptions and card links, then send. Without the framework, read the files yourself:

## What to read
ProjectSettings/ (ProjectVersion.txt, EditorBuildSettings.asset, TagManager.asset), Packages/manifest.json, *.asmdef, *.meta (the \`guid:\`), the YAML of *.unity / *.prefab / *.asset (components, \`guid:\` references), *.cs (classes, namespaces, public API).
Skip Library/ Temp/ Logs/ obj/ Build*/ UserSettings/ .git/ .env* *.pem *.key *.keystore and everything in .gitignore, plus anything the author excluded.

## Rules
- The id of an asset is its GUID (from the .meta) together with the project-relative path. Never absolute paths.
- Do not invent purposes: unknown → \`"confidence":"unknown"\` and a line in unresolved_md.
- A link to a Game Bible card or canon entity only when it is explicit (the card names the asset, or the asset is named after the card) — \`"confirmed": true\`; otherwise list it in unresolved_md.
- No credentials, keys, personal data.

## Sending (MCP tool submit_project_knowledge, in parts)
1. \`{part:"begin", snapshot_id:<new uuid>, manifest:{schema:"${KNOWLEDGE_SCHEMA}", scope:"full"|"partial", paths_scanned:[…], project:{name, fingerprint, repo:{full,branch,commit,dirty}}, unity:{version, render_pipeline, packages:[{name,version}], build_scenes:[…]}, framework:{name,version}|null, scanned_at, coverage:{<type>:{found,indexed,unknown}}}}\`
2. \`{part:"records", snapshot_id, records:[…]}\` — up to 500 records per call, as many calls as needed. Record kinds:
   - \`{kind:"asset", guid, path, type, name, description, labels:[], deps:[guid], confidence}\` (type: Material, Texture2D, Model, AnimationClip, AudioClip, ScriptableObject, Shader, Font, VFX, UI…)
   - \`{kind:"scene", guid, path, name, build_index, roots:[…], components:[…], deps:[guid], description}\`
   - \`{kind:"prefab", guid, path, name, components:[…], scripts:[…], hierarchy, deps:[guid], description}\`
   - \`{kind:"script", guid, path, name, namespace, assembly, responsibility, public_api:[…], deps:[…]}\`
   - \`{kind:"visual", guid, path, name, width, height, purpose, description}\` (images, concepts, textures worth showing)
   - \`{kind:"relation", from:"guid:<g>"|"card:c:<id>"|"entity:e:<id>", to:…, rel:"uses"|"contains"|"references"|"implements"|"maps_to_card", evidence, confirmed}\`
   - \`{kind:"framework", name, version, modules:[{name, used_by:[…]}]}\`
3. \`{part:"end", snapshot_id, overview_md, unresolved_md, report_md}\` — the project overview, unknowns / broken refs / ambiguities, and the scan summary with coverage.
4. \`get_project_knowledge_status\` and show the author the report.

Re-sending the same snapshot is safe (unchanged records are skipped). A partial scan never removes anything; after a full scan, assets that were not seen are only marked missing — the author confirms removals.`,
  },

  activity_log: {
    title: 'Development activity log (paste into CLAUDE.md)',
    markdown: `## WhiteWrite — development activity log (schema ${ACTIVITY_SCHEMA})

This project reports its development history to WhiteWrite (the author's Mini-Marketing and changelog read it).

**When** — at the end of every working session, and right after any large change (a new mechanic, level, character, system, release).

**How** — call the MCP tool \`submit_development_activity\` once per session:
- \`session_id\`: one UUID per session (create it at the start, reuse it on retries — the service ignores duplicates);
- \`branch\`, \`commit\` (HEAD after your work), \`started_at\`, \`ended_at\`, \`summary\` (2–3 sentences);
- \`entries\`: one per real change — \`{entry_id (uuid), change: added|changed|removed|fixed, category: mechanic|level|character|item|ui|audio|art|performance|fix|tooling|release|other, text, status: completed|partial|experimental|planned, player_impact, evidence:{files:[…], commit, tests:{ran, passed, failed}}, media:[…], limits, hints, privacy, task_id}\`.

**Check before sending** — compare with \`git diff\` / \`git log\` of this session: report only what this session actually did or verified; never someone else's work. Mark unfinished work \`partial\` or \`experimental\`.

**Privacy** — \`privacy\` per entry: \`internal\` (refactors, tooling — never public), \`confidential\`, \`spoiler\` (story reveals), \`excluded\`, or \`marketing_approved\` only when the author said so. No secrets, keys, personal data, absolute paths.

**No network** — if the call fails, append the same JSON as one line to \`.whitewrite/activity-pending.jsonl\` (add \`.whitewrite/\` to .gitignore) and tell the author; at the start of the next session send every pending line (same session_id — no duplicates) and clear the file. A failed sync never blocks ending the session.

**What the marketer needs** — \`player_impact\` in plain words (what a player sees or feels), the most visible changes first; \`media\`: paths of screenshots / clips you made or found for the change; \`hints\`: a possible post angle or poll question. Purely internal work can be one short \`internal\` entry.`,
  },
};

function guide(topic) {
  const g = GUIDES[topic];
  if (!g) return null;
  return { topic, title: g.title, schema_version: topic === 'knowledge' ? KNOWLEDGE_SCHEMA : topic === 'activity_log' ? ACTIVITY_SCHEMA : '', markdown: g.markdown };
}

const SETUP_GUIDES = { GUIDES, guide, KNOWLEDGE_SCHEMA, ACTIVITY_SCHEMA, UNITY_CLI_CHECKED, GATE_RULE, SOURCES };
if (typeof module !== 'undefined' && module.exports) module.exports = SETUP_GUIDES;
if (typeof window !== 'undefined') window.__SETUP_GUIDES = SETUP_GUIDES;
