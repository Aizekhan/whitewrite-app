// ============================================================================
// Dependency / Impact / Reconstruction engine — the "under the hood" logic.
//
//   Canon      Characters · Locations · Events · Factions · Artifacts · World
//     ↓
//   Narrative  Arcs · Chapters · Scenes · Dialogues
//     ↓
//   Director   Storyboards · Shots · Images
//
// Every lower-layer object declares what it depends on. The engine answers:
//   "What is affected if I change this canon entity?"  →  wAffected / wImpact
//   "In what order do we regenerate it?"               →  wReconstructionPlan
// No UI here — pure logic, exposed on window for any surface (or agent) to use.
// ============================================================================
(function () {
  const LAYERS = {
    canon: ["world", "characters", "locations", "events", "factions", "artifacts"],
    narrative: ["arcs", "chapters", "scenes", "dialogues"],
    director: ["storyboards", "shots", "images"],
  };
  const CANON = LAYERS.canon.filter((t) => t !== "world");

  const KIND_LABEL = {
    scenes: "Сцени", dialogues: "Діалоги", arcs: "Арки", chapters: "Розділи",
    storyboards: "Розкадровки", shots: "Кадри", images: "Зображення",
  };
  const KIND_ICON = {
    scenes: "book", dialogues: "chat", arcs: "layers", chapters: "scroll",
    storyboards: "grid", shots: "clapper", images: "camera",
  };
  const KIND_ACTION = {
    scenes: "Перегенерувати сцени", dialogues: "Оновити діалоги",
    chapters: "Звірити розділи", arcs: "Звірити арки",
    storyboards: "Перебудувати розкадровки", shots: "Оновити кадри", images: "Перерендерити зображення",
  };

  const titleOf = (kind, it) =>
    it.title || it.name || (kind === "scenes" ? ("Сцена " + it.n) : it.id);

  // Canon entities a narrative/director item directly depends on.
  function wDependencies(item) {
    const out = [];
    CANON.forEach((t) => (item[t] || []).forEach((id) => out.push({ type: t, id })));
    return out;
  }

  // Transitive impact of changing a canon entity, grouped by layer & kind.
  // Memoised — WORLD is read-only at runtime, so (type:id) → result is stable.
  const _affCache = new Map();
  function wAffected(type, id) {
    const key = type + ":" + id;
    if (_affCache.has(key)) return _affCache.get(key);
    const r = _computeAffected(type, id);
    _affCache.set(key, r);
    return r;
  }
  function _computeAffected(type, id) {
    // Safe access to narrative/director layers (may not exist in canon-only WORLD)
    const scenes = WORLD.scenes || [];
    const dialogues = WORLD.dialogues || [];
    const arcs = WORLD.arcs || [];
    const chapters = WORLD.chapters || [];
    const shots = WORLD.shots || [];
    const storyboards = WORLD.storyboards || [];
    const images = WORLD.images || [];

    // Filter scenes by canonRefs (new linking system) with fallback to old system
    const sceneSet = new Set(scenes.filter((s) => {
      // Try new canonRefs first
      if (s.canonRefs && s.canonRefs[type]) {
        return s.canonRefs[type].includes(id);
      }
      // Fallback: old system (scene[type])
      return (s[type] || []).includes(id);
    }).map((s) => s.n));
    const refOr = (it) => (it[type] || []).includes(id);
    const inScene = (it) => sceneSet.has(it.scene);

    const affectedScenes = scenes.filter((s) => sceneSet.has(s.n));
    const affectedDialogues = dialogues.filter((d) => refOr(d) || inScene(d));
    const affectedArcs = arcs.filter((a) => refOr(a) || (a.scenes || []).some((n) => sceneSet.has(n)));
    const affectedChapters = chapters.filter((c) => (c.scenes || []).some((n) => sceneSet.has(n)));
    const affectedShots = shots.filter((sh) => refOr(sh) || inScene(sh));
    const shotSet = new Set(affectedShots.map((sh) => sh.id));
    const affectedStoryboards = storyboards.filter((sb) => sceneSet.has(sb.scene));
    const affectedImages = images.filter((im) => shotSet.has(im.shot));

    return {
      narrative: { arcs: affectedArcs, chapters: affectedChapters, scenes: affectedScenes, dialogues: affectedDialogues },
      director: { storyboards: affectedStoryboards, shots: affectedShots, images: affectedImages }
    };
  }

  // Flat counts + per-layer & grand totals.
  function wImpact(type, id) {
    const a = wAffected(type, id);
    const o = { byKind: {}, narrative: 0, director: 0, total: 0 };
    ["narrative", "director"].forEach((layer) => {
      Object.keys(a[layer]).forEach((kind) => {
        const n = a[layer][kind].length;
        o.byKind[kind] = n; o[layer] += n; o.total += n;
      });
    });
    return o;
  }

  // ── Change Analysis ──────────────────────────────────────────────────────
  // The KIND of change determines the reconstruction STRATEGY (and therefore
  // which affected kinds need work, and how). `verbs[kind]` = the action for
  // that kind; absent kind = the strategy skips it.
  const CHANGES = [
    { id: "rename", label: "Перейменування", icon: "edit", severity: "light", strategy: "Заміна тексту",
      desc: "Оновлюються лише текстові згадки сутності — без перегенерації.",
      verbs: { scenes: "Замінити згадки", dialogues: "Замінити згадки", shots: "Оновити підписи" } },
    { id: "property", label: "Зміна властивості", icon: "wand", severity: "medium", strategy: "Оновлення консистентності",
      desc: "Звіряються опис і візуальна відповідність у залежному контенті.",
      verbs: { scenes: "Звірити опис", dialogues: "Звірити репліки", storyboards: "Перевірити розкадровки", shots: "Оновити кадри", images: "Перерендерити зображення" } },
    { id: "relationship", label: "Зміна зв'язків", icon: "link", severity: "medium", strategy: "Реконструкція зв'язків",
      desc: "Перебудовуються взаємодії та арки, що залежать від зв'язку.",
      verbs: { arcs: "Перебудувати арки", scenes: "Переписати взаємодії", dialogues: "Переписати діалоги" } },
    { id: "add", label: "Додавання", icon: "plus", severity: "none", strategy: "Інтеграція",
      desc: "Нова сутність — наявний контент не зачіпається.",
      verbs: {} },
    { id: "remove", label: "Видалення", icon: "x", severity: "full", strategy: "Повна реконструкція залежностей",
      desc: "Усе, що залежить від сутності, потребує перебудови.",
      verbs: { chapters: "Перебудувати розділи", arcs: "Перебудувати арки", scenes: "Перебудувати сцени", dialogues: "Перебудувати діалоги", storyboards: "Перебудувати розкадровки", shots: "Перебудувати кадри", images: "Перерендерити зображення" } },
    { id: "rewrite", label: "Переписування канону", icon: "scroll", severity: "heavy", strategy: "Наративне переписування",
      desc: "Глибока регенерація наративу, потім режисерського шару.",
      verbs: { chapters: "Звірити розділи", arcs: "Звірити арки", scenes: "Перегенерувати сцени", dialogues: "Перегенерувати діалоги", storyboards: "Перебудувати розкадровки", shots: "Оновити кадри", images: "Перерендерити зображення" } },
  ];
  const SEVERITY = { none: { label: "—", tone: "done" }, light: { label: "Легка", tone: "ready" }, medium: { label: "Середня", tone: "review" }, heavy: { label: "Глибока", tone: "draft" }, full: { label: "Повна", tone: "draft" } };

  // Ordered regeneration plan, STRATEGY-AWARE: the change type filters which
  // affected kinds are regenerated and labels each action accordingly.
  // Narrative first, then Director.
  function wReconstructionPlan(type, id, changeId) {
    const change = CHANGES.find((c) => c.id === changeId) || CHANGES[1]; // default: property
    const a = wAffected(type, id);
    const ORDER = { narrative: ["chapters", "arcs", "scenes", "dialogues"], director: ["storyboards", "shots", "images"] };
    const steps = [];
    let n = 0;
    ["narrative", "director"].forEach((layer) => {
      ORDER[layer].forEach((kind) => {
        const items = a[layer][kind];
        if (!items.length) return;
        const verb = change.verbs[kind];
        if (!verb) return; // strategy excludes this kind
        steps.push({
          order: ++n, layer, kind, count: items.length,
          icon: KIND_ICON[kind], label: KIND_LABEL[kind], action: verb,
          items: items.map((it) => ({ id: it.id || it.n, title: titleOf(kind, it), scene: it.scene })),
          status: "pending",
        });
      });
    });
    return {
      change: { type, id, entity: wEnt(type, id) },
      changeType: change,
      severity: SEVERITY[change.severity],
      affected: wImpact(type, id),
      steps,
    };
  }

  window.WLAYERS = LAYERS;
  window.WCHANGES = CHANGES; window.WSEVERITY = SEVERITY;
  window.WKIND = { label: KIND_LABEL, icon: KIND_ICON, action: KIND_ACTION, titleOf };
  window.wDependencies = wDependencies;
  window.wAffected = wAffected;
  window.wImpact = wImpact;            // richer impact (overrides the simple one)
  window.wReconstructionPlan = wReconstructionPlan;
}());
