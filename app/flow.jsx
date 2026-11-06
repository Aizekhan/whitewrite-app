// Stage 0 (start) and Stage 1 (story form). Each renders its own atmosphere
// so crossfades between stages never flash.
const { useState: useFState } = React;

// ── Stage 0 ─────────────────────────────────────────────────────────────
// The user's own hero art (StartBack.png) leads. The whole scene is the
// doorway — click anywhere to open a universe. Particles add living light.
function StartScreen({ onBegin, langVersion, hasWorlds }) {
  // Fallback Ukrainian text if i18n not loaded yet
  const FALLBACK = {
    'hero.mark': 'WhiteWrite',
    'hero.quote': '«Один світ — безліч історій і ігор.»',
    'hero.title': 'Твій світ\nчекає',
    'hero.lede': 'Збери канон свого світу — і твори з нього книги та ігри, вірні цьому світу.',
    'hero.ctaCreate': 'Створи свій світ',
    'hero.ctaChoose': 'Обери свій світ',
    'hero.agentBeta': 'для творців ігор',
    'hero.agentTitle': 'Від задуму — до гри',
    'hero.agentDesc': 'Біблія гри й продакшн-план — у WhiteWrite, гру за ними будує Claude Code. Ти лише приймаєш роботу.',
    'hero.agentBtn': '🤖 Від чистого ПК до Гри',
    'hero.commTop': 'Вибір спільноти', 'hero.commNew': 'Відкрий нового автора', 'hero.commAll': 'Спільнота — усі світи й ігри', 'hero.commBy': 'автор', 'hero.commTeam': 'шукає команду'
  };
  const t = window.__i18n ? window.__i18n.t : (k) => FALLBACK[k] || k;
  return (
    <div className="screen screen--start stage-screen">
      <img className="hero-img" src="assets/StartBack.jpg" alt={t('hero.imgAlt')} />
      <div className="hero-scrim" aria-hidden="true" />
      <Particles density={0.7} />
      <div className="vignette" aria-hidden="true" />

      <div className="hero-mark">{t('hero.mark')}</div>

      <div className="hero-quote">
        {t('hero.quote')}
        <span className="hero-quote__orn">· ✦ ·</span>
      </div>

      <div className="hero-panel" onClick={(e) => e.stopPropagation()}>
        <h1 className="hero-title">{t('hero.title').split('\n').map((line, i) => i > 0 ? [<br key={i}/>, line] : line)}</h1>
        <p className="hero-lede">{t('hero.lede')}</p>
        <button className="hero-cta" type="button" onClick={(e) => { e.stopPropagation(); try { if (window.parent && window.parent.__wwAuth === false) { window.parent.__wwOpenAuth && window.parent.__wwOpenAuth(); return; } } catch (err) {} onBegin(); }}>
          <span className="hero-cta__star">✦</span> {t(hasWorlds ? 'hero.ctaChoose' : 'hero.ctaCreate')}
        </button>
      </div>

      <div className="hero-buybook" onClick={(e) => e.stopPropagation()}>
        <div className="hero-buybook__beta">{t('hero.agentBeta')}</div>
        <div className="hero-buybook__t">{t('hero.agentTitle').split('\n').map((line, i) => i > 0 ? [<br key={i}/>, line] : line)}</div>
        <div className="hero-buybook__d">{t('hero.agentDesc')}</div>
        <button className="hero-buybook__btn" type="button" onClick={() => { try { window.parent.postMessage({ type: "ww-agent-guide" }, window.location.origin); } catch (err) {} }}>{t('hero.agentBtn')}</button>
      </div>

      <HomeCommunity t={t} />
    </div>
  );
}

