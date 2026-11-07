// ============================================================================
// 🧠 Конструктор особистості — SINGLE SOURCE for the World Bible (window.__PERSONA, copy in app/firebase/ made by
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

var PERSONA = { STEPS: STEPS, TRAITS: TRAITS, QUESTIONS: QUESTIONS, question: question, progress: progress, traitWords: traitWords, personaText: personaText, cleanPersona: cleanPersona };
if (typeof module !== 'undefined' && module.exports) module.exports = PERSONA;
if (typeof window !== 'undefined') window.__PERSONA = PERSONA;
