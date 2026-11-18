// ============================================================================
// 🎓 The demo game «Ліхтарник» (v2.146, owner: «чого не вистачає з геймдизайну» 7): a small 2D platformer with every required GDD stage
// filled (functions/gdd-schema.js STAGES 1–11) — the overview with pillars, aesthetics and the riskiest assumption, mechanics (own cards +
// constructor templates game feel / controls / FTUE / retention / loops), lore, a location, the style, the hero, an NPC, enemies and a boss,
// four levels with the learning ladder, progression, gear, a quest and a dialogue, a scene, assets, animation, sound, UI, tech and a plan.
// Built ONLY by the server (functions/src/projects.js createGame { demo } / { template: 'demo' }) — the author opens it, looks, copies it.
// build(lang) → { title, cards: [{ id, data }], quests, dialogues, plan, tasks }; card ids are fixed (demo_<key>), so the ladder and the
// quest refs point at them. Text: [uk, en].
// ============================================================================
const M = require('./mechanics.js');

const TITLE = ['Ліхтарник', 'Lamplighter'];
const PILLARS = [['Стрибок, що слухається', 'A jump that obeys'], ['Світло відкриває шлях', 'Light opens the way'], ['Коротко й без поспіху', 'Short and unhurried']];
const ANTI = [['Не хардкор: падіння не забирає прогрес', 'Not hardcore: a fall never takes progress'], ['Не бій: ворогів обходять і проганяють світлом', 'Not combat: enemies are avoided and driven off with light']];
const tbl = (head, rows) => '| ' + head.join(' | ') + ' |\n|' + head.map(() => ' --- ').join('|') + '|\n' + rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n');

