# WhiteWrite — проєктна памʼять

Мистичний інструмент для письменників і творців світів. Два простори навколо **одного канону**:

```
📖 Книга (Narrative)   — WhiteWrite.html        пишеш історію (пергамент, Philosopher)
📜 Біблія світу (Canon) — WhiteWrite GameBible.html  дім світу: канон, історії, ігри (Дерево всесвіту прибрано 2026-11-02)
```

## 🗂 Session Logs
- **2026-06-18**: Canon Extraction System (Phase 3.0-3.4) — `docs/archive/CANON_EXTRACTION_SESSION_2026-06-18.md`
  - Auto-extraction працює (Claude Haiku), auto-approve режим
  - AI Models — single source of truth (`ai-models.js`)
  - ANALYZE backend готовий (UI немає), Bulk Sync backend готовий (UI немає)
  - **Next**: Testing + Bulk Sync UI + Analyze UI
- **2026-10-31**: Аудит етапи 0–3 (усе задеплоєно)
  - Етап 2: збірка `app/` → `dist/` (`scripts/build-app.mjs`), prod-React, CSP (повний allowlist поки Report-Only), postMessage same-origin, `functions/src/*` модулі
  - Етап 3: закони/факти/стан сутностей у промпті (`buildCanonContext`); реконструкція з diff (`reconstructScene` + overlay у Дереві, поважає `scene.reconstruction.mode`); таймлайн (`scene.stateChanges` з екстракції → «Стан у часі» у профілі, хронологія в Хроніці); карта локацій (вид «Карта», `entity.mapPos`); Genesis (`genesisWorld` → екран вибору світу між формою і книгою, `__firebaseCanon.applyGenesis`)
  - **Next**: E2E з реальним AI на акаунті власника; увімкнути повний CSP після перевірки Google-логіну/Stripe
- **2026-11-01**: Світи на головній + Біблія гри + Продакшн-план
  - Головна: «Створи свій світ» / «Обери свій світ» → вид «Світи» → хаб світу (історії, Дерево, Біблія гри); Genesis = створення світу (`__firebaseCanon.createWorld` / `listWorlds`); База знань — кнопка «?» біля жучка
  - Біблія гри (`WhiteWrite GameBible.html` + `gamebible.js`): **один канон → багато ігор** — `worlds/{w}/games/{g}` (+ `cards/`, `plan/current`); гейм-поля сутності канону — у `games/{g}/cards/{entityId}` (`canonRef`), не на сутності
  - `functions/src/gamedev.js` → `gamedevPlan`: `import` (.md → пропозиція, автор відмічає), `analyze` (GDD + питання), `plan` (етапи з воротами + промпти для Claude Code); доступ `allowGameDev` (worldbuilder, worldforge)
  - Імпорт .md ділиться на частини ~20k символів (паралельно, стрімінг) — один виклик вибивав таймаут 540 с; картки з тією ж назвою зливаються
  - Файли на картках (префаби, моделі, картинки): Firebase Storage `worlds/{w}/games/{g}/files/{cardId}/…`, `card.files[]`, `storage.rules` (≤200 МБ, allowGameDev)
  - `token-service` тарифікує датований id моделі (`claude-sonnet-4-5-2025…`) за аліасом з `ai-models.js`
  - Світ MythRunner перенесено з артефакту (19 сутностей канону, гра «MythRunner», 233 картки, 102 картинки у Storage)
  - **Next**: E2E з реальним AI (імпорт нотаток MythRunner → аналіз → план); підключити каталог можливостей RPG Framework
  - **Task Engine + MCP**: `plan` пише `games/{g}/tasks/{id}` (accept/tests/cards/prompt, статуси todo→in_progress→review→done | rework | blocked); `functions/src/mcp.js` — MCP-сервер для Claude Code (ключ `wwk_…` на гру, у Firestore лише sha256 у `mcpKeys`); автор приймає/повертає в Продакшн-плані; Акаунт → «Інтеграції · MCP / API» показує URL і всі ключі. Деталі — `ARCHITECTURE.md` §5

- **2026-11-01 (ніч)**: Канон світу перебудовано — Огляд світу · Закони · досьє Персонажі/Локації/Фракції/Артефакти (без ігрових статусів; вкладки знизу, хронологія життя, файли світу) · Неузгоджене · **Історія і хроніка** (комети на лінії часу) · **Культура** (`worlds/{w}/lore`) · **Космологія = Космограф** (`app/cosmograph/`, 2000 токенів/30 днів на світ, `functions/src/cosmograph.js`)
  - Гра бере канон **лише за вибором** (`games/{g}.canonOptIn`, «＋ Додати з канону»); старі ігри мігруються один раз
  - **Next**: E2E з реальним акаунтом (Космограф: оплата й власна карта); можливо — небо Космографа в контекст генерації сцен
