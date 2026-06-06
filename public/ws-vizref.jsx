// 🎨 Visual Canon — the Director's OWN take on characters & locations:
// NOT canon profiles (that's the World Tree) but VISUAL CONSISTENCY assets —
// reference images + per-entity LoRA status, so a character/location looks the
// same across every shot and every episode of the series.
const { useState: useVkState } = React;

// LoRA / reference readiness — derived deterministically from canon role.
function vkModel(type, e) {
  if (type === "characters") {
    if (e.roleType === "lead" || e.roleType === "anta") return { st: "ready", refs: 8 };
    if (e.roleType === "support") return { st: "review", refs: 4 };
    return { st: "draft", refs: 1 };
  }
  if (e.cur) return { st: "ready", refs: 6 };
  return { st: (e.scenes && e.scenes.length > 1) ? "review" : "draft", refs: (e.scenes ? e.scenes.length : 1) };
}
const VK_ST = {
  ready: { label: "LoRA навчено", pill: "ready" },
  review: { label: "Збір референсів", pill: "review" },
  draft: { label: "Немає референсів", pill: "draft" },
};
// per-entity visual anchor notes (what must stay consistent)
const VK_NOTE = {
  marcus: "Помаранчевий скафандр, шрам на лівій щоці, втомлений погляд.",
  elena: "Коротке темне волосся, технічний комбінезон, окуляри-HUD.",
  orion: "Лише голос — візуалізувати як абстрактну хвилю/сяйво.",
  brandt: "Холодний костюм «Геліос», сиві скроні, без емоцій.",
  beta7: "Червоний пил, аварійне світло, іржаві панелі коридорів.",
  alpha: "Висока антена-ретранслятор, холодне синє сяйво консолей.",
};
const vkChars = ["фас", "¾", "профіль", "емоції"];
const vkLocs = ["загальний", "деталь", "освітлення", "ніч"];
const VK_TARGET = 20, VK_MAX = 50, VK_MIN = 3, VK_GOOD = 15;

