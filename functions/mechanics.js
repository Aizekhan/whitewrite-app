// ============================================================================
// The mechanics constructor — SINGLE SOURCE for the Game Bible (window.__MECH, copy in app/firebase/ made by
// scripts/build-app.mjs) and the MCP server (get_mechanics / get_mechanic). Edit THIS file.
// ============================================================================
// A mechanic is a card of the game: worlds/{w}/games/{g}/cards/{id} with section "mechanics" and `mech`:
//   { tpl: 'umcf' | '' (own), tplVersion, cat, sub, stage: concept|dev|testing|ready, type, purpose, rules, tags[], links[cardId],
//     sections: [{ id, title, hint, kind: 'fields' | 'table', fields: [FieldDef], values: {k: v} | rows: [{ _id, k: v }], rowLabel, custom }] }
// The instance carries its OWN copy of the structure (sections, fields), so the author edits it freely; the template in
// TEMPLATES is never touched, and a newer template version never overwrites an instance (tplVersion records the origin).
// FieldDef: { k, l: label ({uk,en} or the author's string), t: type, u: unit, req: 'r' (required) | 'rec' (recommended) | 'opt',
//             adv: true (advanced view only), h: hint, o: options [{ v, l: {uk,en} }], ref: section id (rows of that table), min, max, custom: added by the author }
// Types: text · long · num · pct · time (s) · bool · sel · multi · ref · refs · formula · range ("min–max") · json

