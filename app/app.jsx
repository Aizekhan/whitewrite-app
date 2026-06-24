// Top-level flow: start → form → (ritual + reading inside Book).
const { useState: useAState, useEffect: useAEffect } = React;

// ---- PHASE 3: ProjectContext (read from shell) ----
// Shell (window.parent) is the single source of truth for projectId
// This context listens to postMessage from shell and provides projectId to components
const ProjectContext = React.createContext(null);

function ProjectProvider({ children }) {
  const [projectId, setProjectId] = useAState(null);

  useAEffect(() => {
    // Initial read from parent (if embedded in shell)
    if (window.self !== window.top && window.parent.__currentProjectId) {
      const initialId = window.parent.__currentProjectId;
      console.log('[Book] Initial projectId from parent:', initialId);
      setProjectId(initialId);
    }

    // Listen for projectId updates from shell
    function handleMessage(event) {
      if (event.data && event.data.type === 'ww-project' && event.data.projectId) {
        console.log('[Book] Received projectId from shell:', event.data.projectId);
        setProjectId(event.data.projectId);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return React.createElement(ProjectContext.Provider, { value: projectId }, children);
}

// Pillar navigation (Книга · Всесвіт · Режисер)
function PillarSwitch({ here }) {
  const Ic = window.Ic || {};
  // PHASE 3: Read from ProjectContext (not window.__currentProjectId)
  const projectId = React.useContext(ProjectContext);
  const projectParam = projectId ? `?projectId=${projectId}` : '';

  const fadeNav = (href) => {
    if (window.wwGo && window.wwGo(href)) return;
    window.location.href = href;
  };

  const items = [
    { id: "book", label: "Книга", icon: "feather", go: () => { try { localStorage.setItem("ww_return", "1"); } catch (e) {} fadeNav(`WhiteWrite.html${projectParam}`); } },
    { id: "universe", label: "Всесвіт", icon: "tree", go: () => fadeNav(`WhiteWrite WorldTree.html${projectParam}`) },
    { id: "director", label: "Режисер", icon: "clapper", go: () => fadeNav(`WhiteWrite Workspace.html${projectParam}`) },
  ];

  return (
    <div className="pillswitch pillswitch--fixed" role="tablist" aria-label="Стовпи WhiteWrite">
      {items.map((it) => {
        const I = Ic[it.icon];
        const cur = here === it.id;
        return (
          <button key={it.id} type="button" role="tab" aria-current={cur ? "page" : undefined}
            className={`pillswitch__b ${cur ? "is-here" : ""}`} onClick={() => { if (!cur) it.go(); }}>
            {I && <I />}{it.label}
          </button>
        );
      })}
    </div>
  );
}

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

// Calculate number of scenes to generate based on scope
function getScenesCount(scope, episodes) {
  const counts = {
    shot: 3,        // Short story: 3 scenes
    novella: 8,     // Novella: 8 scenes
    season: episodes || 12,  // Season: user-defined episodes (each = 1 scene for now)
    endless: 5      // Endless: start with 5 scenes
  };
  return counts[scope] || 5;
}

// Choose scene intent based on position in story
function getSceneIntent(index, total, isAutoMode) {
  if (!isAutoMode) return 'surprise';

  // Story structure: beginning → middle → climax → ending
  const position = index / Math.max(total - 1, 1);

  if (index === 0) return 'world';           // First scene: introduce world
  if (index === 1) return 'character';       // Second: introduce character
  if (position < 0.3) return 'conflict';     // Beginning: establish conflict
  if (position < 0.5) return 'action';       // Rising: action
  if (position < 0.7) return 'twist';        // Middle: twist/complication
  if (position < 0.85) return 'conflict';    // Climax: peak conflict
  if (index === total - 1) return 'character'; // Last: resolution/character moment
  return 'surprise';                         // Default: let AI decide
}

// Generation progress overlay
function GenerationProgress({ current, total }) {
  return (
    <div className="gen-overlay">
      <div className="gen-card">
        <div className="gen-star">✨</div>
        <div className="gen-text">Генерується сцена {current + 1} з {total}</div>
        <div className="gen-note">Це може зайняти кілька хвилин...</div>
      </div>
    </div>
  );
}

function App() {
  // Returning from the workspace? Open straight to the story (skip the ritual).
  // Or opening existing project from list?
  let RET = false, RET_TITLE = "", SCENE = null, NEW = false, PROJECT_ID = null;
  try {
    RET = localStorage.getItem("ww_return") === "1";
    RET_TITLE = localStorage.getItem("ww_title") || "";
    if (RET) localStorage.removeItem("ww_return");
    const params = new URLSearchParams(location.search);
    const sp = params.get("scene");
    if (sp) SCENE = parseInt(sp, 10) || null;
    NEW = params.get("new") === "1";
    PROJECT_ID = params.get("projectId");
  } catch (e) {}
  const DIRECT = RET || SCENE != null || PROJECT_ID != null;

  const [stage, setStage] = useAState(DIRECT ? "book" : (NEW ? "form" : "start")); // start | form | book
  const [form, setForm] = useAState(DIRECT ? { description: "", projectId: PROJECT_ID } : null);
  const [returned] = useAState(DIRECT);
  const [loadingProject, setLoadingProject] = useAState(false);
  const [generationProgress, setGenerationProgress] = useAState({ current: 0, total: 0, isGenerating: false });

  // Load existing project if PROJECT_ID provided (URL param mode)
  React.useEffect(() => {
    if (!PROJECT_ID || !window.__firebaseProjects) {
      // Not an error: embed mode (shell) passes projectId via postMessage, not URL
      return;
    }

    async function loadExistingProject() {
      try {
        console.log('Loading project:', PROJECT_ID);
        setLoadingProject(true);

        // Wait for auth to be ready
        if (!window.__wwUser) {
          console.log('Waiting for auth...');
          // Poll for auth every 100ms, max 5 seconds
          let attempts = 0;
          while (!window.__wwUser && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }

          if (!window.__wwUser) {
            throw new Error('Час очікування авторизації минув');
          }
          console.log('Auth ready:', window.__wwUser.email);
        }

        const project = await window.__firebaseProjects.getProject(PROJECT_ID);
        console.log('Project loaded successfully:', project.title);

        setForm({
          title: project.title,
          description: project.desc || '',
          projectId: project.id,
          scope: project.scope,
          ending: project.ending,
          genres: project.genres || []
        });

        // PHASE 3: Notify shell about loaded projectId (if embedded in shell)
        if (window.self !== window.top && window.parent.__setCurrentProject) {
          console.log('[Book] Notifying shell about loaded project:', project.id);
          window.parent.__setCurrentProject(project.id);
        }

        // Ensure we stay on book stage
        console.log('Setting stage to book');
        setStage("book");
      } catch (error) {
        console.error('Failed to load project:', error);
        alert('Не вдалося завантажити проєкт: ' + error.message);
        setStage("start");
      } finally {
        setLoadingProject(false);
      }
    }

    loadExistingProject();
  }, [PROJECT_ID]);

  // Persist the universe title so the workspace ↔ book stay the same world.
  async function enterBook(data) {
    // Create project in Firestore
    if (window.__firebaseProjects && window.__wwUser) {
      try {
        const projectData = {
          title: data.title || titleFromPremise(data.description),
          desc: data.description || '',
          language: data.language || 'uk',
          scope: data.scope || 'novella',
          ending: data.ending || 'open',
          genres: data.genres || [],
          creation: data.creation || 'guided',
          length: data.length || 700,
          dialogue: data.dialogue || 50,
          episodes: data.episodes || null,
          endingNote: data.endingNote || ''
        };

        const projectId = await window.__firebaseProjects.createProject(projectData);
        console.log('Project created:', projectId);

        // Store projectId for book to use
        data.projectId = projectId;

        // PHASE 3: Notify shell about new projectId (if embedded in shell)
        if (window.self !== window.top && window.parent.__setCurrentProject) {
          console.log('[Book] Notifying shell about new project:', projectId);
          window.parent.__setCurrentProject(projectId);
        }

        // Auto mode: generate all scenes at once
        // Guided mode: generate only first scene
        const isAutoMode = data.creation === 'auto';
        const scenesToGenerate = isAutoMode ? getScenesCount(data.scope, data.episodes) : 1;

        console.log('=== GENERATION START ===');
        console.log('Mode:', data.creation, '→ isAutoMode:', isAutoMode);
        console.log('Scope:', data.scope);
        console.log('Episodes:', data.episodes);
        console.log('Scenes to generate:', scenesToGenerate);

        if (window.__firebaseAI && window.__firebaseScenes) {
          try {
            console.log(`${isAutoMode ? 'Auto mode' : 'Guided mode'}: generating ${scenesToGenerate} scene(s)...`);

            // Phase 1.2: Check token balance for ALL scenes upfront (Auto Mode)
            const user = window.__wwUser;
            if (!user || !user.uid) {
              alert('Увійдіть в акаунт для генерації сцен.');
              return;
            }

            const costPerScene = window.__TOKEN_COSTS?.sceneGemini || 20;
            const totalCost = costPerScene * scenesToGenerate;
            if (user.tokensRemaining < totalCost) {
              console.warn(`Insufficient tokens for ${scenesToGenerate} scenes: need ${totalCost}, have ${user.tokensRemaining}`);

              const planName = window.__getPlanConfig ? window.__getPlanConfig(user.plan).name : 'Free';
              const maxScenes = Math.floor(user.tokensRemaining / costPerScene);
              const message = `Недостатньо токенів для генерації ${scenesToGenerate} сцен!\n\nПотрібно: ${totalCost} токенів (${scenesToGenerate} × ${costPerScene})\nДоступно: ${user.tokensRemaining} токенів\n\nМожна згенерувати: до ${maxScenes} сцен\n\nВаш поточний план: ${planName}`;

              if (confirm(message + '\n\nВідкрити налаштування акаунту?')) {
                if (typeof window.__openAccount === 'function') {
                  window.__openAccount();
                }
              }
              return; // BLOCK generation
            }

            // Start progress tracking
            setGenerationProgress({ current: 0, total: scenesToGenerate, isGenerating: true });

            for (let i = 0; i < scenesToGenerate; i++) {
              try {
                // Update progress
                setGenerationProgress({ current: i, total: scenesToGenerate, isGenerating: true });

                // Free tier: add delay between scenes to avoid rate limits
                if (i > 0) {
                  console.log(`[${i + 1}/${scenesToGenerate}] Waiting 3s (free tier rate limit)...`);
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }

                // Get previous scenes for continuity
                const previousScenes = await window.__firebaseScenes.getScenes(projectId);
                const last3 = previousScenes.slice(-3).map(s => ({
                  title: s.title,
                  text: s.text,
                  n: s.n
                }));

                // Choose intent based on position in story
                const intent = getSceneIntent(i, scenesToGenerate, isAutoMode);

                console.log(`[${i + 1}/${scenesToGenerate}] Generating scene with intent: ${intent}...`);

                // Pre-generate sceneId for canon linking
                const sceneId = 'scene_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

                const result = await window.__firebaseAI.generateScene(
                  projectId,
                  intent,
                  null,
                  last3,
                  0,  // retryCount
                  sceneId  // Pass sceneId for canon linking
                );

                if (result.success) {
                  console.log(`[${i + 1}/${scenesToGenerate}] ✓ Generated: "${result.scene.title}"`);

                  // Use the same sceneId that was passed to Cloud Function
                  await window.__firebaseScenes.addScene(projectId, {
                    id: sceneId,  // Use pre-generated ID
                    title: result.scene.title,
                    text: result.scene.text,
                    intent: result.scene.intent
                    // canonRefs will be filled by extraction asynchronously
                  });

                  console.log(`[${i + 1}/${scenesToGenerate}] ✓ Saved to Firestore`);

                  // Phase 1.1: Sync tokens from server response (server already deducted)
                  if (result.tokensConsumed && window.__wwUser) {
                    const cost = result.tokensConsumed;
                    const remaining = result.tokensRemaining;

                    // Update local state to match server
                    window.__wwUser.tokensUsed = (window.__wwUser.tokensUsed || 0) + cost;
                    window.__wwUser.tokensRemaining = remaining;

                    console.log(`[${i + 1}/${scenesToGenerate}] ✅ Tokens synced: -${cost}, remaining: ${remaining}`);

                    // Show toast notification (only on last scene in Auto Mode)
                    if (i === scenesToGenerate - 1 && typeof window.__showTokenToast === 'function') {
                      const totalCost = cost * scenesToGenerate; // Approximate total (may vary if Claude used)
                      window.__showTokenToast(totalCost, remaining);
                    }

                    // Refresh UI
                    if (typeof window.__syncDockAvatar === 'function') {
                      window.__syncDockAvatar();
                    }
                  }
                } else {
                  console.error(`[${i + 1}/${scenesToGenerate}] ✗ Generation failed:`, result.error);
                  alert(`Помилка генерації сцени ${i + 1}: ${result.error}\n\nЗгенеровано ${i} з ${scenesToGenerate} сцен.`);
                  break; // Stop on error
                }
              } catch (sceneError) {
                console.error(`[${i + 1}/${scenesToGenerate}] ✗ Exception:`, sceneError);
                alert(`Помилка при генерації сцени ${i + 1}: ${sceneError.message}\n\nЗгенеровано ${i} з ${scenesToGenerate} сцен.`);
                break;
              }
            }

            console.log(`✓ Generation complete! Total scenes: ${scenesToGenerate}`);
          } catch (genError) {
            console.error('Failed to generate scenes:', genError);
          } finally {
            // Stop progress tracking
            setGenerationProgress({ current: 0, total: 0, isGenerating: false });
          }
        }
      } catch (error) {
        console.error('Failed to create project:', error);
        alert('Не вдалося створити проєкт: ' + error.message);
        setGenerationProgress({ current: 0, total: 0, isGenerating: false });
        return;
      }
    }

    setForm(data);
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
        <StoryForm
          key="form"
          onBack={() => setStage("start")}
          onCreate={enterBook}
        />
      )}
      {stage === "book" && (
        <div key="book" className="stage-screen">
          <PillarSwitch here="book" />
          <Book
            flow={!returned}
            premise={form ? form.description : ""}
            title={bookTitle}
            projectId={form ? form.projectId : null}
            startScene={SCENE}
            onExit={() => { setStage("start"); }}
          />
        </div>
      )}
      {generationProgress.isGenerating && (
        <GenerationProgress current={generationProgress.current} total={generationProgress.total} />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ProjectProvider>
    <App />
  </ProjectProvider>
);