// cards: key, section, title, group?, status, fields { key: [uk, en] | (lang) => text }, tpl? (a constructor template), rows? { sectionId: rows by lang }, intent?
const CARDS = [
  { k: 'overview', s: 'overview', t: TITLE, status: 'agreed', f: {
    logline: ['Маленький дух-ліхтарник стрибає туманним болотом і запалює старі ліхтарі, щоб світло повернулося до маяка.', 'A small lamplighter spirit jumps across a foggy marsh, lighting old lanterns so the light can return to the lighthouse.'],
    genre: ['2D-платформер, спокійна пригода', '2D platformer, a calm adventure'],
    pillars: (l) => PILLARS.map((p) => p[l]).join('\n'),
    loop: ['біг → стрибок → запалити ліхтар → туман відступає → новий шлях', 'run → jump → light a lantern → the fog retreats → a new path'],
    platform: ['ПК (Steam), пізніше Switch', 'PC (Steam), later Switch'], session: ['20–30 хв', '20–30 min'], players: ['соло', 'solo'],
    fantasy: ['Я — маленьке світло, яке робить темний світ знову безпечним.', 'I am a little light that makes a dark world safe again.'],
    audience: ['Гравці затишних платформерів 10+, ті, хто любить короткі сесії ввечері', 'Players of cosy platformers 10+, who like short evening sessions'],
    comparables: (l) => tbl(l ? ['Game', 'Price', 'Why it is comparable'] : ['Гра', 'Ціна', 'Чому схожа'], l
      ? [['A short cosy platformer', '$10–15', 'calm pace, 2–3 hours'], ['A precise indie platformer', '$15–20', 'a jump that obeys, quick retries']]
      : [['Короткий затишний платформер', '$10–15', 'спокійний темп, 2–3 години'], ['Точний інді-платформер', '$15–20', 'стрибок, що слухається, швидкі повтори']]),
    usp: ['Світло — це і шлях, і захист: туман ховає платформи, ліхтар їх відкриває.', 'Light is both the path and the shield: the fog hides platforms, the lantern reveals them.'],
    anti: (l) => ANTI.map((p) => p[l]).join('\n'),
    business: ['Преміум, $9.99 у Steam, без мікротранзакцій', 'Premium, $9.99 on Steam, no microtransactions'],
    aesthetics: ['відкриття, відчуття, виклик', 'discovery, sensation, challenge'],
    risk: ['Що проста механіка «світло відкриває платформи» лишається цікавою 2 години без бою.', 'That the simple «light reveals platforms» idea stays interesting for 2 hours without combat.'],
    riskTest: ['Greybox на 3 кімнати: ліхтар і туман, без арту. 5 гравців грають по 15 хв — чи хочуть ще одну кімнату.', 'A 3-room greybox: the lantern and the fog, no art. 5 players play 15 min each — do they want one more room.'] } },
  { k: 'refs', s: 'refs', t: ['Мудборд: туман і теплі вогні', 'Moodboard: fog and warm lights'], g: ['Візуал', 'Visuals'], status: 'agreed', f: {} },
  { k: 'jump', s: 'mechanics', t: ['Стрибок', 'Jump'], g: ['Рух', 'Movement'], status: 'agreed', i: { p: [0], a: ['sensation', 'challenge'] }, f: {
    text: ['Стрибок зі змінною висотою: коротке натискання — низький, довге — високий.', 'A variable jump: a tap is low, a hold is high.'],
    numbers: ['Висота 1–3 клітинки · coyote time 100 мс · буфер стрибка 100 мс · у повітрі керування 80%', 'Height 1–3 tiles · coyote time 100 ms · jump buffer 100 ms · 80% air control'] } },
  { k: 'lantern', s: 'mechanics', t: ['Ліхтар: світло проти туману', 'Lantern: light against the fog'], g: ['Здібності', 'Abilities'], status: 'agreed', i: { p: [1], a: ['discovery'] }, f: {
    text: ['Ліхтар світить колом 3 клітинки: у світлі туманні платформи стають твердими, туманники відступають.', 'The lantern lights a 3-tile circle: in the light the fog platforms turn solid and fog wraiths back away.'],
    numbers: ['Радіус 3 клітинки · запалений ліхтар на стіні — радіус 6, назавжди', 'Radius 3 tiles · a lantern lit on a wall — radius 6, for good'], deps: ['Стрибок', 'Jump'] } },
  { k: 'wind', s: 'mechanics', t: ['Вітряні потоки', 'Wind currents'], g: ['Світ', 'World'], status: 'work', i: { p: [0, 1], a: ['challenge'] }, f: {
    text: ['Потік вітру підкидає вгору або зносить убік; світло ліхтаря показує, куди він дме.', 'A wind current lifts you up or pushes you aside; the lantern light shows which way it blows.'] } },
  { k: 'feel', s: 'mechanics', t: ['Відчуття гри', 'Game feel'], tpl: 'game_feel', status: 'agreed', i: { p: [0] } },
  { k: 'controls', s: 'mechanics', t: ['Керування', 'Controls'], tpl: 'controls', status: 'agreed' },
  { k: 'ftue', s: 'mechanics', t: ['Перші хвилини', 'The first minutes'], tpl: 'ftue', status: 'work', rows: { marks: [
    { mark: 's10', sec: 3, does: ['Іскра прокидається в згаслому ліхтарі, можна одразу бігти', 'Spark wakes in a dark lantern and can run right away'], emotion: ['цікавість', 'curiosity'], event: 'SessionStarted', words: 0 },
    { mark: 's10', sec: 8, does: ['Перший стрибок через корч', 'The first jump over a snag'], teaches: ['Стрибок', 'Jump'], emotion: ['контроль', 'control'], event: 'MechanicUsed', safe: true, words: 0 },
    { mark: 'm1', sec: 40, does: ['Запалює перший ліхтар — туман відступає, видно платформи', 'Lights the first lantern — the fog retreats, platforms appear'], teaches: ['Ліхтар: світло проти туману', 'Lantern: light against the fog'], emotion: ['диво', 'wonder'], reward: ['спалах світла, мелодія', 'a burst of light, a melody'], event: 'RewardReceived', safe: true, words: 3 },
    { mark: 'm5', sec: 280, does: ['Туманник — ліхтар його проганяє', 'A fog wraith — the lantern drives it off'], emotion: ['сміливість', 'courage'], risk: ['не здогадається підійти зі світлом', 'may not think of walking up with the light'], event: 'EnemyKilled', safe: true, words: 6 },
    { mark: 'm15', does: ['Перша кімната, де треба світити й стрибати разом', 'The first room that needs light and jumps together'], emotion: ['кмітливість', 'cleverness'], reward: ['новий ліхтар на мапі', 'a new lantern on the map'], event: 'LevelCompleted', words: 10 },
    { mark: 'end', does: ['Маяк блимає вдалині: видно, куди йти завтра', 'The lighthouse blinks far away: you see where to go tomorrow'], emotion: ['передчуття', 'anticipation'], reward: ['вітряні потоки відкрито', 'wind currents unlocked'], event: 'CheckpointReached', words: 20 },
    { mark: 'h2', does: ['Пройдено 2 з 4 рівнів, зібрано половину світлячків', '2 of 4 levels done, half the fireflies collected'], emotion: ['прихильність', 'attachment'], risk: ['повернення грошей у Steam', 'a Steam refund'], event: 'ItemAcquired' }] } },
  { k: 'retention', s: 'mechanics', t: ['Причини повернутися', 'Reasons to come back'], tpl: 'retention', status: 'work', rows: { reasons: [
    { horizon: 'next', reason: ['Сесія закінчується біля темного ліхтаря, який уже видно', 'The session ends by a dark lantern you can already see'], type: 'zeigarnik', drive: 'intrinsic' },
    { horizon: 'd1', reason: ['Маяк ще не горить — до нього два рівні', 'The lighthouse is still dark — two levels to go'], type: 'cliff', drive: 'intrinsic' },
    { horizon: 'd7', reason: ['Світлячки рівнів: 31 із 60, за всіх — нова пісня маяка', 'Level fireflies: 31 of 60, all of them unlock a new lighthouse song'], type: 'collection', drive: 'intrinsic' },
    { horizon: 'd30', reason: ['Безкоштовний рівень-епілог', 'A free epilogue level'], type: 'season', drive: 'extrinsic' }] } },
  { k: 'loops', s: 'mechanics', t: ['Ігрові цикли', 'Game loops'], tpl: 'loops', status: 'agreed', rows: { nodes: [
    { layer: 'session', action: ['Шукає шлях у тумані', 'Looks for a way through the fog'], reward: ['видно платформи', 'platforms appear'], next: [1] },
    { layer: 'session', action: ['Стрибає між світлом', 'Jumps from light to light'], reward: ['світлячки', 'fireflies'], next: [2] },
    { layer: 'session', action: ['Запалює ліхтар', 'Lights a lantern'], reward: ['чекпоінт, туман відступає', 'a checkpoint, the fog retreats'], next: [0, 3] },
    { layer: 'meta', action: ['Доходить до кінця рівня', 'Reaches the end of the level'], reward: ['маяк ближче, нова здібність', 'the lighthouse is closer, a new ability'], next: [0] }] } },
  { k: 'lore', s: 'lore', t: ['Згаслий маяк', 'The dark lighthouse'], status: 'agreed', f: {
    text: ['Колись маяк вів човни крізь болото. Пожирач Світла випив його вогонь, і туман укрив усе. Ліхтарі вздовж стежок — це ниточка, що веде світло назад.', 'Once the lighthouse led boats across the marsh. The Light Eater drank its fire and the fog covered everything. The lanterns along the paths are a thread that leads the light back.'] } },
  { k: 'marsh', s: 'locations', t: ['Болото Сірих Вогнів', 'The Grey-Fire Marsh'], status: 'agreed', f: {
    level: ['4 рівні + маяк', '4 levels + the lighthouse'], size: ['кожен рівень — 6–8 екранів зліва направо', 'each level is 6–8 screens left to right'],
    look: ['холодний синьо-сірий туман, теплі жовті вогні', 'cold blue-grey fog, warm yellow lights'], enemies: ['Туманники, Пожирач Світла', 'Fog wraiths, the Light Eater'] } },
  { k: 'style', s: 'artstyle', t: ['Загальний стиль', 'Overall style'], g: ['Загальний стиль', 'Overall style'], status: 'agreed', f: {
    manifesto: ['Мʼякі силуети, мало деталей, світло — єдине яскраве на екрані.', 'Soft silhouettes, few details, the light is the only bright thing on screen.'],
    palette: ['#1d2a33 #3d5563 #8aa0a8 #f2b84b #ffe9a8', '#1d2a33 #3d5563 #8aa0a8 #f2b84b #ffe9a8'],
    light: ['Темно-синій світ, теплі кола світла навколо ліхтарів', 'A dark-blue world, warm circles of light around the lanterns'],
    shapes: ['Круглі, трохи криві форми; герой читається силуетом 16 px', 'Round, slightly crooked shapes; the hero reads as a 16 px silhouette'],
    budget: ['2D-спрайти, тайли 32 px, до 3 шарів паралаксу', '2D sprites, 32 px tiles, up to 3 parallax layers'],
    rules: ['Так: тепле світло, туман шарами. Ні: чисто-чорні тіні, кров.', 'Yes: warm light, layered fog. No: pure-black shadows, blood.'] } },
  { k: 'spark', s: 'characters', t: ['Іскра', 'Spark'], g: ['Герої', 'Heroes'], status: 'agreed', f: {
    role: ['Герой: дух-ліхтарник', 'Hero: a lamplighter spirit'], kit: ['Стрибок, ліхтар', 'Jump, lantern'],
    numbers: (l) => tbl(l ? ['Parameter', 'Value'] : ['Параметр', 'Значення'], l ? [['Speed', '6 tiles/s'], ['Jump height', '1–3 tiles'], ['Light radius', '3 tiles']] : [['Швидкість', '6 клітинок/с'], ['Висота стрибка', '1–3 клітинки'], ['Радіус світла', '3 клітинки']]),
    strengths: ['Легкий і спритний / боїться темряви: без світла туман збиває з ніг', 'Light and nimble / afraid of the dark: without light the fog knocks him down'],
    look: ['Крапля полумʼя в скляному ковпачку, великі очі', 'A drop of flame in a glass cap, big eyes'] } },
  { k: 'heron', s: 'characters', t: ['Стара Чапля', 'Old Heron'], g: ['NPC', 'NPCs'], status: 'agreed', f: {
    role: ['Доглядачка маяка, дає головний квест', 'The lighthouse keeper, gives the main quest'], look: ['Висока сіра чапля з окулярами на дзьобі', 'A tall grey heron with glasses on her beak'] } },
  { k: 'wraith', s: 'enemies', t: ['Туманник', 'Fog wraith'], g: ['Звичайні вороги', 'Regular enemies'], status: 'agreed', f: {
    behaviour: ['Пливе до гравця в темряві, у світлі зупиняється й тане', 'Drifts towards the player in the dark, stops and melts in the light'],
    attacks: ['Дотик: збиває назад до ліхтаря', 'A touch: pushes you back to the lantern'], weakness: ['Підійти зі світлом', 'Walk up with the light'],
    numbers: (l) => tbl(l ? ['Parameter', 'Value'] : ['Параметр', 'Значення'], l ? [['Speed', '2 tiles/s'], ['Melts in light', '1.5 s']] : [['Швидкість', '2 клітинки/с'], ['Тане у світлі', '1,5 с']]) } },
  { k: 'eater', s: 'enemies', t: ['Пожирач Світла', 'The Light Eater'], g: ['Боси', 'Bosses'], status: 'work', f: {
    behaviour: ['Велика тінь на маяку: гасить ліхтарі по черзі', 'A big shadow on the lighthouse: puts the lanterns out one by one'],
    attacks: ['Хвиля темряви, вітер', 'A wave of darkness, wind'], weakness: ['Запалити три ліхтарі навколо нього, поки він гасить інші', 'Light three lanterns around it while it puts others out'] } },
  { k: 'l1', s: 'levels', t: ['1. Берег', '1. The shore'], g: ['Туторіал', 'Tutorial'], o: 1, status: 'ingame', i: { p: [0, 2], lad: [['jump', 'intro'], ['lantern', 'intro']] }, f: {
    location: ['Болото Сірих Вогнів', 'The Grey-Fire Marsh'], layout: ['6 екранів, без ям', '6 screens, no pits'], encounters: ['1 туманник наприкінці', '1 fog wraith at the end'], goal: ['Запалити перший ліхтар', 'Light the first lantern'], length: ['5 хв', '5 min'] } },
  { k: 'l2', s: 'levels', t: ['2. Очерети', '2. The reeds'], g: ['Основні рівні', 'Main levels'], o: 2, status: 'work', i: { p: [0, 1], lad: [['jump', 'test'], ['lantern', 'test']] }, f: {
    layout: ['8 екранів, перші ями, туманні платформи', '8 screens, the first pits, fog platforms'], encounters: ['3 туманники', '3 fog wraiths'], goal: ['Три ліхтарі', 'Three lanterns'], length: ['12 хв', '12 min'] } },
  { k: 'l3', s: 'levels', t: ['3. Вітряна гать', '3. The windy causeway'], g: ['Основні рівні', 'Main levels'], o: 3, status: 'idea', i: { p: [0, 1], lad: [['wind', 'intro'], ['jump', 'twist']] }, f: {
    layout: ['8 екранів, потоки вітру вгору й убік', '8 screens, wind currents up and sideways'], goal: ['Перелетіти гать', 'Cross the causeway'], length: ['15 хв', '15 min'] } },
  { k: 'l4', s: 'levels', t: ['4. Маяк', '4. The lighthouse'], g: ['Рівні босів', 'Boss levels'], o: 4, status: 'idea', i: { p: [1], lad: [['jump', 'combine'], ['lantern', 'combine'], ['wind', 'test']] }, f: {
    layout: ['Вежа вгору, 5 поверхів', 'A tower upwards, 5 floors'], encounters: ['Пожирач Світла', 'The Light Eater'], goal: ['Запалити маяк', 'Light the lighthouse'], length: ['15 хв', '15 min'] } },
  { k: 'fireflies', s: 'progression', t: ['Світлячки', 'Fireflies'], g: ['Валюти', 'Currencies'], status: 'agreed', i: { p: [2], a: ['discovery'] }, f: {
    text: ['15 світлячків на рівні, сховані за туманом.', '15 fireflies per level, hidden behind the fog.'],
    numbers: ['60 усього · 20 — довший ліхтар (радіус 4) · 60 — пісня маяка', '60 in all · 20 — a longer lantern (radius 4) · 60 — the lighthouse song'],
    sinks: ['Звідки: рівні. Куди: не витрачаються, лише відкривають', 'Sources: levels. Sinks: never spent, they only unlock'] } },
  { k: 'glass', s: 'gear', t: ['Скляний ліхтар', 'The glass lantern'], g: ['Ключові предмети', 'Key items'], status: 'agreed', f: {
    effect: ['Світло радіусом 3; з 20 світлячками — 4', 'Light radius 3; with 20 fireflies — 4'], source: ['Є з початку', 'From the start'] } },
  { k: 'scene', s: 'scenes', t: ['Маяк спалахує', 'The lighthouse flares'], g: ['Ключові сцени', 'Key scenes'], status: 'idea', f: {
    what: ['Пожирач тане, промінь маяка проходить по всьому болоту, туман зникає.', 'The Eater melts, the lighthouse beam sweeps the whole marsh, the fog vanishes.'],
    location: ['Маяк', 'The lighthouse'], mood: ['Полегшення, тепле світанкове світло', 'Relief, warm dawn light'], palette: ['#1d2a33 #f2b84b #ffe9a8 #f6c6a0', '#1d2a33 #f2b84b #ffe9a8 #f6c6a0'],
    camera: ['Камера відʼїжджає від Іскри до всього болота', 'The camera pulls back from Spark to the whole marsh'] } },
  { k: 'asset', s: 'assets', t: ['Іскра — спрайт', 'Spark — sprite'], g: ['Персонажі', 'Characters'], status: 'work', f: {
    function: ['Герой: біг, стрибок, падіння, світіння', 'Hero: run, jump, fall, glow'], size: ['32×32 px', '32×32 px'], priority: ['високий', 'high'],
    prompt: ['pixel art, tiny flame spirit inside a glass cap, big eyes, warm yellow glow, 32x32, side view', 'pixel art, tiny flame spirit inside a glass cap, big eyes, warm yellow glow, 32x32, side view'], source: ['свій', 'own'] } },
  { k: 'anim', s: 'animation', t: ['Стрибок Іскри', 'Spark’s jump'], g: ['Персонаж', 'Character'], status: 'idea', f: {
    who: ['Іскра', 'Spark'], what: ['Присідання → зліт → верхня точка → приземлення з бризками світла', 'Crouch → take-off → apex → landing with a splash of light'], timing: ['4 + 2 + 3 + 4 кадри, 12 fps', '4 + 2 + 3 + 4 frames, 12 fps'] } },
  { k: 'music', s: 'audio', t: ['Тема болота', 'The marsh theme'], g: ['Музика', 'Music'], status: 'idea', f: {
    mood: ['Тиха, тепла, з паузами; стає повнішою з кожним запаленим ліхтарем', 'Quiet, warm, with pauses; fuller with each lantern lit'], where: ['Рівні 1–3', 'Levels 1–3'], length: ['2 хв, петля', '2 min, loop'],
    source: ['lo-fi ambient, soft felt piano, warm pads, 70 BPM, gentle; Exclude: drums, flute', 'lo-fi ambient, soft felt piano, warm pads, 70 BPM, gentle; Exclude: drums, flute'] } },
  { k: 'hud', s: 'ui', t: ['HUD', 'HUD'], g: ['HUD', 'HUD'], status: 'agreed', f: {
    purpose: ['Не заважати: на екрані майже нічого', 'Stay out of the way: almost nothing on screen'], elements: ['Лічильник світлячків (зʼявляється на 2 с після знахідки)', 'A firefly counter (shows for 2 s after a find)'],
    actions: ['Пауза → мапа ліхтарів', 'Pause → the lantern map'] } },
  { k: 'tech', s: 'tech', t: ['Рушій і збірка', 'Engine & build'], g: ['Рушій і збірка', 'Engine & build'], status: 'agreed', f: {
    decision: ['Будь-який 2D-рушій; тайлова мапа, фізика без Rigidbody — свій контролер стрибка', 'Any 2D engine; a tile map, no rigidbody physics — an own jump controller'],
    constraints: ['60 fps на слабкому ноутбуці, збірка до 200 МБ', '60 fps on a weak laptop, a build under 200 MB'], status: ['Greybox рівня 1', 'Level 1 greybox'] } },
];
const QUEST = { id: 'demo_q_light', title: ['Запали маяк', 'Light the lighthouse'], type: 'main', summary: ['Чапля просить повернути світло маяку.', 'The Heron asks you to bring the light back to the lighthouse.'], giver: 'heron', stages: [
  { id: 's1', title: ['Перший ліхтар', 'The first lantern'], objective: ['Запали ліхтар на березі', 'Light the lantern on the shore'], next: ['s2'] },
  { id: 's2', title: ['Дорога вогнів', 'The road of lights'], objective: ['Пройди очерети й гать', 'Cross the reeds and the causeway'], next: ['s3'] },
  { id: 's3', title: ['Маяк', 'The lighthouse'], objective: ['Прожени Пожирача й запали маяк', 'Drive off the Eater and light the lighthouse'], end: true }] };
