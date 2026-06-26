// Generic universe workspace: full-screen, scalable management UI for one
// category. Toolbar (search / filter / sort / group / view), split layout
// with Cards · List · Graph on the left and a connected profile on the right.
const { useState: useWsState, useMemo: useWsMemo } = React;

const TYPE_COLOR = {
  characters: "var(--gold-lit)", locations: "var(--st-ready)", events: "var(--st-draft)",
  factions: "var(--violet-lit)", artifacts: "var(--st-review)",
};

function distinct(items, of) {
  const s = []; items.forEach((e) => { const v = of(e); if (v != null && !s.includes(v)) s.push(v); }); return s;
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
      <div className="graph-hint">Натисніть вузол, щоб перейти до пов'язаної сутності</div>
    </div>
  );
}

/* ---------------- impact bar (compact, opens reconstruction on demand) ---------------- */
function ImpactBar({ type, id, onOpen }) {
  const imp = wImpact(type, id);
  if (!imp.total) {
    return <div className="dblk impactbar impactbar--empty"><Ic.layers />Ще не використано в наративі</div>;
  }
  return (
    <div className="dblk impactbar">
      <div className="impactbar__top">
        <span className="impactbar__lead"><Ic.layers />Впливає на <b>{imp.total}</b> елементів</span>
        <button className="impactbar__btn" type="button" onClick={onOpen}>Реконструкція<Ic.chevron /></button>
      </div>
      <div className="impactbar__chips">
        <span className="impactbar__chip"><Ic.book />{imp.byKind.scenes || 0}<i>сцен</i></span>
        <span className="impactbar__chip"><Ic.chat />{imp.byKind.dialogues || 0}<i>діал.</i></span>
        <span className="impactbar__chip"><Ic.clapper />{imp.byKind.shots || 0}<i>кадрів</i></span>
        <span className="impactbar__chip"><Ic.camera />{imp.byKind.images || 0}<i>зобр.</i></span>
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
  if (!e) return <div className="profile profile--empty">Оберіть сутність</div>;
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
    if (titleRef.current) { const v = titleRef.current.innerText.trim(); if (v) e[nameField] = v; }
    if (descRef.current && descField) { const v = descRef.current.innerText.trim(); if (v) e[descField] = v; }
    if (e._draft) { delete e._draft; if (window.__wtCommit) window.__wtCommit(); }
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
        <button className={`profile__edit ${editing ? "is-on" : ""}`} title={editing ? "Зберегти" : "Редагувати"} onClick={() => editing ? save() : startEdit()}>
          {editing ? <><Ic.check />Зберегти</> : <Ic.edit />}
        </button>
        {editing && <button className="profile__cancel" title="Скасувати" onClick={cancelEdit}><Ic.x /></button>}
      </div>
      <div className="profile__body">
        {editing && descField ? (
          <div className="dblk">
            <h3 className="blk-h"><Ic.edit />Опис</h3>
            <div className="prof-edit" contentEditable suppressContentEditableWarning
              ref={descRef}>{e[descField]}</div>
            <p className="prof-edit__hint">Зміни застосуються лише після «Зберегти». Перехід на іншу картку без збереження — скасує правки.</p>
          </div>
        ) : A.profile(e)}
        {conns.length > 0 && (
          <div className="dblk conns">
            <h3 className="blk-h"><Ic.link />Пов'язане · {conns.length}</h3>
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
          <span className="ws-head__title" style={{ fontSize: 15 }}>{cur ? "Сцена " + cur.n : "Уся історія"}</span>
        </span>
        <Ic.caret />
      </button>
      {open && (
        <div className="ws-cat__menu" role="menu" style={{ minWidth: 268 }}>
          <button role="menuitem" type="button" className={`ws-cat__opt ${scene == null ? "is-on" : ""}`} onClick={() => { setOpen(false); setScene(null); }}>
            <Ic.layers /><span className="ws-cat__lbl">Уся історія</span>
          </button>
          <div className="ws-cat__sep" />
          {(WORLD.scenes || []).map((s) => (
            <button key={s.n} role="menuitem" type="button" className={`ws-cat__opt ${scene === s.n ? "is-on" : ""}`} onClick={() => { setOpen(false); setScene(s.n); }}>
              <span className="scene-dot">{s.n}</span><span className="ws-cat__lbl" style={{ fontFamily: "inherit", fontWeight: 500 }}>{s.title}</span><span className="ws-cat__n">акт {s.act}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WsCatMenu({ type, navigate }) {
  const isChron = type === "chronicle";
  const kicker = isChron ? "Серце всесвіту" : ADAPTERS[type].kicker;
  const ttl = isChron ? "Хроніка" : ADAPTERS[type].title;
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
            <Ic.scroll /><span className="ws-cat__lbl">Хроніка</span>
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
  const [filters, setFilters] = useWsState({});
  const [sortKey, setSortKey] = useWsState(A.sorts[0].key);
  const [group, setGroup] = useWsState("");
  const [rev, setRev] = useWsState(0);

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
    const id = "new_" + type + "_" + (++window.__wtNewSeq);
    const base = { id, scenes: [], characters: [], locations: [], events: [], factions: [], artifacts: [] };
    const NEW = {
      characters: { ...base, name: "Новий персонаж", role: "Роль", roleType: "support", status: "Чернетка", motivation: "Опиши мотивацію…", arc: "Арка", prog: 0, relations: [] },
      locations: { ...base, name: "Нова локація", type: "Тип", atmos: [], desc: "Опиши місце…" },
      events: { ...base, title: "Нова подія", type: "Тип", act: 1, when: "—", tone: "review", desc: "Опиши подію…" },
      factions: { ...base, name: "Нова фракція", align: "Нейтральна", tone: "review", motto: "—", power: 30, members: 1, desc: "Опиши фракцію…" },
      artifacts: { ...base, name: "Новий артефакт", type: "Тип", rarity: "Звичайний", tone: "review", desc: "Опиши артефакт…" },
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
        <button className="ws-back" type="button" onClick={onClose}><Ic.tree /><span>До дерева</span></button>
        <span className="ws-head__ring"><EntIcon type={type} hue="var(--gold-lit)" /></span>
        <WsCatMenu type={type} navigate={navigate} />
        <span className="ws-cat__div" />
        <SceneMenu />
        <span className="ws-count">{list.length}{list.length !== all.length ? ` / ${all.length}` : ""}</span>
        <div className="ws-head__sp" />
        <PillarSwitch here="universe" />
      </header>

      <div className="ws-bar">
        <label className="ws-search">
          <Ic.eye style={{ width: 16, height: 16, opacity: .5 }} />
          <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={`Пошук · ${A.title.toLowerCase()}`} />
          {q && <button className="ws-search__x" onClick={() => setQ("")} type="button">✕</button>}
        </label>
        <div className="ws-filters">
          {A.facets.map((f) => (
            <select key={f.key} className="ws-sel" value={filters[f.key] || ""} onChange={(ev) => setFilters((p) => ({ ...p, [f.key]: ev.target.value }))}>
              <option value="">{f.label}: усі</option>
              {distinct(all, f.of).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ))}
          <select className="ws-sel" value={sortKey} onChange={(ev) => setSortKey(ev.target.value)}>
            {A.sorts.map((s) => <option key={s.key} value={s.key}>↕ {s.label}</option>)}
          </select>
          <select className="ws-sel" value={group} onChange={(ev) => setGroup(ev.target.value)}>
            <option value="">Без груп</option>
            {A.facets.map((f) => <option key={f.key} value={f.key}>Групувати: {f.label}</option>)}
          </select>
        </div>
        <div className="ws-views">
          {[["cards", "grid", "Картки"], ["list", "layers", "Список"], ["graph", "link", "Граф"]].map(([v, ic, lbl]) => {
            const I = Ic[ic];
            return <button key={v} className={`ws-view ${view === v ? "is-on" : ""}`} onClick={() => setView(v)} type="button" title={lbl}><I /><span>{lbl}</span></button>;
          })}
        </div>
      </div>

      <div className="ws-split">
        <div className="ws-main">
          {view === "graph" ? (
            sel ? <EgoGraph type={type} id={sel} navigate={navigate} /> : <div className="profile--empty">Немає сутностей</div>
          ) : groups.map((g, gi) => (
            <div className="ws-group" key={gi}>
              {g.key != null && <div className="ws-group__h">{g.key}<span className="ws-group__n">{g.items.length}</span></div>}
              <div className={view === "cards" ? "wcards" : "wrows"}>
                {g.items.map((e) => view === "cards"
                  ? <WCard key={e.id} type={type} e={e} active={e.id === sel} onOpen={() => open(e)} />
                  : <WRow key={e.id} type={type} e={e} active={e.id === sel} onOpen={() => open(e)} />)}
                {gi === groups.length - 1 && (
                  view === "cards"
                    ? <button className="wcard wcard--new" type="button" onClick={createEntity}><Ic.plus /><span>Додати · {A.title.toLowerCase().replace(/и$/, "у")}</span></button>
                    : <button className="wrow wrow--new" type="button" onClick={createEntity}><Ic.plus /><span>Додати</span></button>
                )}
              </div>
            </div>
          ))}
          {view !== "graph" && list.length === 0 && <div className="ws-empty">Нічого не знайдено</div>}
        </div>
        <aside className="ws-aside">
          {sel ? <Profile type={type} id={sel} navigate={navigate} goPillar={goPillar} /> : <div className="profile profile--empty">Оберіть сутність</div>}
        </aside>
      </div>
    </div>
  );
}

window.Workspace = Workspace;