function VkCard({ type, e }) {
  const title = wTitle(type, e);
  const [busy, setBusy] = useVkState(false);
  const [genning, setGenning] = useVkState(false);
  const [refs, setRefs] = useVkState(0);        // references gathered (gen or upload)
  const [trained, setTrained] = useVkState(false);
  const [mng, setMng] = useVkState(false);
  const [pending, setPending] = useVkState(0);
  const angles = type === "characters" ? vkChars : vkLocs;
  const enough = refs >= VK_MIN;
  const tier = refs >= VK_GOOD ? "good" : refs >= VK_MIN ? "draft" : "none";
  const st = trained ? VK_ST.ready : (refs > 0 ? VK_ST.review : VK_ST.draft);
  const note = VK_NOTE[e.id] || (type === "characters" ? "Зафіксувати силует, костюм і кольори." : "Зафіксувати палітру, світло й ключові деталі.");
  const shape = type === "characters" ? "rounded" : "rect";
  function genRefs() {
    if (genning || refs >= VK_MAX) return;
    setGenning(true);
    setTimeout(() => { setGenning(false); setPending(Math.min(VK_MAX - refs, 8)); }, 1400);
  }
  function acceptPending() { setRefs((r) => Math.min(VK_MAX, r + pending)); setPending(0); }
  function discardPending() { setPending(0); }
  function train() {
    if (busy || !enough) return;
    setBusy(true);
    setTimeout(() => { setBusy(false); setTrained(true); }, 1600);
  }
  const pct = Math.min(100, Math.round((refs / VK_TARGET) * 100));
  const hint = trained ? "✦ LoRA навчено — зовнішність триматиметься між кадрами."
    : tier === "good" ? "Якісний набір — модель буде стабільною."
    : tier === "draft" ? `Чернетковий LoRA. Для якісного — ціль ${VK_GOOD}–${VK_TARGET} референсів.`
    : `Потрібно ≥${VK_MIN} референси (оптимум ~${VK_TARGET}): згенеруй із канону або перетягни свої.`;
  return (
    <article className="vk">
      <div className="vk__main" style={{ backgroundImage: `url(assets/ph-${type}.png)`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <image-slot id={`vk-${type}-${e.id}`} class="vk__hero" shape={shape} placeholder=""></image-slot>
        <span className={`pill pill--${st.pill} vk__model`}><Ic.cpu style={{ width: 12, height: 12 }} />{st.label}</span>
      </div>
      <div className="vk__b">
        <div className="vk__row">
          <span className="vk__name">{title}</span>
          <span className="vk__refs mono">{refs} / {VK_TARGET}{refs >= VK_TARGET ? "+" : ""}</span>
        </div>
        <div className="vk__bar"><div className={`vk__barfill is-${tier}`} style={{ width: pct + "%" }} /></div>
        <div className="vk__angles">
          {angles.map((a, i) => (
            <div className="vk__angle" key={a}>
              <image-slot id={`vk-${type}-${e.id}-${i}`} class={`vk__anglefill ${refs > i ? "is-filled" : ""}`} shape="rect" placeholder=""></image-slot>
              <span className="vk__angle-lbl">{a}</span>
            </div>
          ))}
        </div>
        <p className="vk__note"><Ic.eye style={{ width: 13, height: 13, color: "var(--gold-lit)" }} />{note}</p>
        <p className="vk__hint">{hint}</p>
        <div className="vk__acts">
          <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => setMng(true)}>
            <Ic.image />Керувати референсами
          </button>
        </div>
        <div className="vk__acts" style={{ marginTop: 8 }}>
          <button className="btn btn--gold" style={{ flex: 1, justifyContent: "center" }} onClick={train} disabled={busy || !enough}
            title={enough ? "" : `Спершу додай ≥${VK_MIN} референси`}>
            {busy ? <span className="spin-ring" style={{ width: 15, height: 15 }} /> : <Ic.cpu />}
            {busy ? "Навчання…" : trained ? "Перенавчити LoRA" : "Навчити LoRA"}
          </button>
          <button className="btn" onClick={() => window.__wsGoCanon && window.__wsGoCanon(type, e.id)} title="Канон у Світовому дереві"><Ic.tree /></button>
        </div>
      </div>
      {mng && ReactDOM.createPortal(
        <div className="shotmodal" onClick={() => setMng(false)}>
          <div className="shotmodal__card" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true" aria-label="Референси">
            <div className="shotmodal__head">
              <div><div className="shotmodal__k">{title}</div><div className="shotmodal__t">Референси LoRA</div></div>
              <button className="shotmodal__x" onClick={() => setMng(false)} aria-label="Закрити"><Ic.x /></button>
            </div>
            <div className="vk__bar" style={{ marginBottom: 14 }}><div className={`vk__barfill is-${tier}`} style={{ width: pct + "%" }} /></div>
            <p className="vk__hint" style={{ marginBottom: 14 }}>{refs} / {VK_TARGET} референсів · {hint}</p>
            <div className="vk-mng__grid">
              {Array.from({ length: refs }, (_, i) => (
                <div className="vk-mng__cell" key={i}><span className="vk-mng__n">{i + 1}</span>
                  <button className="vk-mng__del" title="Видалити" onClick={() => setRefs((r) => Math.max(0, r - 1))}><Ic.x /></button>
                </div>
              ))}
              {Array.from({ length: pending }, (_, i) => (
                <div className="vk-mng__cell vk-mng__cell--pending" key={"p" + i}><span className="vk-mng__n">✦</span></div>
              ))}
              {refs === 0 && pending === 0 && <div className="vk-mng__empty">Ще немає референсів</div>}
            </div>
            {pending > 0 && (
              <div className="vk-pending">
                <span className="vk-pending__t">✦ Згенеровано {pending} нових — переглянь і підтверди</span>
                <div className="vk__acts">
                  <button className="btn btn--gold" style={{ flex: 1, justifyContent: "center" }} onClick={acceptPending}><Ic.check />Підтвердити</button>
                  <button className="btn" onClick={discardPending}><Ic.x />Відхилити</button>
                </div>
              </div>
            )}
            <div className="vk__acts" style={{ marginTop: 16 }}>
              <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={genRefs} disabled={genning || pending > 0 || refs >= VK_MAX}>
                {genning ? <span className="spin-ring" style={{ width: 15, height: 15 }} /> : <Ic.sparkle />}
                {genning ? "Малюю…" : refs >= VK_MAX ? "Максимум" : "Згенерувати +8"}
              </button>
              <label className="btn" style={{ cursor: "pointer" }} title="Завантажити свої зображення">
                <Ic.image />Завантажити
                <input type="file" accept="image/*" multiple style={{ display: "none" }}
                  onChange={(ev) => { const n = ev.target.files ? ev.target.files.length : 0; if (n) setRefs((r) => Math.min(VK_MAX, r + n)); ev.target.value = ""; }} />
              </label>
            </div>
            {refs > 0 && (
              <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8, color: "var(--st-draft)", borderColor: "rgba(224,86,79,0.4)" }}
                onClick={() => { setRefs(0); setTrained(false); }}>
                <Ic.x />Видалити всі референси
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </article>
  );
}

function VizRefTab() {
  const [seg, setSeg] = useVkState("characters");
  const list = WORLD[seg];
  const ready = list.filter((e) => vkModel(seg, e).st === "ready").length;
  return (
    <div className="page">
      <div className="phead">
        <div className="phead__l">
          <span className="phead__kick">Візуальна продукція</span>
          <h1>Візуальний канон</h1>
          <span className="phead__sub">Референси та LoRA для узгодженості зовнішності між кадрами й серіями</span>
        </div>
        <div className="vk-seg">
          <button className={`vk-seg__b ${seg === "characters" ? "is-on" : ""}`} onClick={() => setSeg("characters")}><Ic.users />Персонажі</button>
          <button className={`vk-seg__b ${seg === "locations" ? "is-on" : ""}`} onClick={() => setSeg("locations")}><Ic.map />Локації</button>
        </div>
      </div>
      <div className="pdiv" />

      <div className="vk-note-bar">
        <Ic.cpu style={{ width: 16, height: 16, color: "var(--violet-lit)" }} />
        <span><b>{ready}</b> із {list.length} {seg === "characters" ? "персонажів" : "локацій"} мають навчену LoRA-модель. Згенеруй референси з канону або перетягни свої — від 3 на сутність для стабільної генерації.</span>
      </div>

      <div className="vk-grid">
        {list.map((e) => <VkCard key={e.id} type={seg} e={e} />)}
      </div>
    </div>
  );
}

window.VizRefTab = VizRefTab;
