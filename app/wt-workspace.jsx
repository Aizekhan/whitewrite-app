// Generic universe workspace: full-screen, scalable management UI for one
// category. Toolbar (search / filter / sort / group / view), split layout
// with Cards · List · Graph on the left and a connected profile on the right.
const { useState: useWsState, useMemo: useWsMemo } = React;

// Helper to get translations
function t(key) {
  return window.__i18n ? window.__i18n.t(key) : key;
}

const TYPE_COLOR = {
  characters: "var(--gold-lit)", locations: "var(--st-ready)", events: "var(--st-draft)",
  factions: "var(--violet-lit)", artifacts: "var(--st-review)",
};

function distinct(items, of) {
  const s = []; items.forEach((e) => { const v = of(e); if (v != null && !s.includes(v)) s.push(v); }); return s;
}

/* ---------------- Preview Mode Banner ---------------- */
function PreviewBanner() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(217,119,6,0.1) 0%, rgba(217,119,6,0.05) 100%)',
      border: '1px solid rgba(217,119,6,0.2)',
      borderRadius: '8px',
      padding: '12px 20px',
      margin: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '14px',
      color: 'var(--tx-base)'
    }}>
      <span style={{
        background: 'var(--gold-soft)',
        color: 'var(--gold)',
        padding: '4px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {t('preview.badge')}
      </span>
      <span style={{ flex: 1 }}>
        {t('preview.message')}
      </span>
    </div>
  );
}

/* ---------------- left views ---------------- */
function EntIcon({ type, hue }) {
  const I = Ic[ADAPTERS[type].icon];
  return <span className="went-ic" style={{ "--h": hue }}><I /></span>;
}

function WCard({ type, e, active, onOpen }) {
  const A = ADAPTERS[type], p = A.pill(e);
  return (
    <article className={`wcard ${active ? "is-active" : ""}`} onClick={onOpen}>
      <div className="wcard__media" style={{ backgroundImage: `url(assets/ph-${type}.png)`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <image-slot id={`wt-${type}-${e.id}`} class="wcard__img" shape={A.slotShape} placeholder=""></image-slot>
        <div className="wcard__scrim" />
        <span className="wcard__ic" style={{ "--h": A.hue(e) }}>{React.createElement(Ic[A.icon])}</span>
        <span className="wcard__stat">{A.cardStat(e)}</span>
      </div>
      <div className="wcard__b">
        <div className="wcard__row"><div className="ent-name">{wTitle(type, e)}</div><span className={`pill pill--${p.cls}`}>{p.label}</span></div>
        <div className="ent-sub">{A.sub(e)}</div>
        <p className="wcard__blurb">{A.blurb(e)}</p>
      </div>
    </article>
  );
}

function WRow({ type, e, active, onOpen }) {
  const A = ADAPTERS[type], p = A.pill(e);
  return (
    <button className={`wrow ${active ? "is-active" : ""}`} onClick={onOpen} type="button">
      <EntIcon type={type} hue={A.hue(e)} />
      <span className="wrow__id"><span className="wrow__name">{wTitle(type, e)}</span><span className="wrow__sub">{A.sub(e)}</span></span>
      <span className="wrow__stat">{A.cardStat(e)}</span>
      <span className={`pill pill--${p.cls}`}>{p.label}</span>
    </button>
  );
}

function EgoGraph({ type, id, navigate }) {
  const center = wEnt(type, id);
  const conns = wConnections(type, id);
  const W = 760, H = 470, cx = W / 2, cy = H / 2;
  const n = conns.length || 1;
  const R = n > 9 ? 196 : n > 5 ? 172 : 140;
  const nodes = conns.map((c, i) => {
    const ang = (-90 + i * (360 / n)) * Math.PI / 180;
    return { ...c, ent: wEnt(c.type, c.id), x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R * 0.8 };
  });
  return (
    <div className="graph-wrap">
      <svg className="egograph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {nodes.map((nd, i) => (
          <line key={"l" + i} x1={cx} y1={cy} x2={nd.x} y2={nd.y} stroke={TYPE_COLOR[nd.type]} strokeOpacity="0.32" strokeWidth="1.4" />
        ))}
        {nodes.map((nd, i) => (
          <g key={"n" + i} className="gn" onClick={() => navigate(nd.type, nd.id)}>
            <circle cx={nd.x} cy={nd.y} r="30" fill="var(--bg-3)" stroke={TYPE_COLOR[nd.type]} strokeWidth="1.6" />
            <text x={nd.x} y={nd.y - 1} className="gn__t">{wTitle(nd.type, nd.ent).slice(0, 14)}</text>
            <text x={nd.x} y={nd.y + 42} className="gn__cap" fill={TYPE_COLOR[nd.type]}>{ADAPTERS[nd.type].title}</text>
            {nd.rel && <text x={nd.x} y={(cy + nd.y) / 2 - 4} className="gn__rel">{nd.rel}</text>}
          </g>
        ))}
        <circle cx={cx} cy={cy} r="44" fill="var(--gold-soft)" stroke="var(--gold)" strokeWidth="2.2" />
        <text x={cx} y={cy} className="gn__t gn__hub">{wTitle(type, center).slice(0, 16)}</text>
      </svg>
      <div className="graph-hint">{t('workspace.graphHint')}</div>
    </div>
  );
}