- **2026-11-02**: Книга (виміряна пагінація, аркуш вільного письма, «Пишу сам», ритуал мага) · Біблія↔Книга (історії з досьє, позначки розкриття) · «✦ Порадити» в аркуші (`analyzeScene`) · **Дерево всесвіту прибрано**: Огляд/Закони редагуються в Біблії, Карта локацій, Стан у часі, «✦ Узгодити сцени» (`reconstructScene` + diff); посилання на Дерево → `openCanon` у Біблії; канон Біблії — з плану Storyteller, ігри — Worldbuilder · червоний «!» на моделях > 100 000 полігонів
  - Ліцензії префабів: чип 🟢/🟡/🔴 за комерційним використанням + ⓘ (автовизначення з glTF-метаданих і license.txt на картці, ручне уточнення)
  - **Режисер прибрано** (макет розкадровки/LoRA без бекенду): лишились Книга + Біблія світу; обіцянки зображень/LoRA/відео прибрано з тарифів і Бази знань (Free/Storyteller/Novelist/Worldbuilder), мертві i18n-ключі Дерева/Режисера видалено
  - **Переміщення карток**: меню підрозділу в картці/досьє + перетягування (порядок `order`, зміна підрозділу)
  - Ліцензії: 🟢 повна · 🟡 з умовами (автор, поріг доходу `revcap`) · 🔴 жорстка/некомерційна · 🔵 невідома або власна; мертві прапорці зображень/LoRA (`allowImages`, `allowLoRA`, `loraSlots`, вартості image/storyboard/LoRA) видалено
  - **Генерація світу + Досвід гравців** (спец `World_Generation_and_Game_Experience_Intelligence_Spec_UA.docx`, платформна частина; Unity-частина — RPG Framework `D:\RPG-Framework`, паралельний агент): розділи гри «Генерація світу» й «Телеметрія», «Задум досвіду» на картках (`card.intent`), 7 нових MCP-інструментів; `functions/src/experience.js`: `telemetryIngest` (ключ `wwi_`), `experience` (метрики, AI-звіт, плейтест, перевірка, ключі, purge); вкладка «Досвід гравців» (метрики, теплові карти, проблеми → задача EX.n → перевірка, плейтести, A/B, підключення). Автовидалення: TTL `expireAt` — сирі події 30 днів, денні підсумки 400 днів. ⚠ **Нагадування: >150 000 подій/день → перенести сирі події в BigQuery** (банер у вкладці, ARCHITECTURE §6 «Scale»)
  - **База знань переписана з нуля** (40+ статей, категорії «Агент» і «RPG Framework»); на головній — «🤖 Як говорити з агентом» замість «Замовити книгу»
  - **GitHub-репо гри** (Налаштування гри): `repoConnect` (токен лише в `repoTokens/{w}__{g}`), «Звірити з репо» за кнопкою (`repoSync`) → пропозиція як в імпорті: нове з репо → картки, розбіжності → «Неузгоджене»; підказка біля імпорту .md — попросити ШІ-агента проєкту скласти файл
  - **Next**: E2E з реальним AI (Порадити, Узгодити сцени) і реальними префабами (полігони/ліцензії зі Storage); вирішити тексти тарифів про зображення/LoRA
