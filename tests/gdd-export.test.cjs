// ⤓ the readable GDD and the one-page pitch (app/gb-export.js, v2.145): stage order, own sections last, constructor tables with
// readable values, the pitch from «Огляд гри», the «Made with WhiteWrite» line. Run: npm test
global.window = {};
window.__GDD = require('../functions/gdd-schema.js'); window.__MECH = require('../functions/mechanics.js'); window.__DESIGN = require('../functions/design-checks.js');
require('../app/gb-export.js');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

const loops = window.__MECH.instantiate('loops');
const cards = [
  { id: 'lv', section: 'levels', title: 'Берег', order: 1, defs: [{ key: 'goal', label: 'Мета гравця' }], fields: { goal: 'Дійти до маяка' }, files: [{ name: 'shore.png', type: 'image/png', url: 'https://x/shore.png' }] },
  { id: 'ov', section: 'overview', title: 'Огляд гри', order: 1, defs: [{ key: 'logline', label: 'Логлайн' }, { key: 'pillars', label: 'Стовпи гри' }, { key: 'loop', label: 'Ігровий цикл' }],
    fields: { logline: 'Лис рятує ліс від туману', pillars: 'Стрибки, що відчуваються\nСекрети за кожним кущем', loop: 'біг → стрибок → монета' }, files: [] },
  { id: 'm1', section: 'mechanics', title: 'Цикли', order: 1, defs: [], fields: {}, files: [], mech: loops },
  { id: 'hid', section: 'mechanics', title: 'Схована', hidden: true, defs: [], fields: {}, files: [] },
  { id: 'own', section: 'my_sec', title: 'Нотатка', defs: [{ key: 'text', label: 'Опис' }], fields: { text: 'своє' }, files: [] }];
const E = window.__GB_EXPORT({ LANG: 'uk', esc: String, md: (s) => s, allCards: () => cards, cards: () => cards, game: () => ({ title: 'Лис' }),
  gameSections: () => [{ id: 'overview' }, { id: 'mechanics' }, { id: 'levels' }, { id: 'my_sec' }], secName: (id) => ({ overview: 'Огляд гри', mechanics: 'Механіки', levels: 'Рівні', my_sec: 'Моє' })[id],
  quests: () => [{ id: 'q', title: 'Маяк', summary: 'Запали маяк' }], dialogues: () => [], download() {}, slugify: (s) => s, notify() {} });

const g = E.gddMd(), at = (t) => g.indexOf(t);
check(at('## 1. Бачення') < at('## 2. Ядро геймплею') && at('## 2. Ядро геймплею') < at('## 6. Структура гри') && at('## 6. Структура гри') < at('## Свої розділи'), true, 'stages in schema order, own sections last');
check(g.includes('Схована'), false, 'hidden cards stay out');
check(g.includes('**Мета гравця:** Дійти до маяка') && g.includes('![shore.png](https://x/shore.png)'), true, 'fields with their labels and the pictures');
check(/\| Сесія \| Досліджує локацію \|[^\n]*\| Бʼється з ворогами \|/.test(g), true, 'a constructor table: option labels and row names instead of ids');
check(g.trim().endsWith('Зроблено у WhiteWrite · whitewrite.com'), true, 'signed «Made with WhiteWrite»');
const p = E.pitchMd();
check(p.startsWith('# Лис\n\n> Лис рятує ліс від туману') && p.includes('- Стрибки, що відчуваються') && p.includes('## Ігровий цикл'), true, 'the pitch: logline, pillars as a list, the loop');
check(p.includes('https://x/shore.png'), false, 'the pitch takes pictures from the style / references / scenes / cast, not levels');
check(window.__GB_EXPORT({ LANG: 'en', esc: String, md: String, allCards: () => [], cards: () => [], game: () => ({}), gameSections: () => [], secName: String, quests: () => [], dialogues: () => [], download() {}, slugify: String, notify() {} }).pitchMd(), null, 'no overview — no pitch');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