// ── Спільнота on the home page: community_home/current (functions/src/community.js, rebuilt hourly) ──
// «Вибір спільноти» walks the top 20 authors (paid promotion first) through the day, ~24h / N each;
// «Відкрий нового автора» is a random showcase below the top whose author was active in the last 7 days.
function pickTop(top) {
  if (!top || !top.length) return null;
  const now = new Date(), day = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000;
  return top[Math.floor(day / (86400000 / top.length)) % top.length];
}
function HomeCommunity({ t }) {
  const [home, setHome] = useFState(null);
  const [rnd] = useFState(Math.random());
  const [, tick] = useFState(0);
  React.useEffect(() => {
    const db = window.__firebase && window.__firebase.db;
    if (db) db.collection('community_home').doc('current').get().then((s) => setHome(s.exists ? s.data() : {}), () => setHome({}));
    const id = setInterval(() => tick((n) => n + 1), 60000); // the top card moves on while the page stays open
    return () => clearInterval(id);
  }, []);
  const go = (pubId) => { try { window.parent.postMessage({ type: 'ww-community', pubId: pubId || null }, window.location.origin); } catch (err) {} };
  const top = pickTop(home && home.top), pool = (home && home.pool) || [];
  const fresh = pool.length ? pool[Math.floor(rnd * pool.length)] : null;
  const card = (c, label, cls) => c && (
    <button type="button" className={'hcomm__card ' + cls} onClick={(e) => { e.stopPropagation(); go(c.id); }}
      style={c.cover ? { backgroundImage: 'url("' + c.cover.replace(/"/g, '%22') + '")' } : undefined}>
      <span className="hcomm__label">{label}</span>
      {c.team ? <span className="hcomm__team">🤝 {t('hero.commTeam')}</span> : null}
      <span className="hcomm__t">{c.title}</span>
      {c.tagline ? <span className="hcomm__tag">{c.tagline}</span> : null}
      <span className="hcomm__by">{t('hero.commBy')} {c.author}{c.followers ? ' · 👤 ' + c.followers : ''}{c.likes ? ' · ★ ' + c.likes : ''}</span>
    </button>
  );
  return (
    <div className="hcomm" onClick={(e) => e.stopPropagation()}>
      {card(top, t('hero.commTop'), 'hcomm__card--top')}
      {card(fresh, t('hero.commNew'), 'hcomm__card--new')}
      <button type="button" className="hcomm__all" onClick={() => go(null)}>✦ {t('hero.commAll')}</button>
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
  const t = window.__i18n ? window.__i18n.t : (k) => k;
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
        <span className="wslider__val">{value} {t('form.wordsPerScene')}</span>
        <span>2000</span>
      </div>
    </div>
  );
}

// Helper to get localized genre list
function getGenres() {
  const t = window.__i18n ? window.__i18n.t : (k) => k;
  return GENRE_KEYS.map(key => ({ key, label: t(`genre.${key}`) }));
}

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

// Genre keys (used for lookup in i18n and dialogue defaults)
const GENRE_KEYS = [
  'fantasy', 'darkFantasy', 'hardSF', 'spaceOpera', 'cyberpunk',
  'postApocalyptic', 'horror', 'mystery', 'detective', 'thriller',
  'romance', 'adventure', 'historical', 'mythFairy', 'anime',
  'drama', 'comedy', 'youngAdult', 'sliceOfLife', 'western', 'documentary'
];

// Genre → default dialogue density (0 none … 100 dialogue-driven).
const GENRE_DIALOGUE = {
  'documentary': 10, 'mythFairy': 30, 'historical': 45, 'horror': 35, 'mystery': 40,
  'postApocalyptic': 40, 'hardSF': 50, 'spaceOpera': 55, 'adventure': 50, 'western': 50,
  'fantasy': 50, 'darkFantasy': 50, 'cyberpunk': 55, 'thriller': 60, 'detective': 65,
  'sliceOfLife': 70, 'romance': 75, 'drama': 75, 'comedy': 70, 'youngAdult': 70,
  'anime': 80,
};
function dialogueDefault(genres) {
  if (!genres || !genres.length) return 50;
  var sum = 0, n = 0;
  genres.forEach(function (g) { if (GENRE_DIALOGUE[g] != null) { sum += GENRE_DIALOGUE[g]; n++; } });
  return n ? Math.round(sum / n) : 50;
}
function dialogueLabel(v) {
  const t = window.__i18n ? window.__i18n.t : (k) => k;
  if (v <= 15) return t('form.dialogueAlmostNone');
  if (v <= 38) return t('form.dialogueMoreNarration');
  if (v <= 62) return t('form.dialogueBalanced');
  if (v <= 82) return t('form.dialogueMoreDialogues');
  return t('form.dialogueDialoguesDrive');
}

// ── Stage 1 ─────────────────────────────────────────────────────────────
function StoryForm({ onBack, onCreate, initial }) {
  const init = initial || {}; // restored when returning from Genesis
  const [description, setDescription] = useFState(init.description || "");
  const [title, setTitle] = useFState(init.title || "");
  const [language, setLanguage] = useFState(init.language || (window.__i18n ? window.__i18n.getLanguage() : "uk")); // the interface language by default
  const [creation, setCreation] = useFState(init.creation || "guided");   // guided | auto | free (the author writes)
  const [scope, setScope] = useFState(init.scope && init.scope !== "endless" ? init.scope : "novella");        // shot | novella | season | endless
  const [episodes, setEpisodes] = useFState(init.episodes || 8);
  const [ending, setEnding] = useFState(init.ending || "open");         // open | closed | custom
  const [endingNote, setEndingNote] = useFState(init.endingNote || "");
  const [genres, setGenres] = useFState(init.genres || []);
  const [length, setLength] = useFState(init.length || 700);
  const [dialogue, setDialogue] = useFState(init.dialogue != null ? init.dialogue : 50);         // 0..100 density
  const [dialogueTouched, setDialogueTouched] = useFState(init.dialogue != null);
  const [creating, setCreating] = useFState(false);
  const [pricingReady, setPricingReady] = useFState(false);  // Track pricing load state
  const ready = description.trim().length > 0 || (creation === "free" && title.trim().length > 0);

  // Guided Mode → 'endless' (історія без меж)
  // Auto Mode → 'season' (завжди серіал, лише кількість серій змінюється)
  const effectiveScope = creation === 'guided' ? 'endless' : 'season';

  // Load pricing from Firestore on mount + poll for user/pricing ready
  React.useEffect(() => {

    if (window.__firebasePricing) {
      window.__firebasePricing.loadPricing().then(() => {
      }).catch(err => {
        console.error('[StoryForm] ❌ Pricing load failed:', err);
      });
    } else {
      console.warn('[StoryForm] ⚠️ window.__firebasePricing not available');
    }

    // Poll for user + pricing ready (trigger re-render when both available)
    let pollCount = 0;
    const interval = setInterval(() => {
      pollCount++;
      const hasUser = !!window.__wwUser;
      const hasPricing = !!window.__firebasePricing;
      const pricingLoaded = window.__firebasePricing?.cache?.loaded;


      if (hasUser && hasPricing && pricingLoaded) {
        setPricingReady(true);
        clearInterval(interval);
      }

      // Timeout after 10 seconds (50 polls)
      if (pollCount >= 50) {
        clearInterval(interval);
        console.warn('[StoryForm] ⚠️ Timeout waiting for pricing, enabling anyway');
        setPricingReady(true); // Enable anyway so UI doesn't break
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
      return window.__TOKEN_COSTS?.scene || 160; // a typical scene on the author's Claude model
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
        dialogue,
        ...(init.subjects ? { subjects: init.subjects, reveal: init.reveal, revealNote: init.revealNote } : {}) // from a Bible dossier
      });
    } catch (error) {
      console.error('Failed to create project:', error);
      const t = window.__i18n ? window.__i18n.t : (k) => k;
      alert(t('form.errorCreate') + ': ' + error.message);
      setCreating(false);
    }
  }

  const t = window.__i18n ? window.__i18n.t : (k) => k;
  const genres_list = getGenres();

  return (
    <div className="screen screen--form stage-screen">
      <Particles density={0.5} />

      <div className="form-parch">
        <div className="form-inner">
          <div className="form-head">
            <div className="form-kicker">{t('form.kicker')}</div>
            <h2 className="form-title">{t('form.title')}</h2>
          </div>

          <label className="field">
            <span className="field__label">{t('form.titleLabel')}</span>
            <input
              className="field__input"
              value={title}
              onChange={(e) => !creating && setTitle(e.target.value)}
              placeholder={t('form.titlePlaceholder')}
              disabled={creating}
            />
          </label>

          <label className="field">
            <span className="field__label">{t('form.languageLabel')}</span>
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
            <span className="field__note">{t('form.languageNote')}</span>
          </label>

          <label className="field">
            <span className="field__label">
              {t('form.descLabel')}
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
              placeholder={t('form.descPlaceholder')}
              rows={6}
              disabled={creating}
              maxLength={2000}
            />
          </label>

          <div className="field">
            <span className="field__label">{t('form.creationLabel')}</span>
            <div className="modecards">
              <button type="button" className={`modecard ${creation === "guided" ? "is-on" : ""}`} onClick={() => !creating && setCreation("guided")} disabled={creating}>
                <span className="modecard__ic">{t('form.guidedIcon')}</span>
                <span className="modecard__t">{t('form.guidedTitle')}</span>
                <span className="modecard__d">{t('form.guidedDesc')}</span>
              </button>
              <button type="button" className={`modecard ${creation === "auto" ? "is-on" : ""}`} onClick={() => !creating && setCreation("auto")} disabled={creating}>
                <span className="modecard__ic">{t('form.autoIcon')}</span>
                <span className="modecard__t">{t('form.autoTitle')}</span>
                <span className="modecard__d">{t('form.autoDesc')}</span>
              </button>
              <button type="button" className={`modecard ${creation === "free" ? "is-on" : ""}`} onClick={() => !creating && setCreation("free")} disabled={creating}>
                <span className="modecard__ic">{t('form.freeIcon')}</span>
                <span className="modecard__t">{t('form.freeTitle')}</span>
                <span className="modecard__d">{t('form.freeDesc')}</span>
              </button>
            </div>
          </div>

          {creation === "auto" && (
            <label className="field">
              <span className="field__label">
                {t('form.episodesLabel')}
                {pricingReady && (() => {
                  const estimate = window.__firebasePricing.estimateAutoModeCost(episodes, window.__wwUser.plan || 'free', length);
                  return (
                    <span className="field__hint" style={{ marginLeft: '8px', fontStyle: 'italic', color: 'rgba(194,161,87,0.85)' }}>
                      ~{estimate.totalCost.toLocaleString()} {t('ui.tokens')}
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
                  <span className="wslider__val">{episodes} {t('form.episodesUnit')}</span>
                  <span>24</span>
                </div>
              </div>
            </label>
          )}

          {creation === "auto" && (
            <label className="field">
              <span className="field__label">{t('form.endingLabel')}</span>
              <Segmented
                value={ending}
                onChange={(val) => !creating && setEnding(val)}
                disabled={creating}
                options={[
                  { value: "open", label: t('form.endingOpen') },
                  { value: "closed", label: t('form.endingClosed') },
                  { value: "custom", label: t('form.endingCustom') },
                ]}
              />
              {ending === "custom" && (
                <textarea
                  className="field__area" style={{ marginTop: 10 }}
                  value={endingNote}
                  onChange={(e) => !creating && setEndingNote(e.target.value)}
                  placeholder={t('form.endingPlaceholder')}
                  rows={2}
                  disabled={creating}
                />
              )}
            </label>
          )}

          <div className="field">
            <span className="field__label">{t('form.genreLabel')} <span className="field__hint">{t('form.genreHint')}</span></span>
            <div className="chips">
              {genres_list.map((g) => (
                <button key={g.key} type="button" className={`chip ${genres.includes(g.key) ? "is-on" : ""}`} onClick={() => !creating && toggleGenre(g.key)} disabled={creating}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field__label">
              {t('form.lengthLabel')}
              {pricingReady && (() => {
                const userPlan = window.__wwUser.plan || 'free';
                const inputChars = description.length;
                const canonTokens = 0; // First scene — no canon yet
                const costPerScene = window.__firebasePricing.estimateSingleSceneCost(length, inputChars, userPlan, canonTokens);
                return (
                  <span className="field__hint" style={{ marginLeft: '8px', fontStyle: 'italic', color: 'rgba(194,161,87,0.85)' }}>
                    ~{costPerScene} {t('form.lengthHint')}
                  </span>
                );
              })()}
            </span>
            <WordSlider value={length} onChange={(val) => !creating && setLength(val)} disabled={creating} />
          </label>

          <label className="field">
            <span className="field__label">{t('form.dialogueLabel')} <span className="field__hint">{dialogueLabel(dialogue)}</span></span>
            <div className="wslider">
              <input
                type="range" min="0" max="100" step="5"
                value={dialogue}
                onChange={(e) => { if (!creating) { setDialogue(+e.target.value); setDialogueTouched(true); } }}
                style={{ "--fill": dialogue + "%" }}
                disabled={creating}
              />
              <div className="wslider__row">
                <span>{t('form.dialogueNarration')}</span>
                <span className="wslider__val">{dialogue}%</span>
                <span>{t('form.dialogueDialogues')}</span>
              </div>
            </div>
            <span className="field__note">{genres.length && !dialogueTouched ? t('form.dialogueNote1') : t('form.dialogueNote2')}</span>
          </label>

          <div className="form-foot">
            <button className="link-back" type="button" onClick={onBack}>{t('form.back')}</button>
            <button
              className={`create-btn ${ready && !creating ? "" : "is-disabled"}`}
              type="button"
              onClick={submit}
              disabled={!ready || creating}
            >
              <span className="begin-btn__star">✨</span>
              {creating ? t('form.creating') : (creation === "auto" ? t('form.createAuto') : creation === "free" ? t('form.createFree') : t('form.createGuided'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// World form — a name and an optional description; the world is created at once and opens in its Bible, where
// «Заповни світ своїми матеріалами» moves the author's notes in (their own AI agent builds the file by our template,
// gamebible.js + functions/world-fill.js). The ✦ tick asks Genesis for three worlds from the description instead.
function WorldForm({ onBack, onCreate, initial }) {
  const t = window.__i18n ? window.__i18n.t : (k) => k;
  const init = initial || {}; // restored when returning from Genesis
  const [title, setTitle] = useFState(init.title || "");
  const [description, setDescription] = useFState(init.description || "");
  const [ideas, setIdeas] = useFState(!!init.ideas);
  const [creating, setCreating] = useFState(false);
  // «📂 Тека світу»: any folder (a whole game project too) → the new world's Bible lets ✦ the AI pick and read what holds the world (gamebible.js startWorldFolder)
  const [folder, setFolder] = useFState(null); // { name, list }
  const desc = description.trim();
  const plan = folder ? "folder" : !title.trim() && !desc ? "" : desc && ideas ? "ideas" : "empty";
  function pickFolder(e) {
    const list = [].slice.call(e.target.files || []); e.target.value = "";
    if (!list.length) return;
    const name = (list[0].webkitRelativePath || list[0].name).split('/')[0];
    setFolder({ name, list }); setIdeas(false);
    if (!title.trim()) setTitle(name);
  }
  async function submit() {
    if (!plan || creating) return;
    setCreating(true);
    try {
      try { window.top.__wwPendingFill = plan === "folder" ? { name: folder.name, folder: folder.list } : null; } catch (e) {} // the shell keeps it: the new world's Bible (a sibling frame) takes it once
      await onCreate({ title: title.trim() || "", description: desc, language: window.__i18n ? window.__i18n.getLanguage() : "uk", genres: [], ideas: plan === "ideas" });
    } catch (error) { alert(t('form.errorCreate') + ': ' + error.message); setCreating(false); }
  }
  const cost = (() => { if (plan !== "ideas") return 0; const PF = window.__PAID_FEATURES; return PF ? PF.featureCost(PF.byOp('genesis'), null, (window.__wwUser || {}).aiModel) : 0; })();

  return (
    <div className="screen screen--form stage-screen">
      <Particles density={0.5} />
      <div className="form-parch">
        <div className="form-inner">
          <div className="form-head">
            <div className="form-kicker">{t('worlds.formKicker')}</div>
            <h2 className="form-title">{t('worlds.formTitle')}</h2>
          </div>

          <label className="field">
            <span className="field__label">{t('worlds.nameLabel')}</span>
            <input className="field__input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
              placeholder={t('worlds.namePlaceholder')} disabled={creating} autoFocus />
          </label>

          <label className="field">
            <span className="field__label">{t('worlds.descLabel')}</span>
            <textarea className="field__area" value={description} rows={4} maxLength={2000}
              onChange={(e) => setDescription(e.target.value)} placeholder={t('worlds.descPlaceholder')} disabled={creating} />
          </label>

          {folder
            ? <div className="wf-folder is-picked"><span className="wf-folder__ico" aria-hidden="true">📂</span>
                <span className="wf-folder__body"><b>{t('worlds.folderPicked').replace('{d}', folder.name).replace('{n}', folder.list.length)}</b><small>{t('worlds.folderHint')}</small></span>
                <button type="button" className="link-back" onClick={() => setFolder(null)} disabled={creating}>{t('worlds.folderClear')}</button></div>
            : <label className="wf-folder"><input type="file" webkitdirectory="" multiple hidden onChange={pickFolder} disabled={creating} />
                <span className="wf-folder__ico" aria-hidden="true">📂</span>
                <span className="wf-folder__body"><b>{t('worlds.folderBtn')}</b><small>{t('worlds.folderHint')}</small></span></label>}

          {desc && plan !== "folder" && <label className="wf-tick"><input type="checkbox" checked={ideas} onChange={(e) => setIdeas(e.target.checked)} disabled={creating} /><span>{t('worlds.ideasTick')}</span></label>}

          <p className="wf-plan" role="status" >{plan ?t('worlds.plan_' + plan) + (cost ? ' · ' + t('genesis.cost').replace('{n}', cost) : '') : t('worlds.fillLater')}</p>

          <div className="form-foot">
            <button className="link-back" type="button" onClick={onBack}>{t('form.back')}</button>
            <button className={`create-btn ${plan && !creating ? "" : "is-disabled"}`} type="button" onClick={submit} disabled={!plan || creating}>
              <span className="begin-btn__star">✨</span>{creating ? t('form.creating') : t('worlds.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Genesis / World Intent — before the first scene the author CHOOSES the world:
// AI proposes 3 distinct seeds from the premise; pick one, ask again, or skip
// (then the world is born from the first scene, as before).
function GenesisScreen({ data, onChoose, onSkip, onBack }) {
  const t = window.__i18n ? window.__i18n.t : (k) => k;
  const [seeds, setSeeds] = useFState(null);
  const [error, setError] = useFState(null);
  const [busy, setBusy] = useFState(false);
  const [choosing, setChoosing] = useFState(null); // seed index, "skip" or "author"
  const [author, setAuthor] = useFState(false); // «✎ Заповнити мінімально»: only the author's description, one world, no variants

  async function load(mode) {
    const own = mode === "author";
    setBusy(true); setError(null); setAuthor(own);
    const r = await window.__firebaseAI.genesisWorld({
      title: data.title, premise: data.description, genres: data.genres, language: data.language, mode: own ? "author" : undefined
    });
    setBusy(false);
    if (!r.success) { setError(r.error); return; }
    if (own) { go("author", () => onChoose(Object.assign({}, r.seeds[0], { name: r.seeds[0].name || data.title }))); return; } // nothing to pick: the world is made at once
    setSeeds(r.seeds);
  }
  React.useEffect(() => { load(); }, []);

  async function go(which, action) {
    if (choosing != null) return;
    setChoosing(which);
    try { await action(); } catch (e) { setError(e.message); }
    setChoosing(null); // still here ⇒ project creation failed (enterBook already alerted)
  }
  const locked = busy || choosing != null;

  return (
    <div className="screen screen--form stage-screen">
      <Particles density={0.5} />
      <div className="form-parch">
        <div className="form-inner">
          <div className="form-head">
            <div className="form-kicker">{t('genesis.kicker')}</div>
            <h2 className="form-title">{t(author ? 'genesis.titleAuthor' : 'genesis.title')}</h2>
            <p className="genesis-lead">{t(!author ? 'genesis.lead' : 'genesis.leadAuthor')}</p>
          </div>

          {(busy || choosing === "author") && <div className="genesis-wait"><span className="genesis-wait__star">✦</span>{t(author ? 'genesis.loadingAuthor' : 'genesis.loading')}</div>}
          {error && <div className="genesis-err">{error}</div>}

          {!busy && !author && seeds && (
            <div className="genesis-seeds">
              {seeds.map((s, i) => (
                <article className={`genesis-seed ${choosing === i ? "is-on" : ""}`} key={i}>
                  <h3 className="genesis-seed__name">{s.name}</h3>
                  {s.tagline && <p className="genesis-seed__tag">{s.tagline}</p>}
                  <p className="genesis-seed__sum">{s.summary}</p>
                  <div className="genesis-seed__k">{t('genesis.laws')}</div>
                  <ol className="genesis-seed__laws">{s.rules.map((r, j) => <li key={j}>{r}</li>)}</ol>
                  {s.characters.length > 0 && <div className="genesis-seed__row"><b>{t('genesis.characters')}:</b> {s.characters.map((c) => c.name + (c.role ? ` (${c.role})` : "")).join(", ")}</div>}
                  {s.locations.length > 0 && <div className="genesis-seed__row"><b>{t('genesis.locations')}:</b> {s.locations.map((l) => l.name).join(", ")}</div>}
                  {s.factions.length > 0 && <div className="genesis-seed__row"><b>{t('genesis.factions')}:</b> {s.factions.map((f) => f.name).join(", ")}</div>}
                  <button className={`create-btn genesis-seed__pick ${locked ? "is-disabled" : ""}`} type="button" disabled={locked}
                    onClick={() => go(i, () => onChoose(s))}>
                    <span className="begin-btn__star">✨</span>{choosing === i ? t('genesis.creating') : t('genesis.choose')}
                  </button>
                </article>
              ))}
            </div>
          )}

          <div className="form-foot">
            <button className="link-back" type="button" onClick={onBack} disabled={locked}>{t('form.back')}</button>
            <span className="genesis-foot">
              {/* the author's material: one world, made at once — retry and an empty world only as a way out of an error */}
              {author
                ? error && !locked && <button className="link-back" type="button" onClick={() => load("author")}>↻ {t('genesis.retry')}</button>
                : <button className="link-back" type="button" onClick={() => load()} disabled={locked}>↻ {t('genesis.again')}</button>}
              {!author && <button className="link-back" type="button" onClick={() => load("author")} disabled={locked}>✎ {t('genesis.minimal')}</button>}
              {(!author || (error && !busy)) && <button className="link-back" type="button" onClick={() => go("skip", onSkip)} disabled={locked}>
                {choosing === "skip" ? t('genesis.creating') : t(author ? 'genesis.skipAuthor' : 'genesis.skip')}
              </button>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StartScreen, StoryForm, WorldForm, GenesisScreen });
