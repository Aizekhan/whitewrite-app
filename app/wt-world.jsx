// ============================================================================
// WORLD — normalized universe model for the World Tree workspaces.
// Every entity has an `id`. Cross-links are arrays NAMED BY TARGET TYPE
// (characters / locations / events / factions / artifacts) so reverse links
// can be derived uniformly. Universe: «Червоний сигнал» (hard-SF, Mars).
// ============================================================================
const WORLD = {
  world: {
    tagline: "Колонії Марса вмовкли. Тиша поширюється швидше за світло.",
    summary:
      "2157 рік. Мережа квантових ретрансляторів, що тримала зв'язок між Землею та марсіанськими колоніями, розпадається вузол за вузлом. Кожен збій відрізає черговий форпост від людства. У цій тиші ще лунає один сигнал — і ніхто не знає, хто його надсилає.",
    facts: [
      { k: "Рік", v: "2157" }, { k: "Сетинг", v: "Колонії Марса та Земля" },
      { k: "Технології", v: "Міжпланетні польоти, квантовий зв'язок" },
      { k: "Жанр", v: "Hard SF · виживання" },
      { k: "Конфлікт", v: "Збій зв'язку ізолює колонії" },
      { k: "Тон", v: "Холодний, самотній, напружений" },
    ],
    rules: [
      "Квантовий зв'язок потребує робочих ретрансляторів — без них тиша абсолютна.",
      "Пилові бурі глушать сигнал на годинами.",
      "Кисневі скафандри мають обмежений ресурс — час завжди проти героїв.",
      "Жоден сигнал не рухається швидше за світло, окрім одного — Оріона.",
    ],
    palette: ["#c2542a", "#7a2f1c", "#d9a441", "#2a1c16", "#8a857e"],
  },

  // ---- Characters ----
  characters: [
    { id: "marcus", name: "Маркус Чен", role: "Головний герой", roleType: "lead", status: "Розпач",
      motivation: "Знайти сигнал, щоб дотягнутися до доньки на Землі.", arc: "Відчай → Надія", prog: 35,
      scenes: [1, 3, 5, 7, 9], locations: ["beta7", "alpha", "aurora"], factions: ["sisters"],
      artifacts: ["suit", "blackbox", "locket"], events: ["silence", "beta7-last", "storm", "finale"],
      relations: [{ id: "elena", kind: "Союзники", tone: "ally" }, { id: "mara", kind: "Батько й донька", tone: "warm" }, { id: "orion", kind: "Невідоме", tone: "anta" }] },
    { id: "elena", name: "Елена Родрігес", role: "Інженерка", roleType: "support", status: "Рішучість",
      motivation: "Полагодити ретранслятори й довести свою цінність.", arc: "Сумнів → Впевненість", prog: 60,
      scenes: [2, 3, 4, 8], locations: ["beta7", "alpha"], factions: ["sisters"], artifacts: ["alpha-node", "quantum-key"],
      events: ["beta7-last", "orion-detected", "alpha-reached"], relations: [{ id: "marcus", kind: "Союзники", tone: "ally" }, { id: "daria", kind: "Наставниця", tone: "warm" }, { id: "brandt", kind: "Конфлікт", tone: "enemy" }] },
    { id: "orion", name: "Голос «Оріон»", role: "Антагоніст", roleType: "anta", status: "Невідомо",
      motivation: "Веде відлік. Його мета прихована за статикою.", arc: "Таємниця → Викриття", prog: 15,
      scenes: [1, 6, 9], locations: [], factions: ["orion"], artifacts: ["orion-tx"], events: ["orion-detected", "finale"],
      relations: [{ id: "marcus", kind: "Невідоме", tone: "anta" }] },
    { id: "sisters", name: "Сестри ретрансляції", role: "Спільнота", roleType: "support", status: "Стабільні",
      motivation: "Тримають останні робочі вузли мережі.", arc: "Тло світу", prog: 0,
      scenes: [2, 8], locations: ["alpha", "relay-belt"], factions: ["sisters"], artifacts: ["alpha-node"], events: ["alpha-reached"], relations: [] },
    { id: "voss", name: "Командор Айла Восс", role: "Адміністраторка", roleType: "support", status: "Під тиском",
      motivation: "Втримати порядок у колоніях, поки правда не вийшла назовні.", arc: "Контроль → Зрив", prog: 40,
      scenes: [6], locations: ["earthcmd", "gamma"], factions: ["admin"], artifacts: ["helios-files"], events: ["collapse", "helios-coverup"],
      relations: [{ id: "brandt", kind: "Союз вигоди", tone: "warm" }] },
    { id: "nakamura", name: "Доктор Тео Накамура", role: "Медик колонії", roleType: "support", status: "Виснажений",
      motivation: "Зберегти живими тих, хто лишився на Беті-7.", arc: "Обов'язок → Жертва", prog: 50,
      scenes: [2, 5], locations: ["beta7", "medbay"], factions: ["survivors"], artifacts: ["suit"], events: ["storm", "suit-breach"], relations: [] },
    { id: "rein", name: "Капітан Рейн Соларіс", role: "Пілот «Аврори»", roleType: "support", status: "Безстрашна",
      motivation: "Перевозити вцілілих між форпостами, доки є чим дихати.", arc: "Самотність → Команда", prog: 30,
      scenes: [5], locations: ["aurora", "relay-belt"], factions: ["survivors"], artifacts: [], events: ["alpha-reached"], relations: [] },
    { id: "daria", name: "Дарія Кель", role: "Старша інженерка", roleType: "support", status: "Зосереджена",
      motivation: "Передати знання про ретранслятори, поки не пізно.", arc: "Гордість → Спадок", prog: 55,
      scenes: [8], locations: ["alpha", "relay-belt"], factions: ["sisters"], artifacts: ["alpha-node", "quantum-key"], events: ["alpha-reached"],
      relations: [{ id: "elena", kind: "Учениця", tone: "warm" }] },
    { id: "brandt", name: "Антон Брандт", role: "Представник «Геліос»", roleType: "anta", status: "Холоднокровний",
      motivation: "Приховати причетність корпорації до збою мережі.", arc: "Брехня → Викриття", prog: 25,
      scenes: [6], locations: ["helios", "earthcmd"], factions: ["helios"], artifacts: ["helios-files"], events: ["helios-coverup"],
      relations: [{ id: "elena", kind: "Конфлікт", tone: "enemy" }, { id: "voss", kind: "Союз вигоди", tone: "warm" }] },
    { id: "ivi", name: "Іві", role: "ШІ скафандра", roleType: "support", status: "Вірна",
      motivation: "Берегти життя носія всупереч спаду ресурсів.", arc: "Інструмент → Голос", prog: 45,
      scenes: [3, 7], locations: ["beta7"], factions: [], artifacts: ["suit"], events: ["suit-breach"],
      relations: [{ id: "marcus", kind: "Супутниця", tone: "warm" }] },
    { id: "mara", name: "Мара Чен", role: "Донька Маркуса", roleType: "support", status: "Чекає",
      motivation: "Дочекатися голосу батька крізь тишу.", arc: "Надія → ?", prog: 20,
      scenes: [9], locations: ["earthcmd"], factions: ["earthgov"], artifacts: ["locket"], events: ["mara-message", "finale"],
      relations: [{ id: "marcus", kind: "Батько й донька", tone: "warm" }] },
    { id: "dispatch", name: "Диспетчер Землі", role: "Голос центру", roleType: "support", status: "Безсилий",
      motivation: "Передавати накази у порожнечу, що більше не відповідає.", arc: "Рутина → Відчай", prog: 15,
      scenes: [1], locations: ["earthcmd"], factions: ["earthgov"], artifacts: [], events: ["silence"], relations: [] },
  ],

  // ---- Locations ----
  locations: [
    { id: "beta7", name: "Колонія Бета-7", type: "Покинута станція", cur: true, atmos: ["Спустошена", "Моторошна"],
      cond: "Наближається пилова буря", desc: "Колись квітучий форпост, тепер укритий червоним пилом; аварійне світло блимає в порожніх коридорах.",
      palette: ["#c2542a", "#7a2f1c", "#d9a441", "#2a1c16", "#8a857e"], scenes: [1, 2, 3, 7], events: ["beta7-last", "storm", "suit-breach"], factions: ["survivors"] },
    { id: "earthcmd", name: "Командний центр, Земля", type: "Орбітальний хаб", atmos: ["Стерильна", "Далека"],
      desc: "Земний центр координації місій. Звідси віддавали накази, поки зв'язок не обірвався — тепер він шле в порожнечу.",
      scenes: [6, 9], events: ["silence", "helios-coverup", "mara-message"], factions: ["earthgov", "admin"] },
    { id: "alpha", name: "Ретранслятор «Альфа»", type: "Вузол зв'язку", atmos: ["Ізольований", "Крихкий"],
      desc: "Останній вузол, здатний дотягнутися до Землі. Полагодити його — мета всієї подорожі героїв.",
      scenes: [4, 8], events: ["alpha-reached"], factions: ["sisters"] },
    { id: "aurora", name: "Транспорт «Аврора»", type: "Корабель", atmos: ["Тісний", "Надійний"],
      desc: "Маленький рятувальний транспорт, що звозить уцілілих між форпостами вмираючої мережі.", scenes: [5], events: [], factions: ["survivors"] },
    { id: "helios", name: "Штаб «Геліос»", type: "Орбітальна корпорація", atmos: ["Холодна", "Багата"],
      desc: "Орбітальна цитадель корпорації, що володіє інфраструктурою ретрансляторів — і її таємницями.", scenes: [], events: ["helios-coverup"], factions: ["helios"] },
    { id: "gamma", name: "Колонія Гамма-9", type: "Втрачений форпост", atmos: ["Мертва", "Тиха"],
      desc: "Перша колонія, що замовкла повністю. Її доля — попередження про те, що чекає на інших.", scenes: [], events: ["collapse"], factions: [] },
    { id: "relay-belt", name: "Пояс ретрансляторів", type: "Орбітальна мережа", atmos: ["Безмежний", "Згасаючий"],
      desc: "Кільце вузлів навколо Марса, що вимикаються один за одним, занурюючи систему в тишу.", scenes: [], events: ["silence"], factions: ["sisters"] },
    { id: "medbay", name: "Медвідсік Бети-7", type: "Приміщення", atmos: ["Тісний", "Тривожний"],
      desc: "Останній теплий куток станції, де Накамура тримає поранених під блимання резервного живлення.", scenes: [2], events: ["suit-breach"], factions: ["survivors"] },
  ],

  // ---- Events ----
  events: [
    { id: "silence", title: "Велике мовчання", when: "T−40 діб", act: 1, type: "Катастрофа", tone: "draft",
      desc: "Каскадний збій вимикає половину ретрансляторів системи за одну добу. Колонії втрачають зв'язок із Землею.",
      characters: ["dispatch"], locations: ["relay-belt", "earthcmd"], factions: ["earthgov"], artifacts: [] },
    { id: "collapse", title: "Падіння Гамма-9", when: "T−30 діб", act: 1, type: "Втрата", tone: "draft",
      desc: "Перша колонія замовкає повністю. Адміністрація приховує масштаб події.",
      characters: ["voss"], locations: ["gamma"], factions: ["admin"], artifacts: [] },
    { id: "beta7-last", title: "Остання передача з Бети-7", when: "T−12 діб", act: 1, type: "Поворот", tone: "review",
      desc: "Колонія надсилає фрагментарне повідомлення й замовкає. Маркуса відправляють перевірити вузол.",
      characters: ["marcus", "elena"], locations: ["beta7"], factions: ["survivors"], artifacts: ["blackbox"] },
    { id: "orion-detected", title: "Виявлено сигнал «Оріон»", when: "T−0", act: 2, type: "Загадка", tone: "review",
      desc: "Серед статики Елена фіксує впорядкований сигнал, що рухається швидше за світло. Джерело невідоме.",
      characters: ["elena", "orion"], locations: ["beta7"], factions: ["orion"], artifacts: ["orion-tx"] },
    { id: "suit-breach", title: "Пробій скафандра", when: "T+1 год", act: 2, type: "Загроза", tone: "draft",
      desc: "Скафандр Маркуса пошкоджено. Іві бере на себе контроль ресурсів повітря.",
      characters: ["marcus", "ivi", "nakamura"], locations: ["beta7", "medbay"], factions: [], artifacts: ["suit"] },
    { id: "storm", title: "Пилова буря накриває форпост", when: "T+2 год", act: 2, type: "Загроза", tone: "draft",
      desc: "Буря глушить усі частоти й ізолює героїв у командному центрі без зв'язку.",
      characters: ["marcus", "nakamura"], locations: ["beta7"], factions: [], artifacts: [] },
    { id: "helios-coverup", title: "Викриття «Геліос»", when: "T+1 доба", act: 2, type: "Розкриття", tone: "review",
      desc: "Чорний ящик доводить: збій мережі не був випадковим. Корпорація знала.",
      characters: ["brandt", "voss"], locations: ["helios", "earthcmd"], factions: ["helios", "admin"], artifacts: ["blackbox", "helios-files"] },
    { id: "alpha-reached", title: "Досягнуто «Альфа»", when: "T+2 доби", act: 3, type: "Прорив", tone: "ready",
      desc: "Герої доходять до останнього вузла. Дарія й Елена починають відновлення зв'язку.",
      characters: ["elena", "daria", "sisters", "rein"], locations: ["alpha"], factions: ["sisters"], artifacts: ["alpha-node", "quantum-key"] },
    { id: "mara-message", title: "Повідомлення Мари", when: "Перед фіналом", act: 3, type: "Зворушення", tone: "review",
      desc: "З Землі крізь відновлений канал пробивається голос доньки Маркуса.",
      characters: ["mara"], locations: ["earthcmd"], factions: ["earthgov"], artifacts: ["locket"] },
    { id: "finale", title: "Голос крізь зорі", when: "Фінал", act: 3, type: "Кульмінація", tone: "ready",
      desc: "Оріон озивається людським голосом. Те, що він каже, змінює сенс усієї тиші.",
      characters: ["marcus", "orion", "mara"], locations: [], factions: ["orion"], artifacts: ["orion-tx"] },
  ],

  // ---- Factions ----
  factions: [
    { id: "admin", name: "Колоніальна адміністрація", motto: "Порядок понад відстанню", align: "Нейтральна", tone: "done", power: 70, members: 4,
      desc: "Бюрократія, що керує колоніями. Втрата зв'язку підриває її владу — і вона приховує масштаб катастрофи.",
      characters: ["voss"], locations: ["earthcmd"], events: ["collapse", "helios-coverup"], artifacts: ["helios-files"] },
    { id: "helios", name: "Корпорація «Геліос»", motto: "Світло, яке ми продаємо", align: "Ворожа", tone: "draft", power: 85, members: 3,
      desc: "Власник інфраструктури ретрансляторів. Знала про вразливість мережі — і мовчала заради прибутку.",
      characters: ["brandt"], locations: ["helios"], events: ["helios-coverup"], artifacts: ["helios-files"] },
    { id: "sisters", name: "Сестри ретрансляції", motto: "Тримаємо останні вузли", align: "Союзна", tone: "ready", power: 35, members: 6,
      desc: "Розрізнена спільнота інженерів, що вручну підтримує робочі станції. Єдина надія відновити зв'язок.",
      characters: ["elena", "daria", "sisters"], locations: ["alpha", "relay-belt"], events: ["alpha-reached"], artifacts: ["alpha-node", "quantum-key"] },
    { id: "survivors", name: "Уцілілі Бети-7", motto: "Ще дихаємо", align: "Союзна", tone: "ready", power: 25, members: 9,
      desc: "Жменя колоністів, що пережили мовчання станції й тримаються разом під керівництвом Накамури.",
      characters: ["nakamura", "rein"], locations: ["beta7", "aurora", "medbay"], events: ["storm"], artifacts: [] },
    { id: "earthgov", name: "Уряд Землі", motto: "Ми чуємо вас", align: "Нейтральна", tone: "done", power: 60, members: 5,
      desc: "Далека земна влада, що втратила очі й вуха в колоніях і відчайдушно шукає сигнал.",
      characters: ["mara", "dispatch"], locations: ["earthcmd"], events: ["silence", "mara-message"], artifacts: [] },
    { id: "orion", name: "«Оріон»", motto: "—", align: "Невідома", tone: "anta", power: 0, members: 1,
      desc: "Джерело сигналу, що рухається швидше за світло. Мета, природа й кількість — за межею статики.",
      characters: ["orion"], locations: [], events: ["orion-detected", "finale"], artifacts: ["orion-tx"] },
  ],

  // ---- Artifacts ----
  artifacts: [
    { id: "alpha-node", name: "Ретранслятор «Альфа»", type: "Інфраструктура", rarity: "Унікальний", tone: "ready",
      owner: "sisters", location: "alpha", faction: "sisters", scene: 4, events: ["alpha-reached"], characters: ["elena", "daria", "sisters"],
      desc: "Єдиний вузол, що ще здатен дотягнутися до Землі. Полагодити його — мета всієї подорожі." },
    { id: "blackbox", name: "Чорний ящик колонії", type: "Запис", rarity: "Ключовий", tone: "review",
      owner: "marcus", location: "beta7", faction: "admin", scene: 3, events: ["beta7-last", "helios-coverup"], characters: ["marcus"],
      desc: "Містить останні години станції перед мовчанням. Доводить, що збій не був випадковим." },
    { id: "suit", name: "Скафандр Маркуса", type: "Спорядження", rarity: "Особистий", tone: "draft",
      owner: "marcus", location: "beta7", scene: 2, events: ["suit-breach"], characters: ["marcus", "ivi", "nakamura"],
      desc: "Пошкоджений у 2-й сцені; ним керує Іві. Запас повітря обмежений — кожна хвилина рахується." },
    { id: "orion-tx", name: "Передавач «Оріон»", type: "Аномалія", rarity: "Легендарний", tone: "anta",
      owner: "orion", faction: "orion", scene: 9, events: ["orion-detected", "finale"], characters: ["orion"],
      desc: "Об'єкт-джерело надсвітлового сигналу. Не описаний жодним каталогом людських технологій." },
    { id: "quantum-key", name: "Квантовий ключ", type: "Пристрій", rarity: "Рідкісний", tone: "ready",
      owner: "daria", location: "alpha", faction: "sisters", scene: 8, events: ["alpha-reached"], characters: ["daria", "elena"],
      desc: "Шифр-ключ, без якого ретранслятор «Альфа» не вийде на земну частоту." },
    { id: "helios-files", name: "Файли «Геліос»", type: "Дані", rarity: "Ключовий", tone: "draft",
      owner: "brandt", location: "helios", faction: "helios", scene: 6, events: ["helios-coverup"], characters: ["brandt", "voss"],
      desc: "Внутрішні звіти, що доводять обізнаність корпорації про вразливість мережі." },
    { id: "locket", name: "Медальйон Мари", type: "Реліквія", rarity: "Особистий", tone: "review",
      owner: "marcus", location: "beta7", scene: 7, events: ["mara-message", "finale"], characters: ["marcus", "mara"],
      desc: "Маленький медальйон із голограмою доньки. Причина, з якої Маркус не здається." },
  ],

  scenes: [
    { n: 1, title: "Тиша над колонією", act: 1, events: ["silence"] },
    { n: 2, title: "Перший контакт", act: 1, events: ["beta7-last"] },
    { n: 3, title: "Зламаний ретранслятор", act: 1, events: ["suit-breach"] },
    { n: 4, title: "Сигнал", act: 2, events: ["orion-detected"] },
    { n: 5, title: "Повернення надії", act: 2, events: [] },
    { n: 6, title: "Корпоративна брехня", act: 2, events: ["helios-coverup"] },
    { n: 7, title: "Ціна тиші", act: 3, events: ["storm"] },
    { n: 8, title: "Остання передача", act: 3, events: ["alpha-reached"] },
    { n: 9, title: "Голос крізь зорі", act: 3, events: ["finale"] },
  ],

  // ---- Narrative layer (what DEPENDS ON the canon) ----
  // Each item references entities by target-type-plural, so the dependency
  // index can answer "what is affected if I change this entity?".
  dialogues: [
    { id: "dlg-silence", scene: 1, title: "Тиша в ефірі", line: "— Базо, ви мене чуєте?.. Базо?", characters: ["marcus", "dispatch"], locations: ["beta7", "earthcmd"] },
    { id: "dlg-contact", scene: 2, title: "Перший контакт", line: "— Ти не сам. Я ще тримаю вузол.", characters: ["marcus", "elena"], locations: ["beta7"] },
    { id: "dlg-console", scene: 3, title: "Мертва консоль", line: "— Іві, скільки повітря? — Достатньо, щоб спробувати ще раз.", characters: ["marcus", "ivi"], locations: ["beta7"], artifacts: ["suit"] },
    { id: "dlg-signal", scene: 4, title: "Сигнал у статиці", line: "— Це не шум. Це хтось.", characters: ["elena"], locations: ["alpha"], artifacts: ["alpha-node"] },
    { id: "dlg-hope", scene: 5, title: "Повернення надії", line: "— Ще один форпост. Ще один шанс.", characters: ["marcus", "rein"], locations: ["aurora"] },
    { id: "dlg-lie", scene: 6, title: "Корпоративна правда", line: "— Вони знали. Весь цей час вони знали.", characters: ["brandt", "voss"], locations: ["earthcmd"], factions: ["helios"], artifacts: ["helios-files"] },
    { id: "dlg-cost", scene: 7, title: "Ціна тиші", line: "— Якщо я не повернуся — передай їй, що я чув.", characters: ["marcus", "ivi"], locations: ["beta7"], artifacts: ["locket"] },
    { id: "dlg-last", scene: 8, title: "Остання передача", line: "— Канал відкрито. Говори, Земле.", characters: ["elena", "daria"], locations: ["alpha"], artifacts: ["quantum-key"] },
    { id: "dlg-voice", scene: 9, title: "Голос крізь зорі", line: "— Тату? — Я тут. Я завжди був тут.", characters: ["marcus", "orion", "mara"], artifacts: ["orion-tx"] },
  ],
  arcs: [
    { id: "arc-marcus", title: "Шлях Маркуса", span: "Акт 1–3", desc: "Від відчаю до надії крізь мовчання мережі.",
      characters: ["marcus", "ivi", "mara"], scenes: [1, 3, 5, 7, 9], events: ["silence", "finale"], artifacts: ["suit", "locket"] },
    { id: "arc-elena", title: "Становлення Елени", span: "Акт 1–3", desc: "Від сумніву до впевненості майстра ретрансляції.",
      characters: ["elena", "daria"], scenes: [2, 3, 4, 8], events: ["orion-detected", "alpha-reached"], factions: ["sisters"], artifacts: ["alpha-node", "quantum-key"] },
    { id: "arc-silence", title: "Велике мовчання", span: "Акт 1–2", desc: "Хроніка розпаду мережі та її прихованих причин.",
      characters: ["dispatch", "voss"], scenes: [1, 6], events: ["silence", "collapse", "helios-coverup"], locations: ["relay-belt", "gamma"], factions: ["helios", "admin"] },
    { id: "arc-helios", title: "Брехня «Геліос»", span: "Акт 2", desc: "Викриття корпоративної причетності до катастрофи.",
      characters: ["brandt", "voss", "elena"], scenes: [6], events: ["helios-coverup"], factions: ["helios"], artifacts: ["helios-files", "blackbox"] },
    { id: "arc-orion", title: "Загадка Оріона", span: "Акт 2–3", desc: "Природа надсвітлового сигналу й те, ким він виявиться.",
      characters: ["orion", "marcus", "mara"], scenes: [4, 9], events: ["orion-detected", "finale"], artifacts: ["orion-tx"], factions: ["orion"] },
  ],
  shots: [
    { id: "sh-1", scene: 1, title: "Дрон над колонією", camera: "Wide · Drone", type: "Wide · Exterior", dur: "5s", angle: "High angle", subject: "Покинута колонія Бета-7", light: "Холодне світанкове, червоний пил", moods: ["Ізоляція", "Небезпека"], generated: true, prompt: "Wide aerial shot of an abandoned Mars colony, red dust storm approaching, dead solar arrays, cinematic dawn light, anamorphic --ar 16:9 --style raw", locations: ["beta7"] },
    { id: "sh-2", scene: 2, title: "Маркус у коридорі", camera: "Medium · Tracking", type: "Medium · Tracking", dur: "8s", angle: "Eye level", subject: "Маркус у скафандрі", light: "Контровий, пил розсіює промені", moods: ["Напруга"], generated: true, prompt: "Medium tracking shot, astronaut in worn orange suit walking abandoned Mars corridor, flickering emergency lights, volumetric dust --ar 16:9 --style raw", characters: ["marcus"], locations: ["beta7"] },
    { id: "sh-3", scene: 3, title: "Руки на консолі", camera: "Close-up · Static", type: "Close-up · Static", dur: "3s", angle: "Slight low angle", subject: "Руки Маркуса на мертвій консолі", light: "Єдиний червоний аварійний LED", moods: ["Розпач", "Тиша"], generated: false, prompt: "Extreme close-up of gloved hands on a dead control console, single red LED reflecting on the visor, tense stillness --ar 16:9 --style raw", characters: ["marcus"], locations: ["beta7"], artifacts: ["suit"] },
    { id: "sh-4", scene: 3, title: "Погляд крізь візор", camera: "CU", type: "Close-up", dur: "2s", angle: "Eye level", subject: "Очі Маркуса крізь візор", light: "Відблиск LED на склі шолома", moods: ["Тиша"], generated: false, prompt: "Close-up of weary eyes behind a fogged helmet visor, faint red light, condensation, shallow focus --ar 16:9 --style raw", characters: ["marcus", "ivi"], dialogue: [{ speaker: "Маркус", line: "Іві, скільки повітря лишилось?", emotion: "стримано, втомлено" }, { speaker: "Іві", line: "Чотири хвилини. Раджу не говорити.", emotion: "спокійно, штучно" }], locations: ["beta7"] },
    { id: "sh-5", scene: 4, title: "Хвиля сигналу", camera: "Insert", type: "Insert · Static", dur: "2s", angle: "Macro", subject: "Хвиля сигналу на екрані", light: "Зелене сяйво осцилоскопа", moods: ["Загадка"], generated: true, prompt: "Macro insert of an oscilloscope waveform, ordered signal emerging from static, green phosphor glow, retro hardware --ar 16:9 --style raw", characters: ["elena"], locations: ["alpha"], artifacts: ["alpha-node"] },
    { id: "sh-6", scene: 5, title: "«Аврора» в пилу", camera: "Wide", type: "Wide", dur: "6s", angle: "Low angle", subject: "Транспорт «Аврора» крізь бурю", light: "Фари крізь червону імлу", moods: ["Надія"], generated: false, prompt: "Wide low-angle of a small rescue transport cutting through a red dust storm, headlights blooming, hopeful tone --ar 16:9 --style raw", characters: ["rein", "marcus"], locations: ["aurora"] },
    { id: "sh-7", scene: 6, title: "Брандт у тіні", camera: "Medium · Low-key", type: "Medium · Low-key", dur: "5s", angle: "Eye level", subject: "Антон Брандт біля вікна штабу", light: "Жорстке бічне, глибокі тіні", moods: ["Загроза"], generated: true, prompt: "Medium low-key portrait of a corporate man by a window over Earth orbit, hard side light, deep shadows, cold blue --ar 16:9 --style raw", characters: ["brandt"], locations: ["helios"], artifacts: ["helios-files"] },
    { id: "sh-8", scene: 7, title: "Медальйон у руці", camera: "ECU", type: "Extreme CU", dur: "3s", angle: "Top-down", subject: "Медальйон із голограмою доньки", light: "Тепле точкове в темряві", moods: ["Втрата", "Ніжність"], generated: false, prompt: "Extreme close-up of a gloved hand opening a locket with a small hologram of a child, warm key light in darkness --ar 16:9 --style raw", characters: ["marcus"], locations: ["beta7"], artifacts: ["locket"] },
    { id: "sh-9", scene: 8, title: "Канал відкрито", camera: "Medium", type: "Medium", dur: "5s", angle: "Eye level", subject: "Елена й Дарія біля ретранслятора", light: "Блимання консолі, іскри", moods: ["Полегшення"], generated: false, prompt: "Medium shot of two engineers at a glowing relay console, sparks, a channel finally opening, relief on their faces --ar 16:9 --style raw", characters: ["elena", "daria"], locations: ["alpha"], artifacts: ["quantum-key"] },
    { id: "sh-10", scene: 9, title: "Голос крізь зорі", camera: "Wide · Push-in", type: "Wide · Push-in", dur: "10s", angle: "Eye level", subject: "Маркус слухає голос крізь зорі", light: "Холодне зоряне сяйво", moods: ["Катарсис"], generated: false, prompt: "Slow push-in on an astronaut bathed in cold starlight, a human voice breaking through static, transcendent finale --ar 16:9 --style raw", characters: ["marcus", "mara"], events: ["finale"] },
  ],

  // ---- Narrative grouping: chapters gather scenes ----
  chapters: [
    { id: "ch-1", title: "Розділ I · Тиша", act: 1, scenes: [1, 2, 3] },
    { id: "ch-2", title: "Розділ II · Сигнал", act: 2, scenes: [4, 5, 6] },
    { id: "ch-3", title: "Розділ III · Голос", act: 3, scenes: [7, 8, 9] },
  ],

  // ---- Director layer ----
  // storyboards belong to a scene; shots belong to a scene; images to a shot.
  storyboards: [
    { id: "stb-1", scene: 1, title: "Розкадровка · Тиша над колонією" },
    { id: "stb-2", scene: 2, title: "Розкадровка · Перший контакт" },
    { id: "stb-3", scene: 3, title: "Розкадровка · Зламаний ретранслятор" },
    { id: "stb-4", scene: 4, title: "Розкадровка · Сигнал" },
    { id: "stb-5", scene: 5, title: "Розкадровка · Повернення надії" },
    { id: "stb-6", scene: 6, title: "Розкадровка · Корпоративна брехня" },
    { id: "stb-7", scene: 7, title: "Розкадровка · Ціна тиші" },
    { id: "stb-8", scene: 8, title: "Розкадровка · Остання передача" },
    { id: "stb-9", scene: 9, title: "Розкадровка · Голос крізь зорі" },
  ],
  images: [
    { id: "im-1", shot: "sh-1", status: "done" }, { id: "im-2", shot: "sh-2", status: "done" },
    { id: "im-3", shot: "sh-3", status: "pending" }, { id: "im-4", shot: "sh-4", status: "pending" },
    { id: "im-5", shot: "sh-5", status: "done" }, { id: "im-6", shot: "sh-6", status: "pending" },
    { id: "im-7", shot: "sh-7", status: "done" }, { id: "im-8", shot: "sh-8", status: "pending" },
    { id: "im-9", shot: "sh-9", status: "pending" }, { id: "im-10", shot: "sh-10", status: "pending" },
  ],
};

