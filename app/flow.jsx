// Stage 0 (start) and Stage 1 (story form). Each renders its own atmosphere
// so crossfades between stages never flash.
const { useState: useFState } = React;

// ── Stage 0 ─────────────────────────────────────────────────────────────
// The user's own hero art (StartBack.png) leads. The whole scene is the
// doorway — click anywhere to open a universe. Particles add living light.
function StartScreen({ onBegin }) {
  return (
    <div className="screen screen--start stage-screen">
      <img className="hero-img" src="assets/StartBack.jpg" alt="Хранитель історій з живою книгою" />
      <div className="hero-scrim" aria-hidden="true" />
      <Particles density={0.7} />
      <div className="vignette" aria-hidden="true" />

      <div className="hero-mark">WhiteWrite<span className="hero-mark__by">by White Tree</span></div>

      <div className="hero-quote">
        «Історії — це магія, що творить світи.»
        <span className="hero-quote__orn">· ✦ ·</span>
      </div>

      <div className="hero-panel" onClick={(e) => e.stopPropagation()}>
        <h1 className="hero-title">Твоя історія<br/>чекає</h1>
        <p className="hero-lede">Легко створюй казки, серіали, аніме, книги й документалки — будь-якого жанру.</p>
        <button className="hero-cta" type="button" onClick={(e) => { e.stopPropagation(); try { if (window.parent && window.parent.__wwAuth === false) { window.parent.__wwOpenAuth && window.parent.__wwOpenAuth(); return; } } catch (err) {} onBegin(); }}>
          <span className="hero-cta__star">✦</span> Створити свою історію
        </button>
      </div>

      <div className="hero-feature" onClick={(e) => e.stopPropagation()}>
        <div className="hero-feature__beta">нова можливість</div>
        <div className="hero-feature__t">🎬 Доведи історію до відео</div>
        <div className="hero-feature__d">Хочеш більшого? Розкадруй сцени на кадри й натренуй <b>LoRA</b>-референси персонажів — і твій світ готовий стати серією відеороликів зі сталими образами.</div>
      </div>

      <div className="hero-buybook" onClick={(e) => e.stopPropagation()}>
        <div className="hero-buybook__beta">бета</div>
        <div className="hero-buybook__t">Надрукуй свою історію<br/>у справжній книзі</div>
        <div className="hero-buybook__d">Стародавня обкладинка · подарунок · унікальний фоліант на полицю</div>
        <button className="hero-buybook__btn" type="button" onClick={() => { try { window.parent.postMessage({ type: "ww-buybook" }, "*"); } catch (err) {} }}>📦 Замовити книгу</button>
      </div>
    </div>
  );
}

