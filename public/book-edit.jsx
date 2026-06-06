// Inline scene editing → canon proposal cycle (the Narrative→Canon bridge).
// The user edits the scene text directly; the Keeper runs a light extraction
// pass and reacts: NEW capitalized entities become inferred-canon proposals,
// and mentions that contradict known canon raise a continuity warning. Nothing
// silently becomes truth — the user confirms, and only then does "impact" show.
(function () {
  const { useState: useEdState, useRef: useEdRef, useEffect: useEdEffect } = React;

  // Known canon of this universe (stand-in for WORLD inside the book).
  const KNOWN = {
    "Елена": { type: "Персонаж", dead: false },
    "Оракул": { type: "Персонаж", dead: false },
    "Орелія": { type: "Локація", dead: false },
    "Маркус": { type: "Персонаж", dead: true },   // already fell — speaking = contradiction
  };
  const STOP = new Set(["Коли","Воно","Він","Вона","Десь","Щоб","Тут","Місто","І","А","Та","Але","Бо","Як","Це","Раптом","Потім","Тоді","Нарешті","Зненацька","Проте","Однак","Тепер","Вже","Ось","Поруч","Раніше","Пізніше","Можливо","Здавалося","Так","Ні","Сталася","Стався","Сталось","Прийшов","Прийшла","Велика","Великий","Велике","За","На","У","В","До","Із","Зі","Над","Під"]);

  // Extract capitalized tokens; classify as known / new / contradiction.
  function analyze(text) {
    const tokens = (text.match(/[А-ЯЇІЄҐ][а-яїієґ’']+/g) || []);
    const seen = new Set();
    const news = [], conflicts = [];
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