// ---- resolvers ----
const W_TYPES = ["characters", "locations", "events", "factions", "artifacts"];
function wEnt(type, id) { return (WORLD[type] || []).find((e) => e.id === id) || null; }
function wTitle(type, e) { return type === "events" ? e.title : e.name; }

// All connections of an entity (forward links + derived reverse links),
// returned as [{ type, id, rel }]. `rel` carries relationship flavour when known.
// Memoised — WORLD is read-only at runtime.
const _connCache = new Map();
function wConnections(type, id) {
  const _ck = type + ":" + id;
  if (_connCache.has(_ck)) return _connCache.get(_ck);
  const _r = _computeConnections(type, id);
  _connCache.set(_ck, _r);
  return _r;
}
function _computeConnections(type, id) {
  const e = wEnt(type, id);
  if (!e) return [];
  const out = [], seen = new Set();
  const push = (t, i, rel) => {
    if (!i) return; const k = t + ":" + i;
    if (seen.has(k) || (t === type && i === id)) return;
    if (!wEnt(t, i)) return;
    seen.add(k); out.push({ type: t, id: i, rel });
  };
  // forward
  W_TYPES.forEach((t) => (e[t] || []).forEach((i) => push(t, i)));
  (e.relations || []).forEach((r) => push("characters", r.id, r.kind));
  push("characters", e.owner, "власник");
  push("locations", e.location);
  push("factions", e.faction);
  // reverse — scan every entity for a link back to (type,id)
  W_TYPES.forEach((t) => WORLD[t].forEach((o) => {
    if (t === type && o.id === id) return;
    if ((o[type] || []).includes(id)) push(t, o.id);
    if (type === "characters" && (o.relations || []).some((r) => r.id === id)) push(t, o.id, ((o.relations || []).find((r) => r.id === id) || {}).kind);
    if (type === "characters" && o.owner === id) push(t, o.id);
    if (type === "locations" && o.location === id) push(t, o.id);
    if (type === "factions" && o.faction === id) push(t, o.id);
  }));
  return out;
}

