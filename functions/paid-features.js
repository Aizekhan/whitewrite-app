// ============================================================================
// Paid features — SINGLE SOURCE OF TRUTH for plans, feature gates and AI prices
// ============================================================================
// Backend: plans.js derives PLAN_BUDGETS from here (require).
// Frontend: window.__PAID_FEATURES — app/firebase/paid-features.js is a COPY made by
// scripts/build-app.mjs (edit THIS file, then run `npm run build:app`).
// Used by: plan cards in the Account (White.html), the knowledge base («Тарифи», a `plans` block),
// token-budget.js (flags), the World/Game Bible (✦ prices before a run) and every server gate.
//
// A feature is unlocked on its `minPlan` and every plan after it in PLAN_ORDER.
// Prices are what the server RESERVES before an AI call (the final charge is by real usage,
// economy_operations); `factor` multiplies the Claude scene price (economy_operations/generateScene
// providers.claude.cost, 300 by default).

const PLAN_ORDER = ['free', 'storyteller', 'novelist', 'worldbuilder'];

const PLANS = {
  free:         { name: 'Free',         price: 0,  monthly: 200,    maxProjects: 1 },
  storyteller:  { name: 'Storyteller',  price: 12, monthly: 2400,   maxProjects: 5 },
  novelist:     { name: 'Novelist',     price: 29, monthly: 32000,  maxProjects: 999, popular: true },
  worldbuilder: { name: 'Worldbuilder', price: 69, monthly: 180000, maxProjects: 999 },
  worldforge:   { name: 'Worldforge',   price: 0,  monthly: 180000, maxProjects: 999, hidden: true, as: 'worldbuilder' } // dev/testing
};

const SCENE_COST = { gemini: 20, claude: 300 }; // defaults of economy_operations/generateScene

