// ============================================================================
// 🧠 Конструктор особистості + 👤 поля зовнішності (LOOK, below) — SINGLE SOURCE for the World Bible (window.__PERSONA, copy in app/firebase/ made by
// scripts/build-app.mjs), the AI prompts (src/common.js buildCanonContext, src/narrative.js, src/gamedev.js) and
// ✦ «Варіанти» (src/card-fill.js personaIdeas). Edit THIS file.
// ============================================================================
// A canon character (worlds/{w}/entities/{id}, kind "characters") keeps its personality in `personality`:
//   { answers: { <question id>: text }, traits: { <trait id>: -2…2 }, updatedAt }
// Questions lead the author step by step («Крок за кроком») or all at once («Усі питання»); every answer is optional.
// Traits are two-pole scales (−2 = the left pole, +2 = the right one, 0 / missing = in between, not said).

var STEPS = [
  { id: 'core', uk: 'Суть', en: 'Core', qs: [
    { id: 'essence', uk: 'Хто цей персонаж одним реченням?', en: 'Who is this character in one sentence?',
      hint: { uk: 'Не біографія, а суть: «втомлений найманець, що шукає, за що померти».', en: 'Not a biography but the essence: “a tired mercenary looking for something worth dying for”.' } },
    { id: 'want', uk: 'Чого прагне свідомо?', en: 'What do they consciously want?',
      hint: { uk: 'Мета, яку він сам назве: помста, золото, визнання, дім…', en: 'The goal they would name: revenge, gold, recognition, a home…' } },
    { id: 'need', uk: 'Чого потребує насправді — і сам цього не бачить?', en: 'What do they truly need — without seeing it?',
      hint: { uk: 'Внутрішня потреба, яку історія змусить усвідомити: пробачити, довіритись, відпустити.', en: 'The inner need the story will make them face: to forgive, to trust, to let go.' } } ] },
  { id: 'past', uk: 'Минуле', en: 'Past', qs: [
    { id: 'wound', uk: 'Яка рана з минулого досі болить?', en: 'Which old wound still hurts?',
      hint: { uk: 'Втрата, зрада, провина, приниження — те, що він ховає.', en: 'A loss, a betrayal, guilt, humiliation — what they hide.' } },
    { id: 'turning', uk: 'Яка подія зробила його таким, як зараз?', en: 'Which event made them who they are now?' } ] },
  { id: 'inner', uk: 'Внутрішній світ', en: 'Inner world', qs: [
    { id: 'fear', uk: 'Чого боїться найбільше?', en: 'What do they fear most?' },
    { id: 'flaw', uk: 'Головна вада', en: 'Main flaw', hint: { uk: 'Те, що заважає йому отримати бажане: гордість, недовіра, гнів…', en: 'What keeps them from what they want: pride, mistrust, anger…' } },
    { id: 'virtue', uk: 'Сильні риси й чесноти', en: 'Strengths and virtues' },
    { id: 'values', uk: 'За що стоїть — і чого не зробить ніколи?', en: 'What do they stand for — and what will they never do?' },
    { id: 'secret', uk: 'Таємниця, яку не знає ніхто', en: 'A secret no one knows' } ] },
  { id: 'behaviour', uk: 'Поведінка', en: 'Behaviour', qs: [
    { id: 'pressure', uk: 'Як поводиться під тиском чи в небезпеці?', en: 'How do they act under pressure or in danger?' },
    { id: 'habits', uk: 'Звички, манери, жести', en: 'Habits, manners, gestures' },
    { id: 'voice', uk: 'Як говорить?', en: 'How do they speak?', hint: { uk: 'Темп, лексика, улюблені слова, тон, акцент, що ніколи не скаже.', en: 'Pace, vocabulary, pet words, tone, accent, what they would never say.' } },
    { id: 'joy', uk: 'Що його тішить і заспокоює?', en: 'What brings them joy or calm?' } ] },
  { id: 'bonds', uk: 'Стосунки', en: 'Relationships', qs: [
    { id: 'trust', uk: 'Кому довіряє і кого любить?', en: 'Whom do they trust and love?' },
    { id: 'enemy', uk: 'Кого ненавидить чи боїться?', en: 'Whom do they hate or fear?' },
    { id: 'strangers', uk: 'Як ставиться до незнайомців?', en: 'How do they treat strangers?' } ] },
  { id: 'arc', uk: 'Арка', en: 'Arc', qs: [
    { id: 'change', uk: 'Як змінюється протягом історії?', en: 'How do they change over the story?' },
    { id: 'breaks', uk: 'Що може його зламати — і що врятувати?', en: 'What could break them — and what could save them?' } ] },
];