/* ---------------- impact bar (compact, opens reconstruction on demand) ---------------- */
function ImpactBar({ type, id, onOpen }) {
  const imp = wImpact(type, id);
  if (!imp.total) {
    return <div className="dblk impactbar impactbar--empty"><Ic.layers />{t('workspace.notUsed')}</div>;
  }
  return (
    <div className="dblk impactbar">
      <div className="impactbar__top">
        <span className="impactbar__lead"><Ic.layers />{t('workspace.impacts')} <b>{imp.total}</b> {t('workspace.elements')}</span>
        <button className="impactbar__btn" type="button" onClick={onOpen} disabled={!window.__features?.universe} title={!window.__features?.universe ? t('preview.actionDisabled') : ''}>{t('workspace.reconstruction')}<Ic.chevron /></button>
      </div>
      <div className="impactbar__chips">
        <span className="impactbar__chip"><Ic.book />{imp.byKind.scenes || 0}<i>{t('workspace.scenes')}</i></span>
        <span className="impactbar__chip"><Ic.chat />{imp.byKind.dialogues || 0}<i>{t('workspace.dialogues')}</i></span>
        <span className="impactbar__chip"><Ic.clapper />{imp.byKind.shots || 0}<i>{t('workspace.shots')}</i></span>
        <span className="impactbar__chip"><Ic.camera />{imp.byKind.images || 0}<i>{t('workspace.images')}</i></span>
      </div>
    </div>
  );
}