// kind: 'gate' — a capability (flag) · 'ai' — spends tokens (price before the run) · 'free' — included, no tokens
// soon: announced on the plan cards and in the knowledge base («скоро»), not live yet
const FEATURES = [
  // ── Book ──
  { id: 'scenes', kind: 'ai', minPlan: 'free', price: { scene: true },
    uk: { name: 'Генерація сцен', desc: 'Сцена за каноном світу: Gemini на Free і Storyteller, Claude від Novelist.' },
    en: { name: 'Scene generation', desc: 'A scene from the world canon: Gemini on Free and Storyteller, Claude from Novelist.' },
    where: 'Книга', server: 'generateScene' },
  { id: 'genesis', kind: 'ai', minPlan: 'free', price: { scene: true },
    uk: { name: 'Genesis — створення світу', desc: 'Світ із кількох рядків: огляд, закони, перші сутності канону.' },
    en: { name: 'Genesis — world creation', desc: 'A world from a few lines: overview, laws, first canon entities.' },
    where: 'Головна → Створи свій світ', server: 'genesisWorld' },
  { id: 'export', kind: 'gate', flag: 'allowExport', minPlan: 'storyteller',
    uk: { name: 'Експорт книги DOCX / PDF', desc: 'Уся історія одним файлом: Word або друк у PDF.' },
    en: { name: 'Book export DOCX / PDF', desc: 'The whole story in one file: Word or print to PDF.' },
    where: 'Книга → ⤓ Експорт', server: '— (у браузері)' },
  { id: 'framework', kind: 'gate', flag: 'allowFramework', minPlan: 'storyteller', soon: true,
    uk: { name: 'Доступ до RPG Framework', desc: 'Особистий токен до фреймворку для Unity: привʼязаний до акаунта, блокується при чужому використанні, оновлюється, поки підписка активна.' },
    en: { name: 'RPG Framework access', desc: 'A personal token for the Unity framework: tied to the account, blocked if used by someone else, renewed while the subscription is active.' },
    where: 'База знань → RPG Framework → Доступ', server: '— (готується)' },
  // ── Canon ──
  { id: 'bible', kind: 'gate', flag: 'allowWorldTree', minPlan: 'storyteller',
    uk: { name: 'Біблія світу: редагування канону', desc: 'Огляд, закони, досьє, культура, хроніка, карта локацій.' },
    en: { name: 'World Bible: canon editing', desc: 'Overview, laws, dossiers, culture, chronicle, location map.' },
    where: 'Біблія світу', server: 'firestore.rules (власник світу)' },
  { id: 'canonExtraction', kind: 'gate', flag: 'allowCanonExtraction', alias: ['allowCanonSync'], minPlan: 'storyteller', price: { fixed: 15, per: 'scene' },
    uk: { name: 'Автоканон', desc: 'Після кожної сцени AI дописує в канон нових персонажів, місця, події та стан.' },
    en: { name: 'Auto-canon', desc: 'After every scene AI adds new characters, places, events and state to the canon.' },
    where: 'Книга (після генерації), синхронізація проєкту', server: 'generateScene · syncProjectCanon' },
  // ── Claude ──
  { id: 'claude', kind: 'gate', flag: 'allowClaude', minPlan: 'novelist',
    uk: { name: 'Claude замість Gemini', desc: 'Сцени, Genesis і аналіз пише Claude Sonnet — якісніше, дорожче за сцену.' },
    en: { name: 'Claude instead of Gemini', desc: 'Scenes, Genesis and analysis are written by Claude Sonnet — better, pricier per scene.' },
    where: 'усюди, де AI пише текст', server: 'generateScene · genesisWorld' },
  { id: 'advise', kind: 'ai', flag: 'allowAnalyze', minPlan: 'novelist', price: { fixed: 50 },
    uk: { name: '✦ Порадити', desc: 'Розбір сцени в аркуші: суперечності з каноном, темп, що посилити.' },
    en: { name: '✦ Advise', desc: 'A scene review on the sheet: canon contradictions, pacing, what to strengthen.' },
    where: 'Книга → аркуш', server: 'analyzeScene' },
  { id: 'reconcile', kind: 'ai', flag: 'allowReconstruction', minPlan: 'novelist', price: { scene: true, per: 'scene' },
    uk: { name: '✦ Узгодити сцени', desc: 'Канон змінився — AI переписує зачеплені сцени, ти приймаєш diff.' },
    en: { name: '✦ Reconcile scenes', desc: 'The canon changed — AI rewrites the affected scenes, you accept the diff.' },
    where: 'Біблія → досьє', server: 'reconstructScene' },
  { id: 'improve', kind: 'gate', flag: 'allowImprove', minPlan: 'novelist', planned: true,
    uk: { name: 'Режим «Покращити»', desc: 'Готується.' }, en: { name: 'Improve mode', desc: 'In the works.' },
    where: '—', server: '—' },
  // ── Game Bible ──
  { id: 'gamedev', kind: 'gate', flag: 'allowGameDev', minPlan: 'worldbuilder',
    uk: { name: 'Біблія гри', desc: 'Ігри на каноні світу: розділи, картки, файли й префаби з ліцензіями, продакшн-план.' },
    en: { name: 'Game Bible', desc: 'Games on the world canon: sections, cards, files and prefabs with licences, production plan.' },
    where: 'Біблія світу → гра', server: 'gamedevPlan · storage.rules' },
  { id: 'mcp', kind: 'gate', flag: 'allowAPI', minPlan: 'worldbuilder',
    uk: { name: 'MCP для Claude Code', desc: 'Claude Code бере задачі плану з каноном і Біблією та здає результат на приймання.' },
    en: { name: 'MCP for Claude Code', desc: 'Claude Code takes plan tasks with the canon and Bible and hands results in for review.' },
    where: 'Продакшн-план → Підключити Claude Code', server: 'mcp' },
  { id: 'mdImport', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 4 }, op: 'import',
    uk: { name: '✦ Імпорт .md', desc: 'Нотатки й GDD → пропозиція карток, ти відмічаєш, що взяти.' },
    en: { name: '✦ .md import', desc: 'Notes and GDD → proposed cards, you tick what to take.' },
    where: 'Біблія гри', server: 'gamedevPlan {op:import}' },
  { id: 'gameAnalyze', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 2 }, op: 'analyze',
    uk: { name: '✦ Аналіз гри', desc: 'GDD з Біблії: прогалини, суперечності, питання до автора.' },
    en: { name: '✦ Game analysis', desc: 'A GDD from the Bible: gaps, contradictions, questions.' },
    where: 'Біблія гри → Аналіз', server: 'gamedevPlan {op:analyze}' },
  { id: 'canonAudit', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 2 }, op: 'canonAudit',
    uk: { name: '✦ Аудит канону', desc: 'Перевірка гри на суперечності з каноном світу.' },
    en: { name: '✦ Canon audit', desc: 'Checks the game for contradictions with the world canon.' },
    where: 'Біблія гри', server: 'gamedevPlan {op:canonAudit}' },
  { id: 'gamePlan', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 4 }, op: 'plan',
    uk: { name: '✦ Продакшн-план', desc: 'Етапи з воротами і задачі з промптами для Claude Code.' },
    en: { name: '✦ Production plan', desc: 'Milestones with gates and tasks with prompts for Claude Code.' },
    where: 'Біблія гри → План', server: 'gamedevPlan {op:plan}' },
  { id: 'repoSync', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 4 }, op: 'repoSync',
    uk: { name: '✦ Звірити з репо', desc: 'Читає GitHub-репозиторій гри й показує розбіжності з Біблією.' },
    en: { name: '✦ Check against the repo', desc: 'Reads the game\'s GitHub repository and shows differences from the Bible.' },
    where: 'Налаштування гри', server: 'gamedevPlan {op:repoSync}' },
  { id: 'telemetry', kind: 'free', flag: 'allowGameDev', minPlan: 'worldbuilder',
    uk: { name: 'Досвід гравців', desc: 'Телеметрія гри, метрики, теплові карти, A/B — без токенів.' },
    en: { name: 'Player experience', desc: 'Game telemetry, metrics, heatmaps, A/B — no tokens.' },
    where: 'Біблія гри → Досвід гравців', server: 'telemetryIngest · experience' },
  { id: 'expReport', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 2 }, op: 'expReport',
    uk: { name: '✦ Звіт AI про досвід', desc: 'Гіпотези про проблеми з доказами й рівнем упевненості.' },
    en: { name: '✦ AI experience report', desc: 'Hypotheses about issues with evidence and confidence.' },
    where: 'Досвід гравців → Проблеми', server: 'experience {op:report}' },
  { id: 'playtest', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 2 }, op: 'playtest',
    uk: { name: '✦ План плейтесту', desc: 'Завдання тестувальникам і короткі опитування в грі.' },
    en: { name: '✦ Playtest plan', desc: 'Tasks for testers and short in-game surveys.' },
    where: 'Досвід гравців → Плейтести', server: 'experience {op:playtest}' },
  { id: 'cosmograph', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { fixed: 2000, per: '30d' }, op: 'cosmograph',
    uk: { name: 'Космограф', desc: 'Небо світу: планета, сонця, місяці, календар. Ціна — за світ на 30 днів.' },
    en: { name: 'Cosmograph', desc: 'The world\'s sky: planet, suns, moons, calendar. Priced per world for 30 days.' },
    where: 'Біблія → Космологія', server: 'cosmographAccess' }
];