- **2026-11-02 (вечір)**: Реєстр платних функцій + експорт книги + аудит
  - **`functions/paid-features.js` — ЄДИНЕ джерело правди для тарифів, прапорців доступу й цін AI-дій** (копію в `app/firebase/` робить `build-app.mjs`, як і `ai-models.js`; редагувати лише `functions/`). З нього: `plans.js` (серверні гейти), резерви `gamedevPlan`/`experience`/`cosmographAccess`, `token-budget.js`, картки тарифів в Акаунті, ціна ✦ на кнопках Біблії, статті бази знань «Тарифи»/«Токени» (блоки `["plans"]`/`["prices"]`)
  - Експорт книги ⤓ DOCX / PDF (`app/book-export.js`, у браузері, `allowExport` — Storyteller+)
  - Аудит: `analyzeScene` резервує токени й перевіряє підписку; порожня екстракція не «падає»; Lemon: скасована підписка працює до `ends_at`, `expired` → free; Stripe-checkout лише з ID-токена; ліміти `telemetryIngest` (денний кап на гру, на IP); Біблія на телефоні — шухляда розділів; відкривається на «Огляді світу»; рев'ю задачі з непройденими перевірками — головна кнопка «Повернути»
  - **База знань — покроковий шлях з агентом** (ПК і команди PowerShell: Git, Unity Hub, Unity CLI, Unity 6, Claude Code → з фреймворком чи без → тека + `claude --dangerously-skip-permissions`, модель Opus → MCP → GDD → перша сесія → задачі → GitHub), посилання між статтями; у «RPG Framework» — «Доступ і токен» (скоро) і «Файли контролю»
  - Налаштування гри → **«Запуск Claude Code»**: тека гри на ПК → готові команди PowerShell з кнопкою «Копіювати» (`games/{g}.launch {dir, model, skip}`)
  - **Маржа**: списання = реальна вартість API ÷ `USD_PER_TOKEN` (0.00015, `functions/paid-features.js`), ціни моделей у `ai-models.js` — справжні; повний бюджет Worldbuilder ≈ $27 API з $69; ціни в UI — «≈ N»
  - **Ліміт проєктів на сервері**: історії створює лише `createProject` (`functions/src/projects.js`, правила забороняють клієнтський create); понад ліміт — слот за 500 токенів назавжди (`users.extraProjects`) або тарифи
  - **Зміна тарифу** (`changeSubscription`, LS PATCH): вищий — одразу, різниця в ціні до кінця періоду + токени пропорційно мінус комісія 3%; нижчий — з наступного місяця (`pendingPlan/pendingFrom`, «Скасувати перехід»); Free — скасування з кінця періоду
  - **Історія з досьє**: вибір «✦ З ШІ» (форма історії, заповнена) / «✎ Пишу сам»; книга більше не падає в демо «Орелія» (чекає вхід); кінець книги: напрями «Що далі?» + писати самому / редагувати / зберегти історію
  - **Меню гри — дерево груп** (`NAV_GROUPS`; Сцени — у «Світ і рівні», UI/UX — в «Арт і аудіо» у `gamebible.js`): споріднені розділи — підвкладки (`#subtabs`) одного пункту; id розділів і карток не змінено (MCP/телеметрія/імпорт), лише навігація
  - **Вебхук LS 401 «Invalid signature» виправлено**: секрети в Secret Manager мали `
` у кінці (усі доставки з 25.10 падали) — перезаписано чисті версії, `common.js` обрізає секрети при читанні
  - **Меню Біблії — дерево**: групи розкриваються стрілкою (`navOpen`), розділи — підпункти; згортається лише один рівень (підрозділи розділу — на його полотні, не в меню)
  - **Лише Claude** (Gemini прибрано): моделі Claude 5.5 (Haiku/Sonnet/Opus), вибір в Акаунті → «Модель Claude» (`users.settings.aiModel`, Haiku — Free, Sonnet — від Storyteller, Opus — від Novelist), резерв × масштаб моделі, списання — реальна вартість; єдиний вхід `functions/src/claude.js` (effort замість temperature, текст за типом блоку)
  - **P0.5 безпека + тести** (спец квестів/маркетингу, рішення власника — memory `quest-marketing-decisions`): правила — клієнт пише лише `cards/plan/tasks/changeRequests/experienceIssues/experiments/playtests` гри, решта (телеметрія, лог виконавця, майбутні журнал/знання/пости) — лише сервер; `npm test` (`tests/`: правила через Rules Test API без емулятора, сторож моделей, запасна модель, ворота плану)
  - **Продакшн-план = виробничий конвеєр** (дослідження: Cerny, vertical slice, greybox, ліцензії Asset Store/Fab): MVP — ворота G0 Сетап → G1 Greybox → G2 Перший ігровий рівень → G3 MVP завершено → G4 Реліз-кандидат; далі «Розширення» і «Додаткові фічі» з лінією відсікання. Автор приймає ворота (`plan/current.gates`), до того наступний етап закритий і для Claude Code (`mcp.js lockedBy`). Задачі посилаються на картки за роллю, мають пріоритет, оцінку, потрібний стан ассету. «Готовність Біблії» (ліцензії, полігони, greybox, чого бракує) і «Матриця ассетів» (`card.assetState`: greybox → заглушка → у стилі → фінал)
  - **Нове лого** `app/assets/LogoG.png` (з `LogoG.png` у корені, обрізане до 324 px) + favicon `LogoG-icon.png`; надпис «WhiteWrite» біля лого прибрано (назва вже на лого), старе `LogoWhiteTree.png` видалено
  - **Сторож версій v2** (2026-11-02): повна перевірка раз на 14 днів; щоденний режим, коли є що відстежувати (нова версія в документації Anthropic ще до появи в API → попередній аналіз ціни; активну оголошено застарілою → дата зняття, примусовий перехід за 14 днів до неї; утримана для адміна; раптово зникла). Зникла модель під час виклику → одразу повтор на тому ж рівні або на рівень нижче (`claude.js withFallback`, `config/ai_models.broken`), критичне сповіщення. Користувачі до узгодженого перемикання — на старій версії
  - **Сторож версій Claude** (`functions/src/model-watch.js`, спершу щодня): нова версія вмикається сама лише якщо ціна відома й ≤ +25%, можливості не гірші, пробний виклик пройшов; інакше — критичне сповіщення адмінам (`admin_notices` + файл `admin/notices/*.md` у Storage, банер в Акаунті) з вимогою перерахувати списання; відкат — `config/ai_models.active`
  - **P1 Квести й діалоги** (рівень світу, з Novelist — `allowQuests`): `worlds/{w}/quests` і `/dialogues`, розділи канону «Квести» / «Діалоги» (типи = підрозділи), редактор на полотні: етапи з переходами й умовами, кінець/провал, передумови, повторення; репліки з виборами, умовами, ефектами, ключами локалізації; `approval` окремо від `status`; перевірка графа — `functions/narrative-validate.js` (спільна для UI й MCP, копія в `app/firebase/`); досьє → «Звʼязки» показує квести й діалоги; MCP `get_quest_context` / `get_dialogue_context` (лише затверджені); правила: create/update — `hasQuests()`, read/delete — власник світу. Тести: `narrative-validate.test.cjs`, `mcp-quests.test.cjs`, правила +10
  - **P2 💡 квест із джерела**: лампочка в досьє, культурі й на картках історій → квест із `source` і заповненими звʼязками; ✦ `narrativeDraft` (`functions/src/narrative.js`, `questDraft`/`dialogueDraft` у `paid-features.js`, з Novelist) — пропозиція по полях (Прийняти/Відхилити/Прийняти все), нове від ШІ — «Ідеї», не канон; двобічні переходи джерело ↔ квест
  - **P3–P5 Знання проєкту · Журнал розробки · Unity-середовище** (ARCHITECTURE 2.27): `functions/setup-guides.js` — єдині тексти для агента (`get_guide setup|unity_env|knowledge|activity_log`, копія в `app/firebase/`); MCP `report_unity_environment`, `submit_project_knowledge` (begin/records/end, ідемпотентно, повний скан лише позначає `missingSince`), `get_project_knowledge_status`, `search_project_knowledge`, `submit_development_activity` (session_id, записи не перезаписуються, коміт звіряється з GitHub); розділи «Знання проєкту» і «Журнал розробки» (приватність запису змінює лише автор), «Unity / середовище розробки» в налаштуваннях; KB «Крок 1» — офіційне `winget install Unity.CLI`, без `--dry-run`/`--accept-eula`
  - **Сцени й палітри** (ARCHITECTURE 2.28): розділ гри «Сцени» (окремий пункт меню) — нові типи полів «Палітра кольорів» (коди, coolors, «З картинок») і «Мініпостановка сцени» (полотно 16:9, перетягування елементів); обидва — текстом у полі (MCP читає); у «Референсах» і «Сценах» 🎨 біля групи — основна гама групи (`games/{g}.subPalettes`), видна в заголовку й на картках, MCP `group_palette(s)`. Валідація фреймворку в гайдах — за логом («Found N error(s)»), не за кодом виходу (ValidateAllData завжди 0)
  - **P6/P7 Міні-маркетинг** (ARCHITECTURE 2.29): `functions/src/marketing.js` — `marketing` (activate за `paid-features` `marketing` 1500 т/30 днів на гру, як Космограф; `marketingDraft` ✦ за фактом; connect Telegram/Discord/Mastodon/Bluesky, settings, draft лише з записів журналу «Для маркетингу», edit/approve/reject/schedule/cancel/publish/delete, purge) + `marketingPublisher` (кожні 5 хв, транзакція scheduled→publishing); X і Reddit — копіювання й посилання. Telegram — один бот платформи: секрет `TELEGRAM_BOT_TOKEN` поки `unset` → власник створює бота в @BotFather, `firebase functions:secrets:set TELEGRAM_BOT_TOKEN`, redeploy `marketing,marketingPublisher`. Секрети каналів — `marketingSecrets` (лише сервер). MCP `get_project_overview.integrations.marketing`
  - **Квести й діалоги перенесено в гру** (рішення власника, ARCHITECTURE 2.30): це геймдизайнерське рішення → `worlds/{w}/games/{g}/quests|dialogues`, пункт меню гри «Квести й діалоги», **лише Worldbuilder** (`allowGameDev`; `allowQuests`/`hasQuests` прибрано). Звʼязки — картки гри (`c:<id>`, ролі `CARD_ROLES`: персонажі/вороги, локації/рівні, фракції, предмети/спорядження) і канон (персонажі, локації…, + «Події канону» `events[]`); `refPool` у `narrative-validate.js` спільний для сторінки, `narrativeDraft` (+`gameId`) і MCP. 💡 — на картках гри й у досьє канону (квест у відкритій грі). Даних на світовому рівні не було — міграції немає
  - **RPG Framework 0.32.0** (агент фреймворку): експорт затверджених квестів/діалогів у `rpgframework.content/1` (імпорт — фреймворк ≥ 0.32.1) — `toFrameworkContent` у `narrative-validate.js`, MCP `get_content_export`, кнопка «⤓ JSON для RPG Framework»; гайди: валідація `ValidateFromCommandLine` (exit 0/1/2, старіші — `ValidateAllData` за логом), індекс знань — `ProjectIndexCommand.ExportFromCommandLine` як джерело (ARCHITECTURE 2.31)
  - **Telegram-бот платформи**: `@WhiteWriteServiceBot` (секрет `TELEGRAM_BOT_TOKEN` v2), `marketing`/`marketingPublisher` передеплоєно
  - **Спільнота** (ARCHITECTURE 5a, v2.36): вітрини світів/ігор для всіх (будь-який тариф) — Біблія → Налаштування → «Спільнота» (знімок обраних розділів, без плану/задач/ключів/журналу/телеметрії/нотаток); `functions/src/community.js` (`community`: publish/unpublish/like/report/hide; `communityRotate` щогодини → `community_home/current`); ♥ зі «старінням» (½ за 30 днів); головна — «Вибір спільноти» (топ-20 авторів по черзі за добу, `promotedUntil` — майбутня платна реклама першою) і «Відкрий нового автора» (нижче топ-20, активний за 7 днів); вкладка оболонки `market` → «Спільнота» (макет маркетплейсу прибрано); скарги → адмін «Приховати»; Discord-запрошення й «🤝 Шукаю команду» на вітрині; вкладка «🤝 Співтворці» (`collab/{uid}_{offer|seek}`, пише власник за правилами)
  - **Автоканон скасовано**: сцена сама нічого не пише в канон (лише Хранитель/Біблія); `syncCanonFromProject` → 410
  - **Хаб світу · Команда · Бекап · Маркет** (ARCHITECTURE §5b, v2.43): біля картки Біблії в хабі — панель (Біблія з `?panel=1`) з бічними вкладками 🌍 Спільнота · 🤝 Команда · ⚖ Маркет · ⛁ Бекап; **друзі** — Акаунт → «Друзі» (`team.js`, `users/{uid}/friends`); **команда** світу — ролі адмін (✦ на токенах власника, `payerFor`) / редактор (без ✦) / перегляд / вибрані розділи (`worlds/{w}.team`, правила за розділом і видом сутності); **бекап у GitHub** щодня (`backup.js`, `githubBackup` 300 т/30 днів, приватний репо); **Маркет етап 1** — ліцензія (Worldbuilder, ціна за обсягом `LICENCE`, світ заморожено `freeze`), ШІ-рецензія + ШІ-юрист + модератор, Stripe Connect викуп (12%), `transferWorld`; шаблони `docs/legal/`, `functions/legal/`; `TOKENOMICS.md` (усі тарифи ≥ 100% маржі; відкрите: квоти телеметрії/Storage, ціни докупівлі)
  - Оболонка без верхньої смуги 118 px (сторінки з самого верху, лого поверх); меню гри в Біблії — акордеон (відкрита одна група)
  - **Фоловери й рейтинг** (v2.44): «Стежити» на вітрині (`community` `follow`, `followers/{uid}`), значки 👤 фоловери · ★ рейтинг (♥) на картках вітрин, світів, головної, у хабі й на «Огляді світу/гри» (світ = сума світу й усіх ігор); **«🎮 Готові ігри»** у Спільноті — фундамент майбутньої полиці релізів (`releases[]` на вітрині гри, напис «в розробці», KB `games-shelf`)
  - Кнопка «Назад» ↶ внизу ліворуч (не на головній): історія екранів зі світом, повтори поточного екрана не стають «попереднім»; ⏸/▶ на відеообкладинці світу (стоп на першому кадрі, запамʼятовується)
  - **Маркет — заглушка «в розробці»** (v2.44.3): `licenceReview`/`marketSell` `soon: true` у `paid-features.js` → сервер відмовляє `apply/connect/checkout` усім, крім адміна; у хабі й Спільноті — ідея Маркету й «в розробці». Запуск = прибрати `soon` (після юриста, компанії в країні Stripe і вебхука Connect)
  - **«Ліцензія» → «Сертифікація WhiteWrite»** (рішення власника): це допуск до Маркету, а не авторська ліцензія; права передає продавець покупцю договором викупу. У коді й даних лишаються `licence*`
  - **Stripe і Україна**: Stripe не працює з користувачами в Україні (немає в списку країн, підтримка: «does not support users located in … Ukraine»), Україна не отримувач ні Connect cross-border, ні Global Payouts → Маркет потребує компанії-платформи в країні Stripe (напр. ЄС), а продавці з України отримати виплати через Stripe не зможуть
  - **Lemon Squeezy і Маркет**: LS забороняє маркетплейси («partner to sell others’ products») і не має виплат стороннім продавцям — Маркет лише через Stripe Connect (або інший провайдер з маркетплейс-режимом); підписки й токени лишаються в LS
  - **Next**: власник — Stripe Connect + вебхук `marketWebhook` + секрет `STRIPE_CONNECT_WEBHOOK_SECRET`; юрист-людина — `docs/legal/`; рішення про квоти телеметрії/Storage і ціни докупівлі (`TOKENOMICS.md`)
  - **Візуальний стиль гри** (етап 1, ARCHITECTURE v2.40): розділ гри `artstyle` (перший у «Арт і аудіо»): загальний стиль + біоми (`places` — локації біома, біом підбирається за назвою / підрозділом / полем «Локація»); значок «🖌 NN» на всіх картинках гри — колір у браузері, без токенів; реєстр `artStyle`. Етапи 2–3 зроблено (v2.41): ШІ-перевірка `styleCheck` (`functions/src/style.js`, спільний `functions/style-guide.js`) — сама після завантаження картинки, «✦ Перевірити всі» лише у вкладці стилю (рішення власника), застарілі оцінки (пунктир), 3D «📷 Знімок для стилю», MCP `get_style_guide` / `check_style` (скриншот із Unity)
  - **Історії — лише в Біблії** (v2.45): з хабу світу прибрано «Історії цього світу» й «Нова історія»; історії створюються, відкриваються, редагуються (✎) і видаляються (🗑) у Біблії → «Історії і хроніка» (повідомлення `ww-edit-story` / `ww-delete-story` → форма й підтвердження оболонки); після «Зберегти історію» — повернення в хроніку (`openChronicle`, `ww-bible-section`); кнопка картки — «Відкрити Біблію світу»
  - **Аудит перед масштабуванням** (v2.46): резерви токенів — транзакції скрізь (єдиний пост-платний `canon-extract` недосяжний: автоканон → 410); MCP ізольований ключем на гру, тепер перевіряє `allowAPI`; «✦ Порадити» резервує ціну з реєстру; `tests/paid-gates.test.cjs` — кожен прапорець і платна дія реєстру діють на сервері (свідомо клієнтські: `allowExport`, `allowWorldTree`, вибір моделі — через `modelTier`); **`aiCostDaily`** (`cost-watch.js`) — щодня витрати API по користувачах → `admin_costs`, Акаунт → «Витрати ШІ» (адмін), тривоги > $5/добу і «списання нижче вартості API»; старі звіти з кореня → `docs/archive/`, у CLAUDE.md прибрано застарілі блоки Stripe/Gemini/маржі
  - «Назад» у Біблії йде по її розділах (`ww-bible-at`), лише з першого — з Біблії
  - **Спільнота — спершу галочки** (v2.47): «Сам світ» і кожна гра окремо великими галочками, форма відкривається лише для позначеного; «🤝 Шукаю команду» — велика галочка, «Кого шукаєш» лише коли стоїть; лише світ → картка світу, гра → своя картка, **світ + ігри → картки ігор зі світом усередині** (`withWorld`, розділи 🌍), окремої картки світу немає; KB «Спільнота» → «Скільки карток побачить спільнота»
  - База знань: мультиплеєр фреймворку — кооператив і PvP (дуель, TDM, FFA) до 8 гравців, хост авторитетний, LAN + Unity Relay; MMO / виділених серверів немає
  - **Конструктор механік + UMCF** (ARCHITECTURE v2.48): `functions/mechanics.js` — єдине джерело (категорії, типи полів, шаблони UMCF/ухилення/блок і парирування/атрибути/рівні/статуси/інвентар/поведінка ворогів, перевірки, `FRAMEWORK` — що є в RPG Framework 0.36.0), копія `app/firebase/mechanics.js`; механіка = картка `mechanics` з `mech` (своя копія структури шаблону); редактор у Біблії (вкладки розділів, таблиці з посиланнями на рядки, пошук/сортування, свої поля й розділи, базовий/розширений вигляд, заповненість і перевірки); стара картка механіки конвертується при збереженні; MCP `get_mechanics` / `get_mechanic`; реєстр `mechanics` (Worldbuilder, без токенів). Фреймворк: бій є частково (AttackAsset фази, SweepSegment дуги, EnemyMove комбо), немає motion warping, адаптації AI, парирування, бойової аналітики, імпорту бойових даних з JSON
  - **Next (рішення власника)**: видача токенів RPG Framework (від Storyteller, блок при чужому використанні, оновлення з підпискою) (`economy_config/global` vs ціни планів), `maxProjects` на сервері, апгрейд підписки без подвійного списання, правило «AI не перезаписує явний канон» у `mergeSuggestions`

