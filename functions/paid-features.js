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
// Prices are what the server RESERVES before an AI call; the final charge is the REAL API cost of
// the call (usage × MODEL_PRICING in ai-models.js) ÷ USD_PER_TOKEN, rounded up (token-service.js charge()).
// `factor` multiplies the Claude scene reserve (economy_operations/generateScene providers.claude.cost, 300 by default).
//
// MARGIN: one token covers USD_PER_TOKEN of API cost. The cheapest token sold is Worldbuilder's
// ($69 / 180 000 = $0.000383), so even a fully spent Worldbuilder budget costs 39% of its price in API
// ($27 of $69); Novelist 17%, Storyteller 3%. Raise USD_PER_TOKEN only together with the plan budgets.

const PLAN_ORDER = ['free', 'storyteller', 'novelist', 'worldbuilder'];

const PLANS = {
  free:         { name: 'Free',         price: 0,  monthly: 200,    maxProjects: 1 },
  storyteller:  { name: 'Storyteller',  price: 12, monthly: 2400,   maxProjects: 5 },
  novelist:     { name: 'Novelist',     price: 29, monthly: 32000,  maxProjects: 999, popular: true },
  worldbuilder: { name: 'Worldbuilder', price: 69, monthly: 180000, maxProjects: 999 },
  worldforge:   { name: 'Worldforge',   price: 0,  monthly: 180000, maxProjects: 999, hidden: true, as: 'worldbuilder' } // dev/testing
};

const USD_PER_TOKEN = 0.00015; // API dollars one token pays for (see MARGIN above)

// Plan change (Lemon Squeezy, functions/src/lemon.js changeSubscription):
//  up   — now: LS charges the prorated price difference at once; the new budget opens prorated to the days left,
//         minus a small switch fee of UPGRADE_FEE × the new plan's monthly tokens;
//  down — from the next billing month (LS bills the new price at renewal, no credit); free = cancel at period end.
const UPGRADE_FEE = 0.03;

// ONLY Claude (Anthropic). The author picks the model in the Account (users.settings.aiModel); the server uses it
// when the plan allows, else the plan default (modelTier). A stronger model costs more tokens per action — the
// charge is the real API cost. typical = tokens for a 700-word scene (measured 2026-11-02, effort low);
// scale = the reserve multiplier against Sonnet (the reserve of every scene/`factor` feature × scale).
const MODEL_TIERS = [
  { id: 'haiku', minPlan: 'free', typical: 10, scale: 0.1,
    uk: { name: 'Claude Haiku', desc: 'Найшвидший і найдешевший: чернетки, короткі сцени.' },
    en: { name: 'Claude Haiku', desc: 'Fastest and cheapest: drafts, short scenes.' } },
  { id: 'sonnet', minPlan: 'storyteller', typical: 160, scale: 1,
    uk: { name: 'Claude Sonnet', desc: 'Баланс якості й ціни — рекомендовано.' },
    en: { name: 'Claude Sonnet', desc: 'Balanced quality and price — recommended.' } },
  { id: 'opus', minPlan: 'novelist', typical: 320, scale: 2,
    uk: { name: 'Claude Opus', desc: 'Найсильніший: складні сюжети, аналіз і плани гри; ≈ вдвічі дорожчий за Sonnet.' },
    en: { name: 'Claude Opus', desc: 'The strongest: complex plots, analysis and game plans; ≈ twice the price of Sonnet.' } }
];
const SCENE_COST = { claude: 300 }; // the Sonnet scene reserve — default of economy_operations/generateScene providers.claude.cost

