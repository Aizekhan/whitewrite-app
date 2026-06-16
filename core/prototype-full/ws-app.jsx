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
  const items = [
    { id: "book", label: "Книга", icon: "book", go: () => { try { localStorage.setItem("ww_return", "1"); } catch (e) {} fadeNav("WhiteWrite.html"); } },
    { id: "universe", label: "Всесвіт", icon: "tree", go: () => fadeNav("WhiteWrite WorldTree.html") },
    { id: "director", label: "Режисер", icon: "clapper", go: () => fadeNav("WhiteWrite Workspace.html") },
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
  const [scene, setScene] = useWState(DATA.scene.n);
  const [genBusy, setGenBusy] = useWState(false);
  const active = TABS.find((t) => t.id === tab);
  const Tab = active.C();
  function calcScene() {
    if (genBusy) return;
    setGenBusy(true);
    if (window.__dirCalc) window.__dirCalc();
    setTimeout(() => setGenBusy(false), 1400);
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
          <Tab key={tab + ":" + scene} scene={scene} />
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);