window.WORLD = WORLD;
window.wEnt = wEnt; window.wTitle = wTitle; window.wConnections = wConnections; window.W_TYPES = W_TYPES;

// ---- dependency / "Referenced By" index ----
// Derive each scene's direct entity references from the canon (single source
// of truth: entity.scenes / artifact.scene). Events & factions are abstract
// and intentionally NOT bound to scenes here.
WORLD.scenes.forEach((s) => {
  s.characters = WORLD.characters.filter((c) => (c.scenes || []).includes(s.n)).map((c) => c.id);
  s.locations = WORLD.locations.filter((l) => (l.scenes || []).includes(s.n)).map((l) => l.id);
  s.artifacts = WORLD.artifacts.filter((a) => a.scene === s.n).map((a) => a.id);
});

// Everything in the narrative layer that DEPENDS ON an entity.
const NARRATIVE = ["scenes", "dialogues", "arcs", "shots"];
function wReferences(type, id) {
  const out = {};
  NARRATIVE.forEach((k) => { out[k] = WORLD[k].filter((item) => (item[type] || []).includes(id)); });
  return out;
}
function wImpact(type, id) {
  const r = wReferences(type, id);
  const o = { total: 0 };
  NARRATIVE.forEach((k) => { o[k] = r[k].length; o.total += r[k].length; });
  return o;
}
function wScene(n) { return WORLD.scenes.find((s) => s.n === n) || null; }

window.wReferences = wReferences; window.wImpact = wImpact; window.wScene = wScene; window.NARRATIVE = NARRATIVE;