// kind: 'gate' — a capability (flag) · 'ai' — spends tokens (price before the run) · 'free' — included, no tokens
// soon: announced on the plan cards and in the knowledge base («скоро»), not live yet
const FEATURES = [
  // ── Book ──
  { id: 'scenes', kind: 'ai', minPlan: 'free', price: { scene: true },
    uk: { name: 'Генерація сцен', desc: 'Сцена за каноном світу. Пише лише Claude — модель обираєш в Акаунті.' },
    en: { name: 'Scene generation', desc: 'A scene from the world canon. Written only by Claude — pick the model in the Account.' },
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
  { id: 'projectSlot', kind: 'ai', minPlan: 'free', price: { fixed: 500, per: 'project' },
    uk: { name: 'Додатковий проєкт', desc: 'Понад ліміт тарифу: ще один проєкт за 500 токенів, слот лишається назавжди.' },
    en: { name: 'Extra project', desc: 'Beyond the plan limit: one more project for 500 tokens, the slot stays forever.' },
    where: 'Створення історії понад ліміт', server: 'createProject' },
  // ── Canon ──
  { id: 'bible', kind: 'gate', flag: 'allowWorldTree', minPlan: 'storyteller',
    uk: { name: 'Біблія світу: редагування канону', desc: 'Огляд, закони, досьє, культура, хроніка, карта локацій.' },
    en: { name: 'World Bible: canon editing', desc: 'Overview, laws, dossiers, culture, chronicle, location map.' },
    where: 'Біблія світу', server: 'firestore.rules (власник світу)' },
  { id: 'quests', kind: 'gate', flag: 'allowGameDev', minPlan: 'worldbuilder',
    uk: { name: 'Квести й діалоги гри', desc: 'Квести з етапами й розгалуженнями, діалоги з репліками й виборами — на картках гри (персонажі, вороги, локації, рівні, предмети) і на персонажах та подіях канону; перевірка графа.' },
    en: { name: 'Game quests & dialogues', desc: 'Quests with stages and branches, dialogues with lines and choices — on the game cards (characters, enemies, locations, levels, items) and on canon characters and events; a graph check.' },
    where: 'Біблія гри → Квести й діалоги', server: 'firestore.rules (games/{g}/quests, dialogues) · mcp' },
  { id: 'questDraft', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 1 }, op: 'questDraft',
    uk: { name: '✦ Чернетка квесту', desc: 'AI пропонує концепцію, учасників, етапи й нагороди з картки гри, історії, досьє чи культури — ти приймаєш по полях.' },
    en: { name: '✦ Quest draft', desc: 'AI proposes the concept, cast, stages and rewards from a game card, story, dossier or culture entry — you accept field by field.' },
    where: 'Біблія гри → Квести · 💡 на картках і в досьє', server: 'narrativeDraft {op:questDraft}' },
  { id: 'dialogueDraft', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 1 }, op: 'dialogueDraft',
    uk: { name: '✦ Чернетка діалогу', desc: 'AI пропонує репліки й вибори голосами персонажів гри й канону.' },
    en: { name: '✦ Dialogue draft', desc: 'AI proposes lines and choices in the voices of the game and canon characters.' },
    where: 'Біблія гри → Діалоги', server: 'narrativeDraft {op:dialogueDraft}' },
  // ── Claude models (MODEL_TIERS) ──
  { id: 'modelSonnet', kind: 'gate', flag: 'allowSonnet', minPlan: 'storyteller',
    uk: { name: 'Модель Claude Sonnet', desc: 'Вибір моделі в Акаунті: Haiku або Sonnet.' },
    en: { name: 'Claude Sonnet model', desc: 'Model choice in the Account: Haiku or Sonnet.' },
    where: 'Акаунт → Модель Claude', server: 'усі AI-функції (functions/src/claude.js)' },
  { id: 'modelOpus', kind: 'gate', flag: 'allowOpus', minPlan: 'novelist',
    uk: { name: 'Модель Claude Opus', desc: 'Найсильніша модель — Haiku, Sonnet або Opus на вибір.' },
    en: { name: 'Claude Opus model', desc: 'The strongest model — Haiku, Sonnet or Opus to choose from.' },
    where: 'Акаунт → Модель Claude', server: 'усі AI-функції (functions/src/claude.js)' },
  { id: 'advise', kind: 'ai', flag: 'allowAnalyze', minPlan: 'novelist', price: { fixed: 200 },
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
  { id: 'gamePlan', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 12 }, op: 'plan', // long output
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
    where: 'Біблія → Космологія', server: 'cosmographAccess' },
  { id: 'marketing', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { fixed: 1500, per: '30d' }, op: 'marketing',
    uk: { name: 'Міні-маркетинг', desc: 'Пости про розробку гри із записів журналу, які ти схвалив; публікація в Telegram, Discord, Mastodon, Bluesky, тексти для X і Reddit. Ціна — за гру на 30 днів.' },
    en: { name: 'Mini-Marketing', desc: 'Posts about the game development from log entries you approved; publishing to Telegram, Discord, Mastodon, Bluesky, texts for X and Reddit. Priced per game for 30 days.' },
    where: 'Біблія гри → Маркетинг', server: 'marketing {op:activate}' },
  { id: 'marketingDraft', kind: 'ai', flag: 'allowGameDev', minPlan: 'worldbuilder', price: { factor: 0.5 }, op: 'marketingDraft',
    uk: { name: '✦ Пост', desc: 'AI пише пост лише з обраних схвалених записів журналу; ти редагуєш і схвалюєш.' },
    en: { name: '✦ Post', desc: 'AI writes a post only from the chosen approved log entries; you edit and approve.' },
    where: 'Біблія гри → Маркетинг', server: 'marketing {op:draft}' }
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

