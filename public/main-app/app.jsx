// Top-level flow: start → form → (ritual + reading inside Book).
const { useState: useAState } = React;

// Derive a universe title from the user's premise — falls back to the
// scripted stub when nothing meaningful is given.
function titleFromPremise(p) {
  if (!p) return "Попіл Орелії";
  const words = p.trim().replace(/[.,;:!?"«»]/g, " ").split(/\s+/).filter(Boolean);
  const small = new Set(["і","та","у","в","на","з","зі","до","що","де","як","про","під","над","для","the","a","of","and"]);
  const pick = words.filter((w) => w.length > 2 && !small.has(w.toLowerCase())).slice(0, 3);
  if (!pick.length) return "Попіл Орелії";
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  return pick.map(cap).join(" ");
}

function App() {
  // Check URL parameters
  let RET = false, RET_TITLE = "", SCENE = null, PROJECT_ID = null;
  try {
    RET = localStorage.getItem("ww_return") === "1";
    RET_TITLE = localStorage.getItem("ww_title") || "";
    if (RET) localStorage.removeItem("ww_return");

    const params = new URLSearchParams(location.search);
    const sp = params.get("scene");
    if (sp) SCENE = parseInt(sp, 10) || null;

    // NEW: support opening existing project via URL
    PROJECT_ID = params.get("projectId");
  } catch (e) {}

  const DIRECT = RET || SCENE != null || PROJECT_ID != null;

  const [stage, setStage] = useAState(DIRECT ? (PROJECT_ID ? "form" : "book") : "start");
  const [form, setForm] = useAState(DIRECT ? { description: "" } : null);
  const [returned] = useAState(DIRECT);
  const [projectId, setProjectId] = useAState(PROJECT_ID);
  const [loadingProject, setLoadingProject] = useAState(false);
  const [projectData, setProjectData] = useAState(null);

  // Load existing project if projectId in URL
  React.useEffect(() => {
    async function loadProject() {
      if (!PROJECT_ID) return;

      setLoadingProject(true);
      try {
        const project = await window.__firebaseProjects.getProject(PROJECT_ID);
        console.log('Loaded existing project:', project);

        setProjectData(project);
        setProjectId(project.id);

        // Pre-fill form data
        setForm({
          projectId: project.id,
          title: project.title || '',
          description: project.desc || '',
          scope: project.scope || 'novella',
          ending: project.ending || 'open',
          genres: project.genres || [],
          // These are not stored in Firestore, use defaults
          creation: 'guided',
          length: 700,
          dialogue: 50,
          episodes: 8,
          endingNote: ''
        });

        setStage("form");
      } catch (error) {
        console.error('Failed to load project:', error);
        alert('Не вдалося завантажити проєкт: ' + error.message);
        setStage("start");
      } finally {
        setLoadingProject(false);
      }
    }

    loadProject();
  }, []);

  // Persist the universe title so the workspace ↔ book stay the same world.
  function enterBook(data) {
    setForm(data);
    if (data.projectId) setProjectId(data.projectId);
    try { localStorage.setItem("ww_title", (data && data.title && data.title.trim()) || titleFromPremise(data && data.description)); } catch (e) {}
    setStage("book");
  }

  const bookTitle = returned ? (RET_TITLE || "Попіл Орелії") : ((form && form.title && form.title.trim()) || titleFromPremise(form && form.description));

  // Tell the White shell whether we're on the cover (home) or inside a story (work),
  // so the side rail can switch between global sections and the pillars.
  React.useEffect(() => {
    if (window.self === window.top) return;
    try { window.parent.postMessage({ type: "ww-mode", mode: stage === "book" ? "work" : "home" }, "*"); } catch (e) {}
  }, [stage]);

  // Shell logo → return to the mage cover even if we navigated internally.
  React.useEffect(() => {
    function onMsg(e) { if (e.data && e.data.type === "ww-home") setStage("start"); }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <div className="app">
      {stage === "start" && (
        <StartScreen key="start" onBegin={() => setStage("form")} />
      )}
      {stage === "form" && (
        loadingProject ? (
          <div className="stage-screen" style={{display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', color:'var(--tx-mid)'}}>
            Завантаження проєкту...
          </div>
        ) : (
          <StoryForm
            key="form"
            onBack={() => setStage("start")}
            onCreate={enterBook}
            initialData={form}
          />
        )
      )}
      {stage === "book" && (
        <div key="book" className="stage-screen">
          <Book
            flow={!returned}
            premise={form ? form.description : ""}
            title={bookTitle}
            projectId={projectId}
            startScene={SCENE}
            onExit={() => { setStage("start"); }}
          />
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
