// World Tree — the Universe pillar. Tree (Level 1) → full-screen category
// workspace (Level 2). Everything is one connected system: navigate(type,id)
// jumps anywhere; the Chronicle is the canon overview at the heart.
const { useState: useAppState, useCallback: useAppCb } = React;

function wtFade(href, ret) {
  if (window.wwGo && window.wwGo(href)) return;
  if (ret) { try { localStorage.setItem("ww_return", "1"); } catch (e) {} }
  const o = document.createElement("div");
  o.style.cssText = "position:fixed;inset:0;z-index:99999;background:#050405;opacity:0;transition:opacity .55s ease;pointer-events:all;";
  document.body.appendChild(o);
  requestAnimationFrame(() => { o.style.opacity = "1"; });
  setTimeout(() => { window.location.href = href; }, 580);
}

// Unified pillar switcher — identical on all three screens. `here` = active pillar.
function PillarSwitch({ here, fixed }) {
  const items = [
    { id: "book", label: "Книга", icon: "feather", go: () => wtFade("WhiteWrite.html", true) },
    { id: "universe", label: "Всесвіт", icon: "tree", go: () => wtFade("WhiteWrite WorldTree.html") },
    { id: "director", label: "Режисер", icon: "clapper", go: () => wtFade("WhiteWrite Workspace.html") },
  ];
  return (
    <div className={`pillswitch ${fixed ? "pillswitch--fixed" : ""}`} role="tablist" aria-label="Стовпи WhiteWrite">
      {items.map((it) => {
        const I = Ic[it.icon];
        const cur = here === it.id;
        return (
          <button key={it.id} type="button" role="tab" aria-current={cur ? "page" : undefined}
            className={`pillswitch__b ${cur ? "is-here" : ""}`} onClick={() => { if (!cur) it.go(); }}>
            <I />{it.label}
          </button>
        );
      })}
    </div>
  );
}

