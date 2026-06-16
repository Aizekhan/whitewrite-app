// Page content — everything lives as part of the book, never as a modal panel.
const { useState: useReactState } = React;

// A drop-cap opening line for prose pages.
function Prose({ first, children }) {
  return (
    <p className="prose">
      {first && <span className="prose__cap">{first}</span>}
      {children}
    </p>);

}

// An AI annotation that lives in the margin, in the voice of a story-keeper.
// No scores, no health bars — only a quiet observation.
function MarginNote({ children }) {
  return (
    <aside className="margin-note">
      <span className="margin-note__rune">❦</span>
      <span className="margin-note__body">{children}</span>
    </aside>);

}

function PageHeader({ kicker, title }) {
  return (
    <header className="page-head">
      {kicker && <div className="page-head__kicker">{kicker}</div>}
      <h2 className="page-head__title">{title}</h2>
      <div className="page-head__rule" />
    </header>);

}

function Folio({ n }) {
  return <div className="folio">{n}</div>;
}

// --- Spread content blocks ------------------------------------------------

// Title / threshold page of the universe.
function TitlePage({ title = "Попіл Орелії" }) {
  return (
    <div className="page-inner page-title" style={{ gap: "0px", textAlign: "center" }}>
      <div className="title-mark">✶</div>
      <div className="title-kicker">Книга перша</div>
      <h1 className="title-name">{title}</h1>
      <div className="title-sub">всесвіт, що дихає у темряві бібліотеки</div>
      <div className="title-orn">· ✦ ·</div>
      <p className="title-epigraph">
        «Коли згасне остання зоря, хтось мусить пам’ятати, якою була ніч до неї.»
      </p>
      <Folio n="i" />
    </div>);

}

function StoryOpening() {
  return (
    <div className="page-inner">
      <PageHeader kicker="Пролог" title="Тиша над містом" />
      <Prose first="К">
        оли впала остання зоря над Орелією, місто не закричало. Воно затихло —
        так затихає людина, що нарешті почула власне ім’я з вуст того, кого
        давно вважала мертвим.
      </Prose>
      <MarginNote>У цьому моменті Елена здається самотньою.</MarginNote>
      <Prose>
        Десь під містом прокинувся голос. Він не кликав її — він просто почав
        рахувати від тисячі донизу.
      </Prose>
      <Folio n="1" />
    </div>);

}

function StoryContinued() {
  return (
    <div className="page-inner">
      <PageHeader kicker="Розділ перший" title="Жертва Оракула" />
      <Prose first="О">
        ракул чекав на неї там, де закінчувалися мапи. Він пам’ятав не минуле —
        він пам’ятав уперед, і кожен спогад був раною, якої ще не сталося.
      </Prose>
      <Prose>
        «Щоб місто вдихнуло, — сказав він, — хтось має затримати подих назавжди.»
        Елена зрозуміла ціну раніше, ніж він договорив.
      </Prose>
      <MarginNote>Тут історія затримує подих перед великим відкриттям.</MarginNote>
      <Folio n="2" />
    </div>);

}

// Characters — portraits as honest placeholders, bios as part of the page.
function CharacterCard({ name, role, lines }) {
  return (
    <div className="char char--text">
      <div className="char__meta">
        <div className="char__name">{name}</div>
        <div className="char__role">{role}</div>
        <p className="char__lines">{lines}</p>
      </div>
    </div>);

}

function CharactersLeft() {
  return (
    <div className="page-inner">
      <PageHeader kicker="Дійові особи" title="Ті, що носять світло" />
      <CharacterCard
        name="Елена"
        role="Хранителька попелу"
        lines="Остання, хто пам’ятає Орелію живою — несе те, що інші воліли б забути." />
      
      <CharacterCard
        name="Оракул"
        role="Той, що пам’ятає вперед"
        lines="Бачить кожен фінал раніше за початок. Його дар — і є його вирок." />
      
      <Folio n="3" />
    </div>);

}

function CharactersRight() {
  return (
    <div className="page-inner">
      <PageHeader kicker="Дійові особи" title="Голоси під містом" />
      <CharacterCard
        name="Маровит"
        role="Голос під містом"
        lines="Рахує зорі донизу. Ніхто не бачив його обличчя — лише чув, як стихає світ." />
      
      <CharacterCard
        name="Сестри Солі"
        role="Хор мосту"
        lines="Тримають межу між водою та небом. Співають, лише коли хтось має зникнути." />
      
      <Folio n="4" />
    </div>);

}

