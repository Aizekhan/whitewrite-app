// Workspace shell: sidebar nav + topbar + tab routing.
const { useState: useWState, useEffect: useWEffect } = React;

// ---- PHASE 3: ProjectContext (read from shell) ----
const ProjectContext = React.createContext(null);

function ProjectProvider({ children }) {
  // Initialize from parent window (synchronous, before first render)
  const [projectId, setProjectId] = React.useState(() => {
    try {
      const initialId = (window.self !== window.top && window.parent.__currentProjectId) || null;
      if (initialId) {
        console.log('[Workspace] Initial projectId from parent:', initialId);
      }
      return initialId;
    } catch (e) {
      console.error('[Workspace] Failed to read parent.__currentProjectId:', e);
      return null;
    }
  });

  // Listen for projectId updates from shell via postMessage
  React.useEffect(() => {
    function handleMessage(event) {
      if (event.data && event.data.type === 'ww-project' && event.data.projectId) {
        console.log('[Workspace] Received projectId from shell:', event.data.projectId);
        setProjectId(event.data.projectId); // Triggers re-render of consumers
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return React.createElement(ProjectContext.Provider, { value: projectId }, children);
}

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
  // PHASE 3: Read from ProjectContext (not window.__currentProjectId)
  const projectId = React.useContext(ProjectContext);
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
  console.log('[Workspace] App component mounting/re-rendering');

  const [tab, setTab] = useWState("director");
  const [scene, setScene] = useWState(1);
  const [genBusy, setGenBusy] = useWState(false);
  const [loading, setLoading] = useWState(true);

  // PHASE 3: Read projectId from ProjectContext
  const contextProjectId = React.useContext(ProjectContext);
  console.log('[Workspace] 🔥 NEW CODE 2026-06-23:', { contextProjectId, wwUser: !!window.__wwUser });

  // DEBUG: Log contextProjectId changes
  React.useEffect(() => {
    console.log('[Workspace] DEBUG: contextProjectId changed:', contextProjectId);
  }, [contextProjectId]);

  // REMOVED: Separate auth polling useEffect
  // Instead, we wait for window.__wwUser inside loadProject() (same as Book)

  // Load canon + scenes when contextProjectId is ready
  React.useEffect(() => {
    console.log('[Workspace] 🚀 NEW useEffect (no authReady!)', { contextProjectId, wwUser: !!window.__wwUser });

    if (!contextProjectId) {
      console.log('[Workspace] Waiting for projectId from shell...');
      setLoading(false); // Show content with mock data instead of spinner
      return;
    }

    async function loadProject() {
      console.log('[Workspace] Loading project:', contextProjectId);
      setLoading(true); // Show spinner while loading real data

      // PHASE 3: Use projectId from ProjectContext (set by postMessage from shell)
      let projectId = contextProjectId;

      // Fallback to URL params (standalone mode)
      if (!projectId) {
        try {
          const params = new URLSearchParams(window.location.search);
          projectId = params.get('projectId');
        } catch (e) {}
      }

      // Fallback to first user project
      if (!projectId && window.__firebase?.auth?.currentUser) {
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

      console.log('[Workspace] Loading projectId:', projectId);

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

        // Mutate WORLD arrays in-place (preserves DATA projection references)
        Object.keys(canonArrays).forEach(key => {
          if (Array.isArray(WORLD[key]) && Array.isArray(canonArrays[key])) {
            WORLD[key].length = 0;
            WORLD[key].push(...canonArrays[key]);
          } else {
            WORLD[key] = canonArrays[key];
          }
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
  }, [contextProjectId]); // Reload when projectId changes via postMessage

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

ReactDOM.createRoot(document.getElementById("root")).render(
  <ProjectProvider>
    <App />
  </ProjectProvider>
);