const DIALOGUE = { id: 'demo_d_heron', title: ['Чапля біля маяка', 'The Heron by the lighthouse'], nodes: [
  { id: 'n1', speaker: 'heron', text: ['Ох, маленький вогнику. Маяк згас, і туман забрав стежки.', 'Oh, little flame. The lighthouse went dark and the fog took the paths.'], next: 'n2' },
  { id: 'n2', speaker: 'player', text: ['Що мені робити?', 'What should I do?'], choices: [{ text: ['Я запалю ліхтарі', 'I will light the lanterns'], to: 'n3' }, { text: ['Я боюся темряви', 'I am afraid of the dark'], to: 'n4' }] },
  { id: 'n3', speaker: 'heron', text: ['Тоді йди вздовж берега. Кожен ліхтар — крок до маяка.', 'Then follow the shore. Each lantern is a step to the lighthouse.'], end: true },
  { id: 'n4', speaker: 'heron', text: ['Ти і є світло. Тримайся ближче до вогнів — туман їх боїться.', 'You are the light. Stay near the fires — the fog fears them.'], next: 'n3' }] };
const PLAN = { overview: ['План демо: від greybox трьох кімнат до готового першого рівня.', 'The demo plan: from a three-room greybox to a finished first level.'], estimateWeeks: 6, milestones: [
  { id: 'G0', name: ['Сетап', 'Setup'], goal: ['Проєкт, контролер стрибка, тайлова мапа', 'The project, the jump controller, the tile map'], tasks: [
    { id: 'G0.1', title: ['Контролер стрибка з coyote time', 'A jump controller with coyote time'], cards: ['jump', 'feel'], owner: 'dev', size: 'M' }] },
  { id: 'G1', name: ['Greybox', 'Greybox'], goal: ['Перевірити найризикованіше: чи цікаво світло без бою', 'Test the riskiest: is the light fun without combat'], tasks: [
    { id: 'G1.1', title: ['Прототип: 3 кімнати з туманом і ліхтарем', 'Prototype: 3 rooms with fog and the lantern'], cards: ['lantern', 'overview'], owner: 'design', size: 'M' },
    { id: 'G1.2', title: ['Плейтест 5 гравців по 15 хв', 'A playtest: 5 players, 15 min each'], cards: ['overview'], owner: 'qa', size: 'S' }] },
  { id: 'G2', name: ['Перший ігровий рівень', 'The first playable level'], goal: ['«Берег» у фінальному стилі', '«The shore» in the final style'], tasks: [
    { id: 'G2.1', title: ['Рівень «Берег» за драбиною навчання', 'The «Shore» level by the learning ladder'], cards: ['l1', 'ftue'], owner: 'design', size: 'L' },
    { id: 'G2.2', title: ['Спрайт і анімація стрибка Іскри', 'Spark’s sprite and jump animation'], cards: ['asset', 'anim'], owner: 'art', size: 'M' }] }] };