// Chronicle — the canon overview at the heart of the tree. Minimal inline editing.
function ChronicleView({ navigate, onClose }) {
  const w = WORLD.world;
  const [edit, setEdit] = useAppState(false);
  const [, force] = useAppState(0);
  const [draft, setDraft] = useAppState(() => ({ tagline: w.tagline, summary: w.summary, rules: w.rules.slice() }));
  function startEdit() { setDraft({ tagline: w.tagline, summary: w.summary, rules: w.rules.slice() }); setEdit(true); }
  function save() {
    w.tagline = draft.tagline.trim() || w.tagline;
    w.summary = draft.summary.trim() || w.summary;
    w.rules = draft.rules.map((r) => r.trim()).filter(Boolean);
    setEdit(false); force((n) => n + 1);
  }
  const setRule = (i, v) => setDraft((d) => ({ ...d, rules: d.rules.map((r, j) => j === i ? v : r) }));
  const addRule = () => setDraft((d) => ({ ...d, rules: d.rules.concat("") }));
  const delRule = (i) => setDraft((d) => ({ ...d, rules: d.rules.filter((_, j) => j !== i) }));
  return (
    <div className="ws chron">
      <header className="ws-head">
        <button className="ws-back" type="button" onClick={onClose}><Ic.tree /><span>До дерева</span></button>
        <span className="ws-head__ring"><span className="went-ic" style={{ "--h": "var(--gold-lit)" }}><Ic.scroll /></span></span>
        <WsCatMenu type="chronicle" navigate={navigate} />
        <span className="ws-cat__div" />
        <SceneMenu />
        <div className="ws-head__sp" />
        {edit
          ? <button className="ws-back" type="button" onClick={save} style={{ borderColor: "rgba(217,119,6,0.4)", color: "var(--gold-lit)" }}><Ic.check /><span>Зберегти</span></button>
          : <button className="ws-back" type="button" onClick={startEdit}><Ic.wand /><span>Редагувати</span></button>}
        <PillarSwitch here="universe" />
      </header>
      <div className="chron__body">
        <div className="world-hero" style={{ backgroundImage: "url(assets/ph-shot.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
          <image-slot id="wt-world-key" class="world-hero__art" shape="rect" placeholder=""></image-slot>
          <div className="world-hero__scrim" />
          <div className="world-hero__cap"><span className="world-hero__k">Канон</span>
            {edit
              ? <input className="chron-edit__tag" value={draft.tagline} onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))} />
              : <p className="world-hero__tag">{w.tagline}</p>}
          </div>
        </div>
        <div className="sec-cols">
          <div>
            {edit
              ? <textarea className="chron-edit__sum" value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} rows={5} />
              : <p className="sec-prose">{w.summary}</p>}
            <h3 className="blk-h"><Ic.scroll />Світовий звід</h3>
            <div className="kv">{w.facts.map((f) => <div className="kv__row" key={f.k}><span className="kv__k">{f.k}</span><span className="kv__v">{f.v}</span></div>)}</div>
          </div>
          <div>
            <h3 className="blk-h"><Ic.layers />Закони світу</h3>
            {edit ? (
              <div className="rules">
                {draft.rules.map((r, i) => (
                  <div className="rule rule--edit" key={i}>
                    <span className="rule__n">{String(i + 1).padStart(2, "0")}</span>
                    <input className="chron-edit__rule" value={r} onChange={(e) => setRule(i, e.target.value)} placeholder="Закон світу…" />
                    <button className="rule__del" type="button" onClick={() => delRule(i)} aria-label="Прибрати"><Ic.x /></button>
                  </div>
                ))}
                <button className="chron-edit__add" type="button" onClick={addRule}>＋ Додати закон</button>
              </div>
            ) : (
              <div className="rules">{w.rules.map((r, i) => <div className="rule" key={i}><span className="rule__n">{String(i + 1).padStart(2, "0")}</span><span>{r}</span></div>)}</div>
            )}
            <h3 className="blk-h" style={{ marginTop: 24 }}><Ic.flame />Хроніка подій · {WORLD.events.length}</h3>
            <div className="chron-list">
              {WORLD.events.slice().sort((a, b) => a.act - b.act).map((e) => (
                <button className="chron-ev" key={e.id} type="button" onClick={() => navigate("events", e.id)}>
                  <span className="chron-ev__dot" style={{ background: aTone(e.tone) }} />
                  <span className="chron-ev__when mono">{e.when}</span>
                  <span className="chron-ev__t">{e.title}</span>
                  <span className="chron-ev__act">Акт {e.act}</span>
                  <Ic.chevron />
                </button>
              ))}
            </div>
            <div className="chron-cats">
              {W_TYPES.map((t) => (
                <button className="chron-cat" key={t} type="button" onClick={() => navigate(t)}>
                  <span className="went-ic" style={{ "--h": "var(--gold-lit)" }}>{React.createElement(Ic[ADAPTERS[t].icon])}</span>
                  <span className="chron-cat__n">{ADAPTERS[t].title}</span>
                  <span className="chron-cat__c">{WORLD[t].length}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function initialCur() {
  try {
    const p = new URLSearchParams(location.search);
    const t = p.get("type");
    if (t === "chronicle") return { type: "chronicle" };
    if (t && WORLD[t]) { const id = p.get("id"); return { type: t, id: id && wEnt(t, id) ? id : undefined }; }
  } catch (e) {}
  return null;
}

function WorldTreeApp() {
  const [cur, setCur] = useAppState(initialCur); // null | {type,id}
  const [canon, setCanon] = useAppState(null); // Real canon from Firestore
  const [loading, setLoading] = useAppState(true);
  const [authReady, setAuthReady] = useAppState(false);

  // Get projectId from URL param, global, or last opened project
  const getProjectId = async () => {
    // 1. Try URL param
    try {
      const params = new URLSearchParams(window.location.search);
      const urlProjectId = params.get('projectId');
      if (urlProjectId) {
        console.log('[WorldTree] projectId from URL:', urlProjectId);
        return urlProjectId;
      }
    } catch (e) {}

    // 2. Try global (set by Book)
    if (window.__currentProjectId) {
      console.log('[WorldTree] projectId from global:', window.__currentProjectId);
      return window.__currentProjectId;
    }

    // 3. Try to get any user project from Firestore
    if (window.__firebase && window.__wwUser?.uid) {
      try {
        console.log('[WorldTree] Fetching projects for user:', window.__wwUser.uid);
        const userProjects = await window.__firebase.db
          .collection('projects')
          .where('owner', '==', window.__wwUser.uid)
          .limit(1)
          .get();

        if (!userProjects.empty) {
          const firstProject = userProjects.docs[0];
          console.log('[WorldTree] projectId from first project:', firstProject.id, firstProject.data().title);
          return firstProject.id;
        } else {
          console.warn('[WorldTree] User has no projects');
        }
      } catch (error) {
        console.error('[WorldTree] Failed to get user projects:', error);
      }
    } else {
      console.warn('[WorldTree] Cannot fetch projects: firebase =', !!window.__firebase, ', user =', !!window.__wwUser);
    }

    console.warn('[WorldTree] No project found');
    return null;
  };

  // Listen to auth state changes and reload canon
  React.useEffect(() => {
    // Poll for auth state (Firebase auth initializes async)
    const authCheckInterval = setInterval(() => {
      if (window.__wwAuth !== undefined && !authReady) {
        console.log('[WorldTree] Auth ready:', window.__wwAuth ? 'authenticated' : 'anonymous', window.__wwUser?.email || 'no user');
        setAuthReady(true);
        clearInterval(authCheckInterval);
      }
    }, 100);

    // Cleanup after 15 seconds
    const timeout = setTimeout(() => {
      if (!authReady) {
        console.warn('[WorldTree] Auth timeout after 15s, proceeding without user');
        setAuthReady(true);
      }
      clearInterval(authCheckInterval);
    }, 15000);

    return () => {
      clearInterval(authCheckInterval);
      clearTimeout(timeout);
    };
  }, [authReady]);

  // Load canon from Firestore when auth is ready
  React.useEffect(() => {
    if (!authReady) return; // Wait for auth

    async function loadCanon() {
      console.log('[WorldTree] Loading canon with auth:', window.__wwAuth ? 'authenticated' : 'anonymous', window.__wwUser?.email || 'no user');

      const projectId = await getProjectId();

      console.log('[WorldTree] Loading canon...', {
        projectId,
        user: window.__wwUser?.email || 'anonymous',
        urlParams: window.location.search,
        globalProjectId: window.__currentProjectId,
        firebaseCanonExists: !!window.__firebaseCanon,
        firebaseExists: !!window.__firebase
      });

      // Store globally for other components
      if (projectId) {
        window.__currentProjectId = projectId;
      }

      if (!projectId) {
        console.warn('[WorldTree] ⚠️ No project selected — using empty canon');
        setCanon(window.__firebaseCanon?._emptyCanon() || WORLD);
        setLoading(false);
        return;
      }

      if (!window.__firebaseCanon) {
        console.error('[WorldTree] ❌ Firebase canon not loaded — falling back to WORLD mock');
        setCanon(WORLD);
        setLoading(false);
        return;
      }

      try {
        const realCanon = await window.__firebaseCanon.getCanon(projectId);
        const canonArrays = window.__firebaseCanon.canonToArrays(realCanon);

        console.log('[WorldTree] ✅ Canon loaded from Firestore:', {
          projectId,
          characters: canonArrays.characters.length,
          locations: canonArrays.locations.length,
          events: canonArrays.events.length,
          world: canonArrays.world
        });

        // Update global WORLD for compatibility with existing code (wt-tree.jsx, wt-workspace.jsx, etc.)
        window.WORLD = canonArrays;

        setCanon(canonArrays);
      } catch (error) {
        console.error('[WorldTree] ❌ Failed to load canon:', error);
        // Keep original WORLD mock as fallback
        setCanon(WORLD);
      } finally {
        setLoading(false);
      }
    }

    loadCanon();
  }, [authReady]); // Reload when auth becomes ready

  const navigate = useAppCb((type, id) => {
    if (!canon) return;
    if (type === "chronicle") { setCur({ type: "chronicle" }); return; }
    const fid = id || (canon[type] && canon[type][0] && canon[type][0].id);
    setCur({ type, id: fid });
  }, [canon]);
  const close = useAppCb(() => setCur(null), []);

  if (loading) {
    return (
      <div className="wt-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--tx-mid)', fontSize: 14 }}>Завантаження канону...</p>
      </div>
    );
  }

  if (!canon) {
    return (
      <div className="wt-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--tx-mid)', fontSize: 14 }}>Канон не знайдено</p>
      </div>
    );
  }

  return (
    <div className="wt-root">
      <TreeMap onSelect={(t) => navigate(t)} />
      {!cur && (
        <>
          <header className="brand">
            <span className="brand__logo"><Ic.book /></span>
            <span><span className="brand__name">White Tree</span><span className="brand__tag">Всесвіт · {canon.world?.tagline || 'Ваш всесвіт'}</span></span>
          </header>
          <PillarSwitch here="universe" fixed />
        </>
      )}
      {cur && cur.type === "chronicle" && <ChronicleView navigate={navigate} onClose={close} />}
      {cur && cur.type !== "chronicle" && (
        <Workspace key={cur.type} type={cur.type} selectedId={cur.id} navigate={navigate} onClose={close} goPillar={wtFade} />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<WorldTreeApp />);