## Архітектура даних (важливо)
- **Канон світу — Firestore `worlds/{w}` + `entities/`, `lore/`, `games/`** (див. інваріант 2 і `ARCHITECTURE.md`). `WORLD` у `wt-world.jsx` — лише легасі-демо для книги, не джерело правди.
- **`AI_MODELS` (`firebase/ai-models.js`) — ЄДИНЕ джерело правди для AI моделей** (дефолти; сторож версій може перемкнути tier через `config/ai_models.active`). Frontend (`window.__AI_MODELS`) і Backend (require) використовують один файл. **НІКОЛИ** не хардкодь версії моделей!
- Тришарова модель: **Canon** (characters/locations/events/factions/artifacts/world) → **Narrative** (arcs/chapters/scenes/dialogues) → **Director** (storyboards/shots/images). Звʼязки названі за target-type-plural; реверс деривується.

## Рушій (`wt-impact.jsx`, під капотом, на `window`)
Конвеєр: **Canon Change → Change Analysis → Impact → Strategy → Plan → Execute**.
- `wConnections(type,id)` — усі звʼязки сутності.
- `wAffected(type,id)` / `wImpact(type,id)` — транзитивний імпакт по шарах.
- `WCHANGES` — 6 типів зміни (rename / property / relationship / add / remove / rewrite), кожен зі стратегією.
- `wReconstructionPlan(type,id,changeId)` — стратегічно-залежний впорядкований план.
- UI рушія відкривається лише на вимогу (overlay у профілі). Книга лишається книгою.