function planRank(plan) {
  const p = PLANS[plan] && PLANS[plan].as || plan;
  const i = PLAN_ORDER.indexOf(p);
  return i < 0 ? 0 : i;
}
function unlocked(feature, plan) { return planRank(plan) >= PLAN_ORDER.indexOf(feature.minPlan); }

// Plan → { monthly, maxProjects, allow…: bool } — the shape plans.js / token-budget.js always had
function planBudget(plan) {
  const p = PLANS[plan] || PLANS.free;
  const out = { monthly: p.monthly, maxProjects: p.maxProjects };
  FEATURES.forEach((f) => {
    if (!f.flag) return;
    const on = unlocked(f, PLANS[plan] ? plan : 'free');
    [f.flag].concat(f.alias || []).forEach((k) => { out[k] = !!(out[k] || on); });
  });
  return out;
}

// Tokens reserved before the run (the real charge may be lower); claudeCost = economy claude scene price
function featureCost(feature, claudeCost) {
  const base = claudeCost || SCENE_COST.claude;
  if (!feature) return base * 4; // unknown op: never reserve nothing
  const pr = feature.price;
  if (!pr) return 0;
  if (pr.fixed) return pr.fixed;
  if (pr.factor) return base * pr.factor;
  return base; // a scene
}
function byOp(op) { return FEATURES.find((f) => f.op === op || f.id === op) || null; }

const PAID_FEATURES = { PLAN_ORDER, PLANS, FEATURES, SCENE_COST, planRank, unlocked, planBudget, featureCost, byOp };

if (typeof module !== 'undefined' && module.exports) module.exports = PAID_FEATURES;
if (typeof window !== 'undefined') window.__PAID_FEATURES = PAID_FEATURES;
