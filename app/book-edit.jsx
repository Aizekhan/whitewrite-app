// Inline scene editing → canon proposal cycle (the Narrative→Canon bridge).
// The user edits the scene text directly; the Keeper runs a light extraction
// pass and reacts: NEW capitalized entities become inferred-canon proposals,
// and mentions that contradict known canon raise a continuity warning. Nothing
// silently becomes truth — the user confirms, and only then does "impact" show.
(function () {
  const { useState: useEdState, useRef: useEdRef, useEffect: useEdEffect } = React;

  // Known canon of this universe — derived from the shared WORLD (loaded by book.jsx).
  // Keyed by full name and first word (tokens below are single capitalized words).
  const DEAD_RE = /dead|deceased|killed|мертв|загин|помер|вбит/i;
  function knownCanon() {
    const W = window.WORLD || {};
    const known = {};
    ["characters", "locations", "events", "factions", "artifacts"].forEach((kind) => {
      (W[kind] || []).forEach((e) => {
        const name = (e.name || e.title || "").trim();
        if (!name) return;
        const info = { type: kind, dead: kind === "characters" && DEAD_RE.test(String(e.status || "")) };
        known[name] = info;
        const first = name.split(/\s+/)[0];
        known[first] = known[first] || info;
      });
    });
    return known;
  }
  const STOP = new Set(["Коли","Воно","Він","Вона","Десь","Щоб","Тут","Місто","І","А","Та","Але","Бо","Як","Це","Раптом","Потім","Тоді","Нарешті","Зненацька","Проте","Однак","Тепер","Вже","Ось","Поруч","Раніше","Пізніше","Можливо","Здавалося","Так","Ні","Сталася","Стався","Сталось","Прийшов","Прийшла","Велика","Великий","Велике","За","На","У","В","До","Із","Зі","Над","Під"]);

  // Extract capitalized tokens; classify as known / new / contradiction.
  function analyze(text) {
    const tokens = (text.match(/[А-ЯЇІЄҐ][а-яїієґ’']+/g) || []);
    const seen = new Set();
    const news = [], conflicts = [];
    const KNOWN = knownCanon();
    tokens.forEach((w) => {
      if (STOP.has(w) || seen.has(w)) return; seen.add(w);
      if (KNOWN[w]) { if (KNOWN[w].dead) conflicts.push(w); }
      else if (w.length > 2) news.push(w);
    });
    return { news: news.slice(0, 3), conflicts };
  }

  function SceneEditor() {
    const initial = "Оракул чекав на неї там, де закінчувалися мапи. Елена зрозуміла ціну раніше, ніж він договорив.";
    const [text, setText] = useEdState(initial);
    const [proposal, setProposal] = useEdState(null); // {news:[{name,type}], conflicts:[]}
    const [confirmed, setConfirmed] = useEdState([]);  // names promoted to canon
    const [coach, setCoach] = useEdState(() => { try { return !localStorage.getItem("ww_edit_seen"); } catch (e) { return true; } });
    const ref = useEdRef(null);
    const [editMode, setEditMode] = useEdState(false);
    const [pages, setPages] = useEdState(null); // null = single; [..] = paginated leaves
    const [pgIdx, setPgIdx] = useEdState(0);
    // text frozen into the editable box while typing — keeps the caret stable
    const editStart = useEdRef(initial);

    // split `full` into page-sized chunks measured against a known leaf height
    function paginate(full, cap) {
      const el = ref.current; if (!el) { return; }
      if (!cap || cap < 120) { setPages(null); setPgIdx(0); return; } // bad measure → keep single
      const probe = document.createElement("div");
      probe.className = "se-prose";
      probe.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:0;";
      probe.style.width = el.clientWidth + "px";
      probe.style.height = "auto";
      el.parentNode.appendChild(probe);
      probe.innerText = full;
      if (probe.scrollHeight <= cap + 2) { probe.remove(); setPages(null); setPgIdx(0); return; }
      const words = full.split(/\s+/);
      const out = []; let cur = "";
      for (let i = 0; i < words.length; i++) {
        const next = cur ? cur + " " + words[i] : words[i];
        probe.innerText = next;
        if (probe.scrollHeight > cap && cur) { out.push(cur); cur = words[i]; }
        else cur = next;
      }
      if (cur) out.push(cur);
      probe.remove();
      setPages(out); setPgIdx(0);
    }

    useEdEffect(() => {
      const h = (e) => {
        const on = !!(e.detail);
        if (on) {
          // entering edit: load the FULL text into the box (join paginated leaves)
          editStart.current = pages ? pages.join(" ") : text;
          setPages(null); setPgIdx(0);
          setEditMode(true);
        } else {
          // leaving edit: capture text AND the real leaf height before React swaps the box
          const full = ref.current ? ref.current.innerText : text;
          const cap = ref.current ? ref.current.clientHeight : 0;
          setText(full);
          const { news, conflicts } = analyze(full);
          const fresh = news.filter((n) => !confirmed.includes(n)).map((n) => ({ name: n, type: "Персонаж" }));
          setProposal((fresh.length || conflicts.length) ? { news: fresh, conflicts } : null);
          setEditMode(false);
          setTimeout(() => paginate(full, cap), 30);
        }
      };
      window.addEventListener("ww-editmode", h);
      window.__wwEditMode = editMode;
      return () => window.removeEventListener("ww-editmode", h);
    });

    function dismissCoach() { setCoach(false); try { localStorage.setItem("ww_edit_seen", "1"); } catch (e) {} }
    function onInput() { setText(ref.current ? ref.current.innerText : ""); }
    function setType(name, type) {
      setProposal((p) => ({ ...p, news: p.news.map((e) => e.name === name ? { ...e, type } : e) }));
    }
    function confirm(name) {
      setConfirmed((c) => c.concat(name));
      setProposal((p) => {
        const news = p.news.filter((e) => e.name !== name);
        return (news.length || p.conflicts.length) ? { ...p, news } : null;
      });
    }
    function dismiss() { setProposal(null); }

    const TYPES = ["Персонаж", "Локація", "Подія"];
    // what the box shows: a frozen string while editing (stable caret), else current leaf / text
    const shown = editMode ? editStart.current : (pages ? (pages[pgIdx] || "") : text);

    return (
      <div className="page-inner">
        <PageHeader kicker="Розділ перший · чернетка" title="Жертва Оракула" />
        <p className="se-hint"><span className="se-hint__pen">✎</span> {editMode ? "Режим редагування увімкнено — перепиши будь-що." : "Натисни «Редагувати» внизу, щоб змінювати текст."}</p>
        <div
          className={`se-prose ${editMode ? "is-editing" : ""}`}
          ref={ref}
          contentEditable={editMode}
          suppressContentEditableWarning
          onInput={onInput}
        >{shown}</div>
        {pages && !editMode && pages.length > 1 && (
          <div className="se-pages">
            <button className="se-pages__b" disabled={pgIdx === 0} onClick={() => setPgIdx((i) => Math.max(0, i - 1))}>‹</button>
            <span className="se-pages__n">аркуш {pgIdx + 1} / {pages.length}</span>
            <button className="se-pages__b" disabled={pgIdx === pages.length - 1} onClick={() => setPgIdx((i) => Math.min(pages.length - 1, i + 1))}>›</button>
          </div>
        )}

        <button className="se-edittoggle" type="button" hidden>
          {editMode ? "✓" : "✎"}
        </button>

        {coach && (
          <div className="se-coach">
            <div className="se-coach__t">✶ Пиши вільно — світ підлаштується сам</div>
            <div className="se-coach__d">Додай у текст нове ім’я чи місце. Хранитель помітить і запитає, чи додати це у твій світ. Нічого не зміниться без твого «так».</div>
            <button className="se-coach__btn" onClick={dismissCoach}>Зрозуміло</button>
          </div>
        )}

        {confirmed.length > 0 && (
          <div className="se-added">
            <span className="se-added__k">У твоєму світі:</span>
            {confirmed.map((n) => <span className="se-added__chip" key={n}>✦ {n}</span>)}
          </div>
        )}

        {proposal && (
          <div className="se-keeper" role="dialog" aria-label="Хранитель помітив зміни">
            <div className="se-keeper__head"><span className="se-keeper__sig">✶</span> Хранитель помітив</div>

            {proposal.news.map((e) => (
              <div className="se-prop" key={e.name}>
                <div className="se-prop__t">У тексті з’явився(лась) <b>{e.name}</b></div>
                <div className="se-prop__d">Цього ще немає у твоєму світі. Додати — і AI памʼятатиме про це в наступних сценах.</div>
                <div className="se-prop__types">
                  {TYPES.map((t) => (
                    <button key={t} className={`se-type ${e.type === t ? "is-on" : ""}`} onClick={() => setType(e.name, t)}>{t}</button>
                  ))}
                </div>
                <div className="se-prop__acts">
                  <button className="se-btn se-btn--ok" onClick={() => confirm(e.name)}>✦ Додати у світ</button>
                  <button className="se-btn" onClick={dismiss}>Лишити тільки в тексті</button>
                </div>
              </div>
            ))}

            {proposal.conflicts.map((n) => (
              <div className="se-prop se-prop--warn" key={n}>
                <div className="se-prop__t">⚠ Так не може бути — <b>{n}</b></div>
                <div className="se-prop__d">За твоїм світом {n} загинув раніше, тож тут його не повинно бути. Це зачепить ще <b>2 сцени</b>.</div>
                <div className="se-prop__acts">
                  <button className="se-btn se-btn--warn" onClick={dismiss}>Це нова правда — змінити світ</button>
                  <button className="se-btn" onClick={dismiss}>Відкотити правку</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Folio n="2" />
      </div>);
  }

  window.SceneEditor = SceneEditor;
}());

// ---------- The writing sheet: free writing or pasting a scene, saved as you type ----------
// Opens over the book from ✎ (this scene) or ＋ (a new one). Plain text: paragraphs are separated by line breaks;
// the book lays them into pages by measuring (book.jsx paginateScene). Autosave → projects/{p}/scenes/{id} { title, text }.
(function () {
  const { useState, useEffect, useRef } = React;
  const tt = (k) => (window.__i18n ? window.__i18n.t(k) : k);
  function SceneSheet({ projectId, scene, fresh, onClose }) {
    const [title, setTitle] = useState(scene.title || "");
    const [text, setText] = useState(scene.text || "");
    const [state, setState] = useState("saved"); // saved | dirty | saving | error
    const timer = useRef(null), last = useRef({ title: scene.title || "", text: scene.text || "" }), area = useRef(null);
    const save = async (v) => {
      if (v.title === last.current.title && v.text === last.current.text) { setState("saved"); return; }
      setState("saving");
      try {
        await window.__firebaseScenes.updateScene(projectId, scene.id, { title: v.title, text: v.text, status: "draft" });
        last.current = v; setState("saved");
      } catch (e) { console.error("[SceneSheet] save failed", e); setState("error"); }
    };
    const change = (v) => { setState("dirty"); clearTimeout(timer.current); timer.current = setTimeout(() => save(v), 900); };
    useEffect(() => { if (area.current) { area.current.focus(); area.current.setSelectionRange(text.length, text.length); } }, []);
    const close = async () => {
      clearTimeout(timer.current);
      const v = { title: title.trim() || scene.title || "", text };
      if (fresh && !text.trim()) { // an untouched new scene leaves no trace
        try {
          const db = window.__firebase.db;
          await db.collection("projects").doc(projectId).collection("scenes").doc(scene.id).delete();
          await db.collection("projects").doc(projectId).update({ written: firebase.firestore.FieldValue.increment(-1) });
        } catch (e) { console.warn("[SceneSheet] cleanup", e); }
        onClose(null); return;
      }
      await save(v);
      onClose(scene.id);
    };
    useEffect(() => {
      const k = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
        if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); clearTimeout(timer.current); save({ title, text }); }
      };
      window.addEventListener("keydown", k, true);
      return () => window.removeEventListener("keydown", k, true);
    });
    const words = (text.match(/\S+/g) || []).length;
    // ✦ Порадити: functions/src/canon-sync.js analyzeScene — improve / canon conflicts / unclear + quick fixes (paid, confirmed first)
    const [adv, setAdv] = useState(null); // null | { ask } | { busy } | { error } | { data }
    const cost = (window.__TOKEN_COSTS && window.__TOKEN_COSTS.analyzeScene) || 50;
    const plan = window.__wwUser && window.__wwUser.plan;
    const allowed = !!(window.__getPlanConfig && plan && window.__getPlanConfig(plan).allowAnalyze);
    const advise = async () => {
      setAdv({ busy: true });
      try {
        const token = await firebase.auth().currentUser.getIdToken();
        const r = await fetch("https://us-central1-whitewrite-app.cloudfunctions.net/analyzeScene", { method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ projectId, sceneText: text, title, lang: window.__i18n ? window.__i18n.getLanguage() : "uk" }) });
        const d = await r.json().catch(() => ({ error: "HTTP " + r.status }));
        if (!r.ok || !d.analysis) throw new Error(d.error || "HTTP " + r.status);
        if (window.__wwUser && d.tokensConsumed) {
          window.__wwUser.tokensUsed = (window.__wwUser.tokensUsed || 0) + d.tokensConsumed;
          window.__wwUser.tokensRemaining = d.tokensRemaining;
          const showToast = (() => { try { return window.parent.__showTokenToast || window.__showTokenToast; } catch (e) { return window.__showTokenToast; } })(); // the toast lives in the shell (White.html), this runs in the book iframe
          if (typeof showToast === "function") showToast(d.tokensConsumed, d.tokensRemaining);
          if (typeof window.__syncDockAvatar === "function") window.__syncDockAvatar();
        }
        setAdv({ data: d.analysis, spent: d.tokensConsumed });
      } catch (e) { setAdv({ error: e.message }); }
    };
    const applyFix = (f) => {
      if (!f.original || text.indexOf(f.original) < 0) return;
      const v = text.replace(f.original, f.suggested || ""); setText(v); change({ title, text: v });
      setAdv((a) => ({ ...a, data: { ...a.data, fixes: a.data.fixes.filter((x) => x !== f) } }));
    };
    const list = (items, render) => (items && items.length ? <ul className="adv__list">{items.map(render)}</ul> : <p className="adv__none">{tt('book.adv.none')}</p>);
    return (
      <div className={"sheet" + (adv ? " sheet--adv" : "")} role="dialog" aria-modal="true" aria-label={tt('book.sheetTitle')}>
        <div className="sheet__paper">
          <div className="sheet__kicker">{tt('book.scene')} {scene.n} · {tt('book.sheetTitle')}</div>
          <input className="sheet__title" value={title} placeholder={tt('book.sheetTitlePh')}
            onChange={(e) => { setTitle(e.target.value); change({ title: e.target.value, text }); }} />
          <textarea ref={area} className="sheet__text" value={text} placeholder={tt('book.sheetPh')} spellCheck="true"
            onChange={(e) => { setText(e.target.value); change({ title, text: e.target.value }); }} />
          <div className="sheet__foot">
            <span className={"sheet__state is-" + state}>{tt('book.sheet.' + state)}</span>
            <span className="sheet__count">{words} {tt('book.words')}</span>
            <span style={{ flex: 1 }} />
            <button className="sheet__adv" type="button" disabled={!text.trim() || !!(adv && adv.busy)} onClick={() => setAdv({ ask: true })}
              title={tt('book.adv.tip').replace('{n}', cost)}>✦ {tt('book.adv.btn')} <span className="sheet__cost">{cost}</span></button>
            <button className="sheet__done" type="button" onClick={close}>{tt('book.sheetDone')}</button>
          </div>
        </div>
        {adv && (
          <aside className="adv" aria-live="polite">
            <div className="adv__head"><b>✦ {tt('book.adv.title')}</b><button className="adv__x" type="button" aria-label={tt('ui.close')} onClick={() => setAdv(null)}>✕</button></div>
            {adv.ask && (allowed ? (
              <div className="adv__ask">
                <p>{tt('book.adv.ask').replace('{n}', cost)}</p>
                <div className="adv__row"><button className="sheet__done" type="button" onClick={advise}>{tt('book.adv.go')}</button><button className="adv__btn" type="button" onClick={() => setAdv(null)}>{tt('book.adv.cancel')}</button></div>
              </div>
            ) : <p className="adv__note">{tt('book.adv.plan')}</p>)}
            {adv.busy && <p className="adv__note">{tt('book.adv.busy')}</p>}
            {adv.error && <p className="adv__note is-error">{adv.error}</p>}
            {adv.data && (
              <div className="adv__body">
                {adv.data.summary && <p className="adv__sum">{adv.data.summary}</p>}
                <h4>{tt('book.adv.improve')}</h4>
                {list(adv.data.improve, (x, i) => <li key={i}><b>{x.what}</b>{x.why && <span> — {x.why}</span>}{x.quote && <q>{x.quote}</q>}</li>)}
                <h4>{tt('book.adv.canon')}</h4>
                {list(adv.data.canon, (x, i) => <li key={i} className="is-canon"><q>{x.quote}</q><span>{x.conflict}</span>{x.fact && <i>{x.fact}</i>}</li>)}
                <h4>{tt('book.adv.unclear')}</h4>
                {list(adv.data.unclear, (x, i) => <li key={i}><q>{x.quote}</q><span>{x.question}</span></li>)}
                {adv.data.fixes && adv.data.fixes.length > 0 && <h4>{tt('book.adv.fixes')}</h4>}
                {adv.data.fixes && adv.data.fixes.length > 0 && <ul className="adv__list">{adv.data.fixes.map((f, i) => (
                  <li key={i} className="adv__fix"><del>{f.original}</del><ins>{f.suggested}</ins>{f.reason && <span>{f.reason}</span>}
                    {text.indexOf(f.original) >= 0 && <button className="adv__btn" type="button" onClick={() => applyFix(f)}>{tt('book.adv.apply')}</button>}</li>))}</ul>}
                {adv.spent != null && <p className="adv__spent">−{adv.spent} {tt('book.adv.tokens')}</p>}
              </div>
            )}
          </aside>
        )}
      </div>
    );
  }
  window.SceneSheet = SceneSheet;
}());
