// ============================================================================
// «Заповни світ своїми матеріалами» — SINGLE SOURCE of the fill template (whitewrite.fill/1), the «what goes where» rules
// and the merge plan. The author's own AI agent (Claude Code, ChatGPT…) reads their notes and writes ONE JSON file by this
// template; the Bible (gamebible.js) only MOVES the data into the world — no AI on our side, no tokens, any plan.
// Copy in app/firebase/ is made by scripts/build-app.mjs (window.__FILL). Edit THIS file. Rules doc: docs/WHAT_GOES_WHERE.md
// ============================================================================
(function () {
var FORMAT = 'whitewrite.fill/1';
var KINDS = ['characters', 'locations', 'factions', 'artifacts', 'events'];
var LORE = { peoples: ['origin', 'look', 'society', 'lands'], languages: ['sound', 'script', 'phrases', 'speakers'],
  beliefs: ['powers', 'myths', 'rites', 'believers'], customs: ['what', 'when', 'meaning'] };
var MAX_STR = 50000, MAX_ITEMS = 3000;

// One place for every kind of fact — the same table the agent gets and docs/WHAT_GOES_WHERE.md explains
var RULES = {
  uk: [
    'Кожен факт — лише в ОДНОМУ місці. Якщо щось пасує у два розділи — обери за цими правилами, а з іншого місця зроби посилання (links), не копію.',
    'world.summary — суть світу кількома абзацами; world.tagline — один рядок. Не переказуй тут персонажів, події чи закони.',
    'world.rules — непорушні закони світу (фізика, магія, межі можливого). Окремий факт без «правила» — у world.facts.',
    'world.facts — короткі довідкові факти «ключ: значення» (столиця, кількість місяців, мова імперії, календар, небо). Подія з датою — НЕ факт, а events.',
    'characters — особи (люди, боги, що діють як особи, тварини-персонажі). desc — 1–2 речення; story — біографія; look — зовнішність; role — роль у світі. desc не повторюється у story.',
    'characters[].life — особисті моменти життя («at» — коли, текст). Подія, що зачепила світ або кількох персонажів, — це events (з who), а не life.',
    'locations — місця (міста, регіони, будівлі, планети). story — історія місця; look — вигляд. Подія, що тут сталася, — в events з посиланням на локацію.',
    'factions — ОРГАНІЗАЦІЇ з метою й членами: держави, ордени, гільдії, клани, культи. Раса, вид чи народ — НЕ фракція, а culture.peoples.',
    'artifacts — унікальні іменовані предмети (меч Х, корона Y). Звичайні типи речей (мечі, зілля) — не канон світу, це предмети гри.',
    'events — події з часом: at — число на лінії часу (рік), dur — тривалість, when — як це записано у світі («3-тя епоха, зима»), who — імена учасників, story — перебіг, outcome — наслідки.',
    'culture.peoples — народи, раси, види; languages — мови; beliefs — віра, божества як ідея, міфи, обряди; customs — звичаї, свята, побут. Божество, що діє як особа, — ще й у characters, а в beliefs — посилання.',
    'links — звʼязки між сутностями: { "to": "точна назва іншої сутності з файлу чи світу", "rel": "ким/чим доводиться" }. Не дублюй у тексті те, що вже є звʼязком.',
    'group — підрозділ (необовʼязково): «Королівська родина», «Північ»… Ігрові числа, механіки, рівні й ассети — НЕ сюди: це GDD гри.',
    'Переноси лише те, що є в матеріалах автора. Нічого не вигадуй і не доповнюй; невідоме поле лиши порожнім або прибери.'
  ],
  en: [
    'Every fact lives in ONE place only. If something fits two sections, pick by these rules and link it from the other place (links), never copy it.',
    'world.summary — the essence of the world in a few paragraphs; world.tagline — one line. Do not retell characters, events or laws here.',
    'world.rules — the unbreakable laws of the world (physics, magic, limits of the possible). A plain fact that is not a rule goes to world.facts.',
    'world.facts — short reference facts "key: value" (capital, number of moons, the empire\'s language, calendar, sky). An event with a date is NOT a fact — it is an event.',
    'characters — persons (people, gods acting as persons, animal characters). desc — 1–2 sentences; story — biography; look — appearance; role — role in the world. desc is not repeated in story.',
    'characters[].life — personal moments of a life ("at" — when, text). An event that touched the world or several characters is an event (with who), not life.',
    'locations — places (cities, regions, buildings, planets). story — the place\'s history; look — how it looks. An event that happened there is an event linked to the location.',
    'factions — ORGANISATIONS with a goal and members: states, orders, guilds, clans, cults. A race, species or people is NOT a faction but culture.peoples.',
    'artifacts — unique named objects (sword X, crown Y). Ordinary kinds of things (swords, potions) are not world canon — they are game items.',
    'events — events in time: at — a number on the time line (year), dur — duration, when — how the world writes it ("3rd age, winter"), who — participants\' names, story — how it went, outcome — consequences.',
    'culture.peoples — peoples, races, species; languages; beliefs — faith, gods as an idea, myths, rites; customs — customs, feasts, daily life. A god acting as a person is also a character, and beliefs link to it.',
    'links — connections between entities: { "to": "the exact name of another entity in the file or the world", "rel": "how they relate" }. Do not repeat in text what is already a link.',
    'group — a subsection (optional): "Royal family", "The North"… Game numbers, mechanics, levels and assets do NOT go here — that is the game\'s GDD.',
    'Move only what is in the author\'s material. Invent nothing, add nothing; leave an unknown field empty or drop it.'
  ]
};

var ENT = function (extra) { return Object.assign({ name: '', group: '', desc: '', story: '', look: '', links: [{ to: '', rel: '' }] }, extra || {}); };
var TEMPLATE = {
  format: FORMAT,
  world: { tagline: '', summary: '', rules: [''], facts: [{ k: '', v: '' }] },
  characters: [ENT({ role: '', life: [{ at: '', text: '' }] })],
  locations: [ENT()],
  factions: [ENT()],
  artifacts: [ENT()],
  events: [{ name: '', group: '', desc: '', story: '', outcome: '', at: 0, dur: 0, when: '', who: [''], links: [{ to: '', rel: '' }] }],
  culture: {
    peoples: [{ name: '', group: '', desc: '', origin: '', look: '', society: '', lands: '' }],
    languages: [{ name: '', group: '', desc: '', sound: '', script: '', phrases: '', speakers: '' }],
    beliefs: [{ name: '', group: '', desc: '', powers: '', myths: '', rites: '', believers: '' }],
    customs: [{ name: '', group: '', desc: '', what: '', when: '', meaning: '' }]
  }
};

// The one paste for the author's agent: the task, the rules and the template
function prompt(lang, folder, worldTitle) {
  var en = lang === 'en', where = String(folder || '').trim();
  var file = where ? where.replace(/[\\/]+$/, '') + (where.indexOf('/') >= 0 && where.indexOf('\\') < 0 ? '/' : '\\') + 'whitewrite-world.json' : 'whitewrite-world.json';
  return (en
    ? 'Read all my world notes ' + (where ? 'in the folder ' + where + ' (every .md, .txt, .docx, .pdf and subfolder)' : 'that I attach') + ' and build ONE file ' + file +
      ' for the WhiteWrite world' + (worldTitle ? ' «' + worldTitle + '»' : '') + ' — strictly by the template below. Valid JSON, UTF-8, no comments. The file may be big: move EVERYTHING from the notes, do not summarise it away.\n\nRules:\n'
    : 'Прочитай усі мої нотатки про світ ' + (where ? 'у теці ' + where + ' (усі .md, .txt, .docx, .pdf і підтеки)' : 'які я додаю') + ' і склади ОДИН файл ' + file +
      ' для світу WhiteWrite' + (worldTitle ? ' «' + worldTitle + '»' : '') + ' — строго за шаблоном нижче. Валідний JSON, UTF-8, без коментарів. Файл може бути великим: перенеси ВСЕ з нотаток, не стискай.\n\nПравила:\n') +
    RULES[en ? 'en' : 'uk'].map(function (r, i) { return (i + 1) + '. ' + r; }).join('\n') +
    (en ? '\n\nTemplate (keep the keys; repeat the objects in the lists as many times as needed; drop empty ones):\n'
        : '\n\nШаблон (ключі не змінюй; обʼєкти в списках повторюй скільки треба; порожні прибери):\n') +
    JSON.stringify(TEMPLATE, null, 2) +
    (en ? '\n\nWhen done, tell me the path of the file and how many items of each kind it has. I will upload it in WhiteWrite: World Bible → «World overview» → «Fill the world with your material».'
        : '\n\nКоли закінчиш — скажи шлях до файлу і скільки в ньому записів кожного виду. Я завантажу його у WhiteWrite: Біблія світу → «Огляд світу» → «Заповни світ своїми матеріалами».');
}

var s = function (v) { return v == null ? '' : String(v).trim().slice(0, MAX_STR); };
var n = function (v) { var x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : null; };
var arr = function (v) { return Array.isArray(v) ? v.slice(0, MAX_ITEMS) : []; };
var norm = function (v) { return String(v || '').toLowerCase().replace(/[«»"'`’]/g, '').replace(/\s+/g, ' ').trim(); };
var slugify = function (v) { return String(v || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, ''); };

// ---- the same file written by hand: a Markdown template (one .md = the whole world in one click, no AI) ----
// # World name / > tagline / summary paragraphs; «## Закони» «## Факти» lists; «## Персонажі» (and the other kinds) with
// «### Name» items: «Поле: значення» lines + free text (= the story / biography); «## Народи» «## Мови» «## Вірування»
// «## Звичаї» the same way. Headings and field names in Ukrainian or English, any case.
var MD_SECTIONS = { 'закони': 'rules', 'laws': 'rules', 'rules': 'rules', 'факти': 'facts', 'facts': 'facts',
  'персонажі': 'characters', 'characters': 'characters', 'локації': 'locations', 'місця': 'locations', 'locations': 'locations', 'places': 'locations',
  'фракції': 'factions', 'factions': 'factions', 'артефакти': 'artifacts', 'artifacts': 'artifacts', 'події': 'events', 'events': 'events', 'хроніка': 'events', 'chronicle': 'events',
  'народи': 'peoples', 'peoples': 'peoples', 'мови': 'languages', 'languages': 'languages', 'вірування': 'beliefs', 'віра': 'beliefs', 'beliefs': 'beliefs', 'звичаї': 'customs', 'customs': 'customs',
  'суть світу': 'summary', 'опис світу': 'summary', 'summary': 'summary', 'слоган': 'tagline', 'tagline': 'tagline',
  'герої': 'characters', 'heroes': 'characters', 'організації': 'factions', 'organisations': 'factions', 'organizations': 'factions',
  'світ': 'summary', 'про світ': 'summary', 'огляд світу': 'summary', 'world': 'summary', 'overview': 'summary', 'лор': 'summary', 'lore': 'summary' };
// «## 2. Персонажі:», «## 🧙 Герої» → «персонажі» / «герої»: numbering, emoji and a trailing colon do not hide a section
var secKey = function (v) { return mdKey(v).replace(/^(?:\d+[.)]?\s*)+/, '').replace(/^[^\p{L}]+/u, '').replace(/[\s:.]+$/, ''); };
var MD_FIELDS = { 'група': 'group', 'підрозділ': 'group', 'group': 'group', 'опис': 'desc', 'коротко': 'desc', 'description': 'desc', 'desc': 'desc',
  'історія': 'story', 'біографія': 'story', 'story': 'story', 'biography': 'story', 'вигляд': 'look', 'зовнішність': 'look', 'look': 'look', 'appearance': 'look',
  'роль': 'role', 'role': 'role', 'звʼязки': 'links', "зв'язки": 'links', 'звязки': 'links', 'links': 'links', 'життя': 'life', 'life': 'life',
  'рік': 'at', 'year': 'at', 'at': 'at', 'тривалість': 'dur', 'duration': 'dur', 'коли': 'when', 'when': 'when', 'учасники': 'who', 'хто': 'who', 'who': 'who',
  'наслідок': 'outcome', 'наслідки': 'outcome', 'outcome': 'outcome',
  'походження': 'origin', 'origin': 'origin', 'суспільство': 'society', 'society': 'society', 'землі': 'lands', 'lands': 'lands',
  'звучання': 'sound', 'sound': 'sound', 'письмо': 'script', 'script': 'script', 'фрази': 'phrases', 'phrases': 'phrases', 'носії': 'speakers', 'speakers': 'speakers',
  'сили': 'powers', 'божества': 'powers', 'powers': 'powers', 'міфи': 'myths', 'myths': 'myths', 'обряди': 'rites', 'rites': 'rites', 'вірні': 'believers', 'believers': 'believers',
  'що': 'what', 'what': 'what', 'значення': 'meaning', 'meaning': 'meaning' };
var mdKey = function (v) { return String(v || '').toLowerCase().replace(/[’`]/g, 'ʼ').replace(/[*_]/g, '').trim(); };
function fromMarkdown(text) {
  var lines = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  var d = { format: FORMAT, world: { tagline: '', summary: '', rules: [], facts: [] }, culture: { peoples: [], languages: [], beliefs: [], customs: [] } };
  KINDS.forEach(function (k) { d[k] = []; });
  var title = '', sec = 'summary', item = null, summary = [], lastField = null, skipped = []; // skipped: «## …» sections not by the template, with text
  var close = function () {
    if (!item) return;
    item.story = (item.story ? item.story + '\n\n' : '') + item._text.join('\n').trim(); item.story = item.story.trim(); delete item._text;
    var list = LORE[sec] ? d.culture[sec] : d[sec]; if (list) list.push(item);
    item = null; lastField = null;
  };
  lines.forEach(function (raw) {
    var line = raw.replace(/\s+$/, ''), h;
    if ((h = line.match(/^#\s+(.+)/))) { close(); if (!title) title = h[1].trim(); sec = 'summary'; return; }
    if ((h = line.match(/^##\s+(.+)/))) { close(); sec = MD_SECTIONS[secKey(h[1])] || 'skip'; if (sec === 'skip') skipped.push({ title: h[1].trim(), text: false }); return; }
    if (sec === 'skip') { if (line.trim()) skipped[skipped.length - 1].text = true; return; }
    if ((h = line.match(/^###\s+(.+)/))) { close(); if (KINDS.indexOf(sec) >= 0 || LORE[sec]) item = { name: h[1].trim(), _text: [] }; return; }
    if (sec === 'summary' || sec === 'tagline') {
      var q = line.match(/^>\s?(.*)/);
      if (q && !d.world.tagline && !summary.length) { d.world.tagline = q[1].trim(); return; }
      if (sec === 'tagline') { if (line.trim()) d.world.tagline = (d.world.tagline ? d.world.tagline + ' ' : '') + line.trim(); return; }
      summary.push(line); return;
    }
    if (sec === 'rules' || sec === 'facts') {
      var b = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)/); if (!b) return;
      if (sec === 'rules') d.world.rules.push(b[1].trim());
      else { var kv = b[1].match(/^([^:]{1,80}):\s*(.+)$/); d.world.facts.push(kv ? { k: kv[1].trim(), v: kv[2].trim() } : { k: '', v: b[1].trim() }); }
      return;
    }
    if (!item) return;
    var f = line.match(/^\s*(?:[-*•]\s+)?\**([^:*]{1,40})\**:\s*(.*)$/), key = f && MD_FIELDS[mdKey(f[1])];
    if (key) {
      var v = f[2].trim(); if (/^(…|\.\.\.)$/.test(v)) v = ''; // the template's placeholder
      if (key === 'links') item.links = v.split(/\s*;\s*/).filter(Boolean).map(function (x) { var p = x.split(/\s+[—–-]\s+/); return { to: p[0].trim(), rel: (p[1] || '').trim() }; });
      else if (key === 'who') item.who = v.split(/\s*[,;]\s*/).filter(Boolean);
      else if (key === 'life') item.life = v.split(/\s*;\s*/).filter(Boolean).map(function (x) { var p = x.split(/\s+[—–-]\s+/); return p.length > 1 ? { at: p[0].trim(), text: p.slice(1).join(' — ').trim() } : { at: '', text: x.trim() }; });
      else item[key] = v;
      lastField = key === 'links' || key === 'who' || key === 'life' ? null : key; return;
    }
    if (!line.trim()) { lastField = null; item._text.push(''); return; }
    if (lastField && /^\s{2,}\S/.test(raw)) { item[lastField] += ' ' + line.trim(); return; } // an indented line continues the field
    item._text.push(line);
  });
  close();
  d.world.summary = summary.join('\n').trim();
  return { data: d, title: title, skipped: skipped.filter(function (x) { return x.text; }).map(function (x) { return x.title; }) };
}
// a Markdown template the author fills by hand (or asks any AI to fill from notes)
function mdTemplate(lang) {
  return lang === 'en' ? [
    '# World name', '> One line that sums up the world', '', 'The essence of the world in a few paragraphs.', '',
    '## Laws', '- An unbreakable law of the world (magic, physics, limits)', '', '## Facts', '- Capital: …', '- Moons: 2', '',
    '## Characters', '### Name', 'Group: Royal family', 'Role: role in the world', 'Description: 1–2 sentences', 'Look: appearance',
    'Links: Another name — who they are to them; Place — born there', 'Life: age 12 — lost the father; age 20 — joined the order', '', 'The biography in free text, as long as you like.', '',
    '## Locations', '### Name', 'Description: …', 'Look: …', '', 'The history of the place.', '',
    '## Factions', '### Name', 'Description: an organisation with a goal and members', 'Links: Name — leader', '',
    '## Artifacts', '### Name', 'Description: a unique named item', '',
    '## Events', '### Name', 'Year: 340', 'Duration: 2', 'When: Third age, year 340', 'Who: Name, Faction', 'Outcome: what changed', '', 'What happened.', '',
    '## Peoples', '### Name', 'Origin: …', 'Look: …', 'Society: …', 'Lands: …', '',
    '## Languages', '### Name', 'Sound: …', 'Script: …', 'Phrases: …', 'Speakers: …', '',
    '## Beliefs', '### Name', 'Powers: …', 'Myths: …', 'Rites: …', 'Believers: …', '',
    '## Customs', '### Name', 'What: …', 'When: …', 'Meaning: …', ''
  ].join('\n') : [
    '# Назва світу', '> Один рядок, що підсумовує світ', '', 'Суть світу кількома абзацами.', '',
    '## Закони', '- Непорушний закон світу (магія, фізика, межі можливого)', '', '## Факти', '- Столиця: …', '- Місяців на небі: 2', '',
    '## Персонажі', '### Імʼя', 'Група: Королівська родина', 'Роль: роль у світі', 'Опис: 1–2 речення', 'Вигляд: зовнішність',
    'Звʼязки: Інше імʼя — ким доводиться; Місце — родом звідти', 'Життя: 12 років — втратила батька; 20 років — вступила в орден', '', 'Біографія довільним текстом, скільки завгодно.', '',
    '## Локації', '### Назва', 'Опис: …', 'Вигляд: …', '', 'Історія місця.', '',
    '## Фракції', '### Назва', 'Опис: організація з метою й членами', 'Звʼязки: Імʼя — очільник', '',
    '## Артефакти', '### Назва', 'Опис: унікальний іменований предмет', '',
    '## Події', '### Назва', 'Рік: 340', 'Тривалість: 2', 'Коли: Третя епоха, рік 340', 'Учасники: Імʼя, Фракція', 'Наслідок: що змінилося', '', 'Що сталося.', '',
    '## Народи', '### Назва', 'Походження: …', 'Вигляд: …', 'Суспільство: …', 'Землі: …', '',
    '## Мови', '### Назва', 'Звучання: …', 'Письмо: …', 'Фрази: …', 'Носії: …', '',
    '## Вірування', '### Назва', 'Сили: …', 'Міфи: …', 'Обряди: …', 'Вірні: …', '',
    '## Звичаї', '### Назва', 'Що: …', 'Коли: …', 'Значення: …', ''
  ].join('\n');
}

// The file → a clean shape; anything unknown is dropped, nothing is invented. The file is JSON (whitewrite.fill/1),
// a .md with a ```json block of it, or the Markdown template above; `title` — the world name from «# …» of a Markdown file
function parse(text) {
  var title = '', skipped = [];
  if (typeof text === 'string') {
    var t = text.replace(/^\uFEFF/, '').trim(), block = t.match(/```(?:json)?\s*\n(\{[\s\S]*?\})\s*\n```/);
    if (t[0] !== '{') {
      if (block && block[1].indexOf(FORMAT) >= 0) text = block[1];
      else { var md = fromMarkdown(t); title = md.title; text = md.data; skipped = md.skipped; }
    }
  }
  var r = parse1(text);
  if (title && !r.error) r.title = title;
  if (!skipped.length) return r;
  if (r.error === 'empty') { // a file not by the template: nothing recognised is \u00ABAI can sort it\u00BB, not \u00ABempty\u00BB
    r = { data: { world: { tagline: '', summary: '', rules: [], facts: [] }, culture: {} }, warnings: [] };
    KINDS.forEach(function (k) { r.data[k] = []; }); Object.keys(LORE).forEach(function (g) { r.data.culture[g] = []; });
    if (title) r.title = title;
  }
  r.skipped = skipped;
  return r;
}
function parse1(text) {
  var d; try { d = typeof text === 'string' ? JSON.parse(text.replace(/^\uFEFF/, '')) : text; } catch (e) { return { error: 'json', detail: e.message }; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { error: 'shape' };
  var warn = [];
  if (d.format !== FORMAT) { if (d.format) return { error: 'format', detail: String(d.format) }; warn.push('noformat'); }
  var w = d.world || {}, out = { world: { tagline: s(w.tagline), summary: s(w.summary),
    rules: arr(w.rules).map(s).filter(Boolean),
    facts: arr(w.facts).map(function (f) { return typeof f === 'string' ? { k: '', v: s(f) } : { k: s(f && f.k), v: s(f && f.v) }; }).filter(function (f) { return f.v; }) } };
  KINDS.forEach(function (k) {
    out[k] = arr(d[k]).filter(function (e) { return e && s(e.name || e.title); }).map(function (e) {
      var x = { name: s(e.name || e.title), group: s(e.group).slice(0, 80), desc: s(e.desc || e.description), story: s(e.story),
        links: arr(e.links).filter(function (l) { return l && s(l.to); }).map(function (l) { return { to: s(l.to), rel: s(l.rel).slice(0, 80) }; }) };
      if (k === 'events') Object.assign(x, { outcome: s(e.outcome), at: n(e.at), dur: n(e.dur), when: s(e.when).slice(0, 200), who: arr(e.who).map(s).filter(Boolean) });
      else x.look = s(e.look);
      if (k === 'characters') { x.role = s(e.role).slice(0, 200); x.life = arr(e.life).filter(function (l) { return l && s(l.text); }).map(function (l) { return { at: s(l.at).slice(0, 80), text: s(l.text) }; }); }
      return x;
    });
  });
  var c = d.culture || {};
  out.culture = {};
  Object.keys(LORE).forEach(function (g) {
    out.culture[g] = arr(c[g]).filter(function (e) { return e && s(e.name); }).map(function (e) {
      var f = {}; LORE[g].forEach(function (k) { if (s(e[k])) f[k] = s(e[k]); });
      return { name: s(e.name), group: s(e.group).slice(0, 80), desc: s(e.desc || e.description), fields: f };
    });
  });
  var total = KINDS.reduce(function (t, k) { return t + out[k].length; }, 0) + Object.keys(LORE).reduce(function (t, g) { return t + out.culture[g].length; }, 0) +
    out.world.rules.length + out.world.facts.length + (out.world.summary ? 1 : 0);
  if (!total) return { error: 'empty' };
  return { data: out, warnings: warn };
}

// The merge: same kind + same name = the same entity (only empty fields are filled, unless `replace`); everything else is new.
// cur = { world, entities: [{id, kind, name|title, …}], lore: [{id, group, name, …}] }; newId(kind) gives ids.
// Returns { world: patch | null, writes: [{ col: 'entities'|'lore', id, doc, isNew }], counts, kept: [what was not replaced] }
function plan(data, cur, opts) {
  opts = opts || {}; var replace = !!opts.replace, newId = opts.newId;
  var W = cur.world || {}, ents = cur.entities || [], lore = cur.lore || [], kept = [], writes = [];
  var counts = { add: {}, upd: {}, rules: 0, facts: 0, world: 0 };
  var bump = function (o, k) { o[k] = (o[k] || 0) + 1; };
  var put = function (old, key, val, label) { // a text field: fill if empty, replace only when asked
    if (!val) return undefined;
    var was = s(old);
    if (!was || was === val) return was === val ? undefined : val;
    if (replace) return val;
    kept.push(label); return undefined;
  };
  // world
  var wp = {}, t;
  if ((t = put(W.tagline, 'tagline', data.world.tagline, 'world.tagline')) !== undefined) wp.tagline = t;
  if ((t = put(W.summary, 'summary', data.world.summary, 'world.summary')) !== undefined) wp.summary = t;
  var rules = (W.rules || []).slice(), have = rules.map(norm);
  data.world.rules.forEach(function (r) { if (have.indexOf(norm(r)) < 0) { rules.push(r); have.push(norm(r)); counts.rules++; } });
  if (counts.rules) wp.rules = rules;
  var facts = (W.facts || []).map(function (f) { return typeof f === 'string' ? { k: '', v: f } : { k: f.k || '', v: f.v || '' }; }), fchg = false;
  data.world.facts.forEach(function (f) {
    var i = -1; facts.forEach(function (x, j) { if (i < 0 && (f.k ? norm(x.k) === norm(f.k) : norm(x.v) === norm(f.v))) i = j; });
    if (i < 0) { facts.push(f); counts.facts++; fchg = true; }
    else if (norm(facts[i].v) !== norm(f.v)) { if (replace) { facts[i] = f; fchg = true; counts.facts++; } else kept.push('world.facts: ' + (f.k || f.v.slice(0, 40))); }
  });
  if (fchg) wp.facts = facts;
  counts.world = (wp.tagline !== undefined ? 1 : 0) + (wp.summary !== undefined ? 1 : 0);
  // entities: first every name gets its id (the file may link to things further down), then the docs
  var byName = {}, key = function (k, name) { return k + '|' + norm(name); };
  ents.forEach(function (e) { if (KINDS.indexOf(e.kind) >= 0) byName[key(e.kind, e.name || e.title)] = e; });
  var anyName = function (name) { // a link's target: any kind, the file's own first
    for (var i = 0; i < KINDS.length; i++) { var e = byName[key(KINDS[i], name)]; if (e) return e.id; }
    return null;
  };
  KINDS.forEach(function (k) { data[k].forEach(function (x) { if (!byName[key(k, x.name)]) byName[key(k, x.name)] = { id: newId(k), kind: k, isNew: true }; }); });
  KINDS.forEach(function (k) {
    data[k].forEach(function (x) {
      var e = byName[key(k, x.name)], fresh = !!e.isNew, doc = {}, label = k + ': ' + x.name, dos = Object.assign({}, e.dossier || {}), dchg = false, v;
      if (fresh) { doc.id = e.id; doc.kind = k; doc[k === 'events' ? 'title' : 'name'] = x.name; doc.slug = slugify(x.name);
        doc.origin = { source: 'explicit', confidence: null, confirmed: true, createdBy: 'import' }; if (x.group) doc.group = x.group; }
      var dk = e.desc !== undefined || e.description === undefined ? 'desc' : 'description';
      if ((v = put(e[dk], dk, x.desc, label + ' · desc')) !== undefined) doc[dk] = v;
      (k === 'events' ? ['story', 'outcome'] : ['story', 'look']).forEach(function (f) { if ((v = put(dos[f], f, x[f], label + ' · ' + f)) !== undefined) { dos[f] = v; dchg = true; } });
      if (dchg) doc.dossier = dos;
      if (k === 'characters') {
        if ((v = put(e.role, 'role', x.role, label + ' · role')) !== undefined) doc.role = v;
        var life = (e.lifeNotes || []).slice(), lk = life.map(function (l) { return norm(l.at) + '|' + norm(l.text); }), lchg = false;
        x.life.forEach(function (l, i) { if (lk.indexOf(norm(l.at) + '|' + norm(l.text)) < 0) { life.push({ id: 'ln_' + e.id + '_' + (life.length + i), at: l.at, text: l.text }); lchg = true; } });
        if (lchg) doc.lifeNotes = life;
      }
      if (k === 'events') {
        if (x.at !== null && x.at !== e.at && (e.at == null || replace)) doc.at = x.at;
        if (x.dur !== null && x.dur !== e.dur && (e.dur == null || replace)) doc.dur = x.dur;
        if ((v = put(e.when, 'when', x.when, label + ' · when')) !== undefined) doc.when = v;
        var who = (Array.isArray(e.characters) ? e.characters : []).slice();
        x.who.forEach(function (nm) { var c = byName[key('characters', nm)]; if (c && who.indexOf(c.id) < 0) who.push(c.id); });
        if (who.length !== (e.characters || []).length) doc.characters = who;
      }
      var rel = (e.relations || []).slice(), rchg = false;
      x.links.forEach(function (l) { var id = anyName(l.to); if (id && id !== e.id && !rel.some(function (r) { return r && r.id === id; })) { rel.push({ id: id, kind: l.rel }); rchg = true; } });
      if (rchg) doc.relations = rel;
      if (!Object.keys(doc).length) return;
      writes.push({ col: 'entities', id: e.id, doc: doc, isNew: fresh });
      bump(fresh ? counts.add : counts.upd, k);
    });
  });
  // culture
  var lby = {}; lore.forEach(function (l) { lby[(l.group || 'customs') + '|' + norm(l.name)] = l; });
  Object.keys(LORE).forEach(function (g) {
    data.culture[g].forEach(function (x) {
      var l = lby[g + '|' + norm(x.name)], fresh = !l, doc = {}, f = Object.assign({}, (l && l.fields) || {}), fchg2 = false, v, label = g + ': ' + x.name;
      if (fresh) { l = { id: newId('lore') }; lby[g + '|' + norm(x.name)] = l; doc = { group: g, name: x.name }; }
      if ((v = put(l.desc, 'desc', x.desc, label + ' · desc')) !== undefined) doc.desc = v;
      Object.keys(x.fields).forEach(function (k) { if ((v = put(f[k], k, x.fields[k], label + ' · ' + k)) !== undefined) { f[k] = v; fchg2 = true; } });
      if (fchg2) doc.fields = f;
      if (!Object.keys(doc).length) return;
      writes.push({ col: 'lore', id: l.id, doc: doc, isNew: fresh });
      bump(fresh ? counts.add : counts.upd, g);
    });
  });
  return { world: Object.keys(wp).length ? wp : null, writes: writes, counts: counts, kept: kept };
}

// Several fill objects (the parts of a big folder, sorted by AI one by one) → one: the same kind + name is one item —
// an empty field takes the other's value, two different texts are joined, lists (links, life, who) are joined without repeats
function merge(parts) {
  var out = { format: FORMAT, world: { tagline: '', summary: '', rules: [], facts: [] }, culture: {} };
  var key = function (v) { return typeof v === 'object' ? JSON.stringify(v) : String(v); };
  var join = function (a, b) {
    if (Array.isArray(a) || Array.isArray(b)) { var seen = {}, r = []; arr(a).concat(arr(b)).forEach(function (x) { var k = key(x); if (!seen[k]) { seen[k] = 1; r.push(x); } }); return r; }
    if (a == null || a === '' || a === 0) return b; if (b == null || b === '' || b === 0) return a;
    if (typeof a === 'string' && typeof b === 'string' && norm(a) !== norm(b)) return norm(a).indexOf(norm(b)) >= 0 ? a : norm(b).indexOf(norm(a)) >= 0 ? b : a + '\n\n' + b;
    return a;
  };
  var into = function (list, items) {
    arr(items).forEach(function (it) {
      if (!it || !s(it.name)) return;
      var same = list.filter(function (x) { return norm(x.name) === norm(it.name); })[0];
      if (!same) { list.push(Object.assign({}, it)); return; }
      Object.keys(it).forEach(function (k) { same[k] = join(same[k], it[k]); });
    });
  };
  arr(parts).forEach(function (p) {
    if (!p || typeof p !== 'object') return;
    var w = p.world || {};
    out.world.tagline = out.world.tagline || s(w.tagline);
    out.world.summary = join(out.world.summary, s(w.summary));
    out.world.rules = join(out.world.rules, w.rules); out.world.facts = join(out.world.facts, w.facts);
    KINDS.forEach(function (k) { into(out[k] || (out[k] = []), p[k]); });
    Object.keys(LORE).forEach(function (g) { into(out.culture[g] || (out.culture[g] = []), (p.culture || {})[g]); });
  });
  return out;
}

var FILL = { FORMAT: FORMAT, KINDS: KINDS, LORE: LORE, RULES: RULES, TEMPLATE: TEMPLATE, prompt: prompt, parse: parse, plan: plan, merge: merge, fromMarkdown: fromMarkdown, mdTemplate: mdTemplate };
if (typeof module !== 'undefined' && module.exports) module.exports = FILL;
if (typeof window !== 'undefined') window.__FILL = FILL;
})();