(function () { // a closure: in the browser this file is a plain <script> sharing the global scope
var TYPES = ['text', 'long', 'num', 'pct', 'time', 'bool', 'sel', 'multi', 'ref', 'refs', 'formula', 'range', 'json'];
var TYPE_NAMES = { text: ['Текст', 'Text'], long: ['Довгий текст', 'Long text'], num: ['Число', 'Number'], pct: ['Відсоток', 'Percent'], time: ['Час, с', 'Time, s'],
  bool: ['Перемикач', 'Toggle'], sel: ['Вибір зі списку', 'Choice'], multi: ['Множинний вибір', 'Multiple choice'], ref: ['Посилання на запис', 'Link to a row'],
  refs: ['Посилання на кілька записів', 'Links to rows'], formula: ['Формула', 'Formula'], range: ['Діапазон', 'Range'], json: ['JSON / структуровані дані', 'JSON / structured data'] };
var STAGES = [['concept', 'Концепція', 'Concept'], ['dev', 'У розробці', 'In development'], ['testing', 'Тестується', 'Testing'], ['ready', 'Готова', 'Ready']];

// The categories of the Mechanics section: game SYSTEMS (rules, numbers, how they connect). Concrete content — the enemies,
// items, quests themselves — lives in its own sections («Вороги й боси», «Предмети», «Квести й діалоги»).
var CATEGORIES = [
  { id: 'movement', uk: 'Рух', en: 'Movement', subs: [['locomotion', 'Переміщення', 'Locomotion'], ['jumps', 'Стрибки й ривки', 'Jumps & dashes'], ['traversal', 'Лазіння, плавання, політ', 'Climbing, swimming, flight']] },
  { id: 'combat', uk: 'Бій', en: 'Combat', subs: [['melee', 'Ближній бій', 'Melee'], ['ranged', 'Далекобійний бій', 'Ranged'], ['defense', 'Захист і парирування', 'Block & parry'], ['evasion', 'Ухилення в бою', 'Evasion'], ['combos', 'Комбо', 'Combos']] },
  { id: 'stats', uk: 'Характеристики', en: 'Attributes & stats', subs: [['attributes', 'Атрибути', 'Attributes'], ['derived', 'Похідні параметри', 'Derived stats']] },
  { id: 'progression', uk: 'Прогресія', en: 'Progression', subs: [['levels', 'Рівні й досвід', 'Levels & XP'], ['perks', 'Перки й дерева', 'Perks & trees']] },
  { id: 'abilities', uk: 'Навички й здібності', en: 'Skills & abilities', subs: [['active', 'Активні', 'Active'], ['passive', 'Пасивні', 'Passive'], ['magic', 'Магія', 'Magic']] },
  { id: 'gear', uk: 'Спорядження й інвентар', en: 'Gear & inventory', subs: [['equipment', 'Зброя й броня', 'Weapons & armour'], ['inventory', 'Інвентар', 'Inventory'], ['loot', 'Лут', 'Loot']] },
  { id: 'status', uk: 'Здоровʼя й статуси', en: 'Health & status', subs: [['resources', 'Ресурси', 'Resources'], ['effects', 'Ефекти', 'Effects']] },
  { id: 'ai', uk: 'AI ворогів', en: 'Enemy AI', subs: [['behavior', 'Поведінка', 'Behaviour'], ['adaptive', 'Адаптація', 'Adaptation']] },
  { id: 'world', uk: 'Взаємодія зі світом', en: 'World interaction', subs: [['objects', 'Обʼєкти й механізми', 'Objects & mechanisms'], ['npc', 'NPC', 'NPCs']] },
  { id: 'narrative', uk: 'Системи квестів і діалогів', en: 'Quest & dialogue systems', subs: [] },
  { id: 'economy', uk: 'Економіка й крафт', en: 'Economy & crafting', subs: [['trade', 'Торгівля й валюти', 'Trade & currencies'], ['crafting', 'Крафт', 'Crafting']] },
  { id: 'camera', uk: 'Камера й керування', en: 'Camera & controls', subs: [] },
  { id: 'death', uk: 'Смерть і відродження', en: 'Death & respawn', subs: [] },
  { id: 'winlose', uk: 'Перемога й поразка', en: 'Win & lose', subs: [] },
];
// the Mechanics groups before v2.48 that were renamed (cards keep their old group text; it shows under the new one)
var GROUP_ALIAS = { 'Здібності': 'Навички й здібності', 'Abilities': 'Skills & abilities', 'Взаємодія': 'Взаємодія зі світом', 'Interaction': 'World interaction' };

// ---- compact builders for the templates ----
function T(uk, en) { return { uk: uk, en: en || uk }; }
function F(k, uk, en, t, x) { var f = { k: k, l: T(uk, en), t: t || 'text' }; if (x) Object.keys(x).forEach(function (n) { f[n] = x[n]; }); return f; }
function O(list) { return list.map(function (o) { return { v: o[0], l: T(o[1], o[2]) }; }); } // options (objects: Firestore stores no arrays in arrays)
var R = { req: 'r' }, REC = { req: 'rec' };
function X(a, b) { var o = {}; [a, b].forEach(function (s) { if (s) Object.keys(s).forEach(function (k) { o[k] = s[k]; }); }); return o; }

// ============================== UMCF ==============================
var PHASES = O([['approach', 'Підготовка / зближення', 'Preparation / approach'], ['align', 'Вирівнювання', 'Align'], ['startup', 'Замах (Startup)', 'Startup / wind-up'],
  ['active', 'Удар (Active)', 'Active / strike'], ['recovery', 'Відновлення (Recovery)', 'Recovery / follow-through'], ['reposition', 'Зміна позиції', 'Reposition']]);
var UMCF = {
  id: 'umcf', version: 1, cat: 'combat', sub: 'melee', complexity: 3,
  name: T('Universal Melee Combat Framework (UMCF)'),
  desc: T('Ближній бій, де рішення атакувати, підготовка позиції, анімація і влучання — окремі повʼязані етапи: ворог не починає завідомо невдалу атаку.',
    'Melee where the decision to attack, positioning, the animation and the hit are separate linked stages: an enemy never starts an attack that cannot land.'),
  purpose: T('Геометрично, анімаційно й логічно коректні атаки ближнього бою для гравця й ворогів.', 'Geometrically, visually and logically correct melee attacks for the player and enemies.'),
  sections: [
    { id: 'overview', title: T('Загальний опис', 'Overview'), kind: 'fields', hint: T('Для кого система і які в неї межі. Головний принцип: якщо AI вирішив атакувати, він має реальну геометричну змогу влучити (якщо гравець не ухилився й не заблокував).', 'Who the system serves and its limits. The core rule: once the AI decides to attack, it can actually land the hit (unless the player dodges or blocks).'),
      fields: [F('users', 'Хто використовує', 'Used by', 'sel', X(R, { o: O([['both', 'Гравець і вороги', 'Player and enemies'], ['player', 'Лише гравець', 'Player only'], ['enemies', 'Лише вороги', 'Enemies only']]) })),
        F('view', 'Камера / перспектива', 'Camera / perspective', 'sel', X(REC, { o: O([['third', 'Від третьої особи', 'Third person'], ['first', 'Від першої особи', 'First person'], ['top', 'Ізометрія / згори', 'Isometric / top-down'], ['side', 'Збоку (2.5D)', 'Side (2.5D)']]) })),
        F('lockon', 'Захоплення цілі (lock-on)', 'Target lock-on', 'sel', X(REC, { o: O([['none', 'Немає', 'None'], ['soft', 'Мʼяке', 'Soft'], ['hard', 'Жорстке', 'Hard']]) })),
        F('tick', 'Частота перевірок бою, Гц', 'Combat update rate, Hz', 'num', { req: 'opt', adv: true, min: 10, max: 240, h: T('Як часто рахуються зони ураження. Низька частота + швидка зброя = прохід крізь ціль — тоді потрібні swept hitboxes.', 'How often hit volumes are evaluated. A low rate + a fast weapon = passing through the target — then swept hitboxes are needed.') }),
        F('notes', 'Нотатки', 'Notes', 'long', { req: 'opt' })] },
    { id: 'weapons', title: T('База зброї', 'Weapon definitions'), kind: 'table', rowLabel: 'name', prefix: 'W',
      hint: T('Кожен рядок — зброя або її варіант (короткий і довгий кинджал — різні рядки). Дистанції — від центру тіла атакувальника.', 'Each row is a weapon or a variant (a short and a long dagger are different rows). Distances are from the attacker\'s body centre.'),
      fields: [F('name', 'Назва', 'Name', 'text', R), F('category', 'Категорія', 'Category', 'sel', X(R, { o: O([['dagger', 'Кинджал', 'Dagger'], ['sword', 'Меч', 'Sword'], ['greatsword', 'Дворучний меч', 'Greatsword'], ['axe', 'Сокира', 'Axe'], ['hammer', 'Молот', 'Hammer'], ['spear', 'Спис', 'Spear'], ['fists', 'Кулаки', 'Fists'], ['claws', 'Пазурі / природна', 'Claws / natural'], ['other', 'Інше', 'Other']]) })),
        F('length', 'Довжина зброї, м', 'Weapon length, m', 'num', X(R, { min: 0, max: 5 })),
        F('reach', 'Ефективна дальність, м', 'Effective reach, m', 'num', X(R, { min: 0, max: 8, h: T('Де вістря реально вражає: довжина зброї + рука.', 'Where the edge really hits: weapon length + arm.') })),
        F('prefDist', 'Бажана дистанція, м', 'Preferred distance, m', 'num', X(REC, { min: 0, max: 8 })),
        F('minDist', 'Мінімальна дистанція, м', 'Minimum distance, m', 'num', X(REC, { min: 0, max: 8, h: T('Ближче — зброя «не працює» (спис впритул).', 'Closer than this the weapon does not work (a spear point-blank).') })),
        F('speed', 'Швидкість атак, ×', 'Attack speed, ×', 'num', X(REC, { min: 0.1, max: 5, h: T('Множник до часу фаз атак (1 = як у таблиці атак).', 'A multiplier on attack phase times (1 = as in the attack table).') })),
        F('weight', 'Вага, кг', 'Weight, kg', 'num', { req: 'opt', min: 0 }), F('handling', 'Зручність (0–100)', 'Handling (0–100)', 'num', { req: 'opt', adv: true, min: 0, max: 100 }),
        F('attacks', 'Доступні атаки', 'Attack types', 'refs', X(R, { ref: 'attacks' })), F('animSet', 'Набір анімацій', 'Animation set', 'text', REC),
        F('moves', 'Рухи перед атакою', 'Movement profiles', 'refs', X(REC, { ref: 'moves' })), F('comboSet', 'Набір комбо', 'Combo set', 'text', { req: 'opt', adv: true }),
        F('notes', 'Нотатки', 'Notes', 'long', { req: 'opt' })],
      rows: [
        { _id: 'W1', name: 'Короткий кинджал', category: 'dagger', length: 0.3, reach: 0.9, prefDist: 0.8, minDist: 0.3, speed: 1.3, weight: 0.4, attacks: ['A1', 'A2', 'A7'], moves: ['M1', 'M2', 'M3'], animSet: 'Dagger_Set' },
        { _id: 'W2', name: 'Довгий бойовий кинджал', category: 'dagger', length: 0.45, reach: 1.05, prefDist: 0.95, minDist: 0.35, speed: 1.15, weight: 0.6, attacks: ['A1', 'A2', 'A7'], moves: ['M1', 'M2', 'M3'], animSet: 'Dagger_Set' },
        { _id: 'W3', name: 'Меч', category: 'sword', length: 0.9, reach: 1.6, prefDist: 1.3, minDist: 0.6, speed: 1, weight: 1.4, attacks: ['A3', 'A4', 'A5', 'A6'], moves: ['M1', 'M2', 'M4', 'M5'], animSet: 'Sword_Set' },
        { _id: 'W4', name: 'Молот', category: 'hammer', length: 1.1, reach: 1.8, prefDist: 1.4, minDist: 0.8, speed: 0.7, weight: 6, attacks: ['A5'], moves: ['M1'], animSet: 'Hammer_Set' },
        { _id: 'W5', name: 'Спис', category: 'spear', length: 2, reach: 2.6, prefDist: 2.2, minDist: 1.2, speed: 0.9, weight: 2.5, attacks: ['A8'], moves: ['M1', 'M2', 'M6'], animSet: 'Spear_Set' }] },
    { id: 'attacks', title: T('База атак', 'Attack definitions'), kind: 'table', rowLabel: 'name', prefix: 'A',
      hint: T('Кожна атака — окремий запис. Часи фаз налаштовуються тут, не в коді. Коефіцієнт k — частка повної дистанції атаки, з якої її варто починати (див. «Дистанція й вирівнювання»).', 'Each attack is its own row. Phase times are set here, not in code. The k coefficient is the share of the full attack distance to start from (see “Distance & alignment”).'),
      fields: [F('name', 'Назва', 'Name', 'text', R), F('kind', 'Тип', 'Type', 'sel', X(R, { o: O([['quick', 'Швидка', 'Quick'], ['heavy', 'Важка', 'Heavy'], ['thrust', 'Колюча', 'Thrust'], ['slash', 'Рубляча', 'Slash'], ['overhead', 'Згори', 'Overhead'], ['spin', 'Розворот', 'Spin'], ['lunge', 'Випад', 'Lunge'], ['jump', 'У стрибку', 'Jump']]) })),
        F('weapons', 'Сумісна зброя', 'Weapon compatibility', 'refs', X(REC, { ref: 'weapons' })),
        F('startup', 'Startup, с', 'Startup, s', 'time', X(R, { min: 0, max: 3 })), F('active', 'Active, с', 'Active, s', 'time', X(R, { min: 0, max: 2 })), F('recovery', 'Recovery, с', 'Recovery, s', 'time', X(R, { min: 0, max: 3 })),
        F('reach', 'Дальність, м', 'Reach, m', 'num', X(REC, { min: 0, max: 8, h: T('Порожньо — дальність зброї.', 'Empty — the weapon\'s reach.') })),
        F('arc', 'Кут атаки, °', 'Attack arc, °', 'num', X(R, { min: 0, max: 360 })), F('forward', 'Рух уперед, м', 'Forward movement, m', 'num', X(REC, { min: 0, max: 6, h: T('Скільки тіло проходить уперед під час удару (D_lunge).', 'How far the body travels forward during the strike (D_lunge).') })),
        F('vOffset', 'Вертикальне зміщення, м', 'Vertical offset, m', 'num', { req: 'opt', adv: true }), F('damage', 'Базова шкода', 'Damage', 'num', X(R, { min: 0 })),
        F('stamina', 'Витривалість', 'Stamina cost', 'num', X(REC, { min: 0 })), F('k', 'Коефіцієнт k', 'Coefficient k', 'num', X(REC, { min: 0.3, max: 1.2, h: T('D_optimal = k × D_attack. Стартові: швидкий тичок 0.75, випад кинджалом 0.85, рубка мечем 0.80, важкий молот 0.70, тичок списом 0.90.', 'D_optimal = k × D_attack. Starting values: quick thrust 0.75, dagger lunge 0.85, sword slash 0.80, heavy hammer 0.70, spear thrust 0.90.') })),
        F('interruptible', 'Можна перервати', 'Interruptible', 'bool', REC), F('canCombo', 'Переходить у комбо', 'Can combo', 'bool', REC),
        F('anim', 'Анімація', 'Animation', 'text', REC), F('notes', 'Нотатки', 'Notes', 'long', { req: 'opt', adv: true })],
      rows: [
        { _id: 'A1', name: 'Quick Thrust', kind: 'quick', weapons: ['W1', 'W2'], startup: 0.18, active: 0.08, recovery: 0.3, arc: 20, forward: 0.2, damage: 12, stamina: 8, k: 0.75, interruptible: true, canCombo: true, anim: 'Dagger_Thrust_01' },
        { _id: 'A2', name: 'Heavy Thrust', kind: 'heavy', weapons: ['W1', 'W2'], startup: 0.42, active: 0.1, recovery: 0.55, arc: 15, forward: 0.9, damage: 28, stamina: 18, k: 0.85, interruptible: false, canCombo: false, anim: 'Dagger_Heavy_01' },
        { _id: 'A3', name: 'Horizontal Slash', kind: 'slash', weapons: ['W3'], startup: 0.3, active: 0.15, recovery: 0.4, arc: 140, forward: 0.3, damage: 20, stamina: 12, k: 0.8, interruptible: true, canCombo: true, anim: 'Sword_Slash_01' },
        { _id: 'A4', name: 'Vertical Slash', kind: 'slash', weapons: ['W3'], startup: 0.34, active: 0.12, recovery: 0.45, arc: 40, forward: 0.3, damage: 24, stamina: 14, k: 0.8, interruptible: true, canCombo: true, anim: 'Sword_Slash_02' },
        { _id: 'A5', name: 'Overhead Strike', kind: 'overhead', weapons: ['W3', 'W4'], startup: 0.6, active: 0.14, recovery: 0.7, arc: 30, forward: 0.4, damage: 45, stamina: 25, k: 0.7, interruptible: false, canCombo: false, anim: 'Hammer_Overhead_01' },
        { _id: 'A6', name: 'Heavy Slash', kind: 'heavy', weapons: ['W3'], startup: 0.5, active: 0.18, recovery: 0.6, arc: 160, forward: 0.8, damage: 34, stamina: 20, k: 0.8, interruptible: false, canCombo: false, anim: 'Sword_Heavy_01' },
        { _id: 'A7', name: 'Lunge Attack', kind: 'lunge', weapons: ['W1', 'W2'], startup: 0.28, active: 0.12, recovery: 0.5, arc: 20, forward: 1.6, damage: 18, stamina: 14, k: 0.85, interruptible: false, canCombo: true, anim: 'Dagger_Lunge_01' },
        { _id: 'A8', name: 'Spear Thrust', kind: 'thrust', weapons: ['W5'], startup: 0.32, active: 0.12, recovery: 0.45, arc: 12, forward: 0.5, damage: 22, stamina: 12, k: 0.9, interruptible: true, canCombo: true, anim: 'Spear_Thrust_01' }] },
    { id: 'phases', title: T('Фази атак', 'Attack phases'), kind: 'table', rowLabel: 'phase', prefix: 'P',
      hint: T('Правила кожної фази. Без атаки в рядку — правило для всіх атак; з атакою — перевизначення для неї. У Startup удар ще не ранить; в Active діють зони ураження; у Recovery персонаж вразливий.', 'The rules of each phase. A row without an attack applies to all attacks; with one — an override for it. Startup never hurts; Active turns the hit volumes on; Recovery leaves the attacker open.'),
      fields: [F('phase', 'Фаза', 'Phase', 'sel', X(R, { o: PHASES })), F('attack', 'Атака (порожньо — усі)', 'Attack (empty — all)', 'ref', { req: 'opt', ref: 'attacks' }),
        F('duration', 'Тривалість, с', 'Duration, s', 'time', { req: 'opt', h: T('Startup / Active / Recovery беруться з атаки; тут — для інших фаз або перевизначення.', 'Startup / Active / Recovery come from the attack; here — for the other phases or an override.') }),
        F('start', 'Умова початку', 'Start condition', 'text', REC), F('end', 'Умова завершення', 'End condition', 'text', REC),
        F('move', 'Дозволений рух', 'Allowed movement', 'sel', X(REC, { o: O([['free', 'Вільний', 'Free'], ['limited', 'Обмежений', 'Limited'], ['root', 'Лише root motion', 'Root motion only'], ['none', 'Заборонений', 'None']]) })),
        F('turn', 'Поворот, °/с', 'Turn rate, °/s', 'num', X(REC, { min: 0, max: 1440 })),
        F('interrupt', 'Переривання', 'Interruption', 'sel', X(REC, { o: O([['always', 'Завжди', 'Always'], ['hit', 'Від удару', 'By a hit'], ['dodge', 'Ухиленням', 'By a dodge'], ['never', 'Ніколи', 'Never']]) })),
        F('hits', 'Зони ураження активні', 'Hit volumes active', 'bool', R), F('anim', 'Анімація', 'Animation', 'text', { req: 'opt' }), F('extra', 'Додатково', 'Extra', 'long', { req: 'opt', adv: true })],
      rows: [
        { _id: 'P1', phase: 'approach', start: 'AI обрав комбінацію', end: 'Дистанція в межах толерантності', move: 'free', turn: 540, interrupt: 'always', hits: false },
        { _id: 'P2', phase: 'align', duration: 0.12, start: 'Дистанція досягнута', end: 'Кут до цілі ≤ толерантності', move: 'limited', turn: 720, interrupt: 'always', hits: false },
        { _id: 'P3', phase: 'startup', start: 'Вирівняно', end: 'Минув Startup атаки', move: 'root', turn: 180, interrupt: 'hit', hits: false },
        { _id: 'P4', phase: 'active', start: 'Кінець Startup', end: 'Минув Active атаки', move: 'root', turn: 0, interrupt: 'never', hits: true },
        { _id: 'P5', phase: 'recovery', start: 'Кінець Active', end: 'Минув Recovery атаки', move: 'none', turn: 0, interrupt: 'hit', hits: false },
        { _id: 'P6', phase: 'reposition', duration: 0.4, start: 'Кінець Recovery', end: 'Нова позиція', move: 'free', turn: 540, interrupt: 'always', hits: false }] },
    { id: 'moves', title: T('Рух перед атакою', 'Movement before attack'), kind: 'table', rowLabel: 'name', prefix: 'M',
      hint: T('Профілі руху, якими персонаж готує позицію до удару. Комбінація вибирає один із них.', 'Movement profiles the attacker uses to set up a strike. A combination picks one.'),
      fields: [F('name', 'Назва', 'Name', 'text', R), F('kind', 'Тип руху', 'Movement type', 'sel', X(R, { o: O([['approach', 'Зближення', 'Approach'], ['lunge', 'Випад', 'Lunge'], ['sidestep', 'Крок убік', 'Side step'], ['retreat', 'Відступ', 'Retreat'], ['circle', 'Обхід по колу', 'Circle'], ['jump', 'Стрибок', 'Jump'], ['vertical', 'Вертикальне зміщення', 'Vertical reposition'], ['align', 'Швидке вирівнювання', 'Quick alignment']]) })),
        F('direction', 'Напрямок', 'Direction', 'sel', X(REC, { o: O([['forward', 'Уперед', 'Forward'], ['back', 'Назад', 'Back'], ['left', 'Ліворуч', 'Left'], ['right', 'Праворуч', 'Right'], ['up', 'Вгору', 'Up'], ['any', 'Будь-який', 'Any']]) })),
        F('duration', 'Тривалість, с', 'Duration, s', 'time', X(R, { min: 0, max: 5 })), F('speed', 'Швидкість, м/с', 'Speed, m/s', 'num', X(REC, { min: 0, max: 30 })),
        F('distance', 'Дистанція, м', 'Distance, m', 'num', X(R, { min: 0, max: 15 })), F('maxAngle', 'Макс. кут корекції, °', 'Max correction angle, °', 'num', X(REC, { min: 0, max: 180 })),
        F('accel', 'Прискорення, м/с²', 'Acceleration, m/s²', 'num', { req: 'opt', adv: true }), F('limits', 'Обмеження', 'Limits', 'text', { req: 'opt', adv: true }),
        F('anim', 'Анімація', 'Animation', 'text', REC), F('when', 'Умови використання', 'Conditions of use', 'text', REC)],
      rows: [
        { _id: 'M1', name: 'Approach', kind: 'approach', direction: 'forward', duration: 0.6, speed: 4.5, distance: 3, maxAngle: 60, anim: 'Run_Fwd', when: 'Ціль далі за бажану дистанцію' },
        { _id: 'M2', name: 'Short Lunge', kind: 'lunge', direction: 'forward', duration: 0.2, speed: 6, distance: 0.8, maxAngle: 25, anim: 'Lunge_Short', when: 'Ціль трохи далі за досяжність' },
        { _id: 'M3', name: 'Long Lunge', kind: 'lunge', direction: 'forward', duration: 0.32, speed: 7.5, distance: 1.8, maxAngle: 15, anim: 'Lunge_Long', when: 'Відкрита траєкторія до цілі' },
        { _id: 'M4', name: 'Side Step Left', kind: 'sidestep', direction: 'left', duration: 0.25, speed: 4, distance: 1, maxAngle: 45, anim: 'Step_L', when: 'Ціль атакує прямо' },
        { _id: 'M5', name: 'Side Step Right', kind: 'sidestep', direction: 'right', duration: 0.25, speed: 4, distance: 1, maxAngle: 45, anim: 'Step_R', when: 'Ціль атакує прямо' },
        { _id: 'M6', name: 'Retreat', kind: 'retreat', direction: 'back', duration: 0.35, speed: 3.5, distance: 1.2, maxAngle: 30, anim: 'Step_Back', when: 'Ціль ближче за мінімальну дистанцію' },
        { _id: 'M7', name: 'Circle Left', kind: 'circle', direction: 'left', duration: 0.8, speed: 2.5, distance: 2, maxAngle: 90, anim: 'Strafe_L', when: 'Шукає відкритий кут' },
        { _id: 'M8', name: 'Quick Alignment', kind: 'align', direction: 'any', duration: 0.1, speed: 0, distance: 0, maxAngle: 90, anim: 'Turn_Quick', when: 'Кут до цілі більший за толерантність' }] },
    { id: 'geometry', title: T('Геометрія ураження', 'Attack hit geometry'), kind: 'table', rowLabel: 'seg', prefix: 'G',
      hint: T('Удар — не один hitbox на всю анімацію, а сегменти в часі вздовж траєкторії зброї. Час — від початку атаки, у межах Active. Для швидкої зброї вмикай swept (безперервна перевірка), щоб вона не проходила крізь ціль між кадрами. Позиції — x,y,z у метрах від атакувальника.', 'A strike is not one hitbox for the whole animation but time segments along the weapon path. Time is from the attack start, inside Active. Turn on swept (continuous detection) for fast weapons so they never pass through a target between frames. Positions — x,y,z in metres from the attacker.'),
      fields: [F('attack', 'Атака', 'Attack', 'ref', X(R, { ref: 'attacks' })), F('seg', 'Сегмент', 'Segment', 'text', R),
        F('t0', 'Початок, с', 'Start time, s', 'time', R), F('t1', 'Кінець, с', 'End time, s', 'time', R),
        F('p0', 'Зброя на початку (x,y,z)', 'Weapon start (x,y,z)', 'text', REC), F('p1', 'Зброя в кінці (x,y,z)', 'Weapon end (x,y,z)', 'text', REC),
        F('dir', 'Напрямок зброї', 'Weapon direction', 'text', { req: 'opt', adv: true }),
        F('width', 'Ширина обʼєму, м', 'Volume width, m', 'num', X(R, { min: 0, max: 5 })), F('length', 'Довжина обʼєму, м', 'Volume length, m', 'num', X(R, { min: 0, max: 8 })),
        F('angle', 'Кут, °', 'Angle, °', 'num', { req: 'opt', adv: true }), F('vRange', 'Висота (від–до), м', 'Vertical range, m', 'range', REC),
        F('speed', 'Швидкість зброї, м/с', 'Weapon speed, m/s', 'num', { req: 'opt', adv: true }), F('mult', 'Множник шкоди', 'Damage multiplier', 'num', X(REC, { min: 0, max: 5 })),
        F('hitType', 'Тип влучання', 'Hit type', 'sel', X(REC, { o: O([['normal', 'Звичайне', 'Normal'], ['sweet', 'Солодка точка', 'Sweet spot'], ['graze', 'Дотичне', 'Graze'], ['stagger', 'Оглушує', 'Staggers']]) })),
        F('targets', 'Кого вражає', 'Target compatibility', 'text', { req: 'opt', adv: true }), F('swept', 'Swept / CCD', 'Swept / CCD', 'bool', REC)],
      rows: [
        { _id: 'G1', attack: 'A3', seg: 'Праворуч → вперед', t0: 0.3, t1: 0.35, p0: '0.6,1.3,0.2', p1: '0.4,1.3,1.0', width: 0.25, length: 1.1, vRange: '0.8–1.6', mult: 0.8, hitType: 'graze', swept: true },
        { _id: 'G2', attack: 'A3', seg: 'Центр', t0: 0.35, t1: 0.4, p0: '0.4,1.3,1.0', p1: '-0.4,1.3,1.0', width: 0.3, length: 1.3, vRange: '0.8–1.6', mult: 1.2, hitType: 'sweet', swept: true },
        { _id: 'G3', attack: 'A3', seg: 'Вперед → ліворуч', t0: 0.4, t1: 0.45, p0: '-0.4,1.3,1.0', p1: '-0.6,1.3,0.2', width: 0.25, length: 1.1, vRange: '0.8–1.6', mult: 0.8, hitType: 'graze', swept: true },
        { _id: 'G4', attack: 'A1', seg: 'Тичок', t0: 0.18, t1: 0.26, p0: '0.1,1.2,0.4', p1: '0.1,1.2,0.9', width: 0.12, length: 0.5, vRange: '0.9–1.5', mult: 1, hitType: 'normal', swept: true }] },
    { id: 'combos', title: T('Комбінації атак', 'Attack combinations'), kind: 'table', rowLabel: 'label', prefix: 'C',
      hint: T('Центральна таблиця: зброя + атака + рух перед атакою + анімація (+ геометрія з атаки). Значення беруться із записів баз; колонки «перевизначення» — лише для цієї комбінації. Вищий пріоритет перемагає, коли підходять кілька.', 'The central table: weapon + attack + movement + animation (+ the attack\'s geometry). Values come from the linked rows; the “override” columns apply to this combination only. Higher priority wins when several fit.'),
      fields: [F('label', 'Назва', 'Label', 'text', REC), F('weapon', 'Зброя', 'Weapon', 'ref', X(R, { ref: 'weapons' })), F('attack', 'Атака', 'Attack', 'ref', X(R, { ref: 'attacks' })),
        F('move', 'Рух перед атакою', 'Movement', 'ref', X(R, { ref: 'moves' })), F('anim', 'Анімація', 'Animation', 'text', REC),
        F('when', 'Умови', 'Conditions', 'text', REC), F('priority', 'Пріоритет', 'Priority', 'num', X(REC, { min: 0, max: 100 })),
        F('dist', 'Дистанція (від–до), м', 'Distance (min–max), m', 'range', REC), F('angle', 'Допустимий кут, °', 'Allowed angle, °', 'num', X(REC, { min: 0, max: 180 })),
        F('kOver', 'Перевизначення k', 'Override k', 'num', { req: 'opt', adv: true, min: 0.3, max: 1.2 }), F('dmgOver', 'Перевизначення шкоди', 'Override damage', 'num', { req: 'opt', adv: true }),
        F('limits', 'Обмеження', 'Limits', 'text', { req: 'opt', adv: true })],
      rows: [
        { _id: 'C1', label: 'Кинджал · швидкий тичок', weapon: 'W1', attack: 'A1', move: 'M1', anim: 'Dagger_Thrust_01', when: 'Середня дистанція', priority: 50, dist: '0.5–0.9', angle: 30 },
        { _id: 'C2', label: 'Кинджал · тичок з випадом', weapon: 'W1', attack: 'A1', move: 'M2', anim: 'Dagger_Lunge_01', when: 'Ціль трохи далі', priority: 40, dist: '0.9–1.6', angle: 20 },
        { _id: 'C3', label: 'Кинджал · важкий тичок', weapon: 'W1', attack: 'A2', move: 'M3', anim: 'Dagger_Heavy_01', when: 'Відкрита траєкторія', priority: 30, dist: '1.4–2.6', angle: 15 },
        { _id: 'C4', label: 'Меч · горизонтальна рубка', weapon: 'W3', attack: 'A3', move: 'M1', anim: 'Sword_Slash_01', when: 'Ціль перед персонажем', priority: 50, dist: '0.8–1.6', angle: 60 },
        { _id: 'C5', label: 'Меч · важка рубка', weapon: 'W3', attack: 'A6', move: 'M2', anim: 'Sword_Heavy_01', when: 'Достатня дистанція', priority: 35, dist: '1.2–2.2', angle: 45 },
        { _id: 'C6', label: 'Молот · удар згори', weapon: 'W4', attack: 'A5', move: 'M1', anim: 'Hammer_Overhead_01', when: 'Ціль у вертикальній зоні', priority: 45, dist: '1.0–1.8', angle: 25 }] },
    { id: 'distance', title: T('Дистанція й вирівнювання', 'Distance & alignment'), kind: 'fields',
      hint: T('D_attack = D_weapon + D_lunge + D_body — повна дистанція, з якої атака дістає ціль; D_optimal = k × D_attack — звідки її починати (k — в атаці). k — стартові значення для тестів, не фізичний закон.', 'D_attack = D_weapon + D_lunge + D_body — the full distance the attack reaches from; D_optimal = k × D_attack — where to start it (k is per attack). k values are test starting points, not a law of physics.'),
      fields: [F('formula', 'Формула дистанції атаки', 'Attack distance formula', 'formula', R), F('optFormula', 'Оптимальна дистанція', 'Optimal distance', 'formula', R),
        F('body', 'D_body: радіус тіла, м', 'D_body: body radius, m', 'num', X(R, { min: 0, max: 3 })),
        F('tolerance', 'Толерантність дистанції, м', 'Distance tolerance, m', 'num', X(R, { min: 0, max: 2 })),
        F('alignTol', 'Толерантність кута, °', 'Alignment tolerance, °', 'num', X(R, { min: 0, max: 90 })),
        F('maxRot', 'Макс. корекція повороту, °', 'Max rotation correction, °', 'num', X(REC, { min: 0, max: 180 })),
        F('vTol', 'Вертикальна толерантність, м', 'Vertical tolerance, m', 'num', X(REC, { min: 0, max: 5 })),
        F('approachSpeed', 'Швидкість зближення, м/с', 'Approach speed, m/s', 'num', X(REC, { min: 0, max: 30 })),
        F('predict', 'Прогноз позиції цілі, с', 'Target prediction time, s', 'time', X(R, { min: 0, max: 2, h: T('AI цілиться туди, де ціль буде в момент контакту (≈ Startup атаки), а не туди, де вона зараз.', 'The AI aims where the target will be at contact (≈ the attack\'s Startup), not where it is now.') })),
        F('targetSize', 'Врахування розміру цілі', 'Target size', 'sel', X(REC, { o: O([['radius', 'Радіус капсули цілі', 'Target capsule radius'], ['bounds', 'Габарити цілі', 'Target bounds'], ['none', 'Не враховується', 'Ignored']]) })),
        F('obstacles', 'Перешкоди', 'Obstacles', 'text', { req: 'opt', adv: true })],
      values: { formula: 'D_attack = D_weapon + D_lunge + D_body', optFormula: 'D_optimal = k × D_attack', body: 0.35, tolerance: 0.2, alignTol: 15, maxRot: 45, vTol: 0.6, approachSpeed: 4.5, predict: 0.3, targetSize: 'radius' } },
    { id: 'feasibility', title: T('Перевірка можливості атаки', 'Attack feasibility'), kind: 'table', rowLabel: 'check', prefix: 'F',
      hint: T('Що AI перевіряє ДО запуску атаки — по прогнозованій позиції цілі. Невдала перевірка → інша комбінація, зміна позиції або відмова.', 'What the AI checks BEFORE starting an attack — against the predicted target position. A failed check → another combination, repositioning or skipping.'),
      fields: [F('check', 'Перевірка', 'Check', 'text', R), F('on', 'Увімкнена', 'Enabled', 'bool', R), F('threshold', 'Поріг', 'Threshold', 'text', REC),
        F('fail', 'Якщо не пройдено', 'On failure', 'sel', X(R, { o: O([['reposition', 'Змінити позицію', 'Reposition'], ['other', 'Інша комбінація', 'Pick another combination'], ['wait', 'Чекати', 'Wait'], ['skip', 'Не атакувати', 'Skip the attack']]) })),
        F('notes', 'Нотатки', 'Notes', 'text', { req: 'opt', adv: true })],
      rows: [
        { _id: 'F1', check: 'Ціль у допустимій дистанції', on: true, threshold: 'D_optimal ± толерантність', fail: 'reposition' },
        { _id: 'F2', check: 'Кут дозволяє удар', on: true, threshold: '≤ толерантність кута', fail: 'reposition' },
        { _id: 'F3', check: 'Немає перешкод на траєкторії', on: true, threshold: 'Промінь / sweep зброї', fail: 'other' },
        { _id: 'F4', check: 'Висота цілі відповідає атаці', on: true, threshold: 'Висота ∈ діапазону сегментів', fail: 'other' },
        { _id: 'F5', check: 'Потрібний рух можливий', on: true, threshold: 'NavMesh / простір для випаду', fail: 'other' },
        { _id: 'F6', check: 'Немає зіткнень з іншими', on: true, threshold: 'Капсула на шляху', fail: 'reposition' },
        { _id: 'F7', check: 'Ціль не вийде з зони до контакту', on: true, threshold: 'Прогноз на Startup', fail: 'wait' },
        { _id: 'F8', check: 'Немає кращої комбінації', on: true, threshold: 'Пріоритет + геометрія', fail: 'other' }] },
    { id: 'commitment', title: T('Фіксація атаки', 'Attack commitment'), kind: 'table', rowLabel: 'phase', prefix: 'K',
      hint: T('Коли атаку ще можна змінити чи скасувати. Без атаки — правило для всіх; з атакою — для неї.', 'When an attack can still be changed or cancelled. Without an attack — the rule for all; with one — for it.'),
      fields: [F('phase', 'Фаза', 'Phase', 'sel', X(R, { o: PHASES })), F('attack', 'Атака (порожньо — усі)', 'Attack (empty — all)', 'ref', { req: 'opt', ref: 'attacks' }),
        F('cancel', 'Скасування', 'Cancel', 'sel', X(R, { o: O([['free', 'Вільно', 'Freely'], ['cond', 'За умов', 'On conditions'], ['no', 'Заборонено', 'Not allowed']]) })),
        F('window', 'Вікно скасування, % фази', 'Cancel window, % of phase', 'pct', X(REC, { min: 0, max: 100 })), F('cond', 'Умови', 'Conditions', 'text', REC)],
      rows: [
        { _id: 'K1', phase: 'approach', cancel: 'free', window: 100, cond: 'Можна змінити атаку чи комбінацію' },
        { _id: 'K2', phase: 'align', cancel: 'cond', window: 100, cond: 'Ціль вийшла з кута / дистанції' },
        { _id: 'K3', phase: 'startup', cancel: 'cond', window: 30, cond: 'Лише перші 30% Startup: удар по атакувальнику' },
        { _id: 'K4', phase: 'active', cancel: 'no', window: 0, cond: 'Лише спеціальні переривання (оглушення, парирування)' },
        { _id: 'K5', phase: 'recovery', cancel: 'cond', window: 60, cond: 'Комбо або ухилення після 60% Recovery' }] },
    { id: 'warping', title: T('Motion Warping', 'Motion warping'), kind: 'fields',
      hint: T('Обмежена корекція руху під час анімації, щоб удар підлаштувався під реальну позицію цілі без «телепортації».', 'Limited motion correction during the animation so the strike adapts to where the target really is, without teleporting.'),
      fields: [F('maxTrans', 'Макс. зсув, м', 'Max translation correction, m', 'num', X(R, { min: 0, max: 3 })), F('maxRot', 'Макс. поворот, °', 'Max rotation correction, °', 'num', X(R, { min: 0, max: 180 })),
        F('window', 'Вікно корекції (від–до), с', 'Correction window (from–to), s', 'range', R), F('speed', 'Швидкість корекції, м/с', 'Correction speed, m/s', 'num', REC),
        F('predict', 'Прогноз цілі', 'Target prediction', 'bool', REC), F('phases', 'Дозволені фази', 'Allowed phases', 'multi', X(R, { o: PHASES })),
        F('collision', 'Обмеження колізій', 'Collision constraints', 'text', REC)],
      values: { maxTrans: 0.5, maxRot: 30, window: '0–0.3', speed: 3, predict: true, phases: ['align', 'startup'], collision: 'Не проходити крізь стіни й інших персонажів' } },
    { id: 'adaptation', title: T('Адаптація AI до гравця', 'Combat adaptation'), kind: 'table', rowLabel: 'archetype', prefix: 'E',
      hint: T('Вороги помічають звички гравця (ухиляється вліво, весь час блокує, відступає) і змінюють вибір атак — кожен у міру свого розуму. Зомбі майже не вчиться, найманець — швидко. Не роби ворогів всезнаючими.', 'Enemies notice the player\'s habits (dodges left, always blocks, retreats) and change their attack choice — each as far as its mind allows. A zombie barely learns, a mercenary learns fast. Never make enemies all-knowing.'),
      fields: [F('archetype', 'Архетип ворога', 'Enemy archetype', 'text', R), F('intel', 'Інтелект (0–100)', 'Intelligence (0–100)', 'num', X(R, { min: 0, max: 100 })),
        F('learn', 'Здатність навчатися (0–100)', 'Learning (0–100)', 'num', X(R, { min: 0, max: 100 })), F('adaptSpeed', 'Швидкість адаптації (0–100)', 'Adaptation speed (0–100)', 'num', X(REC, { min: 0, max: 100 })),
        F('memory', 'Глибина памʼяті, дій', 'Memory depth, actions', 'num', X(REC, { min: 0, max: 50, h: T('Короткочасна памʼять: 3–5 останніх дій гравця.', 'Short-term memory: the player\'s last 3–5 actions.') })),
        F('aggr', 'Агресивність (0–100)', 'Aggression (0–100)', 'num', X(REC, { min: 0, max: 100 })), F('caution', 'Обережність (0–100)', 'Caution (0–100)', 'num', X(REC, { min: 0, max: 100 })),
        F('patterns', 'Що помічає', 'Patterns it tracks', 'multi', X(REC, { o: O([['dodgeDir', 'Напрямок ухилень', 'Dodge direction'], ['block', 'Частоту блоків', 'Block rate'], ['retreat', 'Відступи', 'Retreats'], ['attack', 'Частоту атак', 'Attack rate'], ['combos', 'Повтор комбінацій', 'Repeated combos'], ['reactions', 'Реакції на типи атак', 'Reactions to attack types']]) })),
        F('counters', 'Як відповідає', 'How it counters', 'long', REC)],
      rows: [
        { _id: 'E1', archetype: 'Зомбі', intel: 5, learn: 0, adaptSpeed: 0, memory: 0, aggr: 80, caution: 0, patterns: [], counters: 'Не адаптується' },
        { _id: 'E2', archetype: 'Гоблін', intel: 35, learn: 25, adaptSpeed: 30, memory: 3, aggr: 70, caution: 30, patterns: ['dodgeDir', 'retreat'], counters: 'Частіше випад, якщо гравець відступає' },
        { _id: 'E3', archetype: 'Найманець', intel: 75, learn: 70, adaptSpeed: 60, memory: 5, aggr: 55, caution: 60, patterns: ['dodgeDir', 'block', 'retreat', 'combos'], counters: 'Рубка, що перекриває улюблений бік ухилення; важкі атаки й обхід проти блоку' }] },
    { id: 'collision', title: T('Колізії тіл', 'Body collision'), kind: 'fields',
      hint: T('Як персонажі штовхаються й не проходять одне крізь одного, зокрема під час випадів.', 'How characters push each other and never overlap, including during lunges.'),
      fields: [F('radius', 'Радіус капсули, м', 'Capsule radius, m', 'num', X(R, { min: 0, max: 3 })), F('push', 'Відштовхування', 'Push-back', 'sel', X(R, { o: O([['soft', 'Мʼяке', 'Soft'], ['hard', 'Жорстке', 'Hard'], ['none', 'Немає', 'None']]) })),
        F('overlap', 'Допустимий перетин, м', 'Allowed overlap, m', 'num', X(REC, { min: 0, max: 1 })), F('duringAttack', 'Під час атаки', 'During an attack', 'text', REC),
        F('limits', 'Обмеження переміщення', 'Movement limits', 'text', { req: 'opt' })],
      values: { radius: 0.35, push: 'soft', overlap: 0.05, duringAttack: 'Випад зупиняється на капсулі цілі' } },
    { id: 'debugger', title: T('Combat Debugger', 'Combat debugger'), kind: 'fields',
      hint: T('Що показує налагоджувальний оверлей у грі — щоб бачити, чому удар не влучив або AI не атакував.', 'What the in-game debug overlay shows — to see why a hit missed or the AI did not attack.'),
      fields: [F('phase', 'Поточна фаза атаки', 'Current attack phase', 'bool', REC), F('distance', 'Поточна й бажана дистанція', 'Current and preferred distance', 'bool', REC),
        F('combo', 'Активна комбінація й рух', 'Active combination and movement', 'bool', REC), F('path', 'Траєкторія зброї', 'Weapon path', 'bool', REC),
        F('volumes', 'Активні зони ураження', 'Active hit volumes', 'bool', REC), F('miss', 'Причина промаху', 'Miss reason', 'bool', REC), F('refuse', 'Причина відмови від атаки', 'Reason an attack was skipped', 'bool', REC),
        F('key', 'Як увімкнути', 'How to toggle', 'text', { req: 'opt' })],
      values: { phase: true, distance: true, combo: true, path: true, volumes: true, miss: true, refuse: true, key: 'F3 у dev-збірці' } },
    { id: 'analytics', title: T('Бойова аналітика', 'Combat analytics'), kind: 'table', rowLabel: 'metric', prefix: 'N',
      hint: T('Метрики для балансу. Через телеметрію гри вони потрапляють у «Досвід гравців».', 'Balancing metrics. Through the game\'s telemetry they reach “Player experience”.'),
      fields: [F('metric', 'Метрика', 'Metric', 'text', R), F('on', 'Збирати', 'Collect', 'bool', R), F('target', 'Ціль', 'Target', 'text', REC), F('event', 'Подія телеметрії', 'Telemetry event', 'text', { req: 'opt', adv: true })],
      rows: [
        { _id: 'N1', metric: 'Відсоток влучань', on: true, target: '55–70%', event: 'combat_hit' }, { _id: 'N2', metric: 'Відсоток промахів', on: true, target: '< 30%', event: 'combat_miss' },
        { _id: 'N3', metric: 'Середня дистанція атаки', on: true, target: '≈ D_optimal' }, { _id: 'N4', metric: 'Невдалі зближення', on: true, target: '< 10%' },
        { _id: 'N5', metric: 'Частота переривань', on: true }, { _id: 'N6', metric: 'Найефективніші комбінації', on: true }, { _id: 'N7', metric: 'Найгірші комбінації', on: true },
        { _id: 'N8', metric: 'Частота використання атак', on: true }] },
  ],
};

// checks of UMCF beyond the generic ones (required / links / ranges)
function umcfChecks(m, add, rowsOf, nameOf) {
  var W = rowsOf('weapons'), A = rowsOf('attacks'), M = rowsOf('moves'), G = rowsOf('geometry'), C = rowsOf('combos');
  var byId = function (l, id) { return l.filter(function (r) { return r._id === id; })[0]; };
  W.forEach(function (w) {
    if (num(w.minDist) && num(w.prefDist) && +w.minDist > +w.prefDist) add('warn', 'weapons', w._id, 'Мінімальна дистанція більша за бажану.', 'Minimum distance is larger than the preferred one.');
    if (num(w.prefDist) && num(w.reach) && +w.prefDist > +w.reach + 0.01) add('warn', 'weapons', w._id, 'Бажана дистанція більша за ефективну дальність — без руху вперед удар не дістане.', 'Preferred distance exceeds the effective reach — without forward movement the strike falls short.');
  });
  A.forEach(function (a) {
    if (!String(a.anim || '').trim()) add('warn', 'attacks', a._id, 'Атака без анімації.', 'The attack has no animation.');
    var segs = G.filter(function (g) { return g.attack === a._id; });
    if (segs.length && !(+a.active > 0)) add('error', 'attacks', a._id, 'Є геометрія ураження, але немає активної фази (Active = 0).', 'It has hit geometry but no active phase (Active = 0).');
    if (+a.active > 0 && !segs.length) add('tip', 'geometry', '', 'Атака «' + nameOf(a) + '» без геометрії ураження — додай сегменти.', 'Attack “' + nameOf(a) + '” has no hit geometry — add segments.');
    segs.forEach(function (g) {
      var s0 = +a.startup || 0, s1 = s0 + (+a.active || 0);
      if (num(g.t0) && num(g.t1) && (+g.t0 < s0 - 1e-6 || +g.t1 > s1 + 1e-6)) add('warn', 'geometry', g._id, 'Сегмент поза фазою Active атаки (' + s0 + '–' + s1 + ' с).', 'The segment lies outside the attack\'s Active phase (' + s0 + '–' + s1 + ' s).');
    });
    if (num(a.k) && (+a.k < 0.5 || +a.k > 1)) add('warn', 'attacks', a._id, 'k поза звичним діапазоном 0.5–1.0.', 'k is outside the usual 0.5–1.0 range.');
    if ((+a.forward > 0.5 || a.kind === 'lunge') && !M.length) add('tip', 'moves', '', 'Атака «' + nameOf(a) + '» вимагає зближення — додай профіль руху.', 'Attack “' + nameOf(a) + '” needs an approach — add a movement profile.');
    var used = C.some(function (c) { return c.attack === a._id; });
    if (!used) add('tip', 'combos', '', 'Атака «' + nameOf(a) + '» не входить у жодну комбінацію — AI її не обере.', 'Attack “' + nameOf(a) + '” is in no combination — the AI never picks it.');
  });
  G.forEach(function (g) { if (num(g.t0) && num(g.t1) && +g.t0 >= +g.t1) add('error', 'geometry', g._id, 'Початок сегмента не раніше за кінець.', 'The segment starts no earlier than it ends.'); });
  C.forEach(function (c) {
    var w = byId(W, c.weapon), a = byId(A, c.attack), mv = byId(M, c.move);
    if (w && a) {
      var okW = (a.weapons || []).length ? a.weapons.indexOf(w._id) >= 0 : true, okA = (w.attacks || []).length ? w.attacks.indexOf(a._id) >= 0 : true;
      if (!okW || !okA) add('error', 'combos', c._id, 'Зброя «' + nameOf(w) + '» не має атаки «' + nameOf(a) + '» (див. «Доступні атаки» / «Сумісна зброя»).', 'Weapon “' + nameOf(w) + '” does not have attack “' + nameOf(a) + '” (see “Attack types” / “Weapon compatibility”).');
    }
    if (w && mv && (w.moves || []).length && w.moves.indexOf(mv._id) < 0) add('warn', 'combos', c._id, 'Рух «' + nameOf(mv) + '» не входить у рухи зброї «' + nameOf(w) + '».', 'Movement “' + nameOf(mv) + '” is not among weapon “' + nameOf(w) + '” profiles.');
    var r = range(c.dist); if (r && r[0] > r[1]) add('error', 'combos', c._id, 'Дистанція «від» більша за «до».', 'Distance “min” is larger than “max”.');
    if (w && a && r && num(w.reach)) {
      var full = +w.reach + (+a.forward || 0) + (mv ? +mv.distance || 0 : 0);
      if (r[0] > full + 0.01) add('warn', 'combos', c._id, 'Мінімальна дистанція комбінації (' + r[0] + ' м) більша за повну дальність атаки (' + full.toFixed(2) + ' м) — удар не дістане.', 'The combination\'s minimum distance (' + r[0] + ' m) exceeds the full attack distance (' + full.toFixed(2) + ' m) — the strike cannot land.');
    }
  });
}

// ============================== smaller templates ==============================
var DODGE = {
  id: 'dodge', version: 1, cat: 'combat', sub: 'evasion', complexity: 2, name: T('Dodge & Evasion System'),
  desc: T('Ухилення: дистанція, кадри невразливості, витривалість, вікна скасування, ідеальне ухилення.', 'Dodging: distance, invulnerability frames, stamina, cancel windows, the perfect dodge.'),
  purpose: T('Чесне й читабельне ухилення, що відповідає бойовій системі.', 'A fair, readable dodge matching the combat system.'),
  sections: [
    { id: 'base', title: T('Основне', 'Basics'), kind: 'fields', hint: T('Час — від натискання. i-frames мають лежати всередині тривалості ухилення.', 'Time is from the button press. I-frames must sit inside the dodge duration.'),
      fields: [F('distance', 'Дистанція, м', 'Distance, m', 'num', X(R, { min: 0, max: 10 })), F('duration', 'Тривалість, с', 'Duration, s', 'time', X(R, { min: 0, max: 2 })),
        F('iStart', 'i-frames: початок, с', 'I-frames start, s', 'time', R), F('iLen', 'i-frames: тривалість, с', 'I-frames length, s', 'time', R),
        F('stamina', 'Витривалість', 'Stamina cost', 'num', REC), F('cooldown', 'Перезарядка, с', 'Cooldown, s', 'time', REC),
        F('dirs', 'Напрямки', 'Directions', 'multi', X(REC, { o: O([['fwd', 'Уперед', 'Forward'], ['back', 'Назад', 'Back'], ['side', 'Убік', 'Sideways'], ['any', '8 напрямків', '8 directions']]) })),
        F('cancel', 'Вікна скасування', 'Cancel windows', 'text', REC), F('perfect', 'Ідеальне ухилення: вікно, с', 'Perfect dodge window, s', 'time', { req: 'opt', adv: true }),
        F('perfectReward', 'Нагорода за ідеальне', 'Perfect dodge reward', 'text', { req: 'opt', adv: true })],
      values: { distance: 3, duration: 0.45, iStart: 0.05, iLen: 0.25, stamina: 15, cooldown: 0.2, dirs: ['any'] } },
    { id: 'variants', title: T('Варіанти ухилень', 'Dodge variants'), kind: 'table', rowLabel: 'name', prefix: 'D',
      fields: [F('name', 'Назва', 'Name', 'text', R), F('direction', 'Напрямок', 'Direction', 'text', REC), F('distance', 'Дистанція, м', 'Distance, m', 'num', REC),
        F('duration', 'Тривалість, с', 'Duration, s', 'time', REC), F('iframes', 'i-frames (від–до), с', 'I-frames (from–to), s', 'range', REC), F('anim', 'Анімація', 'Animation', 'text', REC)],
      rows: [{ _id: 'D1', name: 'Перекат', direction: 'Будь-який', distance: 3, duration: 0.5, iframes: '0.05–0.3', anim: 'Roll' }, { _id: 'D2', name: 'Відскок', direction: 'Назад', distance: 1.5, duration: 0.3, iframes: '0.03–0.18', anim: 'Backstep' }] },
  ],
};
function dodgeChecks(m, add, rowsOf, nameOf, val) {
  var d = +val('base', 'duration'), s = +val('base', 'iStart'), l = +val('base', 'iLen');
  if (d > 0 && s + l > d + 1e-6) add('error', 'base', '', 'i-frames закінчуються після кінця ухилення.', 'I-frames end after the dodge ends.');
}
var BLOCK = {
  id: 'blockparry', version: 1, cat: 'combat', sub: 'defense', complexity: 2, name: T('Blocking & Parrying System'),
  desc: T('Блок, пробиття блоку, парирування з вікном і наслідками.', 'Blocking, guard break, parrying with a window and consequences.'),
  purpose: T('Захист, що винагороджує точність і має ціну.', 'Defence that rewards precision and has a cost.'),
  sections: [
    { id: 'block', title: T('Блок', 'Block'), kind: 'fields',
      fields: [F('angle', 'Кут блоку, °', 'Block angle, °', 'num', X(R, { min: 0, max: 360 })), F('stamina', 'Витривалість за удар', 'Stamina per hit', 'num', R),
        F('chip', 'Пробивна шкода, %', 'Chip damage, %', 'pct', REC), F('break', 'Поріг пробиття блоку', 'Guard break threshold', 'num', REC), F('stun', 'Оглушення після пробиття, с', 'Stun after a guard break, s', 'time', REC)],
      values: { angle: 120, stamina: 10, chip: 10, break: 0, stun: 1.2 } },
    { id: 'parry', title: T('Парирування', 'Parry'), kind: 'fields', hint: T('Вікно парирування довше 0.3 с робить його надто легким; коротше 0.08 с — майже неможливим.', 'A parry window longer than 0.3 s makes it too easy; shorter than 0.08 s — nearly impossible.'),
      fields: [F('window', 'Вікно парирування, с', 'Parry window, s', 'time', X(R, { min: 0, max: 1 })), F('stagger', 'Оглушення ворога, с', 'Enemy stagger, s', 'time', REC),
        F('riposte', 'Контратака (riposte)', 'Riposte', 'text', REC), F('fail', 'Якщо не вийшло', 'On a missed parry', 'text', REC), F('unparryable', 'Що не парирується', 'Unparryable attacks', 'text', { req: 'opt' })],
      values: { window: 0.15, stagger: 1.5 } },
  ],
};
function blockChecks(m, add, rowsOf, nameOf, val) {
  var w = +val('parry', 'window');
  if (w > 0.3) add('warn', 'parry', '', 'Вікно парирування довше 0.3 с — парирування надто легке.', 'The parry window is over 0.3 s — parrying is too easy.');
  if (w > 0 && w < 0.08) add('warn', 'parry', '', 'Вікно парирування коротше 0.08 с — майже неможливо.', 'The parry window is under 0.08 s — nearly impossible.');
}
var ATTRS = {
  id: 'attributes', version: 1, cat: 'stats', sub: 'attributes', complexity: 2, name: T('Attribute & Derived Stats System'),
  desc: T('Базові атрибути, їхні межі й формули похідних параметрів.', 'Base attributes, their limits and the formulas of derived stats.'),
  purpose: T('Один набір чисел, з якого виростають здоровʼя, шкода, швидкість.', 'One set of numbers from which health, damage and speed grow.'),
  sections: [
    { id: 'attrs', title: T('Атрибути', 'Attributes'), kind: 'table', rowLabel: 'name', prefix: 'S',
      fields: [F('name', 'Назва', 'Name', 'text', R), F('abbr', 'Скорочення', 'Abbreviation', 'text', R), F('min', 'Мін.', 'Min', 'num', REC), F('base', 'Старт', 'Base', 'num', R),
        F('max', 'Макс.', 'Max', 'num', REC), F('perLevel', 'За рівень', 'Per level', 'num', REC), F('affects', 'На що впливає', 'Affects', 'text', REC)],
      rows: [{ _id: 'S1', name: 'Сила', abbr: 'STR', min: 1, base: 10, max: 99, perLevel: 1, affects: 'Шкода ближнього бою, вага' }, { _id: 'S2', name: 'Спритність', abbr: 'DEX', min: 1, base: 10, max: 99, perLevel: 1, affects: 'Швидкість атак, ухилення' },
        { _id: 'S3', name: 'Витривалість', abbr: 'END', min: 1, base: 10, max: 99, perLevel: 1, affects: 'Здоровʼя, витривалість' }, { _id: 'S4', name: 'Інтелект', abbr: 'INT', min: 1, base: 10, max: 99, perLevel: 1, affects: 'Магія, мана' },
        { _id: 'S5', name: 'Мудрість', abbr: 'WIS', min: 1, base: 10, max: 99, perLevel: 1, affects: 'Опір ефектам' }, { _id: 'S6', name: 'Удача', abbr: 'LCK', min: 1, base: 5, max: 50, perLevel: 0, affects: 'Крит, лут' }] },
    { id: 'derived', title: T('Похідні параметри', 'Derived stats'), kind: 'table', rowLabel: 'name', prefix: 'V',
      fields: [F('name', 'Параметр', 'Stat', 'text', R), F('formula', 'Формула', 'Formula', 'formula', R), F('min', 'Мін.', 'Min', 'num', REC), F('max', 'Макс.', 'Max', 'num', REC), F('unit', 'Одиниця', 'Unit', 'text', { req: 'opt' })],
      rows: [{ _id: 'V1', name: 'Здоровʼя', formula: '100 + END × 10', min: 1 }, { _id: 'V2', name: 'Витривалість', formula: '50 + END × 5', min: 1 }, { _id: 'V3', name: 'Мана', formula: '20 + INT × 8', min: 0 },
        { _id: 'V4', name: 'Шанс крита', formula: '0.05 + LCK × 0.005', min: 0, max: 0.6, unit: '%' }] },
    { id: 'rules', title: T('Правила', 'Rules'), kind: 'fields',
      fields: [F('softcap', 'Мʼякі межі (soft caps)', 'Soft caps', 'formula', REC), F('respec', 'Перерозподіл очок', 'Respec', 'text', REC), F('display', 'Як гравець бачить числа', 'How the player sees the numbers', 'text', { req: 'opt' })] },
  ],
};
function attrChecks(m, add, rowsOf) {
  rowsOf('attrs').forEach(function (a) {
    if (num(a.min) && num(a.max) && +a.min > +a.max) add('error', 'attrs', a._id, 'Мінімум більший за максимум.', 'Min is larger than max.');
    if (num(a.base) && num(a.max) && +a.base > +a.max) add('warn', 'attrs', a._id, 'Стартове значення більше за максимум.', 'The base value exceeds the max.');
  });
}
var LEVELS = {
  id: 'leveling', version: 1, cat: 'progression', sub: 'levels', complexity: 2, name: T('Character Leveling System'),
  desc: T('Рівні, крива досвіду, очки за рівень і віхи розблокувань.', 'Levels, the XP curve, points per level and unlock milestones.'),
  purpose: T('Відчутний ріст без «стіни» гринду.', 'Felt growth without a grind wall.'),
  sections: [
    { id: 'curve', title: T('Крива досвіду', 'XP curve'), kind: 'fields', hint: T('Формула — досвід, потрібний для наступного рівня (L — поточний рівень).', 'The formula is the XP needed for the next level (L — the current level).'),
      fields: [F('maxLevel', 'Макс. рівень', 'Max level', 'num', X(R, { min: 1, max: 1000 })), F('xpFormula', 'Досвід до наступного рівня', 'XP to next level', 'formula', R),
        F('attrPoints', 'Очки атрибутів за рівень', 'Attribute points per level', 'num', REC), F('skillPoints', 'Очки навичок за рівень', 'Skill points per level', 'num', REC),
        F('sources', 'Джерела досвіду', 'XP sources', 'text', REC), F('deathPenalty', 'Втрата досвіду при смерті', 'XP lost on death', 'text', { req: 'opt' })],
      values: { maxLevel: 50, xpFormula: '100 × L^1.5', attrPoints: 3, skillPoints: 1 } },
    { id: 'milestones', title: T('Віхи', 'Milestones'), kind: 'table', rowLabel: 'level', prefix: 'L',
      fields: [F('level', 'Рівень', 'Level', 'num', R), F('unlock', 'Що відкривається', 'Unlocks', 'text', R), F('reward', 'Нагорода', 'Reward', 'text', REC)],
      rows: [{ _id: 'L1', level: 5, unlock: 'Друга зброя', reward: '' }, { _id: 'L2', level: 10, unlock: 'Перше дерево перків', reward: '' }] },
  ],
};
function levelChecks(m, add, rowsOf, nameOf, val) {
  var mx = +val('curve', 'maxLevel');
  rowsOf('milestones').forEach(function (r) { if (mx && +r.level > mx) add('warn', 'milestones', r._id, 'Віха вище за максимальний рівень.', 'The milestone is above the max level.'); });
}
var STATUS = {
  id: 'status', version: 1, cat: 'status', sub: 'effects', complexity: 2, name: T('Status Effects System'),
  desc: T('Отруєння, кровотеча, горіння, замороження, оглушення й бафи: тривалість, тік, стаки, опір.', 'Poison, bleeding, burning, freezing, stun and buffs: duration, ticks, stacks, resistance.'),
  purpose: T('Передбачувані ефекти, які гравець бачить і може контрити.', 'Predictable effects the player sees and can counter.'),
  sections: [
    { id: 'effects', title: T('Ефекти', 'Effects'), kind: 'table', rowLabel: 'name', prefix: 'X',
      fields: [F('name', 'Ефект', 'Effect', 'text', R), F('kind', 'Тип', 'Kind', 'sel', X(R, { o: O([['debuff', 'Негативний', 'Debuff'], ['buff', 'Позитивний', 'Buff'], ['control', 'Контроль', 'Crowd control']]) })),
        F('duration', 'Тривалість, с', 'Duration, s', 'time', R), F('tick', 'Тік, с', 'Tick, s', 'time', REC), F('value', 'Значення за тік', 'Value per tick', 'num', REC),
        F('stacks', 'Макс. стаків', 'Max stacks', 'num', REC), F('stackRule', 'Стакання', 'Stacking', 'sel', X(REC, { o: O([['refresh', 'Оновлює тривалість', 'Refreshes duration'], ['add', 'Додає силу', 'Adds strength'], ['independent', 'Незалежні копії', 'Independent copies']]) })),
        F('resist', 'Опір (атрибут)', 'Resisted by', 'text', REC), F('cleanse', 'Як зняти', 'Cleansed by', 'text', REC), F('vfx', 'Візуальний сигнал', 'Visual cue', 'text', REC)],
      rows: [{ _id: 'X1', name: 'Отруєння', kind: 'debuff', duration: 8, tick: 1, value: 4, stacks: 3, stackRule: 'add', resist: 'END', cleanse: 'Протиотрута', vfx: 'Зелені бульбашки' },
        { _id: 'X2', name: 'Кровотеча', kind: 'debuff', duration: 6, tick: 0.5, value: 3, stacks: 5, stackRule: 'add', resist: 'END', cleanse: 'Бинт', vfx: 'Червоні краплі' },
        { _id: 'X3', name: 'Горіння', kind: 'debuff', duration: 4, tick: 0.5, value: 6, stacks: 1, stackRule: 'refresh', resist: 'WIS', cleanse: 'Вода, перекат', vfx: 'Полумʼя' },
        { _id: 'X4', name: 'Замороження', kind: 'control', duration: 2, stacks: 1, stackRule: 'refresh', resist: 'WIS', cleanse: 'Вогонь', vfx: 'Лід на моделі' },
        { _id: 'X5', name: 'Оглушення', kind: 'control', duration: 1.5, stacks: 1, stackRule: 'refresh', resist: 'END', vfx: 'Зірки над головою' }] },
    { id: 'rules', title: T('Правила', 'Rules'), kind: 'fields',
      fields: [F('maxActive', 'Макс. ефектів одночасно', 'Max active effects', 'num', REC), F('diminish', 'Спадна дія контролю', 'Diminishing returns on control', 'text', REC), F('immunity', 'Імунітети', 'Immunities', 'text', { req: 'opt' })] },
  ],
};
function statusChecks(m, add, rowsOf) {
  rowsOf('effects').forEach(function (e) { if (num(e.tick) && num(e.duration) && +e.tick > +e.duration) add('warn', 'effects', e._id, 'Тік довший за тривалість — ефект не спрацює жодного разу.', 'The tick is longer than the duration — the effect never ticks.'); });
}
var INVENTORY = {
  id: 'inventory', version: 1, cat: 'gear', sub: 'inventory', complexity: 1, name: T('Inventory System'),
  desc: T('Структура інвентарю, вага, стакання, категорії предметів і слоти спорядження.', 'Inventory layout, weight, stacking, item categories and equipment slots.'),
  purpose: T('Зрозумілий інвентар без зайвого менеджменту.', 'A clear inventory without needless micromanagement.'),
  sections: [
    { id: 'layout', title: T('Структура', 'Layout'), kind: 'fields',
      fields: [F('kind', 'Тип', 'Type', 'sel', X(R, { o: O([['grid', 'Сітка (за розміром)', 'Grid (by size)'], ['slots', 'Слоти', 'Slots'], ['list', 'Список', 'List']]) })), F('slots', 'Кількість слотів', 'Slots', 'num', REC),
        F('maxWeight', 'Макс. вага, кг', 'Max weight, kg', 'num', REC), F('overweight', 'Перевантаження', 'Overweight', 'text', REC), F('storage', 'Сховище / скриня', 'Storage / stash', 'text', { req: 'opt' })],
      values: { kind: 'slots', slots: 30, maxWeight: 60 } },
    { id: 'cats', title: T('Категорії предметів', 'Item categories'), kind: 'table', rowLabel: 'name', prefix: 'I',
      fields: [F('name', 'Категорія', 'Category', 'text', R), F('stack', 'Стакається', 'Stackable', 'bool', R), F('maxStack', 'Макс. у стаку', 'Max per stack', 'num', REC), F('slot', 'Слот спорядження', 'Equipment slot', 'text', REC)],
      rows: [{ _id: 'I1', name: 'Зброя', stack: false, slot: 'Рука' }, { _id: 'I2', name: 'Броня', stack: false, slot: 'Тіло' }, { _id: 'I3', name: 'Зілля', stack: true, maxStack: 10 }, { _id: 'I4', name: 'Ресурси', stack: true, maxStack: 99 }] },
  ],
};
var ENEMY_AI = {
  id: 'enemyai', version: 1, cat: 'ai', sub: 'behavior', complexity: 2, name: T('Enemy Behavior System'),
  desc: T('Архетипи ворогів: виявлення, агресія, втеча, роль у групі, складність.', 'Enemy archetypes: detection, aggression, fleeing, group role, difficulty.'),
  purpose: T('Різні вороги поводяться по-різному й читаються гравцем.', 'Different enemies behave differently and read clearly to the player.'),
  sections: [
    { id: 'archetypes', title: T('Архетипи', 'Archetypes'), kind: 'table', rowLabel: 'name', prefix: 'B',
      fields: [F('name', 'Архетип', 'Archetype', 'text', R), F('sight', 'Зір, м', 'Sight, m', 'num', R), F('fov', 'Кут огляду, °', 'Field of view, °', 'num', REC), F('hearing', 'Слух, м', 'Hearing, m', 'num', REC),
        F('aggr', 'Агресія (0–100)', 'Aggression (0–100)', 'num', REC), F('flee', 'Тікає при здоровʼї, %', 'Flees at health, %', 'pct', REC),
        F('role', 'Роль у групі', 'Group role', 'sel', X(REC, { o: O([['tank', 'Танк', 'Tank'], ['flank', 'Обхід', 'Flanker'], ['ranged', 'Стрілець', 'Ranged'], ['support', 'Підтримка', 'Support'], ['solo', 'Одинак', 'Loner']]) })),
        F('leash', 'Повідок, м', 'Leash, m', 'num', { req: 'opt', adv: true })],
      rows: [{ _id: 'B1', name: 'Гоблін', sight: 12, fov: 110, hearing: 8, aggr: 70, flee: 20, role: 'flank', leash: 25 }, { _id: 'B2', name: 'Орк-вартовий', sight: 15, fov: 90, hearing: 10, aggr: 60, flee: 0, role: 'tank', leash: 30 }] },
    { id: 'rules', title: T('Правила', 'Rules'), kind: 'fields',
      fields: [F('aggro', 'Як ворог помічає гравця', 'How enemies notice the player', 'long', R), F('group', 'Групова поведінка', 'Group behaviour', 'long', REC), F('difficulty', 'Масштаб складності', 'Difficulty scaling', 'text', REC),
        F('tokens', 'Скільки ворогів атакує одночасно', 'How many attack at once', 'num', REC)] },
  ],
};

// What RPG Framework (D:\RPG-Framework, ActionCombat, audited at 0.36.0, parry / attack stamina / motion warping from 0.38.0) already has for each UMCF part — shown on the section,
// so the author knows what the agent maps onto existing assets and what it must build. Times in the framework are seconds, distances metres.
var FRAMEWORK = { version: '0.38.0', umcf: {
  overview: ['partial', 'ActionCombat: Combatant, CombatRules, EnemyDirector. Захоплення цілі й частота перевірок — налаштування гри.', 'ActionCombat: Combatant, CombatRules, EnemyDirector. Lock-on and the update rate are game settings.'],
  weapons: ['partial', 'WeaponMoveSet (_weaponKind, _moves) і атаки Combatant._attacks. Довжини, ваги, бажаної дистанції немає — додати.', 'WeaponMoveSet (_weaponKind, _moves) and Combatant._attacks. No length, weight or preferred distance — to add.'],
  attacks: ['exists', 'AttackAsset: _windUp / _active / _recovery (с), _damageMultiplier (× заряд × частка влучання), _interruptible, _blockCost, _motions, _sweep, StaminaCost (з 0.38.0 — платиться на старті атаки чи заряду з CombatRules.AttackStock; не вистачає — атака не починається, політику задає сток гри), Parryable, Warp; заряджені атаки, рівні влучання й оглушення; CombatProjectiles (стріли без фізики, Lead, Landing/Contact). Базова шкода + масштабування UMCF — у реалізації ICombatDamage гри (у кіті — ActorWorldDamage від статів). Дальності й canCombo немає.', 'AttackAsset: _windUp / _active / _recovery (s), _damageMultiplier (× charge × hit share), _interruptible, _blockCost, _motions, _sweep, StaminaCost (since 0.38.0 — paid when an attack or charge starts, from CombatRules.AttackStock; an attacker that cannot pay is refused, the policy lives in the game’s stock), Parryable, Warp; charged attacks, hit tiers and stagger; CombatProjectiles (arrows without physics, Lead, Landing/Contact). UMCF base damage + scaling live in the game’s ICombatDamage implementation (in the kit, ActorWorldDamage from stats). No reach or canCombo.'],
  phases: ['partial', 'CombatState / AttackPhase: WindUp, Active, Recovery. Зближення й зміна позиції — стани ворога (Approach, Circle, BackOff), не фази атаки.', 'CombatState / AttackPhase: WindUp, Active, Recovery. Approach and reposition are enemy states (Approach, Circle, BackOff), not attack phases.'],
  moves: ['partial', 'AttackMotion: Approach, Retreat, StrafeLeft, StrafeRight, Leap (Distance, Height, From/Until). Іменованих профілів і кута корекції немає.', 'AttackMotion: Approach, Retreat, StrafeLeft, StrafeRight, Leap (Distance, Height, From/Until). No named profiles or correction angle.'],
  geometry: ['partial', 'SweepSegment: From/Until (частка Active), ArcFrom/ArcTo (°), InnerRadius/Radius (м), HeightMin/HeightMax — дуги, не позиції зброї; перевіряються на кожному тіку, без CCD.', 'SweepSegment: From/Until (share of Active), ArcFrom/ArcTo (°), InnerRadius/Radius (m), HeightMin/HeightMax — arcs, not weapon positions; sampled every tick, no CCD.'],
  combos: ['partial', 'EnemyMove: Attack, MinRange/MaxRange, Weight, Cooldown, Next (звʼязка комбо), CommitShare. Немає кута, пріоритету (лише вага) й умов.', 'EnemyMove: Attack, MinRange/MaxRange, Weight, Cooldown, Next (combo link), CommitShare. No angle, priority (weight only) or conditions.'],
  distance: ['partial', 'EnemyMove.CommitRange = max(MinRange, MaxRange × CommitShare) — це k. Формули D_weapon + D_lunge + D_body, толерантностей і прогнозу цілі немає.', 'EnemyMove.CommitRange = max(MinRange, MaxRange × CommitShare) — that is k. No D_weapon + D_lunge + D_body formula, tolerances or target prediction.'],
  feasibility: ['partial', 'EnemyDirector.Choose перевіряє лише дистанцію й перезарядку (+ AttackTokens); є повідець (leash) і темп атак (AnimationPaceOf). Кута, перешкод і висоти перед атакою немає.', 'EnemyDirector.Choose checks only distance and cooldown (+ AttackTokens); it has a leash and attack pace (AnimationPaceOf). No angle, obstacle or height check before attacking.'],
  commitment: ['partial', 'Жорсткі правила CombatRules: ухилення скасовує Charging/Recovery, не WindUp/Active; Interruptible=false — суперброня.', 'Fixed CombatRules: a dodge cancels Charging/Recovery, not WindUp/Active; Interruptible=false is hyper armour.'],
  warping: ['exists', 'З 0.38.0: AttackDefinition.Warp = AttackWarp — Phase (WindUp / Active / Recovery), From / Until (частка фази), MaxDistance (м; 0 — лише поворот), MaxAngle (° до 180; 0 — лише підтяг), StopDistance (зазор до цілі; 0 — ContactDistance ворога). Вимкнути — MaxDistance = MaxAngle = 0. CombatRules.WarpOf → швидкість і поворот на кадр поверх MotionOf. Прогнозу цілі й окремих обмежень колізій немає.', 'Since 0.38.0: AttackDefinition.Warp = AttackWarp — Phase (WindUp / Active / Recovery), From / Until (share of the phase), MaxDistance (m; 0 = turn only), MaxAngle (° up to 180; 0 = pull only), StopDistance (gap to the target; 0 = the enemy’s ContactDistance). Off — MaxDistance = MaxAngle = 0. CombatRules.WarpOf → velocity and turn per frame on top of MotionOf. No target prediction or separate collision constraints.'],
  adaptation: ['missing', 'Немає: EnemyBehaviour має лише сталі шанси (BlockChance, DodgeChance…). Будувати.', 'Missing: EnemyBehaviour has only fixed chances (BlockChance, DodgeChance…). To build.'],
  collision: ['partial', 'EnemyBehaviour.PersonalSpace, ContactDistance; CharacterController.SimpleMove.', 'EnemyBehaviour.PersonalSpace, ContactDistance; CharacterController.SimpleMove.'],
  debugger: ['partial', 'CombatTimeline: фази, контакти, відмови з причиною, рішення ворога; гізмо свипу в Hitbox. Вікна редактора немає.', 'CombatTimeline: phases, contacts, refusals with a reason, enemy decisions; the sweep gizmo in Hitbox. No editor window.'],
  analytics: ['missing', 'Немає — лише події (AttackChosenEvent, ContactResolvedEvent). Підключити до телеметрії гри.', 'Missing — only events (AttackChosenEvent, ContactResolvedEvent). Wire them to the game telemetry.'] },
  dodge: { base: ['exists', 'CombatantSettings: DodgeSeconds, InvulnerableFrom / InvulnerableUntil.', 'CombatantSettings: DodgeSeconds, InvulnerableFrom / InvulnerableUntil.'] },
  blockparry: { block: ['exists', 'CombatantSettings: BlockAngle, BlockDamageMultiplier (частина шкоди проходить крізь блок); заблокований удар списує AttackDefinition.BlockCost з CombatRules.BlockStock (запас захисника, як витривалість) — пробиття блоку.', 'CombatantSettings: BlockAngle, BlockDamageMultiplier (chip damage gets through); a blocked hit spends AttackDefinition.BlockCost from CombatRules.BlockStock (the defender’s stamina-like stock) — guard break.'], parry: ['exists', 'З 0.38.0, на захиснику (CombatantSettings): ParryWindow (вікно, с), ParryRecovery (після вікна — невдале парирування), ParryStunSeconds (оглушення ворога), ParryCost (частка BlockCost з запасу блоку), ParryFailDamageMultiplier, ParryOnBlockRaise (ідеальний блок); дія CombatRules.Parry, подія ParriedEvent; на атаці — AttackDefinition.Parryable; лише спереду, в конусі BlockAngle. Контратака — логіка гри. Вороги поки не парирують (KI-24).', 'Since 0.38.0, on the defender (CombatantSettings): ParryWindow (s), ParryRecovery (after the window — a failed parry), ParryStunSeconds (the attacker stays opened), ParryCost (share of BlockCost from the block stock), ParryFailDamageMultiplier, ParryOnBlockRaise (perfect block); action CombatRules.Parry, ParriedEvent; on the attack — AttackDefinition.Parryable; front only, within BlockAngle. The riposte is game logic. Enemies do not parry yet (KI-24).'] },
  attributes: { attrs: ['exists', 'Stats: StatContainer, StatModifier; CharacterDefinition.', 'Stats: StatContainer, StatModifier; CharacterDefinition.'] },
  leveling: { curve: ['exists', 'Progression: LevelTable, ExperienceData, StatGrowthData.', 'Progression: LevelTable, ExperienceData, StatGrowthData.'] },
  status: { effects: ['exists', 'StatusEffectData / StatusEffectAsset: Duration, IsStackable, MaxStacks, TickInterval, Modifiers.', 'StatusEffectData / StatusEffectAsset: Duration, IsStackable, MaxStacks, TickInterval, Modifiers.'] },
  inventory: { layout: ['exists', 'InventoryContainer, EquipmentSlot, ItemStack; ItemAsset.maxStackSize.', 'InventoryContainer, EquipmentSlot, ItemStack; ItemAsset.maxStackSize.'] },
  enemyai: { archetypes: ['partial', 'EnemyBehaviour / EnemyBehaviourAsset (ViewAngle, MemorySeconds, BackOffHealthShare), AttackTokens.MaxPerTarget.', 'EnemyBehaviour / EnemyBehaviourAsset (ViewAngle, MemorySeconds, BackOffHealthShare), AttackTokens.MaxPerTarget.'] } };
function frameworkNote(tplId, secId) { var t = FRAMEWORK[tplId]; return t && t[secId] ? { status: t[secId][0], uk: t[secId][1], en: t[secId][2] } : null; }

// ============================== Фабрика звуку (the Sound & music section) ==============================
// The same constructor, other templates: cards of the game section "audio" with `mech`; their categories are the section's groups.
// Sources: game-music practice (vertical layering, horizontal re-sequencing, leitmotifs, seamless loops, LUFS, ducking) and the
// owner's report «Музика для RPG/roguelike» (prompt format, scene presets, the composer's checklist).
var AUDIO_CATEGORIES = [
  { id: 'music', uk: 'Музика', en: 'Music', subs: [['adaptive', 'Адаптивна музика', 'Adaptive music'], ['themes', 'Теми й лейтмотиви', 'Themes & leitmotifs'], ['prompts', 'Промпти для генераторів', 'Generator prompts']] },
  { id: 'sfx', uk: 'Звукові ефекти', en: 'Sound effects', subs: [['combat', 'Бій', 'Combat'], ['world', 'Світ і предмети', 'World & items'], ['events', 'Ігрові події', 'Game events']] },
  { id: 'voice', uk: 'Озвучка', en: 'Voice', subs: [['dialogue', 'Діалоги', 'Dialogue'], ['barks', 'Вигуки (barks)', 'Barks']] },
  { id: 'ambience', uk: 'Амбієнт', en: 'Ambience', subs: [['biome', 'Біоми й локації', 'Biomes & locations'], ['weather', 'Погода й час доби', 'Weather & time of day']] },
  { id: 'uisound', uk: 'Звуки UI', en: 'UI sounds', subs: [['menu', 'Меню', 'Menus'], ['hud', 'HUD і сповіщення', 'HUD & notifications']] },
];
var SITUATIONS = O([['explore', 'Дослідження', 'Exploration'], ['tension', 'Напруга', 'Tension'], ['stealth', 'Скрадання', 'Stealth'], ['combat', 'Бій', 'Combat'],
  ['boss', 'Бій з босом', 'Boss fight'], ['victory', 'Перемога', 'Victory'], ['defeat', 'Поразка / смерть', 'Defeat / death'], ['town', 'Місто / поселення', 'Town / settlement'],
  ['tavern', 'Таверна', 'Tavern'], ['dungeon', 'Підземелля', 'Dungeon'], ['dialogue', 'Діалог', 'Dialogue'], ['lyrical', 'Тиха / лірична сцена', 'Quiet / lyrical scene'],
  ['cutscene', 'Катсцена', 'Cutscene'], ['menu', 'Меню', 'Menu'], ['other', 'Інше', 'Other']]);
var MOODS = O([['epic', 'Епічний', 'Epic'], ['heroic', 'Героїчний', 'Heroic'], ['triumph', 'Тріумфальний', 'Triumphant'], ['tense', 'Напружений', 'Tense'], ['dark', 'Темний / зловісний', 'Dark / ominous'],
  ['mystic', 'Таємничий', 'Mysterious'], ['sad', 'Сумний', 'Sad'], ['calm', 'Спокійний', 'Calm'], ['cheerful', 'Веселий', 'Cheerful'], ['dreamy', 'Мрійливий', 'Dreamy'], ['solemn', 'Урочистий', 'Solemn'], ['romantic', 'Романтичний', 'Romantic']]);
var TRIGGERS = O([['spotted', 'Ворог помітив гравця', 'Enemy spots the player'], ['lost', 'Ворог загубив гравця', 'Enemy loses the player'], ['combatStart', 'Початок бою', 'Combat starts'],
  ['combatEnd', 'Кінець бою', 'Combat ends'], ['boss', 'Зʼявився бос', 'Boss appears'], ['bossPhase', 'Нова фаза боса', 'Boss phase change'], ['hpLow', 'Мало здоровʼя', 'Low health'],
  ['zoneEnter', 'Вхід у зону', 'Zone entered'], ['zoneExit', 'Вихід із зони', 'Zone left'], ['dialogueStart', 'Початок діалогу', 'Dialogue starts'], ['dialogueEnd', 'Кінець діалогу', 'Dialogue ends'],
  ['menuOpen', 'Відкрито меню', 'Menu opened'], ['menuClose', 'Закрито меню', 'Menu closed'], ['death', 'Смерть гравця', 'Player death'], ['respawn', 'Відродження', 'Respawn'], ['victory', 'Перемога', 'Victory'],
  ['quest', 'Квест виконано', 'Quest completed'], ['custom', 'Своя подія', 'Custom event']]);
var TIMINGS = O([['now', 'Одразу', 'Immediately'], ['beat', 'На наступну долю', 'On the next beat'], ['bar', 'На наступний такт', 'On the next bar'],
  ['loopEnd', 'Наприкінці петлі', 'At the end of the loop'], ['stinger', 'Через стінгер', 'Through a stinger']]);
var CHECKLIST = O([['role', 'Роль кожної теми визначено', 'Each theme has a role'], ['palette', 'Стиль та інструменти підібрано', 'Style and instruments chosen'],
  ['motif', 'Є мотив / лейтмотив', 'A motif / leitmotif exists'], ['harmony', 'Лад відповідає настрою', 'The mode fits the mood'], ['loop', 'Петлі безшовні (8–16 тактів)', 'Loops are seamless (8–16 bars)'],
  ['layers', 'Шари додаються поступово', 'Layers build up gradually'], ['transitions', 'Переходи сплановано', 'Transitions are planned'], ['structure', 'Інтро → розвиток → кульмінація', 'Intro → development → climax'],
  ['adaptive', 'Адаптивні елементи визначено', 'Adaptive elements defined'], ['mix', 'Мікс не глушить ефекти й діалоги', 'The mix leaves room for SFX and dialogue'],
  ['tested', 'Перевірено в грі (A/B)', 'Tested in the game (A/B)'], ['docs', 'Маркери петель і шарів задокументовано', 'Loop and layer markers documented']]);

var MUSIC = {
  id: 'adaptive_music', sec: 'audio', version: 1, cat: 'music', sub: 'adaptive', complexity: 3, name: T('Адаптивна музика гри', 'Adaptive game music'),
  desc: T('Музичні стани гри (дослідження, напруга, бій, бос, перемога, місто, меню…), шари, що вмикаються з інтенсивністю, переходи між станами за ігровими подіями, лейтмотиви, мікс — і готовий промпт для генератора музики для кожного стану.',
    'The game\'s music states (exploration, tension, combat, boss, victory, town, menu…), layers that switch on with intensity, transitions between states on game events, leitmotifs, the mix — and a ready prompt for a music generator for every state.'),
  purpose: T('Музика сама міняється разом із грою: з дослідницької на бойову й назад — безшовно, без різких обривів, і щоразу підкреслює те, що зараз відчуває гравець.', 'The music changes with the game by itself: from exploration to combat and back — seamlessly, without hard cuts, always backing what the player feels right now.'),
  sections: [
    { id: 'palette', title: T('Звучання гри', 'The game\'s sound'), kind: 'fields', hint: T('Спільне для всіх станів: стан бере ці значення, якщо свої не задано.', 'Shared by all states: a state takes these when it has none of its own.'),
      fields: [F('style', 'Стиль / жанр', 'Style / genre', 'text', X(R, { h: T('напр. «оркестр + слов\'янський фольк», «чіптюн», «темний ембієнт»', 'e.g. “orchestra + Slavic folk”, “chiptune”, “dark ambient”') })),
        F('instruments', 'Палітра інструментів', 'Instrument palette', 'long', R), F('key', 'Основний лад / тональність', 'Main key / mode', 'text', X(REC, { h: T('мінор — напруга, мажор — підйом, модальний (дорійський, фригійський) — «не цей світ»', 'minor — tension, major — uplift, modal (Dorian, Phrygian) — “not of this world”') })),
        F('engine', 'Аудіорушій', 'Audio engine', 'sel', X(REC, { o: O([['unity', 'Unity Audio', 'Unity Audio'], ['fmod', 'FMOD', 'FMOD'], ['wwise', 'Wwise', 'Wwise'], ['other', 'Інший', 'Other']]) })),
        F('fade', 'Кросфейд за замовчуванням', 'Default crossfade', 'time', X(REC, { u: 's', min: 0, max: 10 })),
        F('reference', 'Референси (ігри, треки)', 'References (games, tracks)', 'long', { req: 'opt', adv: true })],
      values: { style: 'Епічний оркестр із фольк-інструментами', instruments: 'струнні, валторни, литаври, хор; флейта, арфа, скрипка-соло; для міст — лютня, акордеон', key: 'ре мінор / дорійський', engine: 'unity', fade: 2 } },
    { id: 'states', title: T('Музичні стани', 'Music states'), kind: 'table', rowLabel: 'name', prefix: 'S', prompt: true,
      hint: T('Стан — це музика для однієї ігрової ситуації. ♪ біля рядка копіює промпт для генератора музики. Темп: бій 120–150 BPM, дослідження 60–90.', 'A state is the music for one game situation. ♪ by a row copies a music-generator prompt. Tempo: combat 120–150 BPM, exploration 60–90.'),
      fields: [F('name', 'Назва', 'Name', 'text', R), F('situation', 'Ситуація', 'Situation', 'sel', X(R, { o: SITUATIONS })), F('mood', 'Настрій', 'Mood', 'multi', X(REC, { o: MOODS })),
        F('bpm', 'Темп', 'Tempo', 'num', X(R, { u: 'BPM', min: 40, max: 200 })), F('key', 'Лад', 'Key / mode', 'text', REC), F('style', 'Стиль (якщо інший)', 'Style (if different)', 'text', { req: 'opt', adv: true }),
        F('instruments', 'Інструменти', 'Instruments', 'long', REC), F('bars', 'Петля', 'Loop', 'num', X(REC, { u: 'тактів / bars', min: 2, max: 64 })), F('length', 'Тривалість', 'Length', 'time', X(REC, { u: 's', min: 5, max: 600 })),
        F('where', 'Де звучить', 'Where it plays', 'text', REC), F('notes', 'Примітки', 'Notes', 'text', { req: 'opt', adv: true })],
      rows: [
        { _id: 'S1', name: 'Дослідження', situation: 'explore', mood: ['calm', 'dreamy'], bpm: 90, key: 'ре дорійський', instruments: 'флейта, гобой, арфа (пульсуюче арпеджіо), мʼякий бас', bars: 16, length: 60, where: 'відкритий світ, ліс' },
        { _id: 'S2', name: 'Напруга', situation: 'tension', mood: ['tense', 'mystic'], bpm: 90, key: 'ре мінор', instruments: 'остинато віолончелей, низькі литаври, тремоло скрипок', bars: 8, length: 30, where: 'ворог поруч' },
        { _id: 'S3', name: 'Бій', situation: 'combat', mood: ['epic', 'tense'], bpm: 140, key: 'ре мінор', instruments: 'агресивні струнні, хор, литаври, маршові барабани, валторни', bars: 16, length: 60, where: 'звичайні бої' },
        { _id: 'S4', name: 'Бос', situation: 'boss', mood: ['dark', 'epic'], bpm: 150, key: 'ре фригійський', instruments: 'хор, величезні барабани, валторни з наполегливим мотивом, орган', bars: 32, length: 120, where: 'арени босів' },
        { _id: 'S5', name: 'Перемога', situation: 'victory', mood: ['triumph'], bpm: 100, key: 'ре мажор', instruments: 'фанфари валторн, хор, литаври', bars: 4, length: 8, where: 'після бою' },
        { _id: 'S6', name: 'Поразка', situation: 'defeat', mood: ['sad'], bpm: 60, key: 'ре мінор', instruments: 'соло віолончелі, фортепіано, тихі струнні', bars: 4, length: 10 },
        { _id: 'S7', name: 'Таверна', situation: 'tavern', mood: ['cheerful'], bpm: 110, key: 'соль міксолідійський', instruments: 'лютня, скрипка, акордеон, бубон', bars: 16, length: 45, where: 'таверни, свята' },
        { _id: 'S8', name: 'Підземелля', situation: 'dungeon', mood: ['mystic', 'dark'], bpm: 70, key: 'до мінор', instruments: 'низький бас-дрон, дзвоноподібні ефекти, шепіт хору', bars: 16, length: 60, where: 'печери, крипти' },
        { _id: 'S9', name: 'Розмова', situation: 'dialogue', mood: ['calm'], bpm: 70, key: 'фа мажор', instruments: 'повільні пади, легка арфа, без ударних', bars: 8, length: 30 },
        { _id: 'S10', name: 'Меню', situation: 'menu', mood: ['calm'], bpm: 70, key: 'ре мінор', instruments: 'фортепіано з реверберацією, мʼякі пади', bars: 8, length: 20 },
      ] },
    { id: 'layers', title: T('Шари (vertical layering)', 'Layers (vertical layering)'), kind: 'table', rowLabel: 'name', prefix: 'L',
      hint: T('Шари одного стану звучать разом і вмикаються з інтенсивністю: база завжди, далі — ударні, духові, хор. Так музика росте без зміни треку.', 'Layers of one state play together and switch on with intensity: the base always, then percussion, brass, choir. The music grows without changing the track.'),
      fields: [F('state', 'Стан', 'State', 'ref', X(R, { ref: 'states' })), F('name', 'Шар', 'Layer', 'text', R), F('instruments', 'Інструменти', 'Instruments', 'text', REC),
        F('when', 'Коли вмикається', 'Switches on when', 'text', X(R, { h: T('напр. «завжди», «інтенсивність ≥ 2», «ворогів ≥ 3», «здоровʼя < 30%»', 'e.g. “always”, “intensity ≥ 2”, “enemies ≥ 3”, “health < 30%”') })),
        F('level', 'Рівень інтенсивності', 'Intensity level', 'num', X(REC, { min: 0, max: 5 })), F('fadeIn', 'Поява', 'Fade in', 'time', X(REC, { u: 's', min: 0, max: 10 })), F('db', 'Гучність', 'Volume', 'num', X({ req: 'opt', adv: true }, { u: 'dB', min: -40, max: 6 }))],
      rows: [
        { _id: 'L1', state: 'S1', name: 'База', instruments: 'флейта, арфа, бас', when: 'завжди', level: 0, fadeIn: 2 },
        { _id: 'L2', state: 'S1', name: 'Рух', instruments: 'легка перкусія', when: 'гравець біжить', level: 1, fadeIn: 1.5 },
        { _id: 'L3', state: 'S3', name: 'База', instruments: 'струнні остинато', when: 'завжди', level: 0, fadeIn: 0.5 },
        { _id: 'L4', state: 'S3', name: 'Ударні', instruments: 'литаври, барабани', when: 'інтенсивність ≥ 1', level: 1, fadeIn: 0.5 },
        { _id: 'L5', state: 'S3', name: 'Кульмінація', instruments: 'валторни, хор', when: 'ворогів ≥ 3 або здоровʼя < 30%', level: 2, fadeIn: 1 },
      ] },
    { id: 'transitions', title: T('Переходи (horizontal re-sequencing)', 'Transitions (horizontal re-sequencing)'), kind: 'table', rowLabel: 'trigger', prefix: 'T',
      hint: T('Перехід — коли й як музика переходить з одного стану в інший. «На такт» і «наприкінці петлі» звучать непомітно; «одразу» — лише зі стінгером або кросфейдом. «Затримка» не дає музиці смикатися туди-сюди.',
        'A transition is when and how the music moves between states. “On the bar” and “at the end of the loop” sound seamless; “immediately” only with a stinger or a crossfade. “Hold” keeps the music from flip-flopping.'),
      fields: [F('from', 'Звідки', 'From', 'ref', X(R, { ref: 'states' })), F('to', 'Куди', 'To', 'ref', X(R, { ref: 'states' })), F('trigger', 'Подія', 'Event', 'sel', X(R, { o: TRIGGERS })),
        F('timing', 'Коли перемкнути', 'When to switch', 'sel', X(R, { o: TIMINGS })), F('fade', 'Кросфейд', 'Crossfade', 'time', X(REC, { u: 's', min: 0, max: 10 })),
        F('stinger', 'Стінгер', 'Stinger', 'text', REC), F('hold', 'Затримка перед поверненням', 'Hold before returning', 'time', X({ req: 'opt', adv: true }, { u: 's', min: 0, max: 30 }))],
      rows: [
        { _id: 'T1', from: 'S1', to: 'S2', trigger: 'spotted', timing: 'bar', fade: 1.5 },
        { _id: 'T2', from: 'S2', to: 'S3', trigger: 'combatStart', timing: 'beat', fade: 0.5, stinger: 'удар литаври + хоровий вигук' },
        { _id: 'T3', from: 'S2', to: 'S1', trigger: 'lost', timing: 'loopEnd', fade: 3, hold: 4 },
        { _id: 'T4', from: 'S3', to: 'S5', trigger: 'victory', timing: 'stinger', fade: 0.3, stinger: 'фанфара перемоги' },
        { _id: 'T5', from: 'S5', to: 'S1', trigger: 'combatEnd', timing: 'loopEnd', fade: 2, hold: 5 },
        { _id: 'T6', from: 'S3', to: 'S6', trigger: 'death', timing: 'now', fade: 1 },
        { _id: 'T7', from: 'S1', to: 'S4', trigger: 'boss', timing: 'stinger', fade: 0.5, stinger: 'наростання хору' },
        { _id: 'T8', from: 'S4', to: 'S5', trigger: 'victory', timing: 'stinger', fade: 0.3, stinger: 'фанфара перемоги' },
        { _id: 'T9', from: 'S1', to: 'S7', trigger: 'zoneEnter', timing: 'bar', fade: 3 },
        { _id: 'T10', from: 'S7', to: 'S1', trigger: 'zoneExit', timing: 'bar', fade: 3 },
        { _id: 'T11', from: 'S1', to: 'S8', trigger: 'zoneEnter', timing: 'bar', fade: 3 },
        { _id: 'T12', from: 'S8', to: 'S1', trigger: 'zoneExit', timing: 'bar', fade: 3 },
        { _id: 'T13', from: 'S1', to: 'S9', trigger: 'dialogueStart', timing: 'bar', fade: 2 },
        { _id: 'T14', from: 'S9', to: 'S1', trigger: 'dialogueEnd', timing: 'bar', fade: 2 },
        { _id: 'T15', from: 'S1', to: 'S10', trigger: 'menuOpen', timing: 'now', fade: 0.3 },
        { _id: 'T16', from: 'S10', to: 'S1', trigger: 'menuClose', timing: 'now', fade: 0.3 },
        { _id: 'T17', from: 'S6', to: 'S1', trigger: 'respawn', timing: 'loopEnd', fade: 2 },
      ] },
    { id: 'motifs', title: T('Лейтмотиви', 'Leitmotifs'), kind: 'table', rowLabel: 'name', prefix: 'M',
      hint: T('Короткі теми героїв, місць і фракцій, що повертаються в різних станах (бойова версія, лірична…) — так саундтрек стає впізнаваним. Ноти можна записати текстом.', 'Short themes of heroes, places and factions that come back in different states (a combat version, a lyrical one…) — that is what makes a soundtrack recognisable. Notes can be written as text.'),
      fields: [F('name', 'Назва', 'Name', 'text', R), F('owner', 'Чий мотив', 'Whose motif', 'text', X(REC, { h: T('персонаж, місце, фракція', 'a character, a place, a faction') })),
        F('notes', 'Ноти', 'Notes', 'long', X(REC, { h: T('напр. «D4 ♩ F4 ♩ A4 𝅗𝅥 | C5 ♩ D5 ♩ пауза 𝅗𝅥», 4/4', 'e.g. “D4 ♩ F4 ♩ A4 𝅗𝅥 | C5 ♩ D5 ♩ rest 𝅗𝅥”, 4/4') })),
        F('states', 'Звучить у станах', 'Plays in states', 'refs', X(REC, { ref: 'states' })), F('variations', 'Варіації', 'Variations', 'text', REC)],
      rows: [{ _id: 'M1', name: 'Головна тема', owner: 'герой / світ', notes: 'ре мінор, 4/4, 100 BPM: D4 ♩ F4 ♩ A4 𝅗𝅥 | C5 ♩ D5 ♩ пауза 𝅗𝅥', states: ['S1', 'S3', 'S5'], variations: 'флейта в дослідженні, валторни в бою, фанфара в перемозі' }] },
    { id: 'mix', title: T('Мікс і тестування', 'Mix & testing'), kind: 'fields', hint: T('Однакова гучність треків, місце для ефектів і діалогів, безшовні петлі — і перевірка в самій грі.', 'Equal loudness, room for effects and dialogue, seamless loops — and a check inside the game.'),
      fields: [F('lufs', 'Цільова гучність', 'Target loudness', 'num', X(REC, { u: 'LUFS', min: -30, max: -8, h: T('для музики в грі зазвичай −23…−16', 'game music is usually −23…−16') })),
        F('duck', 'Приглушення під діалог', 'Ducking under dialogue', 'num', X(REC, { u: 'dB', min: -30, max: 0 })), F('loopXfade', 'Кросфейд на межі петлі', 'Crossfade at the loop point', 'num', X(REC, { u: 'ms', min: 0, max: 2000 })),
        F('sfxRoom', 'Місце для ефектів', 'Room for SFX', 'text', X({ req: 'opt', adv: true }, { h: T('напр. «зрізати бас нижче 60 Гц у бою»', 'e.g. “cut the bass below 60 Hz in combat”') })),
        F('ab', 'План A/B-тесту', 'A/B test plan', 'long', REC), F('metrics', 'Що вимірюємо', 'What we measure', 'long', { req: 'opt', adv: true }),
        F('checklist', 'Чекліст композитора', 'Composer\'s checklist', 'multi', X(REC, { o: CHECKLIST }))],
      values: { lufs: -18, duck: -8, loopXfade: 50, ab: 'Дві версії бойової теми (з хором і без) — у половини гравців; дивимось час у бою, відмови й опитування «музика заважала?».', checklist: [] } },
  ],
};
function sitOf(rows, id) { var r = rows.filter(function (x) { return x._id === id; })[0]; return r ? r.situation : ''; }
function musicChecks(m, add, rowsOf, nameOf, val) {
  var st = rowsOf('states'), tr = rowsOf('transitions'), ly = rowsOf('layers'), has = function (s) { return st.some(function (r) { return r.situation === s; }); };
  if (st.length && !has('explore')) add('warn', 'states', '', 'Немає стану «Дослідження» — з нього зазвичай починається й до нього повертається музика.', 'No “Exploration” state — the music usually starts there and comes back to it.');
  if (st.length && !has('combat') && !has('boss')) add('tip', 'states', '', 'Немає бойового стану. Якщо в грі є бої — додай його.', 'No combat state. If the game has fights, add one.');
  if (st.length && !has('menu')) add('tip', 'states', '', 'Немає музики меню.', 'No menu music.');
  if ((has('combat') || has('boss')) && !has('victory')) add('tip', 'states', '', 'Бої є, а стану «Перемога» немає — коротка фанфара закриває бій.', 'There are fights but no “Victory” state — a short fanfare closes a fight.');
  var avg = function (s) { var l = st.filter(function (r) { return r.situation === s && num(r.bpm); }); return l.length ? l.reduce(function (a, r) { return a + +r.bpm; }, 0) / l.length : null; };
  var ex = avg('explore'), cb = avg('combat');
  if (ex != null && cb != null && cb <= ex) add('warn', 'states', '', 'Бій не швидший за дослідження (' + cb + ' ≤ ' + ex + ' BPM) — бойова музика зазвичай 120–150 BPM, дослідження 60–90.', 'Combat is not faster than exploration (' + cb + ' ≤ ' + ex + ' BPM) — combat music is usually 120–150 BPM, exploration 60–90.');
  st.forEach(function (r) {
    if (num(r.bars) && +r.bars % 4) add('tip', 'states', r._id, '«' + nameOf(r) + '»: петля на ' + r.bars + ' тактів — фрази зазвичай кратні 4 (8, 16).', '“' + nameOf(r) + '”: a ' + r.bars + '-bar loop — phrases are usually multiples of 4 (8, 16).');
    if (tr.length && r.situation !== 'menu' && st.indexOf(r) > 0 && !tr.some(function (t) { return t.to === r._id; })) add('warn', 'transitions', r._id, 'До стану «' + nameOf(r) + '» не веде жоден перехід — він ніколи не зазвучить.', 'No transition leads to “' + nameOf(r) + '” — it will never play.');
    if (tr.length && !tr.some(function (t) { return t.from === r._id; })) add('tip', 'transitions', r._id, 'Зі стану «' + nameOf(r) + '» немає виходу.', '“' + nameOf(r) + '” has no way out.');
  });
  tr.forEach(function (t) {
    var name = t._id;
    if (t.from && t.from === t.to) add('error', 'transitions', name, 'Перехід веде в той самий стан.', 'The transition leads into the same state.');
    if (t.timing === 'now' && !(+t.fade > 0) && !String(t.stinger || '').trim()) add('warn', 'transitions', name, 'Перемикання «одразу» без кросфейду й стінгера — гравець почує різкий обрив.', 'Switching “immediately” with no crossfade or stinger — the player hears a hard cut.');
    if (t.timing === 'stinger' && !String(t.stinger || '').trim()) add('warn', 'transitions', name, 'Перехід через стінгер, а стінгер не описано.', 'A transition through a stinger with no stinger described.');
    var to = sitOf(st, t.to), from = sitOf(st, t.from);
    if ((to === 'combat' || to === 'boss') && +t.fade > 2) add('tip', 'transitions', name, 'Перехід у бій довший за 2 с — бій почнеться раніше за музику.', 'A transition into combat longer than 2 s — the fight starts before the music.');
    if ((from === 'combat' || from === 'tension' || from === 'victory') && to === 'explore' && !(+t.hold > 0)) add('tip', 'transitions', name, 'Повернення з бою чи напруги без затримки — музика смикатиметься, якщо ворог зʼявиться знову.', 'Returning from combat or tension without a hold — the music flip-flops if an enemy shows up again.');
  });
  ly.forEach(function (l) { if (!String(l.when || '').trim()) add('warn', 'layers', l._id, '«' + nameOf(l) + '»: не сказано, коли шар вмикається.', '“' + nameOf(l) + '”: when the layer switches on is not said.'); });
  if (!rowsOf('motifs').length) add('tip', 'motifs', '', 'Лейтмотив обʼєднує саундтрек і робить його впізнаваним.', 'A leitmotif ties the soundtrack together and makes it recognisable.');
  var lufs = val('mix', 'lufs'), duck = val('mix', 'duck');
  if (num(lufs) && (+lufs < -24 || +lufs > -14)) add('warn', 'mix', '', 'Гучність ' + lufs + ' LUFS — для музики гри зазвичай −23…−16.', 'Loudness ' + lufs + ' LUFS — game music is usually −23…−16.');
  if (has('dialogue') && !(num(duck) && +duck < 0)) add('tip', 'mix', '', 'Є діалоги — приглуши музику під голос (напр. −6…−10 dB).', 'There is dialogue — duck the music under voices (e.g. −6…−10 dB).');
}
var AMBIENCE = {
  id: 'ambience', sec: 'audio', version: 1, cat: 'ambience', sub: 'biome', complexity: 1, name: T('Амбієнт локації', 'Location ambience'),
  desc: T('Звукове тло біома чи локації: постійна основа й випадкові одиночні звуки (птахи, крапель, далекий грім) з інтервалами, умовами й гучністю.', 'The sound bed of a biome or location: a constant base and random one-shots (birds, drips, distant thunder) with intervals, conditions and volume.'),
  purpose: T('Світ звучить живим і не повторюється.', 'The world sounds alive and never repeats.'),
  sections: [
    { id: 'bed', title: T('Основа', 'Bed'), kind: 'fields',
      fields: [F('location', 'Біом / локація', 'Biome / location', 'text', R), F('loop', 'Постійна петля', 'Constant loop', 'text', R), F('length', 'Довжина петлі', 'Loop length', 'time', X(REC, { u: 's', min: 5, max: 600 })),
        F('db', 'Гучність', 'Volume', 'num', X(REC, { u: 'dB', min: -40, max: 0 })), F('variants', 'День / ніч / погода', 'Day / night / weather', 'text', REC)],
      values: { location: 'Ліс', loop: 'шелест листя, вітер у кронах', length: 60, db: -18, variants: 'вночі — цвіркуни й сова; у дощ — краплі по листю' } },
    { id: 'oneshots', title: T('Одиночні звуки', 'One-shots'), kind: 'table', rowLabel: 'name', prefix: 'A',
      fields: [F('name', 'Звук', 'Sound', 'text', R), F('interval', 'Інтервал (від–до)', 'Interval (min–max)', 'range', X(R, { u: 's' })), F('db', 'Гучність', 'Volume', 'num', X(REC, { u: 'dB', min: -40, max: 0 })),
        F('distance', 'Відстань / простір', 'Distance / space', 'text', REC), F('when', 'Умова', 'Condition', 'text', REC), F('variations', 'Варіацій', 'Variations', 'num', X(REC, { min: 1, max: 20 }))],
      rows: [{ _id: 'A1', name: 'Птахи', interval: '4–12', db: -22, distance: 'далеко, зі всіх боків', when: 'день', variations: 6 }, { _id: 'A2', name: 'Тріск гілки', interval: '20–60', db: -20, distance: 'поруч, позаду', variations: 3 }] },
  ],
};
function ambienceChecks(m, add, rowsOf, nameOf) {
  rowsOf('oneshots').forEach(function (r) {
    var g = range(r.interval);
    if (g && g[0] < 1) add('warn', 'oneshots', r._id, '«' + nameOf(r) + '»: інтервал коротший за 1 с — звук зливатиметься в гул.', '“' + nameOf(r) + '”: an interval under 1 s — it blurs into a drone.');
    if (num(r.variations) && +r.variations < 2 && g && g[1] < 30) add('tip', 'oneshots', r._id, '«' + nameOf(r) + '»: частий звук з однією варіацією швидко набридає.', '“' + nameOf(r) + '”: a frequent sound with one variation gets tiresome fast.');
  });
}
var UISOUND = {
  id: 'ui_sounds', sec: 'audio', version: 1, cat: 'uisound', sub: 'menu', complexity: 1, name: T('Звуки інтерфейсу й подій', 'Interface & event sounds'),
  desc: T('Список звуків для кнопок, меню, сповіщень і ігрових подій (рівень, предмет, квест): характер, довжина, пріоритет, кількість варіацій.', 'The sounds for buttons, menus, notifications and game events (level up, item, quest): character, length, priority, variation count.'),
  purpose: T('Кожна дія гравця має чітку звукову відповідь, а часті звуки не набридають.', 'Every player action gets a clear sound response, and frequent sounds never get tiresome.'),
  sections: [
    { id: 'events', title: T('Події', 'Events'), kind: 'table', rowLabel: 'event', prefix: 'U',
      fields: [F('event', 'Подія', 'Event', 'text', R), F('sound', 'Як звучить', 'How it sounds', 'text', R), F('ms', 'Довжина', 'Length', 'num', X(REC, { u: 'ms', min: 10, max: 5000 })),
        F('frequent', 'Часта подія', 'Frequent event', 'bool', REC), F('variations', 'Варіацій', 'Variations', 'num', X(REC, { min: 1, max: 20 })),
        F('pitch', 'Випадкова висота', 'Random pitch', 'pct', X({ req: 'opt', adv: true }, { min: 0, max: 30 })),
        F('priority', 'Пріоритет', 'Priority', 'sel', X(REC, { o: O([['high', 'Високий', 'High'], ['mid', 'Середній', 'Medium'], ['low', 'Низький', 'Low']]) }))],
      rows: [
        { _id: 'U1', event: 'Наведення на кнопку', sound: 'тихий деревʼяний тук', ms: 60, frequent: true, variations: 3, pitch: 5, priority: 'low' },
        { _id: 'U2', event: 'Натискання кнопки', sound: 'мʼякий клац пергаменту', ms: 120, frequent: true, variations: 3, pitch: 5, priority: 'mid' },
        { _id: 'U3', event: 'Новий рівень', sound: 'дзвін + коротка фанфара', ms: 1800, frequent: false, variations: 1, priority: 'high' },
        { _id: 'U4', event: 'Квест виконано', sound: 'арфа вгору, хоровий акорд', ms: 2200, frequent: false, variations: 1, priority: 'high' },
        { _id: 'U5', event: 'Помилка / не можна', sound: 'глухий низький стук', ms: 200, frequent: false, variations: 2, priority: 'mid' },
      ] },
  ],
};
function uiChecks(m, add, rowsOf, nameOf) {
  rowsOf('events').forEach(function (r) {
    if (r.frequent && num(r.ms) && +r.ms > 400) add('warn', 'events', r._id, '«' + nameOf(r) + '»: часта подія звучить ' + r.ms + ' мс — звуки накладатимуться.', '“' + nameOf(r) + '”: a frequent event lasts ' + r.ms + ' ms — the sounds will pile up.');
    if (r.frequent && !(+r.variations > 1)) add('tip', 'events', r._id, '«' + nameOf(r) + '»: часта подія з однією варіацією швидко набридає — 3+ варіації або випадкова висота.', '“' + nameOf(r) + '”: a frequent event with one variation gets tiresome — 3+ variations or random pitch.');
  });
}
var PROMPTS = {
  id: 'music_prompts', sec: 'audio', version: 1, cat: 'music', sub: 'prompts', complexity: 1, name: T('Бібліотека промптів для музики', 'Music prompt library'),
  desc: T('20+ готових промптів для генераторів музики за сценами (бій, бос, дослідження, місто, таверна, підземелля, тиха сцена, меню) і шаблон із параметрами — копіюй ♪ і змінюй під свою гру.',
    '20+ ready music-generator prompts by scene (combat, boss, exploration, town, tavern, dungeon, quiet scene, menu) and a parametric template — copy ♪ and adapt to your game.'),
  purpose: T('Швидко отримати чернетки треків потрібного настрою, темпу й довжини.', 'Get draft tracks of the right mood, tempo and length quickly.'),
  sections: [
    { id: 'template', title: T('Шаблон промпту', 'Prompt template'), kind: 'fields', hint: T('Заповни дужки — і отримаєш промпт. Для адаптивності скажи прямо, які шари й коли додаються.', 'Fill the brackets to get a prompt. For adaptivity, say which layers come in and when.'),
      fields: [F('template', 'Шаблон', 'Template', 'long', R), F('tips', 'Поради', 'Tips', 'long', REC)],
      values: { template: '(стиль: [епічна / чіптюн / ембієнт / фольк / електроніка / мінімалізм] музика), (настрій: [епічний / сумний / таємничий / веселий / напружений]), (довжина: [15 / 30 / 60] секунд / луп), (BPM: [темп]), (лад: [мажор / мінор / модальний]), (інструменти: [список]), (структура: [інтро з … / петля / варіація / перехід]), (динаміка: [наростання до кульмінації / рівна / поступове згасання]), (адаптивність: [вертикальні шари / перехід у бій при високій інтенсивності])',
        tips: 'Бій 120–150 BPM, дослідження 60–90. Для лупа проси «seamless loop». Додай, який шар вмикається на появу ворога. Генератори часто краще розуміють англійську — переклади промпт, якщо результат слабкий.' } },
    { id: 'presets', title: T('Готові промпти', 'Ready prompts'), kind: 'table', rowLabel: 'name', prefix: 'P', prompt: true,
      fields: [F('name', 'Назва', 'Name', 'text', R), F('scene', 'Сцена', 'Scene', 'sel', X(REC, { o: SITUATIONS })), F('style', 'Стиль', 'Style', 'text', REC), F('mood', 'Настрій', 'Mood', 'text', REC),
        F('length', 'Довжина', 'Length', 'time', X(REC, { u: 's' })), F('bpm', 'Темп', 'Tempo', 'num', X(REC, { u: 'BPM', min: 40, max: 200 })), F('prompt', 'Промпт', 'Prompt', 'long', R)],
      rows: [
        { _id: 'P1', name: 'Епічний героїчний', scene: 'combat', style: 'оркестр', mood: 'героїчний', length: 60, bpm: 130, prompt: 'епічний оркестровий бойовий трек, героїчний настрій, 60 секунд, 130 BPM, повний оркестр з хорами, валторнами та литаврами, структура: інтро з наростанням, основний луп з потужними ударами, динамічні кульмінації, підкреслити перемогу' },
        { _id: 'P2', name: 'Оркестрова битва', scene: 'combat', style: 'оркестр', mood: 'агресивний, драматичний', length: 60, bpm: 140, prompt: 'епічна бойова тема, агресивний драматичний настрій, 60 секунд, 140 BPM, литаври й барабани, хор, поривчасті струнні; швидкий вступ, основний луп з акцентами на кожен такт, кульмінація з хоровим гімном' },
        { _id: 'P3', name: 'Темна бойова', scene: 'combat', style: 'оркестр', mood: 'напружений', length: 60, bpm: 140, prompt: 'епічна темна бойова музика, напружений настрій, 60 секунд, 140 BPM, агресивні струнні, хор, литаври, маршові барабани, тяжкі духові, різкий динамічний розвиток' },
        { _id: 'P4', name: 'Бій з босом', scene: 'boss', style: 'оркестр + хор', mood: 'гнівний', length: 90, bpm: 150, prompt: 'епічний оркестровий трек для битви з босом, гнівний настрій, 90 секунд, 150 BPM, хор на фоні, величезні барабани, стрімкі ритми, розмір 9/8, драма й емоція' },
        { _id: 'P5', name: 'Фінальний бос', scene: 'boss', style: 'оркестр + хор', mood: 'урочисто-грізний', length: 120, bpm: 150, prompt: 'епічний оркестр із хором, урочисто-грізний настрій, 120 секунд, 150 BPM, хор, литаври, навʼязливий мотив валторн, довгі затяжні фрази в переходах' },
        { _id: 'P6', name: 'Містичний бос', scene: 'boss', style: 'оркестр', mood: 'таємничий, сумний', length: 60, bpm: 90, prompt: 'містична оркестрова тема для боса, таємничий і сумний настрій, 60 секунд, 90 BPM, гобої, хор, контрабас із фортепіано, плавна зловісна мелодія, повільне наростання' },
        { _id: 'P7', name: 'Легка подорож', scene: 'explore', style: 'фентезі-оркестр', mood: 'спокійний', length: 60, bpm: 90, prompt: 'мирна мелодія для подорожі, спокійний настрій, 60 секунд, 90 BPM, флейта, гобой, мʼякий бас, пульсуючий малюнок арфи, плавний перехід при вході в нову зону, seamless loop' },
        { _id: 'P8', name: 'Ліс', scene: 'explore', style: 'ембієнт', mood: 'мрійливий', length: 60, bpm: 80, prompt: 'мелодійна ембієнтна музика для лісу, мрійливий настрій, 60 секунд, 80 BPM, флейта, гобой, тихий бас, довгі легкі ударні, seamless loop' },
        { _id: 'P9', name: 'Синтвейв-дослідження', scene: 'explore', style: 'синтвейв', mood: 'оптимістичний', length: 30, bpm: 130, prompt: 'танцювальна електроніка майбутнього для дослідження, оптимістичний настрій, 30 секунд, 130 BPM, арпеджіатор синтезатора, ударні 808, бас-гітара, структура: інтро → основний луп' },
        { _id: 'P10', name: 'Таверна', scene: 'tavern', style: 'фольк', mood: 'радісний', length: 45, bpm: 110, prompt: 'народна танцювальна мелодія для таверни, радісний настрій, 45 секунд, 110 BPM, акордеон, скрипка, бубон, легкий кельтський акорд, танцювальний ритм' },
        { _id: 'P11', name: 'Сільський фольк', scene: 'town', style: 'фольк', mood: 'веселий', length: 30, bpm: 90, prompt: 'сільська весела мелодія для міста, веселий настрій, 30 секунд, 90 BPM, гітара, скрипка, сопілка, приємний вальс, жвава ритміка' },
        { _id: 'P12', name: 'Міський джаз', scene: 'town', style: 'джаз', mood: 'спокійний', length: 30, bpm: 100, prompt: 'джазова тема для міста, спокійний настрій, 30 секунд, 100 BPM, саксофон, контрабас, щітки на барабанах, коротка джазова петля з паузами між тактами' },
        { _id: 'P13', name: 'Нічне місто', scene: 'town', style: 'електроніка', mood: 'романтичний', length: 30, bpm: 90, prompt: 'електронний трек із поп-елементами, романтичний настрій, 30 секунд, 90 BPM, електрогітара з ревербом, синтезаторний бас, спокійні ударні, мʼяка структура лупа' },
        { _id: 'P14', name: 'Тиха загроза', scene: 'dungeon', style: 'ембієнт', mood: 'похмурий', length: 60, bpm: 70, prompt: 'таємнича ембієнтна музика, похмурий настрій, 60 секунд, 70 BPM, низькочастотний бас, дзвоноподібні ефекти, шепіт хору на фоні, повільна наростаюча динаміка' },
        { _id: 'P15', name: 'Чіптюн-підземелля', scene: 'dungeon', style: 'чіптюн', mood: 'таємничий', length: 60, bpm: 100, prompt: 'чіптюн для RPG-підземелля, таємничий настрій, 60 секунд, 100 BPM, ретро-синтезатор з арпеджіо, низький бас, повільний ритм, відчуття дослідження печери' },
        { _id: 'P16', name: 'Активне підземелля', scene: 'dungeon', style: 'чіптюн-рок', mood: 'напружений', length: 45, bpm: 130, prompt: 'чіптюн-рок трек, напружений настрій, 45 секунд, 130 BPM, восьмибітний синтезатор, електрогітара з фуззом, драм-машина, складна ритмічна петля з модуляцією в переході' },
        { _id: 'P17', name: 'Ліричний момент', scene: 'lyrical', style: 'фортепіано', mood: 'сумний, задумливий', length: 30, bpm: 60, prompt: 'сповільнений фортепіанний трек, сумний задумливий настрій, 30 секунд, 60 BPM, рояль з реверберацією, ніжні струнні, легка зміна акордів' },
        { _id: 'P18', name: 'Сумна фолк-балада', scene: 'lyrical', style: 'фольк', mood: 'меланхолійний', length: 30, bpm: 80, prompt: 'фолк-балада для тиші, сумна мелодія, 30 секунд, 80 BPM, акустична гітара, скрипка, мʼяке фортепіано, мінімальний ритм, лагідна динаміка' },
        { _id: 'P19', name: 'Розмова персонажів', scene: 'dialogue', style: 'ембієнт', mood: 'нейтральний', length: 15, bpm: 70, prompt: 'дзвінкий ембієнт, нейтральний настрій, 15 секунд, 70 BPM, повільні синтезаторні пади, легка мелодія арфи, без ударних, seamless loop' },
        { _id: 'P20', name: 'Перемога (хор)', scene: 'victory', style: 'оркестр + хор', mood: 'тріумфальний', length: 30, bpm: 100, prompt: 'епічний хор із повним оркестром, тріумфальний настрій, 30 секунд, 100 BPM, хор без слів, струнні ведуть мелодію, барабани, прискорення на фінал' },
        { _id: 'P21', name: 'Церемонія', scene: 'cutscene', style: 'духовна', mood: 'урочистий', length: 60, bpm: 70, prompt: 'дзвінкий духовний трек, урочистий настрій, 60 секунд, 70 BPM, орган, церковний хор, струнні в октаву, повільний кроковий темп' },
        { _id: 'P22', name: 'Меню', scene: 'menu', style: 'мінімалізм', mood: 'спокійний', length: 15, bpm: 60, prompt: 'мінімалістичний спокійний луп для меню, спокійний настрій, 15 секунд, 60 BPM, мʼякі синтезаторні пади, легке фортепіано, майже без ритму, дуже тихо, seamless loop' },
        { _id: 'P23', name: 'Інвентар', scene: 'menu', style: 'фортепіано', mood: 'нейтральний', length: 20, bpm: 80, prompt: 'легка мелодія фортепіано для меню персонажа, нейтральний настрій, 20 секунд, 80 BPM, чистий рояль, невелике ехо, мінімальні зміни' },
      ] },
  ],
};
// a ready prompt for a music generator from a state row (Адаптивна музика) or the preset's own text (Бібліотека промптів)
function rowPrompt(m, secId, row, lang) {
  if (!m || !row) return '';
  if (m.tpl === 'music_prompts' && secId === 'presets') return String(row.prompt || '');
  if (m.tpl !== 'adaptive_music' || secId !== 'states') return '';
  var en = lang === 'en', secs = m.sections || [], sv = function (id) { var s = secs.filter(function (x) { return x.id === id; })[0]; return s ? s.values || {} : {}; };
  var rows = function (id) { var s = secs.filter(function (x) { return x.id === id; })[0]; return s ? s.rows || [] : []; }, pal = sv('palette');
  var optL = function (list, v) { var o = list.filter(function (x) { return x.v === v; })[0]; return o ? lbl(o.l, en ? 'en' : 'uk').toLowerCase() : ''; };
  var moods = (Array.isArray(row.mood) ? row.mood : []).map(function (v) { return optL(MOODS, v); }).filter(Boolean).join(', ');
  var layers = rows('layers').filter(function (l) { return l.state === row._id; }).map(function (l) { return (l.name || '') + (l.instruments ? ' (' + l.instruments + ')' : '') + (l.when ? ' — ' + l.when : ''); });
  var sit = row.situation, dyn = (sit === 'combat' || sit === 'boss') ? (en ? 'builds to a climax' : 'наростання до кульмінації') : sit === 'victory' ? (en ? 'a short climax and a clear ending' : 'коротка кульмінація й чітке завершення')
    : sit === 'defeat' ? (en ? 'gradual fade-out' : 'поступове згасання') : (en ? 'even and soft' : 'рівна, мʼяка');
  var short = sit === 'victory' || sit === 'defeat';
  var parts = [
    [en ? 'style' : 'стиль', row.style || pal.style], [en ? 'scene' : 'сцена', optL(SITUATIONS, sit)], [en ? 'mood' : 'настрій', moods],
    [en ? 'length' : 'довжина', num(row.length) ? row.length + (en ? ' s' : ' с') + (short ? '' : en ? ', seamless loop' + (num(row.bars) ? ' of ' + row.bars + ' bars' : '') : ', безшовний луп' + (num(row.bars) ? ' на ' + row.bars + ' тактів' : '')) : ''],
    [en ? 'tempo' : 'темп', num(row.bpm) ? row.bpm + ' BPM' : ''], [en ? 'key' : 'лад', row.key || pal.key], [en ? 'instruments' : 'інструменти', row.instruments || pal.instruments],
    [en ? 'structure' : 'структура', short ? (en ? 'one short phrase, no loop' : 'одна коротка фраза без петлі') : (en ? 'short intro → main loop → variation, the loop end flows into its start' : 'короткий вступ → основний луп → варіація, кінець петлі плавно переходить у початок')],
    [en ? 'dynamics' : 'динаміка', dyn], [en ? 'adaptivity' : 'адаптивність', layers.length ? (en ? 'separate stems: ' : 'окремі шари (стеми): ') + layers.join('; ') : '']];
  return parts.filter(function (p) { return p[1]; }).map(function (p) { return '(' + p[0] + ': ' + p[1] + ')'; }).join(', ') + (en ? '. Instrumental, no lyrics.' : '. Інструментал, без слів.');
}

var TEMPLATES = [UMCF, DODGE, BLOCK, ATTRS, LEVELS, STATUS, INVENTORY, ENEMY_AI, MUSIC, AMBIENCE, UISOUND, PROMPTS]; // sec: 'audio' — Фабрика звуку, the rest — Mechanics
var TEMPLATE_CHECKS = { umcf: umcfChecks, dodge: dodgeChecks, blockparry: blockChecks, attributes: attrChecks, leveling: levelChecks, status: statusChecks,
  adaptive_music: musicChecks, ambience: ambienceChecks, ui_sounds: uiChecks };

// ---- helpers ----
function num(v) { return v !== '' && v != null && !isNaN(+v); }
function range(v) { var m = String(v == null ? '' : v).match(/^\s*(-?[\d.]+)\s*[–—-]\s*(-?[\d.]+)\s*$/); return m ? [+m[1], +m[2]] : null; }
function lbl(x, lang) { return x == null ? '' : typeof x === 'string' ? x : x[lang] || x.uk || ''; }
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function category(id) { return CATEGORIES.concat(AUDIO_CATEGORIES).filter(function (c) { return c.id === id; })[0] || null; }
function templatesFor(sec) { return TEMPLATES.filter(function (t) { return (t.sec || 'mechanics') === (sec || 'mechanics'); }); }
function categoriesFor(sec) { return sec === 'audio' ? AUDIO_CATEGORIES : CATEGORIES; }
function template(id) { return TEMPLATES.filter(function (t) { return t.id === id; })[0] || null; }
function empty(v) { return v == null || v === '' || (Array.isArray(v) && !v.length); }

// a new instance: the template's structure and starting values become the author's own copy
function instantiate(tplId) {
  var t = template(tplId);
  var m = { tpl: t ? t.id : '', tplVersion: t ? t.version : 0, cat: t ? t.cat : '', sub: t ? t.sub : '', stage: 'concept', type: '', purpose: t ? lbl(t.purpose, 'uk') : '', rules: '', tags: [], links: [], sections: [] };
  if (t) m.sections = t.sections.map(function (s) {
    var o = { id: s.id, title: clone(s.title), hint: clone(s.hint || ''), kind: s.kind, fields: clone(s.fields) };
    if (s.kind === 'table') { o.rows = clone(s.rows || []); o.rowLabel = s.rowLabel || ''; o.prefix = s.prefix || 'R'; if (s.prompt) o.prompt = true; } else o.values = clone(s.values || {});
    return o;
  });
  return m;
}
function newRowId(sec) {
  var p = sec.prefix || 'R', n = 0;
  (sec.rows || []).forEach(function (r) { var m = String(r._id || '').match(/(\d+)$/); if (m) n = Math.max(n, +m[1]); });
  return p + (n + 1);
}
function rowName(sec, r) { return r ? String(r[sec.rowLabel] != null && r[sec.rowLabel] !== '' ? r[sec.rowLabel] : r._id) : ''; }

// completeness + issues: { issues: [{ level: error|warn|tip, sec, row, uk, en }], req: [done, all], rec: [done, all], pct }
function check(m) {
  var issues = [], add = function (level, sec, row, uk, en) { issues.push({ level: level, sec: sec, row: row || '', uk: uk, en: en || uk }); };
  var secs = (m && m.sections) || [], req = [0, 0], rec = [0, 0];
  var secById = function (id) { return secs.filter(function (s) { return s.id === id; })[0]; };
  var rowsOf = function (id) { var s = secById(id); return s && s.rows ? s.rows : []; };
  var val = function (id, k) { var s = secById(id); return s && s.values ? s.values[k] : undefined; };
  var count = function (f, v) { if (f.req === 'r') { req[1]++; if (!empty(v)) req[0]++; } else if (f.req === 'rec') { rec[1]++; if (!empty(v)) rec[0]++; } };
  if (!String(m.purpose || '').trim()) add('warn', 'general', '', 'Не описано призначення.', 'The purpose is not described.');
  secs.forEach(function (s) {
    var fields = s.fields || [], t = s.title;
    var nameOf = function (r) { return rowName(s, r); };
    var chk = function (f, v, row) {
      if (f.t === 'ref' && !empty(v) && !rowsOf(f.ref).some(function (r) { return r._id === v; })) add('error', s.id, row, '«' + lbl(f.l, 'uk') + '»: посилання на запис, якого вже немає (' + v + ').', '“' + lbl(f.l, 'en') + '”: a link to a row that is gone (' + v + ').');
      if (f.t === 'refs' && Array.isArray(v)) v.forEach(function (id) { if (!rowsOf(f.ref).some(function (r) { return r._id === id; })) add('error', s.id, row, '«' + lbl(f.l, 'uk') + '»: посилання на запис, якого вже немає (' + id + ').', '“' + lbl(f.l, 'en') + '”: a link to a row that is gone (' + id + ').'); });
      if ((f.t === 'num' || f.t === 'pct' || f.t === 'time') && !empty(v)) {
        if (!num(v)) add('error', s.id, row, '«' + lbl(f.l, 'uk') + '» — не число.', '“' + lbl(f.l, 'en') + '” is not a number.');
        else if ((f.min != null && +v < f.min) || (f.max != null && +v > f.max)) add('warn', s.id, row, '«' + lbl(f.l, 'uk') + '» = ' + v + ' поза звичним діапазоном ' + (f.min != null ? f.min : '…') + '–' + (f.max != null ? f.max : '…') + '.', '“' + lbl(f.l, 'en') + '” = ' + v + ' is outside the usual ' + (f.min != null ? f.min : '…') + '–' + (f.max != null ? f.max : '…') + ' range.');
      }
      if (f.t === 'range' && !empty(v) && !range(v)) add('error', s.id, row, '«' + lbl(f.l, 'uk') + '»: діапазон пишеться як «від–до», напр. 0.5–1.2.', '“' + lbl(f.l, 'en') + '”: write a range as “min–max”, e.g. 0.5–1.2.');
      if (f.t === 'json' && !empty(v)) { try { JSON.parse(v); } catch (e) { add('error', s.id, row, '«' + lbl(f.l, 'uk') + '»: некоректний JSON.', '“' + lbl(f.l, 'en') + '”: invalid JSON.'); } }
    };
    if (s.kind === 'table') {
      var rows = s.rows || [];
      if (!rows.length) { add('tip', s.id, '', 'Таблиця «' + lbl(t, 'uk') + '» порожня.', 'Table “' + lbl(t, 'en') + '” is empty.'); fields.forEach(function (f) { count(f, undefined); }); }
      rows.forEach(function (r) {
        fields.forEach(function (f) {
          count(f, r[f.k]); chk(f, r[f.k], r._id);
          if (f.req === 'r' && empty(r[f.k]) && f.t !== 'bool') add('warn', s.id, r._id, '«' + nameOf(r) + '»: не заповнено «' + lbl(f.l, 'uk') + '».', '“' + nameOf(r) + '”: “' + lbl(f.l, 'en') + '” is empty.');
        });
      });
    } else {
      var v = s.values || {};
      fields.forEach(function (f) {
        count(f, v[f.k]); chk(f, v[f.k], '');
        if (f.req === 'r' && empty(v[f.k]) && f.t !== 'bool') add('warn', s.id, '', 'Не заповнено «' + lbl(f.l, 'uk') + '».', '“' + lbl(f.l, 'en') + '” is empty.');
      });
    }
  });
  var tc = TEMPLATE_CHECKS[m.tpl];
  if (tc) tc(m, add, rowsOf, function (r) { var s = secs.filter(function (x) { return (x.rows || []).indexOf(r) >= 0; })[0]; return s ? rowName(s, r) : ''; }, val);
  var all = req[1] + rec[1], done = req[0] + rec[0];
  return { issues: issues, req: req, rec: rec, pct: all ? Math.round((req[0] * 2 + rec[0]) / (req[1] * 2 + rec[1]) * 100) : (String(m.purpose || '').trim() ? 100 : 0), done: done, all: all };
}
function worst(issues) { return issues.some(function (i) { return i.level === 'error'; }) ? 'error' : issues.some(function (i) { return i.level === 'warn'; }) ? 'warn' : issues.length ? 'tip' : ''; }

// plain values for the agent (MCP): refs become { id, name }, labels in one language
function exportMech(card, lang) {
  var m = card.mech || {}, L = lang || 'en', cat = category(m.cat), t = template(m.tpl);
  var secs = (m.sections || []).map(function (s) {
    var cols = (s.fields || []).map(function (f) { return { key: f.k, label: lbl(f.l, L), type: f.t, unit: f.u || '', required: f.req === 'r', ref: f.ref || '' }; });
    var name = function (refSec, id) { var rs = (m.sections || []).filter(function (x) { return x.id === refSec; })[0]; var r = rs && (rs.rows || []).filter(function (x) { return x._id === id; })[0]; return r ? { id: id, name: rowName(rs, r) } : { id: id, name: null }; };
    var plain = function (o) { var out = {}; (s.fields || []).forEach(function (f) { var v = o[f.k]; if (empty(v)) return; out[f.k] = f.t === 'ref' ? name(f.ref, v) : f.t === 'refs' ? v.map(function (id) { return name(f.ref, id); }) : v; }); return out; };
    var o = { id: s.id, title: lbl(s.title, L), kind: s.kind, fields: cols };
    if (s.kind === 'table') o.rows = (s.rows || []).map(function (r) { var x = Object.assign({ id: r._id }, plain(r)), p = s.prompt && rowPrompt(m, s.id, r, L); if (p) x.generator_prompt = p; return x; }); else o.values = plain(s.values || {});
    return o;
  });
  var c = check(m);
  return { id: card.id, title: card.title || '', template: t ? { id: t.id, name: lbl(t.name, L), version: m.tplVersion } : null,
    category: cat ? lbl(cat, L) : (card.fields && card.fields.group) || '', subcategory: cat && m.sub ? lbl((cat.subs.filter(function (s) { return s[0] === m.sub; })[0] || [])[L === 'uk' ? 1 : 2], L) : '',
    stage: m.stage || 'concept', type: m.type || '', purpose: m.purpose || '', rules: m.rules || '', tags: m.tags || [], links: m.links || [],
    sections: secs.map(function (x) { var n = frameworkNote(m.tpl, x.id); if (n) x.framework = { status: n.status, note: L === 'uk' ? n.uk : n.en }; return x; }), completeness: c.pct, issues: c.issues.map(function (i) { return { level: i.level, section: i.sec, row: i.row, message: L === 'uk' ? i.uk : i.en }; }) };
}

var MECH = { TYPES: TYPES, TYPE_NAMES: TYPE_NAMES, STAGES: STAGES, CATEGORIES: CATEGORIES, GROUP_ALIAS: GROUP_ALIAS, TEMPLATES: TEMPLATES,
  AUDIO_CATEGORIES: AUDIO_CATEGORIES, templatesFor: templatesFor, categoriesFor: categoriesFor, rowPrompt: rowPrompt,
  FRAMEWORK: FRAMEWORK, frameworkNote: frameworkNote, lbl: lbl, category: category, template: template, instantiate: instantiate, newRowId: newRowId, rowName: rowName, range: range, check: check, worst: worst, exportMech: exportMech };
if (typeof module !== 'undefined' && module.exports) module.exports = MECH;
if (typeof window !== 'undefined') window.__MECH = MECH;
})();