## Крос-навігація
- Книга → Всесвіт: магічні закладки + «✦ Дослідити канон».
- Deep-links: старі `WorldTree.html?type=&id=` ведуть у Біблію (`openCanon`), `WhiteWrite.html?scene=N` (відкрити розворот).

## 💳 Платежі та токени
- Тарифи, прапорці доступу, ціни AI-дій — **лише `functions/paid-features.js`**; економіка й маржа — `TOKENOMICS.md`.
- Підписки й токени — **Lemon Squeezy** (`functions/src/lemon.js`, `changeSubscription`); Stripe — лише Connect для майбутнього Маркету (`market.js`). Старий Stripe Checkout (`stripe.js`) — легасі.
- Списання = реальна вартість API ÷ `USD_PER_TOKEN`; резерв перед викликом ШІ — транзакція (`token-service.js reserve/charge/refund`).
- Історичні нотатки про ціни/маржі червня 2026 — у `docs/archive/` (не актуальні).

---

# 🗺 Roadmap (ідеї, не зобовʼязання)

## Навколо реконструкції
- **Реальне AI-виконання** — ▶ перегенеровує сцену/діалог через `window.claude`, підтягуючи повʼязаний канон як контекст.
- **Diff + human-in-the-loop** — «було → стане» з Прийняти/Відхилити на кожен елемент. ⭐ топ-вибір.
- Вибірковість (лише Режисер), оцінка вартості, глибина хвилі.

