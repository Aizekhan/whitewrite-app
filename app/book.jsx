// The book IS the interface — Stage 2 (ritual video) + Stage 3 (reading).
// Stage 2: StartStoryAnim.mp4 plays under a semi-transparent "AI generating"
// line. Stage 3: OpenedBook.jpg is the book; story text is laid over its two
// pages and crossfades as you move with ← →. From reading you cross into the
// production workspace (the 5 tabs) — same universe, seamless fade.
const { useState, useEffect, useCallback, useRef } = React;

// ---------- pages: measured, not counted ----------
// Each scene's text is laid into page boxes by measuring a hidden copy of the real page (same width/height, fonts, size),
// paragraph by paragraph, splitting the last one by words. Re-run on resize, font, size or language — so text never
// runs past a page. A continued paragraph has no indent.
const BOOK_TYPO_KEY = "ww-book-typo";
function readTypo() {
  try { const v = JSON.parse(localStorage.getItem(BOOK_TYPO_KEY) || "{}"); return { size: +v.size || 1, font: v.font || "Philosopher" }; }
  catch (e) { return { size: 1, font: "Philosopher" }; }
}
function makeProbe(box, typo) {
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = "position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none;";
  root.style.setProperty("--book-size", typo.size);
  root.style.setProperty("--book-font", typo.font);
  const pages = document.createElement("div");
  pages.className = "photobook__pages";
  if (box) { pages.style.width = box.w + "px"; pages.style.height = box.h + "px"; }
  root.appendChild(pages);
  const inner = ["left", "right"].map((side) => {
    const o = document.createElement("div"); o.className = "opage opage--" + side;
    const i = document.createElement("div"); i.className = "page-inner"; o.appendChild(i); pages.appendChild(o);
    return i;
  });
  document.body.appendChild(root);
  return { inner, remove: () => root.remove() };
}
function splitParas(text) { return String(text || "").replace(/\r/g, "").split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean); }
// → [{ first, paras: [{ text, cap, cont }] }] for one scene
function paginateScene(scene, probe) {
  const paras = splitParas(scene.text);
  const pages = [];
  let page = { first: true, paras: [] };
  const fill = (inner, pg) => {
    inner.innerHTML = "";
    if (pg.first) {
      const h = document.createElement("header"); h.className = "page-head";
      const t = document.createElement("h2"); t.className = "page-head__title"; t.textContent = scene.title || "";
      const r = document.createElement("div"); r.className = "page-head__rule"; h.appendChild(t); h.appendChild(r); inner.appendChild(h);
    }
    const box = document.createElement("div");
    pg.paras.forEach((p) => {
      const el = document.createElement("p"); el.className = "prose" + (p.cont ? " prose--cont" : "") + (p.split ? " prose--split" : "");
      if (p.cap && p.text) { const c = document.createElement("span"); c.className = "prose__cap"; c.textContent = p.text.charAt(0); el.appendChild(c); el.appendChild(document.createTextNode(p.text.slice(1))); }
      else el.textContent = p.text;
      box.appendChild(el);
    });
    inner.appendChild(box);
  };
  const fits = (pg) => { const inner = probe.inner[pages.length % 2]; fill(inner, pg); return inner.scrollHeight <= inner.clientHeight + 1; };
  const queue = paras.map((text, i) => ({ text, cap: i === 0, cont: false }));
  while (queue.length) {
    const p = queue.shift();
    page.paras.push(p);
    if (fits(page)) continue;
    page.paras.pop();
    const words = p.text.split(/\s+/);
    let lo = 0, hi = words.length - 1; // the most words of p that still fit on this page
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      page.paras.push({ ...p, text: words.slice(0, mid).join(" ") });
      if (fits(page)) lo = mid; else hi = mid - 1;
      page.paras.pop();
    }
    if (lo === 0 && !page.paras.length) lo = 1; // a word longer than a page still moves on
    if (lo > 0) page.paras.push({ ...p, text: words.slice(0, lo).join(" "), split: lo < words.length });
    pages.push(page);
    page = { first: false, paras: [] };
    if (lo < words.length) queue.unshift({ text: words.slice(lo).join(" "), cap: false, cont: lo > 0 });
  }
  if (page.paras.length || !pages.length) pages.push(page);
  return pages;
}
function PageView({ spec, title }) {
  return (
    <div className="page-inner">
      {spec.first && (
        <header className="page-head">
          <h2 className="page-head__title">{title}</h2>
          <div className="page-head__rule" />
        </header>
      )}
      <div>
        {spec.paras.map((p, i) => p.cap && p.text
          ? <p key={i} className={"prose" + (p.split ? " prose--split" : "")}><span className="prose__cap">{p.text.charAt(0)}</span>{p.text.slice(1)}</p>
          : <p key={i} className={"prose" + (p.cont ? " prose--cont" : "") + (p.split ? " prose--split" : "")}>{p.text}</p>)}
      </div>
    </div>
  );
}
function EmptyBookPage({ onWrite }) {
  const t = (k) => (window.__i18n ? window.__i18n.t(k) : k);
  return (
    <div className="page-inner empty-book">
      <header className="page-head">
        <h2 className="page-head__title">{t('book.emptyTitle')}</h2>
        <div className="page-head__rule" />
      </header>
      <p className="prose prose--cont">{t('book.emptyText')}</p>
      <button className="quill" type="button" onClick={onWrite}>✎ {t('book.writeFirst')}</button>
    </div>
  );
}
// raw Firestore scenes → book scenes with spreads; the last one ends with the «what next?» spread
function paginateBook(raw, box, typo, projectId, onWrite) {
  if (!raw.length) return [{ n: 1, t: "", id: null, pages: [
    { left: <EmptyBookPage onWrite={onWrite} />, right: null },
    { left: <SceneIntentLeft />, right: <SceneIntentRight projectId={projectId} /> },
  ] }];
  // a phone reads one long parchment sheet per scene (no page boxes to fill)
  const phone = window.matchMedia && window.matchMedia("(max-width:820px)").matches;
  const probe = phone ? null : makeProbe(box, typo);
  try {
    return raw.map((scene, idx) => {
      const specs = phone ? [{ first: true, paras: splitParas(scene.text).map((text, i) => ({ text, cap: i === 0, cont: false })) }] : paginateScene(scene, probe);
      const spreads = [];
      for (let i = 0; i < specs.length; i += 2) spreads.push({
        left: <PageView spec={specs[i]} title={scene.title} />,
        right: specs[i + 1] ? <PageView spec={specs[i + 1]} title={scene.title} /> : null,
      });
      if (idx === raw.length - 1) spreads.push({ left: <SceneIntentLeft />, right: <SceneIntentRight projectId={projectId} /> });
      return { n: scene.n, t: scene.title, id: scene.id, pages: spreads };
    });
  } finally { if (probe) probe.remove(); }
}

