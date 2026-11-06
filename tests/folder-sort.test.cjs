// «📂 Тека гри» — the AI's folder plan is cleaned on the server (functions/src/gamedev.js op folderSort). Run: npm test
const path = require('path');
const { cleanFolderSort, sortParts, folderSortPrompt } = require(path.join(__dirname, '../functions/src/gamedev.js'))._folderSort;
let fails = 0;
const check = (got, want, msg) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`)); if (!ok) fails++; };
const shelves = [{ id: 'characters', name: 'Персонажі', kind: 'canon', canonKind: 'characters', groups: [] }, { id: 'assets', name: 'Ассети', kind: 'game', canonKind: '', groups: [] }, { id: 'audio', name: 'Звук', kind: 'game', canonKind: '', groups: [] }];
const files = [{ i: 0, p: 'Chars/Arven/arven.fbx', s: 1 }, { i: 1, p: 'Chars/Arven/arven.prefab', s: 1 }, { i: 2, p: 'SFX/step_01.wav', s: 1 }, { i: 3, p: 'SFX/step_02.wav', s: 1 }, { i: 4, p: 'Library/x.asset', s: 1 }];
const r = cleanFolderSort([{ cards: [{ section: 'characters', title: 'Арвен', canon: 'char_a', files: [0, 1, 99] }, { section: 'nope', title: 'Step', group: 'SFX', files: [2, 3, 0] }],
  ignore: [{ files: [4, 2], reason: 'кеш' }] }], shelves, [{ id: 'char_a' }], files);
check(r.cards.map((c) => [c.section, c.title, c.group, c.canon, c.files]), [['characters', 'Арвен', '', 'char_a', [0]], ['assets', 'Арвен', 'Префаби', '', [1]], ['assets', 'Step', 'SFX', '', [2, 3]]],
  'a prefab leaves its card for «Префаби», unknown indexes and repeats dropped, an unknown section → assets, canon only by a known id');
check(r.ignore, [{ files: [4], reason: 'кеш' }], 'ignore keeps only files no card took');
check(cleanFolderSort([{ cards: [{ section: 'assets', title: 'X', canon: 'char_fake', files: [0] }] }], shelves, [], files).cards[0].canon, '', 'an invented canon id is dropped');
const many = Array.from({ length: 3000 }, (_, i) => `${i}|Assets/Models/some_long_folder_name/model_${i}.fbx|120`);
check(sortParts(many).every((p) => p.join('\n').length <= 20000) && sortParts(many).reduce((n, p) => n + p.length, 0), 3000, 'a big list is cut into parts ≤ partChars, nothing lost');
check(/Префаби/.test(folderSortPrompt(['0|a.prefab|1'], shelves, [], [], 'Ukrainian')), true, 'the prompt carries the prefab rule');
const sp = folderSortPrompt(['0|Docs/GDD.md|4'], shelves, [], [], 'Ukrainian');
check(/frameworks, libraries, plugins/.test(sp) && /NOT read/.test(sp), true, 'the prompt keeps only the author notes about the game, not docs of frameworks / plugins');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
