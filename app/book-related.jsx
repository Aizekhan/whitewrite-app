// "Пов'язане" reimagined as a manuscript, not a database. Slim leather
// bookmarks peek from the book's edge; tapping one reveals a small parchment
// note with just that category's entities. A ✦ ribbon closes the book and
// opens the World Tree. Canon is revealed progressively, never dumped.
(function () {
  const { useState: useRelState, useEffect: useRelEffect } = React;

  const REL_LABEL = { characters: "Персонажі", locations: "Локації", events: "Події", factions: "Фракції", artifacts: "Артефакти" };
  const REL_COLOR = { characters: "#b78a32", locations: "#6f8a4f", events: "#b15a37", factions: "#8a6bb0", artifacts: "#c0892f" };
  const REL_ORDER = ["characters", "locations", "events", "factions", "artifacts"];

  const I = (paths) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
  );
  const RIcon = {
    characters: I(<><circle cx="12" cy="8" r="3.4" /><path d="M5.5 19c.6-3.3 3.2-5 6.5-5s5.9 1.7 6.5 5" /></>),
    locations: I(<><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></>),
    events: I(<path d="M12 2l2.3 6.9H21l-5.4 4 2 6.8L12 15.7 6.4 19.7l2-6.8L3 8.9h6.7z" />),
    factions: I(<><path d="M12 3 5 5.4V12c0 4.2 3 7 7 9 4-2 7-4.8 7-9V5.4z" /><path d="M12 7v8M8.5 10.5h7" /></>),
    artifacts: I(<><path d="M6 4h12l3 5-9 11L3 9z" /><path d="M3 9h18M9 4 6 9l6 11M15 4l3 5-6 11" /></>),
  };

  // Only the DIRECT canon of a scene — a few key threads, not the whole web.
  function relatedForScene(n) {
    const s = wScene(n) || {};
    const facs = new Set();
    (s.events || []).forEach((eid) => { const e = wEnt("events", eid); (e && e.factions || []).forEach((f) => facs.add(f)); });
    return { characters: s.characters || [], locations: s.locations || [], events: s.events || [], factions: [...facs], artifacts: s.artifacts || [] };
  }

  function relFade(href) {
    if (window.wwGo && window.wwGo(href)) return;
    const o = document.createElement("div");
    o.style.cssText = "position:fixed;inset:0;z-index:99999;background:#080503;opacity:0;transition:opacity .6s ease;pointer-events:all;";
    document.body.appendChild(o);
    requestAnimationFrame(() => { o.style.opacity = "1"; });
    setTimeout(() => { window.location.href = href; }, 600);
  }
  const openEntity = (type, id) => relFade("WhiteWrite%20WorldTree.html?type=" + type + "&id=" + encodeURIComponent(id));
  const exploreCanon = () => relFade("WhiteWrite%20WorldTree.html");

  // reading typography controls (set CSS vars on the reading root)
  function readingRoot() { return document.querySelector(".world.reading") || document.documentElement; }
  function setBookFont(ff) { readingRoot().style.setProperty("--book-font", ff); }
  let _sz = 1;
  function setBookSize(v) { _sz = v; readingRoot().style.setProperty("--book-size", v); }
  function stepBookSize(d) {
    const cur = parseFloat(getComputedStyle(readingRoot()).getPropertyValue("--book-size")) || 1;
    setBookSize(Math.min(1.4, Math.max(0.78, cur + d)));
  }

  function RelatedPanel({ scene }) {
    const [open, setOpen] = useRelState(null);
    const popRef = React.useRef(null);
    const lastFocus = React.useRef(null);
    useRelEffect(() => {
      const k = (e) => { if (e.key === "Escape") setOpen(null); };
      window.addEventListener("keydown", k);
      return () => window.removeEventListener("keydown", k);
    }, []);
    useRelEffect(() => { setOpen(null); }, [scene]);
    // move focus into the popover on open, restore on close; trap Tab
    useRelEffect(() => {
      if (!open) { if (lastFocus.current && lastFocus.current.focus) lastFocus.current.focus(); return; }
      lastFocus.current = document.activeElement;
      const el = popRef.current;
      const first = el && el.querySelector("button");
      if (first) first.focus();
      const onKey = (e) => {
        if (e.key !== "Tab" || !el) return;
        const items = [...el.querySelectorAll("button")].filter((n) => n.offsetParent !== null);
        if (!items.length) return;
        const f = items[0], l = items[items.length - 1];
        if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); }
        else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); }
      };
      el && el.addEventListener("keydown", onKey);
      return () => { el && el.removeEventListener("keydown", onKey); };
    }, [open]);

    const groups = relatedForScene(scene);
    const present = REL_ORDER.filter((t) => groups[t].length);
    if (!present.length) return null;

    return (
      <>
        <div className="bookmarks">
          {present.map((t) => (
            <button className={`bm ${open === t ? "is-active" : ""}`} key={t} type="button" title={REL_LABEL[t]}
              style={{ "--c": REL_COLOR[t] }}
              onClick={() => setOpen(open === t ? null : t)}>
              <span className="bm__glyph">{RIcon[t]}</span>
              <span className="bm__n">{groups[t].length}</span>
            </button>
          ))}
          <button className={`bm bm--explore ${open === "__text" ? "is-active" : ""}`} type="button" title="Налаштування тексту" onClick={() => setOpen(open === "__text" ? null : "__text")}>
            <span className="bm__glyph">Aa</span>
          </button>
        </div>

        {open === "__text" && (
          <>
            <div className="bm-scrim" onClick={() => setOpen(null)} />
            <div className="bm-pop bm-pop--text" role="dialog" aria-modal="true" aria-label="Налаштування тексту" ref={popRef}>
              <div className="bm-pop__head">
                <div>
                  <div className="bm-pop__sub">Читання</div>
                  <div className="bm-pop__title">Текст</div>
                </div>
                <button className="bm-pop__x" type="button" onClick={() => setOpen(null)} aria-label="Закрити">✕</button>
              </div>
              <div className="ts-group">
                <div className="ts-lbl">Шрифт</div>
                <div className="ts-row">
                  {[["Philosopher","Philosopher"],["Spectral","Spectral, Georgia, serif"],["Sans","system-ui, sans-serif"]].map(([lbl,ff]) => (
                    <button key={lbl} className="ts-btn" style={{ fontFamily: ff }} onClick={() => setBookFont(ff)}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div className="ts-group">
                <div className="ts-lbl">Розмір</div>
                <div className="ts-row">
                  <button className="ts-btn" onClick={() => stepBookSize(-0.08)}>A−</button>
                  <button className="ts-btn" onClick={() => setBookSize(1)}>Скинути</button>
                  <button className="ts-btn" onClick={() => stepBookSize(0.08)}>A+</button>
                </div>
              </div>
              <div className="bm-pop__foot">Налаштування читання</div>
            </div>
          </>
        )}

        {open && open !== "__text" && (
          <>
            <div className="bm-scrim" onClick={() => setOpen(null)} />
            <div className="bm-pop" role="dialog" aria-modal="true" aria-label={`Канон сцени ${scene}: ${REL_LABEL[open]}`} ref={popRef} style={{ "--c": REL_COLOR[open] }}>
              <div className="bm-pop__head">
                <div>
                  <div className="bm-pop__sub">Канон сцени {scene}</div>
                  <div className="bm-pop__title">{REL_LABEL[open]}</div>
                </div>
                <button className="bm-pop__x" type="button" onClick={() => setOpen(null)} aria-label="Закрити">✕</button>
              </div>
              <div className="bm-pop__list">
                {groups[open].map((id) => {
                  const e = wEnt(open, id); if (!e) return null;
                  return (
                    <button className="bm-item" key={id} type="button" onClick={() => openEntity(open, id)}>
                      <span className="bm-item__dot" /><span className="bm-item__t">{wTitle(open, e)}</span><span className="bm-item__go">›</span>
                    </button>
                  );
                })}
              </div>
              <div className="bm-pop__foot">✦ Відкрити у Світовому Дереві</div>
            </div>
          </>
        )}
      </>
    );
  }

  window.RelatedPanel = RelatedPanel;
}());