const ID = (k) => 'demo_' + k;
function build(lang) {
  const l = lang === 'en' ? 1 : 0, T = (v) => (typeof v === 'function' ? v(l) : Array.isArray(v) ? v[l] : v);
  const titles = {}; CARDS.forEach((c) => { titles[c.k] = c.t[l]; });
  const cards = CARDS.map((c, n) => {
    const fields = {}; Object.keys(c.f || {}).forEach((k) => { fields[k] = T(c.f[k]); });
    const data = { section: c.s, title: c.t[l], status: c.status || 'idea', order: c.o || n + 1, fields };
    if (c.tpl) {
      const m = M.instantiate(c.tpl);
      Object.keys(c.rows || {}).forEach((sid) => {
        const s = m.sections.find((x) => x.id === sid);
        s.rows = c.rows[sid].map((r, i) => { const o = { _id: sid.slice(0, 2).toUpperCase() + (i + 1) }; Object.keys(r).forEach((k) => { o[k] = k === 'next' ? r[k].map((j) => sid.slice(0, 2).toUpperCase() + (j + 1)) : T(r[k]); }); return o; });
      });
      data.mech = m; const cat = M.category(m.cat); fields.group = cat ? (l ? cat.en : cat.uk) : ''; fields.text = m.purpose || '';
    } else if (c.g) fields.group = c.g[l];
    if (c.i) {
      const it = {};
      if (c.i.p) it.pillars = c.i.p.map((i) => PILLARS[i][l]);
      if (c.i.a) it.aesthetics = c.i.a;
      if (c.i.lad) it.ladder = c.i.lad.map((x) => ({ m: ID(x[0]), step: x[1] }));
      data.intent = it;
    }
    return { id: ID(c.k), data };
  });
  const ref = (k) => 'c:' + ID(k);
  const quest = { title: T(QUEST.title), type: QUEST.type, summary: T(QUEST.summary), approval: 'approved', status: 'idea', giver: ref(QUEST.giver), characters: [ref('spark')], locations: [ref('marsh')], factions: [], artifacts: [], events: [], prereqs: [],
    stages: QUEST.stages.map((s) => Object.assign({ id: s.id, title: T(s.title), objective: T(s.objective), next: (s.next || []).map((to) => ({ to })) }, s.end ? { end: true } : {})) };
  const dialogue = { title: T(DIALOGUE.title), type: 'quest', approval: 'approved', status: 'idea', participants: [ref('heron')], questId: QUEST.id, stageId: 's1', location: ref('marsh'), trigger: '',
    nodes: DIALOGUE.nodes.map((n) => { const o = { id: n.id, speaker: n.speaker === 'player' ? 'player' : ref(n.speaker), text: T(n.text) }; if (n.next) o.next = n.next; if (n.end) o.end = true;
      if (n.choices) o.choices = n.choices.map((x) => ({ text: T(x.text), to: x.to })); return o; }) };
  const tasks = [];
  const plan = { gated: true, overview: T(PLAN.overview), dod: [], estimateWeeks: PLAN.estimateWeeks, engineNotes: '', cutLine: 0, health: [], parallel: [], risks: [],
    milestones: PLAN.milestones.map((m) => ({ id: m.id, track: 'mvp', name: T(m.name), goal: T(m.goal), gate: '', entry: '', deliverables: [], accept: [], budgets: '', estimateDays: 0,
      tasks: m.tasks.map((t) => { const x = { id: t.id, title: T(t.title), detail: '', deps: [], size: t.size, owner: t.owner, priority: 'must', assetState: '', estimate: 0, prompt: '', cards: t.cards.map(ref), roles: {}, accept: [], tests: [] };
        tasks.push(Object.assign({}, x, { milestone: m.id, track: 'mvp', status: 'todo', order: tasks.length + 1, history: [] })); return x; }) })) };
  return { title: T(TITLE), cards, quests: [{ id: QUEST.id, data: quest }], dialogues: [{ id: DIALOGUE.id, data: dialogue }], plan, tasks, titles };
}

module.exports = { build, ID, PILLARS, TITLE };
