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
      setProjectId(initialId);
    }

    // Listen for projectId updates from shell
    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'ww-project' && event.data.projectId) {
        setProjectId(event.data.projectId);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return React.createElement(ProjectContext.Provider, { value: projectId }, children);
}

// Pillar navigation (Книга · Біблія світу)
function PillarSwitch({ here }) {
  const Ic = window.Ic || {};
  // PHASE 3: Read from ProjectContext (not window.__currentProjectId)
  const projectId = React.useContext(ProjectContext);
  const projectParam = projectId ? `?projectId=${projectId}` : '';

  // Helper to get translations
  const t = (key) => window.__i18n ? window.__i18n.t(key) : key;

  const fadeNav = (href) => {
    if (window.wwGo && window.wwGo(href)) return;
    window.location.href = href;
  };

  const items = [
    { id: "book", label: t('nav.book'), icon: "feather", go: () => { try { localStorage.setItem("ww_return", "1"); } catch (e) {} fadeNav(`WhiteWrite.html${projectParam}`); } },
    { id: "universe", label: t('nav.universe'), icon: "tree", go: () => fadeNav(`WhiteWrite GameBible.html${projectParam}`) },
  ];

  return (
    <div className="pillswitch pillswitch--fixed" role="tablist" aria-label={t('nav.pillars')}>
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
  const t = window.__i18n ? window.__i18n.t : (k) => k;
  const text = t('generation.creating').replace('{current}', current + 1).replace('{total}', total);
  return (
    <div className="gen-overlay">
      <div className="gen-card">
        <div className="gen-star">✨</div>
        <div className="gen-text">{text}</div>
        <div className="gen-note">{t('generation.note')}</div>
      </div>
    </div>
  );
}

function App() {
  // Returning from the workspace? Open straight to the story (skip the ritual).
  // Or opening existing project from list?
  let RET = false, RET_TITLE = "", SCENE = null, NEW = false, PROJECT_ID = null, WORLD_ID = null, NEW_WORLD = false;
  let FREE = null, RITUAL = false, STORY_INIT = null; // STORY_INIT: dossier «＋ Історія» with AI — the story form opens prefilled // RITUAL: opened from the World Bible — the mage opens the book // from the World Bible («＋ Історія»): { title, subjects, reveal, revealNote } — created at once, no form
  try {
    RET = localStorage.getItem("ww_return") === "1";
    RET_TITLE = localStorage.getItem("ww_title") || "";
    if (RET) localStorage.removeItem("ww_return");
    const params = new URLSearchParams(location.search);
    const sp = params.get("scene");
    if (sp) SCENE = parseInt(sp, 10) || null;
    NEW = params.get("new") === "1";
    PROJECT_ID = params.get("projectId");
    WORLD_ID = params.get("worldId");       // a new story is born inside this world
    NEW_WORLD = params.get("newWorld") === "1";
    RITUAL = params.get("ritual") === "1";
    if (NEW && params.get("free") === "1" && params.get("title")) FREE = {
      title: params.get("title"), subjects: (params.get("about") || "").split(",").filter(Boolean),
      reveal: params.get("reveal") || "open", revealNote: params.get("revealNote") || "" };
    else if (NEW && params.get("title")) STORY_INIT = {
      title: params.get("title"), subjects: (params.get("about") || "").split(",").filter(Boolean),
      reveal: params.get("reveal") || "open", revealNote: params.get("revealNote") || "" };
  } catch (e) {}
  const DIRECT = RET || SCENE != null || PROJECT_ID != null;

  // A story always lives in a world: "new" without a world starts with the world itself.
  const [stage, setStage] = useAState(DIRECT ? "book" : (NEW_WORLD || (NEW && !WORLD_ID)) ? "worldform" : FREE ? "auto" : (NEW ? "form" : "start")); // start | worldform | genesis | form | auto | book
  React.useEffect(() => { if (stage === "auto") enterBook({ title: FREE.title, description: "", creation: "free", subjects: FREE.subjects, reveal: FREE.reveal, revealNote: FREE.revealNote }); }, []);
  const [form, setForm] = useAState(DIRECT ? { description: "", projectId: PROJECT_ID } : null);
  const [returned] = useAState(DIRECT);
  const [loadingProject, setLoadingProject] = useAState(false);
  const [generationProgress, setGenerationProgress] = useAState({ current: 0, total: 0, isGenerating: false });
  const [langVersion, setLangVersion] = useAState(0); // For language change re-render

  // Export generation progress control to window (for SceneIntent continuation)
  React.useEffect(() => {
    window.__setGenerationProgress = setGenerationProgress;
    return () => { window.__setGenerationProgress = null; };
  }, []);

  // Load existing project if PROJECT_ID provided (URL param mode)
  React.useEffect(() => {
    if (!PROJECT_ID || !window.__firebaseProjects) {
      // Not an error: embed mode (shell) passes projectId via postMessage, not URL
      return;
    }

    async function loadExistingProject() {
      try {
        setLoadingProject(true);

        // Wait for auth to be ready
        if (!window.__wwUser) {
          // Poll for auth every 100ms, max 5 seconds
          let attempts = 0;
          while (!window.__wwUser && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }

          if (!window.__wwUser) {
            throw new Error('Час очікування авторизації минув');
          }
        }

        const project = await window.__firebaseProjects.getProject(PROJECT_ID);

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
          window.parent.__setCurrentProject(project.id);
        }

        // Ensure we stay on book stage
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

  // How many worlds the author has: the hero CTA is "create" for none, "choose" otherwise.
  const [worldsCount, setWorldsCount] = useAState(() => { try { return window.parent.__wwWorldsCount || 0; } catch (e) { return 0; } });
  function beginFromHero() {
    if (window.self !== window.top) window.parent.postMessage({ type: "ww-world-cta" }, window.location.origin);
    else setStage("worldform");
  }

  // World form → Genesis (author chooses the world) → world hub in the shell.
  const [genesisData, setGenesisData] = useAState(null);
  function startGenesis(data) {
    setGenesisData(data);
    // the world at once — it opens in its Bible, where the author fills it with their own material; ✦ ideas → Genesis
    if (!data.ideas || !(window.__firebaseAI && window.__firebaseAI.genesisWorld)) return createWorld({ name: data.title, summary: data.description }, true);
    setStage("genesis");
  }
  async function createWorld(seed, fill) {
    const worldId = await window.__firebaseCanon.createWorld(seed);
    if (window.self !== window.top) window.parent.postMessage({ type: "ww-world-created", worldId, fill: !!fill }, window.location.origin); // fill → its Bible, «Заповни світ»
  }

  // Persist the universe title so the workspace ↔ book stay the same world.
  async function enterBook(data) {
    // The book may open before the sign-in has loaded (a story straight from the Bible): wait for it,
    // otherwise no project is created and the book would fall back to the demo.
    for (let i = 0; i < 100 && !(window.__firebaseProjects && window.__wwUser); i++) await new Promise((r) => setTimeout(r, 100));
    if (!(window.__firebaseProjects && window.__wwUser)) {
      const t = window.__i18n ? window.__i18n.t : (k) => k;
      alert(t('error.projectCreation') + ': ' + t('error.notSignedIn'));
      setStage(FREE ? "start" : "form");
      return;
    }
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
          endingNote: data.endingNote || '',
          worldId: WORLD_ID,
          subjects: data.subjects || [],       // canon entities the story is about (World Bible dossier «Історії»)
          reveal: data.reveal || 'open',       // open | later | internal — what the reader may see
          revealNote: data.revealNote || ''
        };

        const projectId = await window.__firebaseProjects.createProject(projectData);

        // Store projectId for book to use
        data.projectId = projectId;

        // PHASE 3: Notify shell about new projectId (if embedded in shell)
        if (window.self !== window.top && window.parent.__setCurrentProject) {
          window.parent.__setCurrentProject(projectId);
        }

        // Free mode: the author writes — no generation, the book opens into the writing sheet
        if (data.creation === 'free') {
          setForm(data);
          try { localStorage.setItem("ww_title", (data.title && data.title.trim()) || titleFromPremise(data.description)); } catch (e) {}
          setStage("book");
          return;
        }

        // Auto mode: generate all scenes at once
        // Guided mode: generate only first scene
        const isAutoMode = data.creation === 'auto';
        const scenesToGenerate = isAutoMode ? getScenesCount(data.scope, data.episodes) : 1;


        if (window.__firebaseAI && window.__firebaseScenes) {
          try {

            // Phase 1.2: Check token balance for ALL scenes upfront (Auto Mode)
            const user = window.__wwUser;
            if (!user || !user.uid) {
              alert('Увійдіть в акаунт для генерації сцен.');
              return;
            }

            const costPerScene = window.__TOKEN_COSTS?.scene || 160; // the author's Claude model (token-budget.js)
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

                  // Use the same sceneId that was passed to Cloud Function
                  await window.__firebaseScenes.addScene(projectId, {
                    id: sceneId,  // Use pre-generated ID
                    title: result.scene.title,
                    text: result.scene.text,
                    intent: result.scene.intent
                    // canonRefs will be filled by extraction asynchronously
                  });


                  // Phase 1.1: Sync tokens from server response (server already deducted)
                  if (result.tokensConsumed && window.__wwUser) {
                    const cost = result.tokensConsumed;
                    const remaining = result.tokensRemaining;

                    // Update local state to match server
                    window.__wwUser.tokensUsed = (window.__wwUser.tokensUsed || 0) + cost;
                    window.__wwUser.tokensRemaining = remaining;


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
                  const t = window.__i18n ? window.__i18n.t : (k) => k;
                  const errorMsg = t('error.sceneGeneration').replace('{number}', i + 1);
                  const countMsg = t('error.scenesGenerated').replace('{count}', i).replace('{total}', scenesToGenerate);
                  alert(`${errorMsg}: ${result.error}\n\n${countMsg}`);
                  break; // Stop on error
                }
              } catch (sceneError) {
                console.error(`[${i + 1}/${scenesToGenerate}] ✗ Exception:`, sceneError);
                const t = window.__i18n ? window.__i18n.t : (k) => k;
                const errorMsg = t('error.sceneGeneration').replace('{number}', i + 1);
                const countMsg = t('error.scenesGenerated').replace('{count}', i).replace('{total}', scenesToGenerate);
                alert(`${errorMsg}: ${sceneError.message}\n\n${countMsg}`);
                break;
              }
            }

          } catch (genError) {
            console.error('Failed to generate scenes:', genError);
          } finally {
            // Stop progress tracking
            setGenerationProgress({ current: 0, total: 0, isGenerating: false });
          }
        }
      } catch (error) {
        console.error('Failed to create project:', error);
        const t = window.__i18n ? window.__i18n.t : (k) => k;
        if (!error.silent) alert(t('error.projectCreation') + ': ' + error.message); // silent: the limit dialog already spoke
        setGenerationProgress({ current: 0, total: 0, isGenerating: false });
        if (stage === "auto") setStage("start"); // a story from the Bible: never the demo book
        return;
      }
    }

    setForm(data);
    try { localStorage.setItem("ww_title", (data && data.title && data.title.trim()) || titleFromPremise(data && data.description)); } catch (e) {}
    setStage("book");
  }

  const bookTitle = (form && form.title && form.title.trim()) || (returned ? (RET_TITLE || "Попіл Орелії") : titleFromPremise(form && form.description));

  // Tell the White shell whether we're on the cover (home) or inside a story (work),
  // so the side rail can switch between global sections and the pillars.
  React.useEffect(() => {
    if (window.self === window.top) return;
    // "create": a story / world form — not the cover, so the shell keeps the way back to the World Bible
    try { window.parent.postMessage({ type: "ww-mode", mode: stage === "book" ? "work" : stage === "start" ? "home" : "create" }, window.location.origin); } catch (e) {}
  }, [stage]);

  // Shell logo → return to the mage cover even if we navigated internally.
  React.useEffect(() => {
    function onMsg(e) {
      if (e.origin !== window.location.origin || !e.data) return;
      if (e.data.type === "ww-home") setStage("start");
      if (e.data.type === "ww-worlds") setWorldsCount(e.data.count);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Listen for language change events from parent window (Account modal)
  React.useEffect(() => {
    function onLanguageChange(event) {
      const newLang = event.detail?.lang || (window.__i18n ? window.__i18n.getLanguage() : 'uk');

      // Update iframe's i18n to match parent
      if (window.__i18n && newLang) {
        window.__i18n.setLanguage(newLang);
      }

      setLangVersion(prev => {
        return prev + 1;
      });
    }
    window.addEventListener('ww-language-change', onLanguageChange);
    return () => window.removeEventListener('ww-language-change', onLanguageChange);
  }, [langVersion]);

  return (
    <div className="app" key={`app-${langVersion}`}>
      {stage === "start" && (
        <StartScreen key={`start-${langVersion}`} langVersion={langVersion} hasWorlds={worldsCount > 0} onBegin={beginFromHero} />
      )}
      {stage === "worldform" && (
        <WorldForm
          key={`worldform-${langVersion}`}
          onBack={() => setStage("start")}
          onCreate={startGenesis}
          initial={genesisData}
        />
      )}
      {stage === "form" && (
        <StoryForm
          key={`form-${langVersion}`}
          langVersion={langVersion}
          onBack={() => { try { window.parent.__wwOpenWorld(WORLD_ID); } catch (e) { setStage("start"); } }}
          onCreate={enterBook}
          initial={STORY_INIT}
        />
      )}
      {stage === "genesis" && genesisData && (
        <GenesisScreen
          key={`genesis-${langVersion}`}
          data={genesisData}
          onChoose={createWorld}
          onSkip={() => createWorld({ name: genesisData.title, summary: genesisData.description })}
          onBack={() => setStage("worldform")}
        />
      )}
      {stage === "book" && (
        <div key="book" className="stage-screen">
          <PillarSwitch here="book" />
          <Book
            flow={!returned || RITUAL}
            ritualText={(form && form.creation === 'free') || RITUAL ? (window.__i18n ? window.__i18n.t('book.opening') : 'Книга відкривається…') : null}
            premise={form ? form.description : ""}
            title={bookTitle}
            projectId={form ? form.projectId : null}
            startScene={SCENE}
            startWriting={!!(form && form.creation === 'free')}
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
  <ErrorBoundary>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </ErrorBoundary>
);