// ── small form controls ──────────────────────────────────────────────────
function Segmented({ options, value, onChange, disabled }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`seg__opt ${value === o.value ? "is-on" : ""}`}
          onClick={() => !disabled && onChange(o.value)}
          disabled={disabled}
        >
          {o.icon && <span className="seg__icon">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function WordSlider({ value, onChange, disabled }) {
  return (
    <div className="wslider">
      <input
        type="range" min="200" max="2000" step="100"
        value={value}
        onChange={(e) => !disabled && onChange(+e.target.value)}
        style={{ "--fill": ((value - 200) / 1800) * 100 + "%" }}
        disabled={disabled}
      />
      <div className="wslider__row">
        <span>200</span>
        <span className="wslider__val">{value} слів / сцена</span>
        <span>2000</span>
      </div>
    </div>
  );
}

// Genre / tone palette — a broad, current spread the writer can mix.
const GENRES = [
  "Фентезі", "Темне фентезі", "Hard SF", "Космоопера", "Кіберпанк",
  "Постапокаліпсис", "Горор", "Містика", "Детектив", "Трилер",
  "Романтика", "Пригоди", "Історичне", "Міф і казка", "Аніме / манґа",
  "Драма", "Комедія", "Янг-адалт", "Слайс-оф-лайф", "Вестерн",
];

// World languages for project language selection
const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "uk", name: "Українська (Ukrainian)" },
  { code: "es", name: "Español (Spanish)" },
  { code: "zh", name: "中文 (Chinese)" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "pt", name: "Português (Portuguese)" },
  { code: "bn", name: "বাংলা (Bengali)" },
  { code: "ru", name: "Русский (Russian)" },
  { code: "ja", name: "日本語 (Japanese)" },
  { code: "pa", name: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "de", name: "Deutsch (German)" },
  { code: "jv", name: "Basa Jawa (Javanese)" },
  { code: "ko", name: "한국어 (Korean)" },
  { code: "fr", name: "Français (French)" },
  { code: "te", name: "తెలుగు (Telugu)" },
  { code: "mr", name: "मराठी (Marathi)" },
  { code: "tr", name: "Türkçe (Turkish)" },
  { code: "ta", name: "தமிழ் (Tamil)" },
  { code: "vi", name: "Tiếng Việt (Vietnamese)" },
  { code: "ur", name: "اردو (Urdu)" },
  { code: "it", name: "Italiano (Italian)" },
  { code: "th", name: "ไทย (Thai)" },
  { code: "gu", name: "ગુજરાતી (Gujarati)" },
  { code: "pl", name: "Polski (Polish)" },
  { code: "fa", name: "فارسی (Persian)" },
  { code: "ml", name: "മലയാളം (Malayalam)" },
  { code: "kn", name: "ಕನ್ನಡ (Kannada)" },
  { code: "or", name: "ଓଡ଼ିଆ (Odia)" },
  { code: "my", name: "မြန်မာ (Burmese)" },
  { code: "nl", name: "Nederlands (Dutch)" },
  { code: "sv", name: "Svenska (Swedish)" },
  { code: "he", name: "עברית (Hebrew)" },
  { code: "el", name: "Ελληνικά (Greek)" },
  { code: "cs", name: "Čeština (Czech)" },
  { code: "ro", name: "Română (Romanian)" },
  { code: "hu", name: "Magyar (Hungarian)" },
  { code: "da", name: "Dansk (Danish)" },
  { code: "fi", name: "Suomi (Finnish)" },
  { code: "no", name: "Norsk (Norwegian)" },
  { code: "sk", name: "Slovenčina (Slovak)" },
  { code: "bg", name: "Български (Bulgarian)" },
  { code: "hr", name: "Hrvatski (Croatian)" },
  { code: "sr", name: "Српски (Serbian)" },
  { code: "lt", name: "Lietuvių (Lithuanian)" },
  { code: "sl", name: "Slovenščina (Slovenian)" },
  { code: "lv", name: "Latviešu (Latvian)" },
  { code: "et", name: "Eesti (Estonian)" },
  { code: "is", name: "Íslenska (Icelandic)" },
  { code: "ga", name: "Gaeilge (Irish)" },
  { code: "cy", name: "Cymraeg (Welsh)" },
  { code: "mt", name: "Malti (Maltese)" }
];

// Genre → default dialogue density (0 none … 100 dialogue-driven).
const GENRE_DIALOGUE = {
  "Документалка": 10, "Міф і казка": 30, "Історичне": 45, "Горор": 35, "Містика": 40,
  "Постапокаліпсис": 40, "Hard SF": 50, "Космоопера": 55, "Пригоди": 50, "Вестерн": 50,
  "Фентезі": 50, "Темне фентезі": 50, "Кіберпанк": 55, "Трилер": 60, "Детектив": 65,
  "Слайс-оф-лайф": 70, "Романтика": 75, "Драма": 75, "Комедія": 70, "Янг-адалт": 70,
  "Аніме / манґа": 80,
};
function dialogueDefault(genres) {
  if (!genres || !genres.length) return 50;
  var sum = 0, n = 0;
  genres.forEach(function (g) { if (GENRE_DIALOGUE[g] != null) { sum += GENRE_DIALOGUE[g]; n++; } });
  return n ? Math.round(sum / n) : 50;
}
function dialogueLabel(v) {
  if (v <= 15) return "Майже без діалогів";
  if (v <= 38) return "Більше розповіді";
  if (v <= 62) return "Збалансовано";
  if (v <= 82) return "Більше діалогів";
  return "Діалоги ведуть сцену";
}

