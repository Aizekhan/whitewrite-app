// Workspace shell: sidebar nav + topbar + tab routing.
const { useState: useWState } = React;

// Smooth fade back into the book document (same universe).
function fadeNav(href) {
  if (window.wwGo && window.wwGo(href)) return;
  const o = document.createElement("div");
  o.style.cssText = "position:fixed;inset:0;z-index:99999;background:#080503;opacity:0;transition:opacity .55s ease;pointer-events:all;";
  document.body.appendChild(o);
  requestAnimationFrame(() => { o.style.opacity = "1"; });
  setTimeout(() => { window.location.href = href; }, 580);
}
// Visual Canon → open the matching canon entity in the World Tree.
window.__wsGoCanon = (type, id) => fadeNav("WhiteWrite WorldTree.html?type=" + type + "&id=" + encodeURIComponent(id));

// Unified pillar switcher — identical on all three screens. `here` = active pillar.
function PillarSwitch({ here }) {
  // Get current projectId to pass to other pillars
  const projectId = window.__currentProjectId;
  const projectParam = projectId ? `?projectId=${projectId}` : '';

  const items = [
    { id: "book", label: "Книга", icon: "book", go: () => { try { localStorage.setItem("ww_return", "1"); } catch (e) {} fadeNav(`WhiteWrite.html${projectParam}`); } },
    { id: "universe", label: "Всесвіт", icon: "tree", go: () => fadeNav(`WhiteWrite WorldTree.html${projectParam}`) },
    { id: "director", label: "Режисер", icon: "clapper", go: () => fadeNav(`WhiteWrite Workspace.html${projectParam}`) },
  ];
  return (
    <div className="pillswitch" role="tablist" aria-label="Стовпи WhiteWrite">
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

// Director = visual production ONLY: shot breakdown + visual-consistency assets.
// Canon (characters/locations/events/memory) lives in the World Tree — reached
// via the topbar "Світове дерево" button, never duplicated as Director tabs.
const TABS = [
  { id: "director", label: "Розкадровка", icon: "clapper", count: () => DATA.shots.length, C: () => window.DirectorTab },
  { id: "vizref", label: "Візуальний канон", icon: "image", count: () => WORLD.characters.length + WORLD.locations.length, C: () => window.VizRefTab },
];

// Scene picker dropdown — choose which scene the Director works on.
function ScenePick({ scene, setScene }) {
  const [open, setOpen] = useWState(false);
  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  const cur = WORLD.scenes.find((s) => s.n === scene) || WORLD.scenes[0];
  return (
    <div className="scene-pickwrap" onClick={(e) => e.stopPropagation()}>
      <button className={`scene-pick ${open ? "is-open" : ""}`} onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        <Ic.clapper /><span className="num">Сцена {cur.n}</span>
        <span>· {cur.title}</span>
        <Ic.caret />
      </button>
      {open && (
        <div className="scene-menu" role="menu">
          {WORLD.scenes.map((s) => (
            <button key={s.n} role="menuitem" type="button" className={`scene-opt ${s.n === scene ? "is-on" : ""}`}
              onClick={() => { setOpen(false); setScene(s.n); }}>
              <span className="scene-opt__n">{s.n}</span>
              <span className="scene-opt__t">{s.title}</span>
              <span className="scene-opt__act">акт {s.act}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [tab, setTab] = useWState("director");
  const [scene, setScene] = useWState(1);
  const [genBusy, setGenBusy] = useWState(false);
  const [loading, setLoading] = useWState(true);
  const [authReady, setAuthReady] = useWState(false);

  // Load project from Firestore (canon + scenes)
  React.useEffect(() => {
    // Poll for auth state (Firebase auth initializes async)
    const authCheckInterval = setInterval(() => {
      if (window.__wwAuth !== undefined && !authReady) {
        setAuthReady(true);
        clearInterval(authCheckInterval);
        console.log('[Workspace] Auth ready:', window.__wwAuth ? 'authenticated' : 'anonymous');
      }
    }, 100);

    return () => clearInterval(authCheckInterval);
  }, [authReady]);

  // Load canon + scenes when auth is ready
  React.useEffect(() => {
    if (!authReady) return;

    async function loadProject() {
      console.log('[Workspace] Loading project...');

      const isEmbedded = window.location.search.indexOf('embed=1') >= 0;
      let projectId;

      // Embedded mode: ONLY read from global (shell sets it)
      if (isEmbedded) {
        projectId = window.__currentProjectId;
        if (!projectId) {
          console.warn('[Workspace] Embedded mode but no global projectId set');
          setLoading(false);
          return;
        }
        console.log('[Workspace] Embedded mode — projectId from global:', projectId);
      } else {
        // Standalone mode: try URL param, then Firestore fallback
        try {
          const params = new URLSearchParams(window.location.search);
          projectId = params.get('projectId');
        } catch (e) {}

        if (!projectId && window.__firebase?.auth?.currentUser) {
          // Fallback: load first user project
          try {
            const uid = window.__firebase.auth.currentUser.uid;
            const userProjects = await window.__firebase.db
              .collection('projects')
              .where('owner', '==', uid)
              .orderBy('createdAt', 'desc')
              .limit(1)
              .get();

            if (!userProjects.empty) {
              projectId = userProjects.docs[0].id;
            }
          } catch (error) {
            console.error('[Workspace] Failed to load user projects:', error);
          }
        }

        if (!projectId) {
          console.warn('[Workspace] No project selected — using mock data');
          setLoading(false);
          return;
        }

        // Store globally
        window.__currentProjectId = projectId;
        console.log('[Workspace] projectId:', projectId);
      }

      try {
        // Load canon from Firestore
        const realCanon = await window.__firebaseCanon.getCanon(projectId);
        const canonArrays = window.__firebaseCanon.canonToArrays(realCanon);

        // Load scenes from Firestore subcollection
        let scenes = [];
        if (window.__firebaseScenes) {
          try {
            scenes = await window.__firebaseScenes.getScenes(projectId);
            console.log('[Workspace] ✅ Scenes loaded:', scenes.length);
          } catch (sceneError) {
            console.warn('[Workspace] Failed to load scenes:', sceneError);
          }
        }

        // Merge into WORLD
        canonArrays.scenes = scenes;

        // Replace mock WORLD with real data
        Object.keys(canonArrays).forEach(key => {
          WORLD[key] = canonArrays[key];
        });

        console.log('[Workspace] ✅ Canon loaded:', {
          characters: WORLD.characters.length,
          locations: WORLD.locations.length,
          scenes: WORLD.scenes.length
        });

        // Set first scene as default
        if (WORLD.scenes.length > 0) {
          setScene(WORLD.scenes[0].n);
        }

        setLoading(false);
      } catch (error) {
        console.error('[Workspace] Failed to load project:', error);
        setLoading(false);
      }
    }

    loadProject();
  }, [authReady]);

  const active = TABS.find((t) => t.id === tab);
  const Tab = active ? active.C() : null;

  function calcScene() {
    if (genBusy) return;
    setGenBusy(true);
    if (window.__dirCalc) window.__dirCalc();
    setTimeout(() => setGenBusy(false), 1400);
  }

  if (loading) {
    return (
      <div className="shell">
        <div className="main">
          <div className="content" style={{ display: 'grid', placeItems: 'center', color: 'var(--tx-mid)' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="spin-ring" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
              <div>Завантаження проєкту...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="main">
        <header className="topbar">
          <ScenePick scene={scene} setScene={setScene} />
          <div className="dir-tabs">
            {TABS.map((t) => {
              const I = Ic[t.icon];
              return (
                <button key={t.id} type="button" className={`dir-tab ${tab === t.id ? "is-on" : ""}`} onClick={() => setTab(t.id)}>
                  <I /><span>{t.label}</span>
                </button>
              );
            })}
          </div>
          <div className="topbar__spacer" />
          <PillarSwitch here="director" />
          <button className="topbar__btn topbar__btn--gold" onClick={calcScene} disabled={genBusy || tab !== "director"} title={tab !== "director" ? "Доступно на вкладці Розкадровка" : ""}>
            {genBusy ? <span className="spin-ring" style={{ width: 15, height: 15 }} /> : <Ic.grid />}
            {genBusy ? "Розраховую…" : "Розрахувати кадри"}
          </button>
        </header>

        <main className="content">
          {Tab && <Tab key={tab + ":" + scene} scene={scene} />}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);