var TRAITS = [
  { id: 'social', uk: ['Інтроверт', 'Екстраверт'], en: ['Introvert', 'Extrovert'] },
  { id: 'courage', uk: ['Обережний', 'Сміливий'], en: ['Cautious', 'Bold'] },
  { id: 'mind', uk: ['Серце', 'Розум'], en: ['Heart', 'Mind'] },
  { id: 'order', uk: ['Хаотичний', 'Впорядкований'], en: ['Chaotic', 'Orderly'] },
  { id: 'trustful', uk: ['Недовірливий', 'Довірливий'], en: ['Suspicious', 'Trusting'] },
  { id: 'temper', uk: ['Спокійний', 'Запальний'], en: ['Calm', 'Hot-tempered'] },
  { id: 'moral', uk: ['Прагматик', 'Ідеаліст'], en: ['Pragmatist', 'Idealist'] },
  { id: 'humour', uk: ['Серйозний', 'Жартівник'], en: ['Serious', 'Joker'] },
];

var QUESTIONS = STEPS.reduce(function (a, s) { return a.concat(s.qs.map(function (q) { return Object.assign({ step: s.id }, q); })); }, []);
function question(id) { return QUESTIONS.filter(function (q) { return q.id === id; })[0] || null; }
function tr(o, lang) { return o ? (o[lang] || o.uk) : ''; }

// how much of the constructor is done: answered questions + set traits, of all
function progress(p) {
  p = p || {}; var a = p.answers || {}, t = p.traits || {};
  var done = QUESTIONS.filter(function (q) { return String(a[q.id] || '').trim(); }).length + TRAITS.filter(function (x) { return +t[x.id]; }).length;
  return { done: done, total: QUESTIONS.length + TRAITS.length };
}
// a trait value → words («дуже сміливий», «радше обережний»), '' when not set
function traitWords(x, v, lang) {
  v = Math.max(-2, Math.min(2, Math.round(+v || 0))); if (!v) return '';
  var pole = (x[lang] || x.uk)[v < 0 ? 0 : 1].toLowerCase();
  return (Math.abs(v) === 2 ? (lang === 'en' ? 'very ' : 'дуже ') : (lang === 'en' ? 'rather ' : 'радше ')) + pole;
}
// the personality as text for AI prompts and exports: «Чого прагне: …» lines + a traits line; '' when empty
function personaText(p, lang) {
  lang = lang === 'en' ? 'en' : 'uk'; p = p || {};
  var a = p.answers || {}, t = p.traits || {}, out = [];
  QUESTIONS.forEach(function (q) { var v = String(a[q.id] || '').trim(); if (v) out.push(tr(q, lang).replace(/\?$/, '') + ': ' + v.slice(0, 1500)); });
  var tw = TRAITS.map(function (x) { return traitWords(x, t[x.id], lang); }).filter(Boolean);
  if (tw.length) out.push((lang === 'en' ? 'Temperament' : 'Темперамент') + ': ' + tw.join(', '));
  return out.join('\n');
}
// what the author / AI may write: known ids only, answers ≤ 4000 chars, traits −2…2
function cleanPersona(p) {
  p = p && typeof p === 'object' ? p : {};
  var a = {}, t = {};
  QUESTIONS.forEach(function (q) { var v = p.answers && p.answers[q.id]; if (typeof v === 'string' && v.trim()) a[q.id] = v.trim().slice(0, 4000); });
  TRAITS.forEach(function (x) { var v = p.traits && Math.round(+p.traits[x.id]); if (v && isFinite(v)) t[x.id] = Math.max(-2, Math.min(2, v)); });
  return { answers: a, traits: t };
}