// Claude tiers this plan may choose, and the tier used: the author's choice when allowed, else Sonnet, else Haiku
function modelTiers(plan) { return MODEL_TIERS.filter((t) => unlocked(t, plan)); }
function modelTier(plan, chosen) {
  const ok = modelTiers(plan).map((t) => t.id);
  return ok.indexOf(chosen) >= 0 ? chosen : ok.indexOf('sonnet') >= 0 ? 'sonnet' : 'haiku';
}
function tierInfo(id) { return MODEL_TIERS.find((t) => t.id === id) || MODEL_TIERS[1]; }

// Tokens reserved before the run (the real charge may be lower); claudeCost = economy claude scene price (Sonnet),
// tier = the model tier (a scene / `factor` reserve scales with it; fixed prices don't)
function featureCost(feature, claudeCost, tier) {
  const base = (claudeCost || SCENE_COST.claude) * (tier ? tierInfo(tier).scale : 1);
  if (!feature) return base * 4; // unknown op: never reserve nothing
  const pr = feature.price;
  if (!pr) return 0;
  if (pr.fixed) return pr.fixed;
  if (pr.factor) return Math.ceil(base * pr.factor);
  return Math.ceil(base); // a scene
}
function byOp(op) { return FEATURES.find((f) => f.op === op || f.id === op) || null; }

// Tokens for a call that cost `usd` in API (the charge; never 0 for a paid call)
function tokensForUsd(usd) { return usd > 0 ? Math.max(1, Math.ceil(usd / USD_PER_TOKEN - 1e-9)) : 0; }

// Upgrade terms for the days left: money ≈ the price difference × left, tokens = budget difference × left − fee
function upgradeQuote(from, to, left) {
  const a = PLANS[from] || PLANS.free, b = PLANS[to] || PLANS.free, f = Math.min(1, Math.max(0, left));
  return { usd: Math.max(0, Math.round((b.price - a.price) * f * 100) / 100),
    tokens: Math.max(0, Math.round((b.monthly - a.monthly) * f)), fee: Math.round(b.monthly * UPGRADE_FEE) };
}

const PAID_FEATURES = { PLAN_ORDER, PLANS, FEATURES, MODEL_TIERS, SCENE_COST, USD_PER_TOKEN, UPGRADE_FEE, upgradeQuote, planRank, unlocked, planBudget,
  modelTiers, modelTier, tierInfo, featureCost, byOp, tokensForUsd };

if (typeof module !== 'undefined' && module.exports) module.exports = PAID_FEATURES;
if (typeof window !== 'undefined') window.__PAID_FEATURES = PAID_FEATURES;
