// 🎬 Director — scene text → production-ready shot breakdown.
// Buttons are live: add / edit / delete a shot, and "generate storyboard"
// (simulated render with a transient state). Local state only — the prototype's
// stand-in for the real generation pipeline.
const { useState: useDState } = React;

function CopyBtn({ text }) {
  const [done, setDone] = useDState(false);
  function copy() {
    navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {});
    setDone(true); setTimeout(() => setDone(false), 1600);
  }
  return (
    <button className="btn" onClick={copy}>
      {done ? <Ic.check /> : <Ic.copy />}{done ? "Скопійовано" : "Копіювати"}
    </button>
  );
}

function ShotCard({ s, onGenerate, onEdit, onDelete, onPick, onMoreVariant }) {
  const [busy, setBusy] = useDState(false);
  function generate() {
    if (busy || s.generated) return;
    setBusy(true);
    setTimeout(() => { setBusy(false); onGenerate(s.n); }, 1400);
  }
  return (
    <div className="card shot">
      <div className="shot__bar">
        <span className="grip"><i /><i /><i /></span>
        <span className="shot__no">SHOT {s.n}</span>
        <span className="shot__type">{s.type}</span>
        <span className="chip"><Ic.clock style={{ width: 13, height: 13 }} />{s.dur}</span>
        <span className="shot__moods">
          {s.moods.map((m) => <span key={m} className="chip chip--mood">{m}</span>)}
        </span>
        <span className="shot__acts">
          <button className="ibtn" title="Редагувати об'єкт кадру" onClick={() => onEdit(s.n)}><Ic.edit /></button>
          <button className="ibtn" title="Видалити кадр" onClick={() => onDelete(s.n)}><Ic.plus style={{ transform: "rotate(45deg)" }} /></button>
        </span>
      </div>

      <div className="shot__body">
        <div className="shot__sb">
          <div className="frame" style={s.img ? { backgroundImage: `url(${s.img})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
            <span className="frame__tag">16:9</span>
            {busy ? (
              <div className="frame__c" style={{ color: "var(--gold-lit)" }}>
                <span className="spin-ring" /><span className="frame__lbl">генерується…</span>
              </div>
            ) : s.img ? null : s.generated ? (
              <div className="frame__c" style={{ color: "var(--st-ready)" }}>
                <Ic.check /><span className="frame__lbl">варіант {(s.sel || 0) + 1} обрано</span>
              </div>
            ) : (
              <div className="frame__c"><Ic.camera /><span className="frame__lbl">не згенеровано</span></div>
            )}
          </div>
          {s.generated && (
            <div className="varstrip">
              {Array.from({ length: s.variants || 3 }, (_, i) => (
                <button key={i} className={`varthumb ${(s.sel || 0) === i ? "is-sel" : ""}`} title={"Варіант " + (i + 1)}
                  onClick={() => onPick(s.n, i)}><span className="varthumb__n">{i + 1}</span></button>
              ))}
              {(s.variants || 3) < 5 && (
                <button className="varthumb varthumb--add" title="Згенерувати ще варіант" onClick={() => onMoreVariant(s.n)}><Ic.plus /></button>
              )}
            </div>
          )}
        </div>

        <div className="shot__detail">
          <div className="kv">
            <div className="kv__row"><span>Камера</span><b>{s.camera}</b></div>
            <div className="kv__row"><span>Ракурс</span><b>{s.angle}</b></div>
            <div className="kv__row"><span>Об'єкт</span><b>{s.subject}</b></div>
            <div className="kv__row"><span>Світло</span><b>{s.light}</b></div>
          </div>

          <div className="prompt">
            <div className="prompt__head">
              <span className="prompt__lbl"><Ic.wand style={{ width: 13, height: 13 }} /> Midjourney prompt</span>
            </div>
            <p className="prompt__txt mono">{s.prompt}</p>
            <div className="prompt__acts">
              <CopyBtn text={s.prompt} />
              <button className="btn btn--gold" onClick={generate} disabled={busy || s.generated}>
                <Ic.sparkle />{s.generated ? "Перемалювати" : busy ? "Малюю…" : "Намалювати кадр"}
              </button>
            </div>
          </div>
          {s.dialogue && s.dialogue.length ? (
            <div className="shot__dlglist">
              <div className="shot__dlg__tag">🗨 діалог · {s.dialogue.length}</div>
              {s.dialogue.map((d, i) => (
                <div className="shot__dlg" key={i}>
                  <span className="shot__dlg__who">{d.speaker || "—"}</span>
                  <span className="shot__dlg__line">«{d.line}»</span>
                  <span className="shot__dlg__dur mono">~{Math.max(1, Math.round((d.line || "").length / 14))}с</span>
                </div>
              ))}
              <button className="shot__dlg--more" onClick={() => onEdit(s.n)}>＋ ще репліка / редагувати</button>
            </div>
          ) : (
            <button className="shot__dlg shot__dlg--add" onClick={() => onEdit(s.n)}>🗨 Додати репліку персонажа до цього кадру</button>
          )}
        </div>
      </div>
    </div>
  );
}
// Project WORLD.shots for a given scene into the Director's shot-card shape.
let _shotSeq = 100;
function shotsForScene(n) {
  return WORLD.shots.filter((sh) => sh.scene === n).map((sh, i) => ({
    n: i + 1, type: sh.type, dur: sh.dur, camera: sh.camera, angle: sh.angle,
    subject: sh.subject, light: sh.light, moods: sh.moods || [], prompt: sh.prompt, generated: !!sh.generated,
    dialogue: sh.dialogue || null,
  }));
}
function DirectorTab({ scene }) {
  const sc = scene != null ? scene : DATA.scene.n;
  const meta = WORLD.scenes.find((s) => s.n === sc) || DATA.scene;
  const [shots, setShots] = useDState(() => shotsForScene(sc));
  const [calc, setCalc] = useDState(false);

  // Estimate shot count from the scene's canon weight, then lay out that many panels.
  function calcShots() {
    if (calc) return;
    const s = WORLD.scenes.find((x) => x.n === sc) || {};
    const links = (s.characters || []).length + (s.locations || []).length + (s.events || []).length;
    const est = Math.max(3, Math.min(10, 2 + links + (s.act === 3 ? 1 : 0)));
    setCalc(true);
    setTimeout(() => {
      setShots(Array.from({ length: est }, (_, i) => ({
        n: i + 1, type: "Кадр " + (i + 1), dur: "—", camera: "—", angle: "—",
        subject: "Опиши об'єкт кадру", light: "—", moods: [], generated: false, prompt: "—", _id: ++_shotSeq,
      })));
      setCalc(false);
    }, 1300);
  }
  React.useEffect(() => { window.__dirCalc = calcShots; });

  function addShot() {
    setShots((cur) => {
      const n = (cur.length ? Math.max.apply(null, cur.map((s) => s.n)) : 0) + 1;
      return cur.concat({
        n, type: "Новий кадр", dur: "—", camera: "—", angle: "—",
        subject: "Опиши об'єкт кадру", light: "—", moods: [], generated: false,
        prompt: "—", _id: ++_shotSeq,
      });
    });
  }
  function genShot(n) { setShots((cur) => cur.map((s) => s.n === n ? { ...s, generated: true, variants: 3, sel: 0 } : s)); }
  function pickVariant(n, i) { setShots((cur) => cur.map((s) => s.n === n ? { ...s, sel: i } : s)); }
  function moreVariant(n) { setShots((cur) => cur.map((s) => s.n === n ? { ...s, variants: Math.min(5, (s.variants || 3) + 1) } : s)); }
  function delShot(n) { setShots((cur) => cur.filter((s) => s.n !== n)); }
  const [editShotN, setEditShotN] = useDState(null);
  function editShot(n) { setEditShotN(n); }
  function saveShotEdit(patch) {
    setShots((cur) => cur.map((s) => s.n === editShotN ? { ...s, ...patch } : s));
    setEditShotN(null);
  }
  const editing = shots.find((s) => s.n === editShotN) || null;

  const ready = shots.filter((s) => s.generated).length;
  return (
    <div className="page">
      <div className="phead">
        <div className="phead__l">
          <span className="phead__kick">Сцена {meta.n} · {meta.title}</span>
          <h1>Розкадровка</h1>
          <span className="phead__sub">{shots.length} кадри · готових storyboard: {ready}</span>
        </div>
        <button className="btn btn--gold" onClick={addShot}><Ic.plus />Додати кадр</button>
      </div>
      <div className="pdiv" />

      <div className="shot-list">
        {shots.map((s) => <ShotCard key={s._id || s.n} s={s} onGenerate={genShot} onEdit={editShot} onDelete={delShot} onPick={pickVariant} onMoreVariant={moreVariant} />)}
        {shots.length === 0 && (
          <div className="ws-empty" style={{ padding: "80px 20px", textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🎬</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "var(--tx)" }}>Розкадровка порожня</div>
            <div style={{ color: "var(--tx-mid)", marginBottom: 24 }}>
              Натисніть <strong>«Розрахувати кадри»</strong> у топбарі, щоб AI розбив текст сцени на візуальні кадри.
            </div>
            <button className="btn" onClick={addShot}><Ic.plus />Або додайте кадр вручну</button>
          </div>
        )}
        {shots.length > 0 && <button className="btn btn--add" onClick={addShot}><Ic.plus />Додати кадр</button>}
      </div>

      {editing && <ShotEditor shot={editing} onSave={saveShotEdit} onClose={() => setEditShotN(null)} />}
    </div>
  );
}

// Styled in-app shot editor — replaces window.prompt.
function ShotEditor({ shot, onSave, onClose }) {
  const initLines = Array.isArray(shot.dialogue) ? shot.dialogue.map((d) => ({ ...d })) : [];
  const [f, setF] = useDState({ subject: shot.subject, type: shot.type, camera: shot.camera, angle: shot.angle, light: shot.light, dur: shot.dur, img: shot.img || null });
  const [lines, setLines] = useDState(initLines);
  React.useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const set = (key) => (e) => setF((p) => ({ ...p, [key]: e.target.value }));
  const setLine = (i, key) => (e) => setLines((cur) => cur.map((d, j) => j === i ? { ...d, [key]: e.target.value } : d));
  const addLine = () => setLines((cur) => cur.concat({ speaker: "", line: "", emotion: "" }));
  const delLine = (i) => setLines((cur) => cur.filter((_, j) => j !== i));
  function onPick(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const rd = new FileReader(); rd.onload = () => setF((p) => ({ ...p, img: rd.result })); rd.readAsDataURL(file);
  }
  const totalDur = lines.reduce((a, d) => a + Math.max(1, Math.round((d.line || "").length / 14)), 0);
  return (
    <div className="shotmodal" onClick={onClose}>
      <div className="shotmodal__card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Редагувати кадр">
        <div className="shotmodal__head">
          <div><div className="shotmodal__k">Кадр {shot.n}</div><div className="shotmodal__t">Редагувати кадр</div></div>
          <button className="shotmodal__x" onClick={onClose} aria-label="Закрити"><Ic.x /></button>
        </div>
        <label className="sm-field"><span>Зображення кадру</span>
          <div className="sm-img" style={f.img ? { backgroundImage: `url(${f.img})` } : undefined}>
            {!f.img && <span className="sm-img__ph"><Ic.camera />Своє зображення кадру</span>}
            <label className="sm-img__btn">{f.img ? "Замінити" : "Завантажити"}<input type="file" accept="image/*" style={{ display: "none" }} onChange={onPick} /></label>
            {f.img && <button className="sm-img__del" type="button" onClick={() => setF((p) => ({ ...p, img: null }))}>Прибрати</button>}
          </div>
        </label>
        <label className="sm-field"><span>Об'єкт кадру</span>
          <textarea rows={2} value={f.subject} onChange={set("subject")} /></label>
        <div className="sm-two">
          <label className="sm-field"><span>Тип</span><input value={f.type} onChange={set("type")} /></label>
          <label className="sm-field"><span>Тривалість</span><input value={f.dur} onChange={set("dur")} /></label>
        </div>
        <div className="sm-two">
          <label className="sm-field"><span>Камера</span><input value={f.camera} onChange={set("camera")} /></label>
          <label className="sm-field"><span>Ракурс</span><input value={f.angle} onChange={set("angle")} /></label>
        </div>
        <label className="sm-field"><span>Світло</span><input value={f.light} onChange={set("light")} /></label>
        <div className="sm-dlg">
          <div className="sm-dlg__h">🗨 Репліки в кадрі <span className="sm-dlg__hint">по черзі — для озвучки й ліпсінку</span></div>
          {lines.length === 0 && <div className="sm-dlg__empty">Кадр без діалогу. Додай репліку, якщо персонажі говорять.</div>}
          {lines.map((d, i) => (
            <div className="sm-dlgrow" key={i}>
              <div className="sm-dlgrow__head">
                <span className="sm-dlgrow__n">{i + 1}</span>
                <button className="sm-dlgrow__del" type="button" onClick={() => delLine(i)} aria-label="Прибрати репліку"><Ic.x /></button>
              </div>
              <div className="sm-two">
                <label className="sm-field"><span>Хто говорить</span><input value={d.speaker} onChange={setLine(i, "speaker")} placeholder="Елена" /></label>
                <label className="sm-field"><span>Емоція / тон</span><input value={d.emotion} onChange={setLine(i, "emotion")} placeholder="пошепки, зі страхом" /></label>
              </div>
              <label className="sm-field"><span>Репліка</span>
                <textarea rows={2} value={d.line} onChange={setLine(i, "line")} placeholder="Що каже персонаж…" /></label>
            </div>
          ))}
          <button className="sm-dlg__add" type="button" onClick={addLine}>＋ Додати репліку</button>
          {lines.some((d) => (d.line || "").trim()) && <div className="sm-dlg__dur mono">разом ~{totalDur}с озвучки · кадр триватиме стільки ж</div>}
        </div>
        <div className="sm-foot">
          <button className="btn" onClick={onClose}>Скасувати</button>
          <button className="btn btn--gold" onClick={() => onSave({ subject: f.subject, type: f.type, camera: f.camera, angle: f.angle, light: f.light, dur: f.dur, img: f.img, dialogue: lines.filter((d) => (d.line || "").trim()).map((d) => ({ speaker: d.speaker, line: d.line.trim(), emotion: d.emotion })) })}><Ic.check />Зберегти</button>
        </div>
      </div>
    </div>
  );
}

window.DirectorTab = DirectorTab;