// ---------- 👤 Зовнішність (the «Зовнішність» tab of a world character, v2.87) ----------
// entities/{id}.appearance = { <field id>: text } — every field is free text; `opts` are suggestions for the drop-down
// (pick one, several with commas, or type your own). The free description stays in dossier.look («Вільний опис»).
// `opts: 'peoples'` — the world's own peoples from Culture (lore group "peoples") come first.
var o = function (uk, en) { return { uk: uk.split('|'), en: en.split('|') }; };
var LOOK = [
  { id: 'general', uk: 'Загальне', en: 'General', fields: [
    { id: 'sex', uk: 'Стать / вигляд', en: 'Sex / presentation', opts: o('чоловіча|жіноча|андрогінна|без статі', 'male|female|androgynous|sexless') },
    { id: 'age', uk: 'Вік на вигляд', en: 'Apparent age', opts: o('дитина|підліток|молодий|дорослий|зрілий|літній|древній', 'child|teen|young|adult|middle-aged|elderly|ancient') },
    { id: 'people', uk: 'Раса / народ', en: 'Race / people', opts: 'peoples', base: o('людина|ельф|гном|орк|напівкровка|нежить|звіролюд|дух|машина', 'human|elf|dwarf|orc|half-blood|undead|beastfolk|spirit|machine') },
    { id: 'height', uk: 'Зріст', en: 'Height', opts: o('дуже низький|низький|середній|високий|дуже високий|велетенський', 'very short|short|average|tall|very tall|giant') },
    { id: 'build', uk: 'Статура', en: 'Build', opts: o('худорлява|струнка|атлетична|мʼязиста|кремезна|повна|сутула|витончена', 'gaunt|slender|athletic|muscular|stocky|heavy|hunched|delicate') } ] },
  { id: 'face', uk: 'Обличчя й волосся', en: 'Face & hair', fields: [
    { id: 'skin', uk: 'Шкіра', en: 'Skin', opts: o('бліда|світла|оливкова|смаглява|темна|засмагла|вкрита лускою|сіра|незвичного кольору', 'pale|fair|olive|tan|dark|sunburnt|scaled|grey|unusual colour') },
    { id: 'faceShape', uk: 'Обличчя', en: 'Face', opts: o('овальне|кругле|квадратне|видовжене|різке, вилицювате|мʼяке|грубе|вродливе|непримітне', 'oval|round|square|long|sharp, high cheekbones|soft|rough|beautiful|unremarkable') },
    { id: 'eyes', uk: 'Очі', en: 'Eyes', opts: o('карі|сірі|блакитні|зелені|бурштинові|чорні|різного кольору|світяться|сліпі|вузькі|великі', 'brown|grey|blue|green|amber|black|mismatched|glowing|blind|narrow|large') },
    { id: 'hairColor', uk: 'Колір волосся', en: 'Hair colour', opts: o('чорне|каштанове|руде|русяве|біляве|сиве|біле|фарбоване|немає', 'black|brown|red|light brown|blond|grey|white|dyed|none') },
    { id: 'hair', uk: 'Зачіска', en: 'Hairstyle', opts: o('лисий|коротке|середнє|довге|коса|хвіст|дреди|голена скроня|кучері|розпатлане', 'bald|short|medium|long|braid|ponytail|dreadlocks|shaved side|curls|messy') },
    { id: 'beard', uk: 'Борода й вуса', en: 'Beard & moustache', opts: o('немає|щетина|вуса|коротка борода|довга борода|заплетена борода', 'none|stubble|moustache|short beard|long beard|braided beard') },
    { id: 'marks', uk: 'Особливі прикмети', en: 'Distinguishing marks', opts: o('шрам|татуювання|родимка|пірсинг|опік|протез|відсутнє око|ритуальні знаки|веснянки', 'scar|tattoo|birthmark|piercing|burn|prosthesis|missing eye|ritual marks|freckles') } ] },
  { id: 'outfit', uk: 'Одяг і спорядження', en: 'Clothes & gear', fields: [
    { id: 'style', uk: 'Стиль одягу', en: 'Clothing style', opts: o('селянський|міський|шляхетний|військовий|мандрівний|жрецький|розбійницький|мисливський|екзотичний|лахміття', 'peasant|town|noble|military|traveller|priestly|outlaw|hunter|exotic|rags') },
    { id: 'colors', uk: 'Кольори', en: 'Colours', opts: o('чорний|білий|сірий|червоний|бордовий|синій|зелений|коричневий|золото|срібло', 'black|white|grey|red|crimson|blue|green|brown|gold|silver') },
    { id: 'armour', uk: 'Обладунок', en: 'Armour', opts: o('немає|стьобаний|шкіряний|кольчуга|лускатий|латний|магічний', 'none|padded|leather|chainmail|scale|plate|magical') },
    { id: 'accessories', uk: 'Аксесуари', en: 'Accessories', opts: o('плащ|каптур|амулет|персні|пояс із сумками|маска|окуляри|сумка|книга|прапорець', 'cloak|hood|amulet|rings|belt with pouches|mask|glasses|satchel|book|banner') },
    { id: 'weapon', uk: 'Зброя на виду', en: 'Visible weapon', opts: o('немає|меч|кинджали|сокира|спис|лук|арбалет|посох|молот|вогнепальна', 'none|sword|daggers|axe|spear|bow|crossbow|staff|hammer|firearm') } ] },
  { id: 'presence', uk: 'Рухи й враження', en: 'Movement & presence', fields: [
    { id: 'posture', uk: 'Постава', en: 'Posture', opts: o('пряма|горда|сутула|розслаблена|напружена|насторожена', 'upright|proud|hunched|relaxed|tense|wary') },
    { id: 'gait', uk: 'Хода й рухи', en: 'Gait & movement', opts: o('граційні|важкі|швидкі|обережні|незграбні|кульгає|безшумні', 'graceful|heavy|quick|careful|clumsy|limping|silent') },
    { id: 'voice', uk: 'Голос', en: 'Voice', opts: o('низький|високий|хриплий|мʼякий|гучний|тихий|з акцентом|металевий', 'deep|high|hoarse|soft|loud|quiet|accented|metallic') },
    { id: 'smell', uk: 'Запах', en: 'Smell', opts: o('дим|трави|кров|море|ладан|пил дороги|парфуми|нічим', 'smoke|herbs|blood|the sea|incense|road dust|perfume|nothing') },
    { id: 'impression', uk: 'Перше враження', en: 'First impression', opts: o('загрозливий|привітний|загадковий|жалюгідний|величний|непомітний|чарівний', 'menacing|friendly|mysterious|pitiful|majestic|unnoticeable|charming') } ] },
];
var LOOK_FIELDS = LOOK.reduce(function (a, g) { return a.concat(g.fields.map(function (f) { return Object.assign({ group: g.id }, f); })); }, []);
function cleanLook(a) {
  var out = {}; a = a && typeof a === 'object' ? a : {};
  LOOK_FIELDS.forEach(function (f) { var v = a[f.id]; if (typeof v === 'string' && v.trim()) out[f.id] = v.trim().slice(0, 600); });
  return out;
}
// the appearance as text for AI prompts: «Зріст: високий; Очі: зелені…»; '' when empty
function lookText(a, lang) {
  lang = lang === 'en' ? 'en' : 'uk'; a = cleanLook(a);
  return LOOK_FIELDS.filter(function (f) { return a[f.id]; }).map(function (f) { return tr(f, lang) + ': ' + a[f.id]; }).join('; ');
}

var PERSONA = { STEPS: STEPS, TRAITS: TRAITS, QUESTIONS: QUESTIONS, question: question, progress: progress, traitWords: traitWords, personaText: personaText, cleanPersona: cleanPersona,
  LOOK: LOOK, LOOK_FIELDS: LOOK_FIELDS, cleanLook: cleanLook, lookText: lookText };
if (typeof module !== 'undefined' && module.exports) module.exports = PERSONA;
if (typeof window !== 'undefined') window.__PERSONA = PERSONA;