// Smooth full-screen fade, then navigate. Keeps the "one world" feeling
// across the (separate) workspace document.
function fadeNav(href) {
  if (window.wwGo && window.wwGo(href)) return;
  const o = document.createElement("div");
  o.style.cssText = "position:fixed;inset:0;z-index:99999;background:#080503;opacity:0;transition:opacity .55s ease;pointer-events:all;";
  document.body.appendChild(o);
  requestAnimationFrame(() => { o.style.opacity = "1"; });
  setTimeout(() => { window.location.href = href; }, 580);
}

function WritingPage() {
  return (
    <div className="page-inner">
      <PageHeader kicker="Твій хід" title="Чистий аркуш" />
      <div
        className="writing"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Тут історія затримує подих… напиши перше речення."
      />
      <div className="writing__caret-hint">світ слухає</div>
      <Folio n="vii" />
    </div>
  );
}

// Maps each reading spread to a canonical scene, so the "Пов'язане" panel
// shows the universe entities connected to what you're reading.
const actOf = (n) => n <= 3 ? 1 : n <= 6 ? 2 : 3;
// Scenes, each with its OWN page-spreads. Page arrows/dots flip WITHIN a scene;
// the scene picker switches between scenes (jumps to the scene's first page).
function buildScenes(title) {
  return [
    { n: 1, t: "Тиша над колонією", pages: [
      { left: <TitlePage title={title} />, right: <StoryOpening />, whisper: "Історію зіткано. Ось як вона починається." },
      { left: <StoryContinued />, right: <CharactersLeft />, whisper: "Світ розгортається сторінка за сторінкою." },
    ] },
    { n: 2, t: "Перший контакт", pages: [
      { left: <CharactersLeft />, right: <CharactersRight />, whisper: "Ці двоє ще не знають, що шукають одне одного." },
    ] },
    { n: 3, t: "Зламаний ретранслятор", pages: [
      { left: <WorldMapSpread />, right: <SceneEditor />, whisper: "Перепиши сцену — і Хранитель звірить її з каноном." },
    ] },
    { n: 4, t: "Остання передача", pages: [
      { left: <ColophonPage />, right: <SceneIntentRight />, whisper: "Сцену завершено. Тепер ти вирішуєш, куди поверне історія." },
    ] },
  ];
}