## Граф залежностей
- **Continuity-checker** — авто-виявлення суперечностей (мертвий персонаж говорить).
- Теплова мапа впливу на дереві; виявлення «сиріт».

## Авторство (зараз read-only)
- Редагування канону з live-прев'ю впливу.
- «Промоція з книги»: виділив у тексті → зробити сутністю.
- Гілки всесвіту (what-if версіонування).

## AI-генерація (обіцянка продукту)
- Генерація сцени з канону на «Чистому аркуші».
- Реальні зображення (портрети, локації, кадри сцен) — у досьє Біблії та сценах книги (Режисер прибрано 2026-11-02 як макет без бекенду).
- Усе canon-aware.

## Стратегічне
- Universe Reconstruction як моат.
- Агентний режим (аналіз→імпакт→чернетки→черга рев'ю).

## Нелінійність і твісти (моат, природно лягає на граф)
- **Прихований канон**: сутність/факт має `trueVersion` + `surfacedVersion` (+`revealUntil: sceneId`). До розкриття світ «знає» одне, після — фліп. Твіст = зміна канону → reconstruction підправляє сцени консистентно.
- **Setup→Payoff ребра** ("foreshadows"/"pays-off"): система садить насіння й гарантує виплату, не губить натяк.
- **Паралельні лінії**: `scene.arc` + `POV`; дві осі порядку — story order vs chronological (флешбеки); «коса» (braid) на таймлайні.
- **Scene Intent «Поворот»**: окремий напрям — AI свідомо підриває очікування, спираючись на канон (не рандом).

---

# 🔧 Тех-аудит — статус
- **P0 — два джерела даних** → ✅ ВИРІШЕНО (єдиний `WORLD`, `DATA` = проєкція).
- **P1** — Режисер досі має дублюючі вкладки Персонажі/Локації (територія Всесвіту); крихкий глобальний скоуп; **доступність** (focus-trap у модалках, фокус-кільця, статус не лише кольором).
  - ✅ Режисер очищено: лише Розкадровка + Візуальний канон (LoRA-референси); Персонажі/Локації — у Дереві.
  - ✅ Єдиний перемикач стовпів `.pillswitch` (Книга·Всесвіт·Режисер) на всіх 3 екранах.
  - ✅ Мертвий CSS у WorldTree прибрано; focus-trap + role=dialog на overlay реконструкції та книжкових закладках; глобальні фокус-кільця.
- **P2** — продакшн (in-browser Babel, dev-React); ✅ важкі PNG (world-tree, StartBack) → JPEG (−86%, 5.8МБ→0.8МБ); ✅ memo для `wConnections`/`wImpact`; ✅ персистентність позиції читання книги (localStorage); ✅ прекомпіляція JSX + prod-React (`scripts/build-app.mjs` → `dist/`); лишається: мобільні overlay/граф полірування.

# 🧬 Фундаментальні інваріанти (НЕ порушувати)

Міграція прод-системи (whitewrite.com) в **Canon-Aware**. Беремо ПОВЕРХ, не заміна. Лишаємо: auth, Firestore, save-queue, billing, AI-режими (Write/Analyze/Improve/Adapt/Architect), memorySuggestions, дебаунс-autosave.

1. **Canon = джерело правди. Memory = View** (буквально як SQL View, не копія).
   `Canon → Memory View → AI Context`. memorySuggestions пишуть **у canon**, memory **ре-деривується**. Ніколи два джерела правди.
2. **Canon живе у Світі: `worlds/{worldId}` + підколекція `entities/{id}`** (рішення 2026-10-31, замість поля `project.canon` — ліміт 1 МБ і «один світ = одна історія»). Проєкт = історія, посилається на світ через `project.worldId`; кілька історій можуть ділити один світ. Вид сутності — поле `kind` (`type` — це підтип сутності). Бекенд: `functions/canon-store.js` (`loadCanon` / `mergeSuggestions` / лінива міграція `ensureWorld`), фронт: `app/firebase/firebase-canon.js` (`getCanon` / `createEntity` / `updateEntity` / `updateWorld`). Легасі `project.canon` не видаляється (rollback), але більше не читається.
3. **Два джерела канону:**
   - **Explicit Canon** — створив користувач (авторитетне).
   - **Inferred Canon** — AI припустив, із `confidence %` → черга на підтвердження. Inferred НЕ є фактом: не годується в генерацію як істина і не тригерить реконструкцію, доки не підтверджено. Міграція не створює непідтверджених «фактів».
4. **ID стабільний і непрозорий** + окремо slug + display name:
   `id: "char_8f3k2a"`, `slug: "marcus-chen"`, `name: "Маркус Кейн"`.
   Перейменування (Маркус → Король Маркус) змінює лише name/slug + текстові згадки — **граф не ламається** (тому change-type `rename` лишається легким).
5. **True History Lock** — механізм не беремо; беремо інтент через per-item стани реконструкції: Авто-реген / **Рев'ю (diff, дефолт)** / Pinned (+ continuity-warning).

# ✍️ Філософія наративу (Story Navigation, НЕ Story Generation)

**Користувач майже не пише текст — він приймає творчі рішення.**

Дефолт — **Guided Mode** (поступово, по одній сцені):
```
Canon → Сцена 1 → Scene Intent → Сцена 2 → Scene Intent → …
```
Перед кожною наступною сценою — **Scene Intent**: AI питає «що далі?» з варіантами (Конфлікт / Розвиток персонажа / Екшн / Романтика / Світобудова / Сюрприз від AI / Свій опис). Користувач задає **напрям**, не промпт. Інтент зберігається на сцені (для регенерації).

**Auto Mode** (окремий, не дефолт): «згенерувати сезон» → 12 серій → 200 сцен одним заходом.

НЕ будувати систему під генерацію книг (Sudowrite/NovelAI). Architect-аутлайн = гнучкий каркас-пропозиція, який юзер веде, а не фіксований контракт. Кожна наступна сцена читає **поточний** canon → історія лишається canon-consistent у міру еволюції.

> Narrative generation must NOT assume full-story generation. Default flow: Canon → Next Scene → User Direction → Next Scene. Full-book/season generation is a separate autonomous mode.

# 🏗 Продакшн і структура

## Продакшн
- **Головний сайт:** `whitewrite.com` (custom domain для Firebase Hosting)
- **Firebase Hosting:** віддає `dist/` — збірку з `app/` (`npm run build:app`, запускається автоматично як predeploy). Вихідники — `app/`, `dist/` не редагувати й не комітити.
- **Деплой:** `firebase deploy --only hosting` (або `--only functions` для Cloud Functions)
- **Тести:** `npm test` (усі), `npm run test:rules` (правила Firestore)

## Структура файлів (ВАЖЛИВО!)
- **Робоча директорія:** `app/` — вихідники продакшну (локально працюють як є, з in-browser Babel); на whitewrite.com іде їх збірка `dist/`
- **Cloud Functions:** `functions/index.js` лише збирає модулі з `functions/src/` (перелік — `ARCHITECTURE.md`)
- **Firebase модулі:** `app/firebase/*.js` (НЕ `app/shared/firebase/`!)
- **Документація:** у корені лише `ARCHITECTURE.md` (актуальна архітектура), `CLAUDE.md`, `TOKENOMICS.md`, `MARKETPLACE_SPEC.md`; `docs/archive/` — історія, не джерело правди

## Підписка: плани користувачів
- Актуальні тарифи, ціни й що відкриває кожен — **лише в `functions/paid-features.js`** (Free $0 · Storyteller $12 · Novelist $29 · Worldbuilder $69; `worldforge` — прихований dev-план = Worldbuilder). Старі назви seed/storyweaver не використовуються.

## UI
- **Дизайн затверджено.** Не змінювати стилі, тексти, елементи без явної вказівки власника.
- Токени — у лівому нижньому куті (dock) — `#tokcount`.

# Конвенції
- Стиль коду — як у наявних файлах. JSX через babel; глобали на `window` (увага до колізій імен; **ніколи** `const styles`).
- Скриншотер (html-to-image) НЕ знімає web-компоненти й fixed-overlay — перевіряти через DOM (eval), а не скриншот. У реальному браузері все рендериться.
- **НІКОЛИ не переписуй весь файл** — використовуй `Edit` tool для точкових змін (git diff style). Якщо Read повернув 50 lines, а ти змінюєш 2 — Write з усіма 50 lines ЗАБОРОНЕНО. Лише Edit з old_string → new_string.
- **Завжди працюємо з `app/`, НЕ `public/`!** Перед редагуванням перевіряй, чи правильна директорія.
- **База знань (`app/kb.js`, uk + en) оновлюється разом із кожною зміною сервісу** — додай, зміни або прибери відповідну статтю (як працює функція, кнопки, ціни, кольори, тарифи) у тому ж коміті, що й код. Нова функція без статті, або стаття про прибране, — зміна незавершена. Готові запити для Claude Code — блок `["prompt", "…"]` (категорія «Робота з ШІ-агентом»).
- **Кожна нова платна (або обмежена тарифом) функція — одразу в реєстр `functions/paid-features.js`** у тому ж коміті: запис `{ id, kind: 'ai' | 'gate' | 'free', flag, minPlan, price, op, … }` з коротким описом. Жодних тарифних перевірок чи цін у коді повз реєстр. Реєстр — єдиний список для подальшого балансування тарифів (рішення власника 2026-11-02); якщо функцію додано без запису — зміна незавершена.
- **Архітектурний файл `ARCHITECTURE.md` (корінь) оновлюється разом із кожною зміною** — великою чи малою: нові файли/модулі, Cloud Functions, колекції чи поля Firestore, правила, інтеграції (MCP/API), потоки даних, інваріанти. Оновлюй точково через `Edit` у тому ж коміті, онови `Version`/`Last updated`. Зміна без оновлення архітектури вважається незавершеною.


---

# Behavioral Guidelines (Claude Code)

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