// Cartography — pure prose, no map illustration (the book stays text-only).
function WorldMapSpread() {
  return (
    <div className="page-inner">
      <PageHeader kicker="Картографія" title="Відомий світ" />
      <Prose first="С">
        віт Орелії тісний, як долоня. У його серці — саме місто, оточене
        Тихими долами на півночі та Соляним морем, що дихає сіллю й туманом.
      </Prose>
      <Prose>
        За Підмістям, де вулиці спускаються в темряву, стоїть Вежа Оракула —
        там, де закінчуються всі мапи. Шлях Елени веде від Соляного мосту
        до Вежі — і світ звужується разом із нею.
      </Prose>
      <MarginNote>Соляне море, Тихі доли, Край мап — імена, що чекають своїх сцен.</MarginNote>
      <Folio n="5" />
    </div>);

}

// End-of-scene Scene Intent: the heart of Story Navigation. After the last
// written scene, the keeper asks "what next?" — the reader sets a DIRECTION,
// not a prompt, then generates the next scene.
function SceneIntentPage() {
  const INTENTS = [
    { id: "conflict", icon: "⚔", t: "Конфлікт", d: "зіткнення, ставки ростуть" },
    { id: "character", icon: "❦", t: "Розвиток персонажа", d: "внутрішня зміна, вибір" },
    { id: "action", icon: "✦", t: "Екшн", d: "рух, погоня, небезпека" },
    { id: "romance", icon: "♥", t: "Романтика", d: "близькість, тепло, напруга" },
    { id: "world", icon: "✶", t: "Світобудова", d: "глибше у канон світу" },
    { id: "twist", icon: "↯", t: "Поворот", d: "підрив очікувань" },
    { id: "surprise", icon: "✷", t: "Сюрприз від AI", d: "довірити напрям Хранителю" },
    { id: "custom", icon: "✎", t: "Свій напрям", d: "опиши, що хочеш побачити" },
  ];
  const [sel, setSel] = useReactState("");
  const [note, setNote] = useReactState("");
  const [busy, setBusy] = useReactState(false);
  const cur = INTENTS.find((o) => o.id === sel);
  const canGo = sel && (sel !== "custom" || note.trim().length > 0);
  async function generate() {
    if (!canGo || busy) return;

    const projectId = window.__currentProjectId;
    if (!projectId) {
      alert('Проєкт не знайдено. Спробуйте створити новий.');
      return;
    }

    // Phase 1.2: Check token balance BEFORE generation
    const user = window.__wwUser;
    if (!user || !user.uid) {
      alert('Увійдіть в акаунт для генерації сцен.');
      return;
    }

    // Get cost for scene generation (default to Gemini)
    const cost = window.__TOKEN_COSTS?.sceneGemini || 20;
    if (user.tokensRemaining < cost) {
      console.warn(`Insufficient tokens: need ${cost}, have ${user.tokensRemaining}`);

      // Show upgrade modal
      const planName = window.__getPlanConfig ? window.__getPlanConfig(user.plan).name : 'Free';
      const message = `Недостатньо токенів для генерації сцени!\n\nПотрібно: ${cost} токенів\nДоступно: ${user.tokensRemaining} токенів\n\nВаш поточний план: ${planName}\n\nОберіть більший план для продовження генерації.`;

      if (confirm(message + '\n\nВідкрити налаштування акаунту?')) {
        // Open account modal
        if (typeof window.__openAccount === 'function') {
          window.__openAccount();
        }
      }
      return; // BLOCK generation
    }

    setBusy(true);

    try {
      // F2: Load previous scenes for continuity (last 2-3 scenes)
      let previousScenes = [];
      if (window.__firebaseScenes) {
        try {
          const allScenes = await window.__firebaseScenes.getScenes(projectId);
          // Take last 2-3 scenes for context
          const contextCount = Math.min(3, allScenes.length);
          previousScenes = allScenes.slice(-contextCount).map(s => ({
            title: s.title,
            text: s.text,
            n: s.n
          }));
          console.log(`Continuity: passing ${previousScenes.length} previous scenes`);
        } catch (err) {
          console.error('Failed to load previous scenes:', err);
        }
      }

      const result = await window.__firebaseAI.generateScene(
        projectId,
        sel,
        sel === 'custom' ? note : null,
        previousScenes
      );

      if (result.success) {
        console.log('Scene generated:', result.scene);

        // D4: Save scene to Firestore
        if (window.__firebaseScenes) {
          try {
            const savedScene = await window.__firebaseScenes.addScene(projectId, {
              title: result.scene.title,
              text: result.scene.text,
              intent: result.scene.intent,
              customIntent: sel === 'custom' ? note : null,
              entities: {
                characters: result.scene.entities?.filter(e => e.type === 'character').map(e => e.id) || [],
                locations: result.scene.entities?.filter(e => e.type === 'location').map(e => e.id) || [],
                events: [],
                artifacts: []
              }
            });
            console.log('Scene saved to Firestore:', savedScene.id);

            // D5: Trigger book reload to show new scene
            if (window.__reloadBook) {
              window.__reloadBook({ jumpToLast: true });
            } else {
              alert(`Сцена збережена!\n\n"${result.scene.title}"\n\nОновіть сторінку, щоб побачити її в книзі.`);
            }
          } catch (saveError) {
            console.error('Failed to save scene:', saveError);
            alert('Сцена згенерована, але не вдалося зберегти: ' + saveError.message);
          }
        } else {
          alert(`Сцена згенерована!\n\nНазва: ${result.scene.title}\n\n(Firebase не підключений)`);
        }
      } else {
        alert('Помилка генерації: ' + result.error);
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Помилка: ' + error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-inner page-intent">
      <PageHeader kicker="Сцена 3 завершена" title="Що далі?" />
      <p className="intent__lead">Задай напрям — або опиши свій. Хранитель напише наступну сцену, спираючись на канон.</p>
      <label className="intent-field">
        <span className="intent-field__lbl">Напрям наступної сцени</span>
        <select className="intent-select" value={sel} onChange={(ev) => setSel(ev.target.value)}>
          <option value="" disabled>Оберіть напрям…</option>
          {INTENTS.map((o) => <option key={o.id} value={o.id}>{o.icon}  {o.t} — {o.d}</option>)}
        </select>
      </label>
      {sel === "custom" && (
        <textarea className="intent-note" value={note} onChange={(ev) => setNote(ev.target.value)}
          placeholder="Напр.: Маркус знаходить лист від Олени й вирішує повернутись на станцію…" rows={3} />
      )}
      {/* Phase 1.2: Token balance indicator + Phase 1.3: Feature gates info */}
      {(() => {
        const user = window.__wwUser;
        const cost = window.__TOKEN_COSTS?.sceneGemini || 20;
        const canAfford = user && user.tokensRemaining >= cost;
        const balanceClass = canAfford ? 'intent-balance' : 'intent-balance intent-balance--low';
        const planConfig = window.__getPlanConfig ? window.__getPlanConfig(user?.plan) : null;

        return user ? (
          <>
            <div className={balanceClass}>
              <span className="intent-balance__label">Вартість генерації:</span>
              <span className="intent-balance__cost">{cost} токенів</span>
              <span className="intent-balance__sep">·</span>
              <span className="intent-balance__remaining">
                {canAfford ? `Доступно: ${user.tokensRemaining}` : `⚠ Недостатньо токенів (${user.tokensRemaining})`}
              </span>
            </div>
            {/* Phase 1.3: Feature gates indicator */}
            {planConfig && (!planConfig.allowClaude || !planConfig.allowImages) && (
              <div className="intent-features">
                <span className="intent-features__label">Провайдер:</span>
                <span className="intent-features__provider">✦ Gemini Flash (швидкий, економний)</span>
                {!planConfig.allowClaude && (
                  <span className="intent-features__upgrade">
                    · Claude Sonnet доступний з плану Novelist →
                  </span>
                )}
              </div>
            )}
          </>
        ) : null;
      })()}
      <button className="intent-gen" type="button" onClick={generate} disabled={!canGo || busy}>
        {busy ? "✦ Хранитель пише…" : "✦ Генерувати наступну сцену"}
      </button>
      <Folio n="vi" />
    </div>);

}

function ColophonPage() {
  return (
    <div className="page-inner page-title">
      <div className="title-mark">✶</div>
      <div className="title-sub">кінець відомих сторінок</div>
      <p className="title-epigraph">
        Книга не закінчується. Вона лише чекає, поки ти напишеш наступний подих.
      </p>
      <div className="title-orn">· ✦ ·</div>
      <button className="quill" type="button" data-write="1">
        ✒ Продовжити історію
      </button>
      <Folio n="vi" />
    </div>);

}

Object.assign(window, {
  TitlePage, StoryOpening, StoryContinued,
  CharactersLeft, CharactersRight, WorldMapSpread, ColophonPage, SceneIntentPage
});