function Book({ flow = false, premise = "", title = "Попіл Орелії", projectId = null, startScene = null, startWriting = false, ritualText = null, onExit }) {
  const [generating, setGenerating] = useState(flow);
  const [ritualClosing, setRitualClosing] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const [scenes, setScenes] = useState(() => (projectId ? [] : buildScenes(title))); // the demo only without a story
  const [raw, setRaw] = useState(null);       // scenes as stored (projects/{p}/scenes)
  const [typo, setTypo] = useState(readTypo); // reading font & size (the «Aa» bookmark)
  const [sheet, setSheet] = useState(null);   // the writing sheet: { scene } (book-edit.jsx SceneSheet)
  const startDone = useRef(false), writeDone = useRef(false);
  const [pageBox, setPageBox] = useState(null);
  const [loadingScenes, setLoadingScenes] = useState(false);
  // current scene index + page index within that scene
  const [sc, setSc] = useState(0);
  const [pg, setPg] = useState(0);
  const [whisper, setWhisper] = useState({ text: "", sig: 0 });
  const [sceneMenu, setSceneMenu] = useState(false);
  const [exportMenu, setExportMenu] = useState(false); // ⤓ DOCX / PDF (book-export.js; allowExport — Storyteller+)
  const [showingNewScene, setShowingNewScene] = useState(false); // Trigger fade-in animation for new scene
  const [, forceBookUpdate] = useState(0); // For language change re-render
  const done = useRef(false);

  // Listen for language change events
  useEffect(() => {
    function onLanguageChange(event) {
      const newLang = event.detail?.lang;
      console.log('[Book] Language changed to:', newLang, 'forcing re-render');

      // Update iframe's i18n to match parent
      if (window.__i18n && newLang) {
        window.__i18n.setLanguage(newLang);
      }

      forceBookUpdate(prev => prev + 1);
    }
    window.addEventListener('ww-language-change', onLanguageChange);
    return () => window.removeEventListener('ww-language-change', onLanguageChange);
  }, []);

  // PHASE 3: Removed useEffect that wrote to window.__currentProjectId
  // ProjectContext now provides projectId to all components

  // Load scenes from Firestore on mount
  useEffect(() => {
    async function loadFromFirestore(options = {}) {
      if (!projectId || !window.__firebaseScenes) {
        return; // Keep mock scenes
      }

      try {
        setLoadingScenes(true);
        // Canon loads in parallel into the shared WORLD (Related panel, inline continuity)
        const canonPromise = window.__firebaseCanon
          ? window.__firebaseCanon.getCanon(projectId).catch((err) => { console.warn('[Book] Canon load failed:', err); return null; })
          : Promise.resolve(null);
        const firestoreScenes = await window.__firebaseScenes.getScenes(projectId);
        const canon = await canonPromise;
        if (canon && window.wSetWorld) {
          // Scene → canon links come from scene.canonRefs (set by extraction)
          window.wSetWorld({
            ...window.__firebaseCanon.canonToArrays(canon),
            scenes: firestoreScenes.map((s) => ({ ...s, ...(s.canonRefs || {}) }))
          });
        }

        setRaw(firestoreScenes); // pages are measured from these (paginateBook), not cut by character counts
        if (firestoreScenes.length === 0) { setSc(0); setPg(0); return; }

        // If reload after new scene generation, jump to NEW scene (not Scene Intent page)
        if (options.jumpToLast) {
          setSc(firestoreScenes.length - 1);
          setPg(0);
          setShowingNewScene(true); // Trigger fade-in animation
          setTimeout(() => setShowingNewScene(false), 1200);
          return;
        }
        // after writing in the sheet: back to the scene that was written
        if (options.jumpTo) {
          const i = firestoreScenes.findIndex((x) => x.id === options.jumpTo);
          setSc(Math.max(0, i)); setPg(0);
          return;
        }
        // deep link ?scene=N
        if (startScene != null && !startDone.current) {
          startDone.current = true;
          const i = firestoreScenes.findIndex((x) => x.n === startScene);
          if (i >= 0) { setSc(i); setPg(0); return; }
        }

        // Restore reading position if exists
        try {
          const savedPosition = localStorage.getItem("ww_reading_position");
          if (savedPosition) {
            const position = JSON.parse(savedPosition);
            if (position.projectId === projectId) {
              setSc(Math.min(position.sc, firestoreScenes.length - 1));
              setPg(position.pg || 0); // clamped once the pages are measured
              return;
            }
          }
        } catch (e) {
          console.error('Failed to restore position:', e);
        }

        // Default: start from beginning (first time opening project)
        setSc(0);
        setPg(0);
      } catch (error) {
        console.error('Failed to load scenes:', error);
      } finally {
        setLoadingScenes(false);
      }
    }

    loadFromFirestore();

    // Export reload function for SceneIntentPage to call after saving
    window.__reloadBook = loadFromFirestore;

    // Listen for postMessage reload requests (fallback if __reloadBook not accessible)
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'reloadBook') {
        console.log('[Book] Received reloadBook message from iframe');
        loadFromFirestore(event.data);
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.__reloadBook = null;
      window.removeEventListener('message', handleMessage);
    };
  }, [projectId]);

  useEffect(() => {
    const h = (e) => setTypo((cur) => {
      const next = { ...cur, ...(e.detail || {}) };
      try { localStorage.setItem(BOOK_TYPO_KEY, JSON.stringify(next)); } catch (er) {}
      return next;
    });
    window.addEventListener("ww-book-typo", h);
    return () => window.removeEventListener("ww-book-typo", h);
  }, []);
  const openSheet = useCallback((scene) => setSheet({ scene }), []);
  const newScene = useCallback(async () => {
    const tt = (k) => (window.__i18n ? window.__i18n.t(k) : k);
    const n = (raw || []).reduce((m, x) => Math.max(m, x.n || 0), 0) + 1;
    const made = await window.__firebaseScenes.addScene(projectId, { title: tt('book.scene') + " " + n, text: "", n, status: "draft" });
    setSheet({ scene: made, fresh: true });
  }, [raw, projectId]);
  useEffect(() => {
    if (!raw) return;
    let dead = false;
    const run = () => { if (!dead) setScenes(paginateBook(raw, pageBox, typo, projectId, () => (raw.length ? openSheet(raw[0]) : newScene()))); };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(run);
    return () => { dead = true; };
  }, [raw, pageBox, typo, projectId]);
  // a written-from-scratch story opens straight into the sheet
  useEffect(() => {
    if (!raw || generating || !startWriting || writeDone.current) return; // after the mage has opened the book
    writeDone.current = true;
    if (raw.length) openSheet(raw[raw.length - 1]); else newScene();
  }, [raw, generating]);
  // keep the page index inside the (re)measured scene
  useEffect(() => {
    const s = scenes[sc];
    if (!s) { if (scenes.length) setSc(scenes.length - 1); return; }
    if (pg > s.pages.length - 1) setPg(s.pages.length - 1);
  }, [scenes]);

  const SCENES = scenes;
  const scene = SCENES.length > 0 ? SCENES[sc] : null;
  const spread = scene && scene.pages ? scene.pages[pg] : null;
  const atFirst = sc === 0 && pg === 0;
  const atLast = SCENES.length > 0 && sc === SCENES.length - 1 && scene && pg === scene.pages.length - 1;


  // Pagination diagnostics removed - stable at 520/580 chars

  // Size an overlay box to exactly match the cover-rendered book image, so
  // the text regions track the photographed pages at any viewport/crop.
  useEffect(() => {
    const IW = 1536, IH = 1024;
    function calc() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const scale = Math.max(vw / IW, vh / IH);
      setPageBox({ w: Math.round(IW * scale), h: Math.round(IH * scale) });
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // Persist reading position so a refresh keeps the reader's place.
  useEffect(() => {
    if (generating || !projectId) return;
    try {
      const position = { projectId, sc, pg };
      localStorage.setItem("ww_reading_position", JSON.stringify(position));
    } catch (e) {}
  }, [sc, pg, generating, projectId]);

  const announce = useCallback((sIdx, pIdx) => {
    const s = SCENES[sIdx]; const w = s && s.pages[pIdx] && s.pages[pIdx].whisper;
    if (w) setWhisper((p) => ({ text: w, sig: p.sig + 1 }));
  }, [SCENES]);

  const finishRitual = useCallback(() => {
    if (done.current) return;
    done.current = true;
    // hold on the last frame for a beat, then fade to black, then reveal the book
    setTimeout(() => {
      setRitualClosing(true);            // triggers fade-to-black overlay
      setTimeout(() => { setGenerating(false); setJustRevealed(true); setTimeout(() => announce(0, 0), 500); }, 900);
    }, 1000);
  }, [announce]);

  // Safety timer in case the video can't autoplay / has no duration.
  useEffect(() => {
    if (!flow) return;
    const t = setTimeout(finishRitual, 5200);
    return () => clearTimeout(t);
  }, [flow, finishRitual]);

  // page-turn flips within a scene; at a scene's edge it crosses to the
  // adjacent scene (next → its first page, prev → its last page).
  const go = useCallback((dir) => {
    if (dir === "next") {
      if (pg < SCENES[sc].pages.length - 1) { setPg(pg + 1); announce(sc, pg + 1); }
      else if (sc < SCENES.length - 1) { setSc(sc + 1); setPg(0); announce(sc + 1, 0); }
    } else {
      if (pg > 0) { setPg(pg - 1); announce(sc, pg - 1); }
      else if (sc > 0) { const ps = SCENES[sc - 1].pages.length - 1; setSc(sc - 1); setPg(ps); announce(sc - 1, ps); }
    }
  }, [SCENES, sc, pg, announce]);
  // jump to a scene (its first page)
  const goScene = useCallback((sIdx) => {
    setSc(sIdx); setPg(0); announce(sIdx, 0);
  }, [announce]);

  const close = useCallback(() => {
    if (onExit) onExit();
  }, [onExit]);

  useEffect(() => {
    function onKey(e) {
      if (generating || sheet || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") || (e.target && e.target.isContentEditable)) return;
      if (e.key === "ArrowRight") go("next");
      else if (e.key === "ArrowLeft") go("prev");
      else if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [generating, go, close, sheet]);

  // Quill "continue the story" jumps to the writing leaf (last scene's last page).
  useEffect(() => {
    function onClick(e) {
      const w = e.target.closest && e.target.closest("[data-write]");
      if (w) {
        setSc(SCENES.length - 1); setPg(SCENES[SCENES.length - 1].pages.length - 1);
        setTimeout(() => {
          const el = document.querySelector(".writing");
          if (el) el.focus();
          setWhisper((p) => ({ text: "Жодне речення не буває хибним. Просто почни.", sig: p.sig + 1 }));
        }, 120);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [SCENES]);

  const goTree = useCallback(() => {
    const url = projectId ? `WhiteWrite GameBible.html?projectId=${encodeURIComponent(projectId)}` : "WhiteWrite GameBible.html";
    fadeNav(url);
  }, [projectId]);

  // Show loading if scenes not ready
  if (!scene || !spread) {
    return (
      <div className="book-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0908', color: '#d4af70', fontSize: '18px' }}>
        <div>Завантаження книги...</div>
      </div>
    );
  }

  return (
    <div className="world reading" style={{ "--book-size": typo.size, "--book-font": typo.font }}>
      <div className="vignette" aria-hidden="true" />
      <div className="ambient" aria-hidden="true" />
      <Particles density={0.7} />

      {/* Subtle brand/title ribbon */}
      <div className="ribbon">
        <span className="ribbon__brand">White&nbsp;Tree</span>
        <span className="ribbon__sep">·</span>
        <span className="ribbon__universe">{title}</span>
      </div>

      {/* Always-visible pillar navigation — identical to Tree / Director */}
      {!generating && (
        <div className="book-nav">
          <div className="pillswitch" role="tablist" aria-label={window.__i18n ? window.__i18n.t('nav.pillars') : 'Стовпи WhiteWrite'}>
            <button className="pillswitch__b is-here" type="button" aria-current="page">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5c-3 0-9 2-12 8-1.3 2.6-2 5-2 5s2.4-.7 5-2c6-3 8-9 9-11z"/><path d="M5 19 11 13M16 8l-4 1 1-4"/></svg>{window.__i18n ? window.__i18n.t('nav.book') : 'Книга'}
            </button>
            <button className="pillswitch__b" type="button" onClick={goTree}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21v-6"/><path d="M12 15c-3 0-5-2-5-5a4.3 4.3 0 0 1 1.5-3.3A4 4 0 0 1 12 3a4 4 0 0 1 3.5 3.7A4.3 4.3 0 0 1 17 10c0 3-2 5-5 5z"/></svg>{window.__i18n ? window.__i18n.t('nav.universe') : 'Всесвіт'}
            </button>
          </div>
        </div>
      )}

      {/* Stage 3 — full-bleed photographed book; text tracks its two pages */}
      <div className={`photobook ${flow && !ritualClosing ? "" : "is-revealed"} ${justRevealed ? "is-revealing" : ""}`}>
        <img className="photobook__img" src={atLast ? "assets/BookNextEpisode.png" : "assets/OpenedBook.jpg"} alt="Відкрита книга" />
        <div className="photobook__pages" style={pageBox ? { width: pageBox.w, height: pageBox.h } : undefined}>
          <div className="opage opage--left">
            <div className="opage__fade" key={"L" + sc + "-" + pg + (showingNewScene ? "-new" : "")}>{spread.left}</div>
          </div>
          <div className="opage opage--right">
            <div className="opage__fade" key={"R" + sc + "-" + pg + (showingNewScene ? "-new" : "")}>{spread.right}</div>
          </div>
        </div>

        {!generating && (
          <button className={`pturn pturn--prev ${atFirst ? "is-disabled" : ""}`} onClick={() => !atFirst && go("prev")} aria-label="Назад" type="button" disabled={atFirst}>‹</button>
        )}
        {!generating && !atLast && (
          <button className={`pturn pturn--next ${atLast ? "is-disabled" : ""}`} onClick={() => !atLast && go("next")} aria-label="Далі" type="button" disabled={atLast}>›</button>
        )}
        {!generating && atLast && (
          <button
            className="pturn pturn--generate"
            onClick={() => {
              console.log('[Book] Generate button clicked');
              const canGenerate = window.__sceneIntentCanGenerate ? window.__sceneIntentCanGenerate() : false;
              console.log('[Book] window.__sceneIntentGenerate:', window.__sceneIntentGenerate);
              console.log('[Book] window.__sceneIntentCanGenerate:', canGenerate);

              if (!canGenerate) {
                alert('Обери напрям історії перед генерацією!');
                return;
              }

              if (window.__sceneIntentGenerate) {
                window.__sceneIntentGenerate();
              } else {
                console.error('[Book] window.__sceneIntentGenerate is not defined!');
                alert('Помилка: функція генерації не знайдена. Перезавантаж сторінку.');
              }
            }}
            aria-label={(window.__i18n ? window.__i18n.t('intent.generate') : 'Почати наступну сцену')}
            type="button"
          >
            <span style={{ fontSize: '46px', lineHeight: 1, color: '#3a2a15' }}>
              {window.__sceneIntentIsBusy && window.__sceneIntentIsBusy() ? '⏳' : '✦'}
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'Philosopher, serif', fontWeight: 700, marginTop: '4px', color: '#3a2a15', textShadow: '0 0 2px rgba(255,255,255,0.3)' }}>
              {window.__i18n ? window.__i18n.t('intent.generate') : 'Генерувати'}
            </span>
          </button>
        )}
      </div>

      {/* Stage 2 — generation ritual: the user's opening-book video + overlay */}
      {generating && (
        <div className="ritual" aria-live="polite">
          <video
            className="ritual__video"
            src="assets/StartStoryAnim.mp4"
            autoPlay muted playsInline
            onEnded={finishRitual}
          />
          <div className="ritual__veil" />
          <div className={`ritual__center ${ritualClosing ? "is-closing" : ""}`}>
            <div className="ritual__mark">✶</div>
            <div className="ritual__text">{ritualText || (window.__i18n ? window.__i18n.t('book.ritualAi') : 'AI створює вашу історію…')}</div>
            {premise && <div className="ritual__premise">«{premise.trim().slice(0, 120)}»</div>}
            <div className="ritual__dots"><span /><span /><span /></div>
          </div>
          <div className={`ritual__fade ${ritualClosing ? "is-on" : ""}`} />
        </div>
      )}

      <KeeperWhisper text={whisper.text} signal={whisper.sig} />

      {!generating && (
        <div className="bookbar">
          <button className="scenebar__nav" type="button" disabled={atFirst} onClick={() => go("prev")} aria-label={(window.__i18n ? window.__i18n.t('ui.previous') : 'Попередня')}>‹</button>
          <div className="scenebar__pick">
            <button className={`scenebar__btn ${sceneMenu ? "is-open" : ""}`} type="button" onClick={(e) => { e.stopPropagation(); setSceneMenu((o) => !o); }}>
              <span className="scenebar__act">{window.__i18n ? window.__i18n.t('book.act') : 'Акт'} {actOf(scene.n)}</span>
              <span className="scenebar__sc">{window.__i18n ? window.__i18n.t('book.scene') : 'Сцена'} {scene.n} · {scene.t}</span>
              <span className="scenebar__caret">▾</span>
            </button>
            {sceneMenu && (
              <>
                <div className="scenebar__scrim" onClick={(e) => { e.stopPropagation(); setSceneMenu(false); }} />
                <div className="scenebar__menu scenebar__menu--up" role="menu" onClick={(e) => e.stopPropagation()}>
                  {SCENES.map((s, i) => (
                    <button key={s.n} role="menuitem" type="button" className={`scenebar__opt ${i === sc ? "is-on" : ""}`}
                      onClick={(e) => { e.stopPropagation(); setSceneMenu(false); goScene(i); }}>
                      <span className="scenebar__opt-act">{window.__i18n ? window.__i18n.t('book.act') : 'Акт'} {actOf(s.n)}</span>
                      <span className="scenebar__opt-n">{s.n}</span>
                      <span className="scenebar__opt-t">{s.t}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="pager">
            {(function () {
              const n = scene.pages.length;
              if (n <= 7) return scene.pages.map((_, i) => (
                <button key={i} className={`pager__dot ${i === pg ? "is-on" : ""}`} onClick={() => { setPg(i); announce(sc, i); }} title={"Сторінка " + (i + 1)}>{i + 1}</button>
              ));
              // windowed: first · current±1 · last, gaps shown as «…»
              const want = new Set([0, n - 1, pg - 1, pg, pg + 1]);
              const idxs = [...want].filter((i) => i >= 0 && i < n).sort((a, b) => a - b);
              const out = [];
              idxs.forEach((i, k) => {
                if (k > 0 && i - idxs[k - 1] > 1) out.push(<span key={"g" + i} className="pager__gap">…</span>);
                out.push(<button key={i} className={`pager__dot ${i === pg ? "is-on" : ""}`} onClick={() => { setPg(i); announce(sc, i); }} title={"Сторінка " + (i + 1)}>{i + 1}</button>);
              });
              return out;
            }())}
          </div>
          <button className="scenebar__nav" type="button" disabled={atLast} onClick={() => go("next")} aria-label="Наступна">›</button>
          <span className="scenebar__div" />
          {projectId && raw && raw[sc] && (
            <button className="bookbar__edit" type="button" title={window.__i18n ? window.__i18n.t('book.editScene') : 'Редагувати сцену'} onClick={() => openSheet(raw[sc])}>✎</button>
          )}
          {projectId && raw && (
            <button className="bookbar__edit bookbar__new" type="button" title={window.__i18n ? window.__i18n.t('book.newScene') : 'Нова сцена'} onClick={newScene}>＋</button>
          )}
          {projectId && raw && raw.length > 0 && (function () {
            const tt = (k) => (window.__i18n ? window.__i18n.t(k) : k);
            const plan = window.__wwUser && window.__wwUser.plan;
            const ok = !!(window.__getPlanConfig && plan && window.__getPlanConfig(plan).allowExport);
            const run = (kind) => { setExportMenu(false); window.__bookExport[kind](title, raw.map((s) => ({ n: s.n, title: s.title, text: s.text }))); };
            return (
              <div className="bookbar__exp">
                <button className={`bookbar__edit ${exportMenu ? "is-on" : ""}`} type="button" title={tt('book.export')} aria-label={tt('book.export')} aria-expanded={exportMenu}
                  onClick={(e) => { e.stopPropagation(); setExportMenu((o) => !o); }}>⤓</button>
                {exportMenu && (
                  <>
                    <div className="scenebar__scrim" onClick={(e) => { e.stopPropagation(); setExportMenu(false); }} />
                    <div className="scenebar__menu scenebar__menu--up bookbar__expmenu" role="menu" onClick={(e) => e.stopPropagation()}>
                      <div className="bookbar__exphead">{tt('book.export')} · {raw.length} {tt('plan.scenes')}</div>
                      <button role="menuitem" type="button" className="scenebar__opt" disabled={!ok} onClick={() => run("docx")}>DOCX — Word</button>
                      <button role="menuitem" type="button" className="scenebar__opt" disabled={!ok} onClick={() => run("pdf")}>PDF — {tt('book.exportPrint')}</button>
                      {!ok && <div className="bookbar__exphead">{tt('book.exportPlan')}</div>}
                    </div>
                  </>
                )}
              </div>
            );
          }())}
        </div>
      )}

      {!generating && <RelatedPanel scene={scene.n} />}
      {sheet && (
        <SceneSheet projectId={projectId} scene={sheet.scene} fresh={!!sheet.fresh}
          onClose={(id) => { setSheet(null); if (window.__reloadBook) window.__reloadBook({ jumpTo: id }); }} />
      )}
    </div>
  );
}

window.Book = Book;