// ── Stage 1 ─────────────────────────────────────────────────────────────
function StoryForm({ onBack, onCreate }) {
  const [description, setDescription] = useFState("");
  const [title, setTitle] = useFState("");
  const [language, setLanguage] = useFState("en");       // Default: English (буде dropdown з усіма мовами)
  const [creation, setCreation] = useFState("guided");   // guided | auto
  const [scope, setScope] = useFState("novella");        // shot | novella | season | endless
  const [episodes, setEpisodes] = useFState(8);
  const [ending, setEnding] = useFState("open");         // open | closed | custom
  const [endingNote, setEndingNote] = useFState("");
  const [genres, setGenres] = useFState([]);
  const [length, setLength] = useFState(700);
  const [dialogue, setDialogue] = useFState(50);         // 0..100 density
  const [dialogueTouched, setDialogueTouched] = useFState(false);
  const [creating, setCreating] = useFState(false);
  const [pricingReady, setPricingReady] = useFState(false);  // Track pricing load state
  const ready = description.trim().length > 0;

  // Guided Mode → 'endless' (історія без меж)
  // Auto Mode → 'season' (завжди серіал, лише кількість серій змінюється)
  const effectiveScope = creation === 'guided' ? 'endless' : 'season';

  // Load pricing from Firestore on mount + poll for user/pricing ready
  React.useEffect(() => {
    if (window.__firebasePricing) {
      window.__firebasePricing.loadPricing().then(() => {
        console.log('[StoryForm] Pricing loaded');
      });
    }

    // Poll for user + pricing ready (trigger re-render when both available)
    const interval = setInterval(() => {
      if (window.__wwUser && window.__firebasePricing?.cache?.loaded) {
        setPricingReady(true);
        clearInterval(interval);
        console.log('[StoryForm] User + pricing ready, re-rendering');
      }
    }, 200);

    // Cleanup
    return () => clearInterval(interval);
  }, []);

  // Token cost calculator using real pricing from Firestore
  function estimateTokens() {
    if (!window.__firebasePricing || !window.__wwUser) {
      // Fallback if pricing not loaded
      return creation === 'guided' ? 300 : episodes * 300;
    }

    const userPlan = window.__wwUser.plan || 'free';

    if (creation === 'guided') {
      // Guided mode: 1 scene only
      const provider = window.__firebasePricing.getProviderForPlan(userPlan);
      // Estimate based on provider (conservative)
      return provider === 'claude' ? 300 : 20;
    } else {
      // Auto Mode: use real pricing formula
      const estimate = window.__firebasePricing.estimateAutoModeCost(episodes, userPlan);
      return estimate.totalCost;
    }
  }

  const estimatedCost = estimateTokens();

  function toggleGenre(g) {
    setGenres((cur) => {
      const next = cur.includes(g) ? cur.filter((x) => x !== g) : (cur.length >= 4 ? cur : cur.concat(g));
      if (!dialogueTouched) setDialogue(dialogueDefault(next)); // auto-set until user overrides
      return next;
    });
  }
  async function submit() {
    if (!ready || creating) return;
    setCreating(true);
    try {
      await onCreate({
        title,
        description,
        language,
        creation,
        scope: effectiveScope,  // Guided → 'endless', Auto → вибране юзером
        episodes: effectiveScope === "season" ? episodes : null,
        ending,
        endingNote,
        genres,
        length,
        dialogue
      });
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Не вдалося створити проєкт: ' + error.message);
      setCreating(false);
    }
  }

  const SCOPE_HINT = { shot: "одна завершена сцена", novella: "кілька сцен, один сюжет", season: "повноцінний серіал із кількох серій", endless: "історія без визначеного кінця" };

  return (
    <div className="screen screen--form stage-screen">
      <Particles density={0.5} />

      <div className="form-parch">
        <div className="form-inner">
          <div className="form-head">
            <div className="form-kicker">Новий всесвіт</div>
            <h2 className="form-title">Із чого почати історію?</h2>
          </div>

          <label className="field">
            <span className="field__label">Назва</span>
            <input
              className="field__input"
              value={title}
              onChange={(e) => !creating && setTitle(e.target.value)}
              placeholder="Попіл Орелії"
              disabled={creating}
            />
          </label>

          <label className="field">
            <span className="field__label">Language / Мова історії</span>
            <select
              className="field__input"
              value={language}
              onChange={(e) => !creating && setLanguage(e.target.value)}
              disabled={creating}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
            <span className="field__note">AI will generate scenes and dialogues in this language</span>
          </label>

          <label className="field">
            <span className="field__label">
              Опис всесвіту
              <span className="field__counter" style={{ marginLeft: '8px', fontSize: '12px', color: description.length > 2000 ? '#d9534f' : 'rgba(194,161,87,0.7)' }}>
                {description.length} / 2000
              </span>
            </span>
            <textarea
              className="field__area"
              value={description}
              onChange={(e) => {
                if (!creating && e.target.value.length <= 2000) {
                  setDescription(e.target.value);
                }
              }}
              placeholder="Місто, де згасають зорі, і жінка, що пам'ятає його живим…"
              rows={6}
              disabled={creating}
              maxLength={2000}
            />
          </label>

          <div className="field">
            <span className="field__label">Як створюємо</span>
            <div className="modecards">
              <button type="button" className={`modecard ${creation === "guided" ? "is-on" : ""}`} onClick={() => !creating && setCreation("guided")} disabled={creating}>
                <span className="modecard__ic">🪶</span>
                <span className="modecard__t">Поступово з автором</span>
                <span className="modecard__d">Канон → сцена → «що далі?» → сцена. Ти ведеш історію рішеннями.</span>
              </button>
              <button type="button" className={`modecard ${creation === "auto" ? "is-on" : ""}`} onClick={() => !creating && setCreation("auto")} disabled={creating}>
                <span className="modecard__ic">⚡</span>
                <span className="modecard__t">Згенерувати все автоматично</span>
                <span className="modecard__d">AI напише весь обсяг одразу. Подивишся, що вигадає всесвіт.</span>
              </button>
            </div>
          </div>

          {creation === "auto" && (
            <label className="field">
              <span className="field__label">
                Скільки серій
                {pricingReady && (() => {
                  const estimate = window.__firebasePricing.estimateAutoModeCost(episodes, window.__wwUser.plan || 'free', length);
                  return (
                    <span className="field__hint" style={{ marginLeft: '8px', fontStyle: 'italic', color: 'rgba(194,161,87,0.85)' }}>
                      ~{estimate.totalCost.toLocaleString()} токенів
                    </span>
                  );
                })()}
              </span>
              <div className="wslider">
                <input
                  type="range" min="3" max="24" step="1"
                  value={episodes}
                  onChange={(e) => !creating && setEpisodes(+e.target.value)}
                  style={{ "--fill": ((episodes - 3) / 21) * 100 + "%" }}
                  disabled={creating}
                />
                <div className="wslider__row">
                  <span>3</span>
                  <span className="wslider__val">{episodes} серій</span>
                  <span>24</span>
                </div>
              </div>
            </label>
          )}

          {creation === "auto" && (
            <label className="field">
              <span className="field__label">Фінал</span>
              <Segmented
                value={ending}
                onChange={(val) => !creating && setEnding(val)}
                disabled={creating}
                options={[
                  { value: "open", label: "Відкритий" },
                  { value: "closed", label: "Завершений" },
                  { value: "custom", label: "Свій опис" },
                ]}
              />
              {ending === "custom" && (
                <textarea
                  className="field__area" style={{ marginTop: 10 }}
                  value={endingNote}
                  onChange={(e) => !creating && setEndingNote(e.target.value)}
                  placeholder="Чим має завершитись історія…"
                  rows={2}
                  disabled={creating}
                />
              )}
            </label>
          )}

          <div className="field">
            <span className="field__label">Жанр і тон <span className="field__hint">до 4</span></span>
            <div className="chips">
              {GENRES.map((g) => (
                <button key={g} type="button" className={`chip ${genres.includes(g) ? "is-on" : ""}`} onClick={() => !creating && toggleGenre(g)} disabled={creating}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field__label">
              Довжина сцен
              {pricingReady && (() => {
                const userPlan = window.__wwUser.plan || 'free';
                const estimate = window.__firebasePricing.estimateAutoModeCost(1, userPlan, length);
                const costPerScene = estimate.breakdown?.sceneCostPerScene || 0;
                return (
                  <span className="field__hint" style={{ marginLeft: '8px', fontStyle: 'italic', color: 'rgba(194,161,87,0.85)' }}>
                    ~{costPerScene} токенів/сцена
                  </span>
                );
              })()}
            </span>
            <WordSlider value={length} onChange={(val) => !creating && setLength(val)} disabled={creating} />
          </label>

          <label className="field">
            <span className="field__label">Діалоги <span className="field__hint">{dialogueLabel(dialogue)}</span></span>
            <div className="wslider">
              <input
                type="range" min="0" max="100" step="5"
                value={dialogue}
                onChange={(e) => { if (!creating) { setDialogue(+e.target.value); setDialogueTouched(true); } }}
                style={{ "--fill": dialogue + "%" }}
                disabled={creating}
              />
              <div className="wslider__row">
                <span>Розповідь</span>
                <span className="wslider__val">{dialogue}%</span>
                <span>Діалоги</span>
              </div>
            </div>
            <span className="field__note">{genres.length && !dialogueTouched ? "Підібрано за жанром — можна змінити" : "Скільки історія тримається на репліках персонажів"}</span>
          </label>

          <div className="form-foot">
            <button className="link-back" type="button" onClick={onBack}>‹ Назад</button>
            <button
              className={`create-btn ${ready && !creating ? "" : "is-disabled"}`}
              type="button"
              onClick={submit}
              disabled={!ready || creating}
            >
              <span className="begin-btn__star">✨</span>
              {creating ? "Створюємо всесвіт..." : (creation === "auto" ? "Згенерувати історію" : "Почати історію")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StartScreen, StoryForm });