/* ---------------- profile (right) ---------------- */
function Profile({ type, id, navigate, goPillar }) {
  const [recon, setRecon] = useWsState(false);
  const [editing, setEditing] = useWsState(false);
  React.useEffect(() => {
    const h = (ev) => { if (ev.detail === id) setEditing(true); };
    window.addEventListener("wt-edit", h);
    return () => window.removeEventListener("wt-edit", h);
  }, [id]);
  React.useEffect(() => { setEditing(false); }, [type, id]);
  const [, bump] = useWsState(0);
  const A = ADAPTERS[type], e = wEnt(type, id);
  if (!e) return <div className="profile profile--empty">{t('workspace.selectEntity')}</div>;
  const p = A.pill(e);
  const conns = wConnections(type, id);
  const grouped = {};
  conns.forEach((c) => { (grouped[c.type] = grouped[c.type] || []).push(c); });

  const nameField = type === "events" ? "title" : "name";
  const descField = e.desc !== undefined ? "desc" : (e.motivation !== undefined ? "motivation" : null);
  // Edits are NOT written to WORLD until Save: read the editable DOM on save.
  const titleRef = React.useRef(null);
  const descRef = React.useRef(null);
  function startEdit() { setEditing(true); }
  function save() {
    const patch = {};
    if (titleRef.current) { const v = titleRef.current.innerText.trim(); if (v) { e[nameField] = v; patch[nameField] = v; } }
    if (descRef.current && descField) { const v = descRef.current.innerText.trim(); if (v) { e[descField] = v; patch[descField] = v; } }
    const isNew = !!e._draft;
    if (e._draft) { delete e._draft; if (window.__wtCommit) window.__wtCommit(); }
    // Persist to the world (canon = source of truth)
    const fc = window.__firebaseCanon;
    if (fc && fc.worldId) {
      (isNew ? fc.createEntity(type, e) : fc.updateEntity(id, patch))
        .catch((err) => console.error('Canon save failed:', err));
    }
    setEditing(false);
    bump((n) => n + 1);
  }
  function cancelEdit() {
    if (e._draft && window.__wtDiscard) { window.__wtDiscard(id); return; }
    setEditing(false);
  }

  return (
    <div className="profile" key={type + ":" + id}>
      <div className={`profile__hero ${editing ? "is-editing" : ""}`} style={{ backgroundImage: `url(assets/ph-${type}.png)`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <image-slot id={`wt-${type}-${id}`} class="profile__img" shape={A.slotShape} radius="14" placeholder=""></image-slot>
        <div className="profile__scrim" />
        <div className="profile__cap">
          <span className="profile__k">{A.sub(e)}</span>
          <h2 className="profile__title" contentEditable={editing} suppressContentEditableWarning
            ref={titleRef}>{wTitle(type, e)}</h2>
        </div>
        <span className={`pill pill--${p.cls} profile__pill`}>{p.label}</span>
        <button className={`profile__edit ${editing ? "is-on" : ""}`} title={editing ? t('workspace.save') : t('workspace.edit')} onClick={() => editing ? save() : startEdit()} disabled={!window.__features?.universe} title={!window.__features?.universe ? t('preview.actionDisabled') : (editing ? t('workspace.save') : t('workspace.edit'))}>
          {editing ? <><Ic.check />{t('workspace.save')}</> : <Ic.edit />}
        </button>
        {editing && <button className="profile__cancel" title={t('workspace.cancel')} onClick={cancelEdit}><Ic.x /></button>}
      </div>
      <div className="profile__body">
        {editing && descField ? (
          <div className="dblk">
            <h3 className="blk-h"><Ic.edit />{t('workspace.description')}</h3>
            <div className="prof-edit" contentEditable suppressContentEditableWarning
              ref={descRef}>{e[descField]}</div>
            <p className="prof-edit__hint">{t('workspace.editHint')}</p>
          </div>
        ) : A.profile(e)}
        <StateTimeline type={type} id={id} />
        {conns.length > 0 && (
          <div className="dblk conns">
            <h3 className="blk-h"><Ic.link />{t('workspace.related')} · {conns.length}</h3>
            {W_TYPES.filter((t) => grouped[t]).map((t) => (
              <div className="conn-grp" key={t}>
                <div className="conn-grp__h">{React.createElement(Ic[ADAPTERS[t].icon])}{ADAPTERS[t].title} · {grouped[t].length}</div>
                <div className="conn-chips">
                  {grouped[t].map((c) => (
                    <button className="conn-chip" key={c.id} style={{ "--c": TYPE_COLOR[t] }} type="button" onClick={() => navigate(c.type, c.id)}>
                      <span className="conn-chip__dot" />{wTitle(t, wEnt(t, c.id))}
                      {c.rel && <em className="conn-chip__rel">{c.rel}</em>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <ImpactBar type={type} id={id} onOpen={() => setRecon(true)} />
      </div>
      {recon && <ReconstructionOverlay type={type} id={id} onClose={() => setRecon(false)} />}
    </div>
  );
}

/* entity state over time — per-scene changes recorded by canon extraction
   (scene.stateChanges). Follows the scene lens: shows the state AS OF that scene
   and dims what happens later. */
function wStateRows(type, id) {
  const rows = [];
  (WORLD.scenes || []).slice().sort((a, b) => a.n - b.n).forEach((s) => {
    (s.stateChanges || []).forEach((c) => {
      if (c.kind === type && c.id === id) rows.push({ n: s.n, title: s.title, aspect: c.aspect, value: c.value });
    });
  });
  return rows;
}
function StateTimeline({ type, id }) {
  const [lens] = useWtScene();
  const rows = wStateRows(type, id);
  if (!rows.length) return null;
  const asOf = {};
  rows.forEach((r) => { if (lens == null || r.n <= lens) asOf[r.aspect] = r; });
  const now = Object.values(asOf);
  return (
    <div className="dblk stl">
      <h3 className="blk-h"><Ic.hourglass />{t('timeline.title')} · {rows.length}</h3>
      {now.length > 0 && (
        <div className="stl__now">
          <span className="stl__now-k">{lens == null ? t('timeline.now') : t('timeline.asOf').replace('{n}', lens)}</span>
          <div className="kv">
            {now.map((r) => <div className="kv__row" key={r.aspect}><span className="kv__k">{t('timeline.aspect.' + r.aspect)}</span><span className="kv__v">{r.value}</span></div>)}
          </div>
        </div>
      )}
      <ol className="stl__list">
        {rows.map((r, i) => (
          <li className={`stl__row ${lens != null && r.n > lens ? "is-future" : ""}`} key={i}>
            <span className="scene-dot">{r.n}</span>
            <span className="stl__scene">{r.title}</span>
            <span className="stl__aspect">{t('timeline.aspect.' + r.aspect)}</span>
            <span className="stl__val">{r.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* World map — locations laid out by the author (drag; saved as entity.mapPos),
   routes derived from characters moving between scenes, and who is where as of
   the scene lens. Location state values are free text, so they are matched to
   locations by name (longest name first). */
const MAP_W = 1000, MAP_H = 620;
function wMatchLocation(value, locs) {
  const v = String(value || "").toLowerCase();
  if (!v) return null;
  return locs.slice().sort((a, b) => (b.name || "").length - (a.name || "").length)
    .find((l) => l.name && v.includes(l.name.toLowerCase())) || null;
}
function wMapData(locs, lens) {
  const scenes = (WORLD.scenes || []).slice().sort((a, b) => a.n - b.n);
  const trail = {}; // characterId → [locationId per move, story order]
  scenes.forEach((s) => (s.stateChanges || []).forEach((c) => {
    if (c.kind !== "characters" || c.aspect !== "location") return;
    const l = wMatchLocation(c.value, locs);
    if (l) (trail[c.id] = trail[c.id] || []).push({ n: s.n, loc: l.id });
  }));
  const routes = {};
  Object.values(trail).forEach((moves) => moves.forEach((m, i) => {
    if (i === 0 || moves[i - 1].loc === m.loc) return;
    const k = [moves[i - 1].loc, m.loc].sort().join("|");
    routes[k] = (routes[k] || 0) + 1;
  }));
  const here = {}; // locationId → [character]
  (WORLD.characters || []).forEach((ch) => {
    const moves = (trail[ch.id] || []).filter((m) => lens == null || m.n <= lens);
    // No recorded moves at all → the canon's static location holds for the whole story
    const locId = moves.length ? moves[moves.length - 1].loc
      : ((lens == null || !trail[ch.id]) && wMatchLocation(ch.location, locs) || {}).id;
    if (locId) (here[locId] = here[locId] || []).push(ch);
  });
  return { routes, here };
}
function WorldMap({ locs, sel, onOpen }) {
  const [lens] = useWtScene();
  const [, bump] = useWsState(0);
  const drag = React.useRef(null);
  const svgRef = React.useRef(null);
  const pos = (l, i) => l.mapPos || {
    x: MAP_W / 2 + Math.cos(i * 2.39996) * (90 + 34 * Math.sqrt(i)) * 1.6,
    y: MAP_H / 2 + Math.sin(i * 2.39996) * (90 + 34 * Math.sqrt(i)),
  };
  const P = {};
  locs.forEach((l, i) => { P[l.id] = pos(l, i); });
  const { routes, here } = wMapData(locs, lens);
  const canEdit = !!window.__features?.universe;

  function toSvg(ev) {
    const r = svgRef.current.getBoundingClientRect();
    return { x: Math.max(30, Math.min(MAP_W - 30, (ev.clientX - r.left) / r.width * MAP_W)),
             y: Math.max(30, Math.min(MAP_H - 30, (ev.clientY - r.top) / r.height * MAP_H)) };
  }
  function down(ev, l) {
    if (!canEdit) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = { l, moved: false };
  }
  function move(ev) {
    if (!drag.current) return;
    drag.current.l.mapPos = toSvg(ev); drag.current.moved = true; bump((n) => n + 1);
  }
  function up(l) {
    const d = drag.current; drag.current = null;
    if (!d || !d.moved) { onOpen(l); return; }
    const fc = window.__firebaseCanon;
    const mp = { x: Math.round(l.mapPos.x), y: Math.round(l.mapPos.y) };
    l.mapPos = mp;
    if (fc && fc.worldId && !l._draft) fc.updateEntity(l.id, { mapPos: mp }).catch((err) => console.error('Map save failed:', err));
  }

  if (!locs.length) return <div className="ws-empty">{t('workspace.nothingFound')}</div>;
  return (
    <div className="wmap">
      <svg ref={svgRef} className="wmap__svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} onPointerMove={move} role="img" aria-label={t('map.title')}>
        <defs>
          <pattern id="wmap-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="currentColor" strokeWidth="0.6" /></pattern>
        </defs>
        <rect width={MAP_W} height={MAP_H} fill="url(#wmap-grid)" className="wmap__grid" />
        {Object.entries(routes).map(([k, n]) => {
          const [a, b] = k.split("|");
          if (!P[a] || !P[b]) return null;
          return <line key={k} className="wmap__route" x1={P[a].x} y1={P[a].y} x2={P[b].x} y2={P[b].y} strokeWidth={1.2 + Math.min(n, 5) * 0.8} />;
        })}
        {locs.map((l) => {
          const p = P[l.id], who = here[l.id] || [];
          return (
            <g key={l.id} className={`wmap__node ${l.id === sel ? "is-sel" : ""} ${canEdit ? "is-drag" : ""}`} transform={`translate(${p.x},${p.y})`}
              onPointerDown={(ev) => down(ev, l)} onPointerUp={() => up(l)} tabIndex={0}
              onKeyDown={(ev) => { if (ev.key === "Enter") onOpen(l); }}>
              <circle r={who.length ? 17 : 13} className="wmap__dot" />
              {who.length > 0 && <text className="wmap__count" textAnchor="middle" dy="4">{who.length}</text>}
              <text className="wmap__name" textAnchor="middle" y={who.length ? 34 : 30}>{l.name}</text>
              {who.length > 0 && <text className="wmap__who" textAnchor="middle" y={who.length ? 50 : 46}>{who.slice(0, 3).map((c) => c.name).join(", ")}{who.length > 3 ? " +" + (who.length - 3) : ""}</text>}
            </g>
          );
        })}
      </svg>
      <div className="wmap__legend">
        <span>{lens == null ? t('timeline.now') : t('timeline.asOf').replace('{n}', lens)}</span>
        <span className="wmap__legend-route">{t('map.routes')}</span>
        {canEdit && <span>{t('map.hint')}</span>}
      </div>
    </div>
  );
}

/* category dropdown — switch workspace without returning to the tree; also the "you are here" marker */
/* shared "current scene" lens — synced across categories & chronicle via localStorage + event */
function useWtScene() {
  const [s, setS] = useWsState(function () { try { var v = localStorage.getItem("wt_scene"); return v ? parseInt(v, 10) : null; } catch (e) { return null; } });
  React.useEffect(function () {
    var h = function (e) { setS(e.detail); };
    window.addEventListener("wt-scene", h);
    return function () { window.removeEventListener("wt-scene", h); };
  }, []);
  var set = function (n) {
    try { n == null ? localStorage.removeItem("wt_scene") : localStorage.setItem("wt_scene", String(n)); } catch (e) {}
    window.dispatchEvent(new CustomEvent("wt-scene", { detail: n }));
  };
  return [s, set];
}

/* scene picker — the lens we examine the universe through; sits beside the category menu */
function SceneMenu() {
  const [scene, setScene] = useWtScene();
  const [open, setOpen] = useWsState(false);
  const [langRev, setLangRev] = useWsState(0);

  // Force re-render on language change
  React.useEffect(() => {
    function onLanguageChange(event) {
      const newLang = event.detail?.lang;
      if (window.__i18n && newLang) {
        window.__i18n.setLanguage(newLang);
      }
      setLangRev(prev => prev + 1);
    }
    window.addEventListener('ww-language-change', onLanguageChange);
    return () => window.removeEventListener('ww-language-change', onLanguageChange);
  }, []);

  React.useEffect(function () {
    if (!open) return;
    var close = function () { setOpen(false); };
    window.addEventListener("click", close);
    return function () { window.removeEventListener("click", close); };
  }, [open]);
  const cur = scene != null ? WORLD.scenes.find(function (s) { return s.n === scene; }) : null;
  return (
    <div className="ws-cat ws-scene" onClick={(e) => e.stopPropagation()}>
      <button className={`ws-cat__btn ${open ? "is-open" : ""}`} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        <Ic.clapper style={{ width: 17, height: 17, color: "var(--gold-lit)", flex: "0 0 auto" }} />
        <span className="ws-head__id">
          <span className="ws-head__title" style={{ fontSize: 15 }}>{cur ? t('workspace.sceneLabel') + " " + cur.n : t('workspace.allStory')}</span>
        </span>
        <Ic.caret />
      </button>
      {open && (
        <div className="ws-cat__menu" role="menu" style={{ minWidth: 268 }}>
          <button role="menuitem" type="button" className={`ws-cat__opt ${scene == null ? "is-on" : ""}`} onClick={() => { setOpen(false); setScene(null); }}>
            <Ic.layers /><span className="ws-cat__lbl">{t('workspace.allStory')}</span>
          </button>
          <div className="ws-cat__sep" />
          {(WORLD.scenes || []).map((s) => (
            <button key={s.n} role="menuitem" type="button" className={`ws-cat__opt ${scene === s.n ? "is-on" : ""}`} onClick={() => { setOpen(false); setScene(s.n); }}>
              <span className="scene-dot">{s.n}</span><span className="ws-cat__lbl" style={{ fontFamily: "inherit", fontWeight: 500 }}>{s.title}</span><span className="ws-cat__n">{t('workspace.act')} {s.act}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WsCatMenu({ type, navigate }) {
  const isChron = type === "chronicle";
  const [langRev, setLangRev] = useWsState(0);

  // Force re-render on language change
  React.useEffect(() => {
    function onLanguageChange(event) {
      const newLang = event.detail?.lang;
      if (window.__i18n && newLang) {
        window.__i18n.setLanguage(newLang);
      }
      setLangRev(prev => prev + 1);
    }
    window.addEventListener('ww-language-change', onLanguageChange);
    return () => window.removeEventListener('ww-language-change', onLanguageChange);
  }, []);

  const kicker = isChron ? t('workspace.chronicleKicker') : ADAPTERS[type].kicker;
  const ttl = isChron ? t('workspace.chronicle') : ADAPTERS[type].title;
  const [open, setOpen] = useWsState(false);
  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("keydown", function k(e){ if(e.key==="Escape") setOpen(false); });
    return () => { window.removeEventListener("click", close); };
  }, [open]);
  return (
    <div className="ws-cat" onClick={(e) => e.stopPropagation()}>
      <button className={`ws-cat__btn ${open ? "is-open" : ""}`} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        <span className="ws-head__id">
          <span className="ws-head__title">{ttl}</span>
        </span>
        <Ic.caret />
      </button>
      {open && (
        <div className="ws-cat__menu" role="menu">
          {W_TYPES.map((t) => {
            const TA = ADAPTERS[t]; const TI = Ic[TA.icon];
            return (
              <button key={t} role="menuitem" type="button" className={`ws-cat__opt ${t === type ? "is-on" : ""}`}
                onClick={() => { setOpen(false); if (t !== type) navigate(t); }}>
                <TI /><span className="ws-cat__lbl">{TA.title}</span><span className="ws-cat__n">{WORLD[t].length}</span>
              </button>
            );
          })}
          <div className="ws-cat__sep" />
          <button role="menuitem" type="button" className={`ws-cat__opt ${isChron ? "is-on" : ""}`} onClick={() => { setOpen(false); if (!isChron) navigate("chronicle"); }}>
            <Ic.scroll /><span className="ws-cat__lbl">{t('workspace.chronicle')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- the workspace ---------------- */
function Workspace({ type, selectedId, navigate, onClose, goPillar, canon }) {
  const A = ADAPTERS[type];
  // Use canon prop if available (real data), fallback to WORLD (mock)
  const dataSource = canon || window.WORLD;
  const rawData = dataSource ? dataSource[type] : undefined;

  // DEBUG: Log data for inspection
  if (typeof DEBUG !== 'undefined' && DEBUG) {
    console.log(`[Workspace ${type}] canon prop:`, canon);
    console.log(`[Workspace ${type}] dataSource:`, dataSource);
    console.log(`[Workspace ${type}] rawData for type "${type}":`, rawData);
    console.log(`[Workspace ${type}] rawData type:`, Array.isArray(rawData) ? 'array' : typeof rawData);
  }

  // Ensure 'all' is always an array (handle both object and array formats)
  const all = Array.isArray(rawData)
    ? rawData
    : (rawData && typeof rawData === 'object' ? Object.values(rawData) : []);

  console.log(`[Workspace ${type}] all (converted):`, all);
  console.log(`[Workspace ${type}] all.length:`, all.length);
  const [scene] = useWtScene();
  const [q, setQ] = useWsState("");
  const [view, setView] = useWsState("cards");
  React.useEffect(() => { if (view === "map" && type !== "locations") setView("cards"); }, [type]);
  const [filters, setFilters] = useWsState({});
  const [sortKey, setSortKey] = useWsState(A.sorts[0].key);
  const [group, setGroup] = useWsState("");
  const [rev, setRev] = useWsState(0);

  // Listen for language changes and force re-render
  React.useEffect(() => {
    function onLanguageChange(event) {
      const newLang = event.detail?.lang;
      console.log('[Workspace] Language changed to:', newLang);
      if (window.__i18n && newLang) {
        window.__i18n.setLanguage(newLang);
      }
      setRev(prev => prev + 1); // Force re-render
    }
    window.addEventListener('ww-language-change', onLanguageChange);
    return () => window.removeEventListener('ww-language-change', onLanguageChange);
  }, []);

  const list = useWsMemo(() => {
    let r = all.filter((e) => !e._draft);
    if (scene != null) {
      const sc = (dataSource.scenes || []).find((s) => s.n === scene);
      // Filter by scene.canonRefs (new linking system)
      if (sc && sc.canonRefs && sc.canonRefs[type]) {
        r = r.filter((e) => sc.canonRefs[type].includes(e.id));
      } else {
        // Fallback: old system (entity.scenes or scene[type])
        r = r.filter((e) => (e.scenes || []).includes(scene) || (sc && (sc[type] || []).includes(e.id)));
      }
    }
    const qq = q.trim().toLowerCase();
    if (qq) r = r.filter((e) => A.search(e).toLowerCase().includes(qq));
    A.facets.forEach((f) => { const v = filters[f.key]; if (v) r = r.filter((e) => f.of(e) === v); });
    const s = A.sorts.find((x) => x.key === sortKey) || A.sorts[0];
    r.sort(s.cmp);
    return r;
  }, [all, q, filters, sortKey, type, scene, rev, canon]);

  const groups = useWsMemo(() => {
    if (!group) return [{ key: null, items: list }];
    const f = A.facets.find((x) => x.key === group);
    const m = new Map();
    list.forEach((e) => { const k = f.of(e); if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
    return [...m.entries()].map(([key, items]) => ({ key, items }));
  }, [list, group, type]);

  const open = (e) => navigate(type, e.id);

  let _newSeq = (window.__wtNewSeq = (window.__wtNewSeq || 0));
  function createEntity() {
    const fc = window.__firebaseCanon;
    const id = fc && fc.worldId ? fc.newEntityId(type) : "new_" + type + "_" + (++window.__wtNewSeq);
    const base = { id, scenes: [], characters: [], locations: [], events: [], factions: [], artifacts: [] };
    const NEW = {
      characters: { ...base, name: t('workspace.newCharacter'), role: t('workspace.role'), roleType: "support", status: "draft", motivation: t('workspace.motivation'), arc: t('workspace.arc'), prog: 0, relations: [] },
      locations: { ...base, name: t('workspace.newLocation'), type: "other", atmos: [], desc: t('workspace.atmosphere') },
      events: { ...base, title: t('workspace.newEvent'), type: "other", act: 1, when: t('workspace.when'), tone: "review", desc: t('workspace.eventDesc') },
      factions: { ...base, name: t('workspace.newFaction'), align: "neutral", tone: "review", motto: t('workspace.motto'), power: 30, members: 1, desc: t('workspace.factionDesc') },
      artifacts: { ...base, name: t('workspace.newArtifact'), type: "other", rarity: "common", tone: "review", desc: t('workspace.artifactDesc') },
    }[type];
    NEW._draft = true;
    WORLD[type].push(NEW);
    try { localStorage.removeItem("wt_scene"); } catch (e) {}
    window.dispatchEvent(new CustomEvent("wt-scene", { detail: null }));
    window.__wtCommit = () => setRev((n) => n + 1);
    window.__wtDiscard = (did) => {
      const i = WORLD[type].findIndex((x) => x.id === did);
      if (i >= 0) WORLD[type].splice(i, 1);
      setRev((n) => n + 1);
      const first = WORLD[type][0];
      navigate(type, first ? first.id : undefined);
    };
    setRev((n) => n + 1);
    window.__wtEditIntent = id;
    navigate(type, id);
    setTimeout(() => window.dispatchEvent(new CustomEvent("wt-edit", { detail: id })), 40);
  }
  const sel = selectedId && wEnt(type, selectedId) ? selectedId : (list[0] ? list[0].id : null);

  return (
    <div className="ws">
      <header className="ws-head">
        <button className="ws-back" type="button" onClick={onClose}><Ic.tree /><span>{t('workspace.toTree')}</span></button>
        <span className="ws-head__ring"><EntIcon type={type} hue="var(--gold-lit)" /></span>
        <WsCatMenu type={type} navigate={navigate} />
        <span className="ws-cat__div" />
        <SceneMenu />
        <span className="ws-count">{list.length}{list.length !== all.length ? ` / ${all.length}` : ""}</span>
        <div className="ws-head__sp" />
        <PillarSwitch here="universe" />
      </header>

      {!window.__features?.universe && <PreviewBanner />}

      <div className="ws-bar">
        <label className="ws-search">
          <Ic.eye style={{ width: 16, height: 16, opacity: .5 }} />
          <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={`${t('workspace.search')} · ${A.title.toLowerCase()}`} />
          {q && <button className="ws-search__x" onClick={() => setQ("")} type="button">✕</button>}
        </label>
        <div className="ws-filters">
          {A.facets.map((f) => (
            <select key={f.key} className="ws-sel" value={filters[f.key] || ""} onChange={(ev) => setFilters((p) => ({ ...p, [f.key]: ev.target.value }))}>
              <option value="">{f.label}: {t('workspace.all')}</option>
              {distinct(all, f.of).map((v) => <option key={v} value={v}>{f.display ? f.display(v) : v}</option>)}
            </select>
          ))}
          <select className="ws-sel" value={sortKey} onChange={(ev) => setSortKey(ev.target.value)}>
            {A.sorts.map((s) => <option key={s.key} value={s.key}>↕ {s.label}</option>)}
          </select>
          <select className="ws-sel" value={group} onChange={(ev) => setGroup(ev.target.value)}>
            <option value="">{t('workspace.noGroups')}</option>
            {A.facets.map((f) => <option key={f.key} value={f.key}>{t('workspace.groupBy')}: {f.label}</option>)}
          </select>
        </div>
        <div className="ws-views">
          {[["cards", "grid", t('workspace.cards')], ["list", "layers", t('workspace.list')], ["graph", "link", t('workspace.graph')]]
            .concat(type === "locations" ? [["map", "map", t('map.title')]] : []).map(([v, ic, lbl]) => {
            const I = Ic[ic];
            return <button key={v} className={`ws-view ${view === v ? "is-on" : ""}`} onClick={() => setView(v)} type="button" title={lbl}><I /><span>{lbl}</span></button>;
          })}
        </div>
      </div>

      <div className="ws-split">
        <div className="ws-main">
          {view === "map" ? (
            <WorldMap locs={all.filter((e) => !e._draft)} sel={sel} onOpen={open} />
          ) : view === "graph" ? (
            sel ? <EgoGraph type={type} id={sel} navigate={navigate} /> : <div className="profile--empty">{t('workspace.noEntities')}</div>
          ) : groups.map((g, gi) => {
            const f = group ? A.facets.find((x) => x.key === group) : null;
            const displayKey = g.key != null && f?.display ? f.display(g.key) : g.key;
            return (
            <div className="ws-group" key={gi}>
              {g.key != null && <div className="ws-group__h">{displayKey}<span className="ws-group__n">{g.items.length}</span></div>}
              <div className={view === "cards" ? "wcards" : "wrows"}>
                {g.items.map((e) => view === "cards"
                  ? <WCard key={e.id} type={type} e={e} active={e.id === sel} onOpen={() => open(e)} />
                  : <WRow key={e.id} type={type} e={e} active={e.id === sel} onOpen={() => open(e)} />)}
                {gi === groups.length - 1 && (
                  view === "cards"
                    ? <button className="wcard wcard--new" type="button" onClick={createEntity} disabled={!window.__features?.universe} title={!window.__features?.universe ? t('preview.actionDisabled') : ''}><Ic.plus /><span>{t('workspace.add')} · {A.title.toLowerCase()}</span></button>
                    : <button className="wrow wrow--new" type="button" onClick={createEntity} disabled={!window.__features?.universe} title={!window.__features?.universe ? t('preview.actionDisabled') : ''}><Ic.plus /><span>{t('workspace.add')}</span></button>
                )}
              </div>
            </div>
            );
          })}
          {view !== "graph" && view !== "map" && list.length === 0 && <div className="ws-empty">{t('workspace.nothingFound')}</div>}
        </div>
        <aside className="ws-aside">
          {sel ? <Profile type={type} id={sel} navigate={navigate} goPillar={goPillar} /> : <div className="profile profile--empty">{t('workspace.selectEntity')}</div>}
        </aside>
      </div>
    </div>
  );
}

window.Workspace = Workspace;
