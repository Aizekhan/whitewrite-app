// The book IS the interface — Stage 2 (ritual video) + Stage 3 (reading).
// Stage 2: StartStoryAnim.mp4 plays under a semi-transparent "AI generating"
// line. Stage 3: OpenedBook.jpg is the book; story text is laid over its two
// pages and crossfades as you move with ← →. From reading you cross into the
// production workspace (the 5 tabs) — same universe, seamless fade.
const { useState, useEffect, useCallback, useRef } = React;

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
      { left: <ColophonPage />, right: <SceneIntentPage />, whisper: "Сцену завершено. Тепер ти вирішуєш, куди поверне історія." },
    ] },
  ];
}

function Book({ flow = false, premise = "", title = "Попіл Орелії", startScene = null, onExit }) {
  const [generating, setGenerating] = useState(flow);
  const [ritualClosing, setRitualClosing] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const [editOn, setEditOn] = useState(false);
  const SCENES = useRef(buildScenes(title)).current;
  // current scene index + page index within that scene
  const [sc, setSc] = useState(0);
  const [pg, setPg] = useState(0);
  const [whisper, setWhisper] = useState({ text: "", sig: 0 });
  const [sceneMenu, setSceneMenu] = useState(false);
  const done = useRef(false);

  const scene = SCENES[sc];
  const spread = scene.pages[pg];
  const atFirst = sc === 0 && pg === 0;
  const atLast = sc === SCENES.length - 1 && pg === scene.pages.length - 1;

  // Size an overlay box to exactly match the cover-rendered book image, so
  // the text regions track the photographed pages at any viewport/crop.
  const [pageBox, setPageBox] = useState(null);
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
    if (generating) return;
    try { localStorage.setItem("ww_book_sc", String(sc)); } catch (e) {}
  }, [sc, generating]);

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
      if (generating) return;
      if (e.key === "ArrowRight") go("next");
      else if (e.key === "ArrowLeft") go("prev");
      else if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [generating, go, close]);

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

  const goWorkspace = useCallback(() => fadeNav("WhiteWrite Workspace.html"), []);
  const goTree = useCallback(() => fadeNav("WhiteWrite WorldTree.html"), []);

  return (
    <div className="world reading">
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
          <div className="pillswitch" role="tablist" aria-label="Стовпи WhiteWrite">
            <button className="pillswitch__b is-here" type="button" aria-current="page">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5c-3 0-9 2-12 8-1.3 2.6-2 5-2 5s2.4-.7 5-2c6-3 8-9 9-11z"/><path d="M5 19 11 13M16 8l-4 1 1-4"/></svg>Книга
            </button>
            <button className="pillswitch__b" type="button" onClick={goTree}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21v-6"/><path d="M12 15c-3 0-5-2-5-5a4.3 4.3 0 0 1 1.5-3.3A4 4 0 0 1 12 3a4 4 0 0 1 3.5 3.7A4.3 4.3 0 0 1 17 10c0 3-2 5-5 5z"/></svg>Всесвіт
            </button>
            <button className="pillswitch__b" type="button" onClick={goWorkspace}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 21 9.5 21 19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="m3 9.5 17-4M7 5l-1 4M12 4l-1 4.5M17 3l-1 5"/></svg>Режисер
            </button>
          </div>
        </div>
      )}

      {/* Stage 3 — full-bleed photographed book; text tracks its two pages */}
      <div className={`photobook ${flow && !ritualClosing ? "" : "is-revealed"} ${justRevealed ? "is-revealing" : ""}`}>
        <img className="photobook__img" src="assets/OpenedBook.jpg" alt="Відкрита книга" />
        <div className="photobook__pages" style={pageBox ? { width: pageBox.w, height: pageBox.h } : undefined}>
          <div className="opage opage--left">
            <div className="opage__fade" key={"L" + sc + "-" + pg}>{spread.left}</div>
          </div>
          <div className="opage opage--right">
            <div className="opage__fade" key={"R" + sc + "-" + pg}>{spread.right}</div>
          </div>
        </div>

        {!generating && (
          <button className={`pturn pturn--prev ${atFirst ? "is-disabled" : ""}`} onClick={() => !atFirst && go("prev")} aria-label="Назад" type="button" disabled={atFirst}>‹</button>
        )}
        {!generating && (
          <button className={`pturn pturn--next ${atLast ? "is-disabled" : ""}`} onClick={() => !atLast && go("next")} aria-label="Далі" type="button" disabled={atLast}>›</button>
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
            <div className="ritual__text">AI створює вашу історію…</div>
            {premise && <div className="ritual__premise">«{premise.trim().slice(0, 120)}»</div>}
            <div className="ritual__dots"><span /><span /><span /></div>
          </div>
          <div className={`ritual__fade ${ritualClosing ? "is-on" : ""}`} />
        </div>
      )}

      <KeeperWhisper text={whisper.text} signal={whisper.sig} />

      {!generating && (
        <div className="bookbar">
          <button className="scenebar__nav" type="button" disabled={atFirst} onClick={() => go("prev")} aria-label="Попередня">‹</button>
          <div className="scenebar__pick">
            <button className={`scenebar__btn ${sceneMenu ? "is-open" : ""}`} type="button" onClick={(e) => { e.stopPropagation(); setSceneMenu((o) => !o); }}>
              <span className="scenebar__act">Акт {actOf(scene.n)}</span>
              <span className="scenebar__sc">Сцена {scene.n} · {scene.t}</span>
              <span className="scenebar__caret">▾</span>
            </button>
            {sceneMenu && (
              <>
                <div className="scenebar__scrim" onClick={(e) => { e.stopPropagation(); setSceneMenu(false); }} />
                <div className="scenebar__menu scenebar__menu--up" role="menu" onClick={(e) => e.stopPropagation()}>
                  {SCENES.map((s, i) => (
                    <button key={s.n} role="menuitem" type="button" className={`scenebar__opt ${i === sc ? "is-on" : ""}`}
                      onClick={(e) => { e.stopPropagation(); setSceneMenu(false); goScene(i); }}>
                      <span className="scenebar__opt-act">Акт {actOf(s.n)}</span>
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
          <button className={`bookbar__edit ${editOn ? "is-on" : ""}`} type="button" title="Редагувати текст" onClick={() => { const v = !window.__wwEditMode; window.__wwEditMode = v; setEditOn(v); window.dispatchEvent(new CustomEvent("ww-editmode", { detail: v })); }}>✎</button>
        </div>
      )}

      {!generating && <RelatedPanel scene={scene.n} />}
    </div>
  );
}

window.Book = Book;
