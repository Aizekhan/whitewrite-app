// Per-type adapters that drive the generic workspace engine: how an entity
// is labelled, searched, filtered, sorted, and how its profile body renders.
// Version: 2026-06-29 (cache bust)

// Helper to get translations
function t(key) {
  return window.__i18n ? window.__i18n.t(key) : key;
}

// Helper to translate enum values (with fallback for user-entered text)
function tEnum(prefix, value) {
  if (!value) return value;
  const key = `enum.${prefix}.${value}`;
  const translated = t(key);
  // If translation key not found (returns key itself), return original value (user text)
  return translated !== key ? translated : value;
}

function A_ROLE(roleType) {
  const roles = {
    lead: t('canon.roleLead'),
    support: t('canon.roleSupport'),
    anta: t('canon.roleAnta')
  };
  return roles[roleType];
}
const A_TONECLS = { draft: "draft", review: "review", ready: "ready", done: "done", anta: "review" };
const aTone = (t) => ({ draft: "var(--st-draft)", review: "var(--st-review)", ready: "var(--st-ready)", done: "var(--st-done)", anta: "var(--violet-lit)" }[t] || "var(--gold)");
const aHue = (t) => ({ lead: "var(--gold)", anta: "var(--st-draft)", support: "var(--violet)" }[t] || "var(--violet)");

// Safe string compare helper for sorting (handles undefined/null)
const safeCompare = (a, b) => {
  const aStr = (a || "").toString();
  const bStr = (b || "").toString();
  return aStr.localeCompare(bStr, "uk");
};

function Bar({ pct, color }) {
  return <div className="prog"><div className="prog__fill" style={{ width: pct + "%", background: color }} /></div>;
}
function SceneChips({ list }) {
  if (!list || !list.length) return null;
  return (
    <div className="scenechips">
      {list.map((n) => {
        const s = WORLD.scenes.find((x) => x.n === n);
        return <span className="scenechip" key={n}><span className="scene-dot">{n}</span>{s ? s.title : ""}</span>;
      })}
    </div>
  );
}
function Facts({ rows }) {
  return (
    <div className="kv">
      {rows.map((r) => <div className="kv__row" key={r.k}><span className="kv__k">{r.k}</span><span className="kv__v">{r.v}</span></div>)}
    </div>
  );
}

const ADAPTERS = {
  characters: {
    get title() { return t('canon.characters'); },
    get kicker() { return t('canon.charactersKicker'); },
    icon: "users", accent: "var(--gold)", slotShape: "rounded",
    sub: (e) => e.role, blurb: (e) => e.motivation,
    pill: (e) => ({ label: tEnum('status', e.status), cls: e.roleType === "anta" ? "draft" : e.roleType === "lead" ? "ready" : "done" }),
    hue: (e) => aHue(e.roleType),
    search: (e) => [e.name, e.role, e.motivation, e.status, e.arc].join(" "),
    get facets() {
      return [
        { key: "role", label: t('canon.role'), of: (e) => e.roleType, display: (v) => A_ROLE(v) },
        { key: "status", label: t('canon.status'), of: (e) => e.status, display: (v) => tEnum('status', v) },
      ];
    },
    get sorts() {
      return [
        { key: "name", label: t('canon.byName'), cmp: (a, b) => safeCompare(a.name, b.name) },
        { key: "arc", label: t('canon.byArc'), cmp: (a, b) => (b.prog || 0) - (a.prog || 0) },
      ];
    },
    cardStat: (e) => `${e.prog}%`,
    profile: (e) => (
      <>
        <p className="dprose">{e.motivation}</p>
        <div className="dblk">
          <h3 className="blk-h"><Ic.wand />{t('canon.arc')} · {e.prog}%</h3>
          <div className="arc-head"><span className="arc-lbl">{e.arc}</span></div>
          <Bar pct={e.prog} color="linear-gradient(90deg,var(--violet),var(--gold))" />
        </div>
        {e.scenes && e.scenes.length > 0 && <div className="dblk"><h3 className="blk-h"><Ic.clapper />{t('canon.scenes')} · {e.scenes.length}</h3><SceneChips list={e.scenes} /></div>}
      </>
    ),
  },

  locations: {
    get title() { return t('canon.locations'); },
    get kicker() { return t('canon.locationsKicker'); },
    icon: "map", accent: "var(--gold-lit)", slotShape: "rect",
    sub: (e) => tEnum('locationType', e.type), blurb: (e) => e.desc,
    pill: (e) => ({ label: e.cur ? t('canon.current') : t('canon.canon'), cls: e.cur ? "review" : "done" }),
    hue: () => "var(--gold)",
    search: (e) => [e.name, e.type, e.desc, (e.atmos || []).join(" ")].join(" "),
    get facets() {
      return [
        { key: "type", label: t('canon.type'), of: (e) => e.type, display: (v) => tEnum('locationType', v) },
        { key: "atmos", label: t('canon.atmosphere'), of: (e) => (e.atmos || [])[0] || "—", display: (v) => v },
      ];
    },
    get sorts() {
      return [{ key: "name", label: t('canon.byTitle'), cmp: (a, b) => safeCompare(a.name, b.name) }];
    },
    cardStat: (e) => (e.scenes ? e.scenes.length + " " + t('canon.scenesShort') : ""),
    profile: (e) => (
      <>
        <div className="chips" style={{ marginTop: 0 }}>
          {(e.atmos || []).map((a) => <span className="chip" key={a}>{a}</span>)}
          {e.cond && <span className="chip chip--gold">{e.cond}</span>}
        </div>
        <p className="dprose" style={{ marginTop: 14 }}>{e.desc}</p>
        {e.palette && <div className="dblk"><h3 className="blk-h"><Ic.palette />{t('canon.palette')}</h3><div className="swatches">{e.palette.map((c) => <span className="sw" key={c} style={{ background: c }} />)}</div></div>}
        {e.scenes && e.scenes.length > 0 && <div className="dblk"><h3 className="blk-h"><Ic.clapper />{t('canon.scenes')} · {e.scenes.length}</h3><SceneChips list={e.scenes} /></div>}
      </>
    ),
  },

  events: {
    get title() { return t('canon.events'); },
    get kicker() { return t('canon.eventsKicker'); },
    icon: "flame", accent: "var(--gold)", slotShape: "rect",
    sub: (e) => `${t('book.act')} ${e.act} · ${e.when}`, blurb: (e) => e.desc,
    pill: (e) => ({ label: tEnum('eventType', e.type), cls: A_TONECLS[e.tone] }),
    hue: (e) => aTone(e.tone),
    search: (e) => [e.title, e.type, e.desc, e.when].join(" "),
    get facets() {
      return [
        { key: "act", label: t('book.act'), of: (e) => e.act, display: (v) => t('book.act') + " " + v },
        { key: "type", label: t('canon.type'), of: (e) => e.type, display: (v) => tEnum('eventType', v) },
      ];
    },
    get sorts() {
      return [{ key: "act", label: t('canon.chronology'), cmp: (a, b) => (a.act || 0) - (b.act || 0) }];
    },
    cardStat: (e) => t('book.act') + " " + e.act,
    profile: (e) => (
      <>
        <div className="chips" style={{ marginTop: 0 }}>
          <span className="chip mono">{e.when}</span>
          <span className="chip" style={{ color: aTone(e.tone), borderColor: "color-mix(in srgb," + aTone(e.tone) + " 40%, transparent)" }}>{tEnum('eventType', e.type)}</span>
          <span className="chip">{t('book.act')} {e.act}</span>
        </div>
        <p className="dprose" style={{ marginTop: 14 }}>{e.desc}</p>
      </>
    ),
  },

  factions: {
    get title() { return t('canon.factions'); },
    get kicker() { return t('canon.factionsKicker'); },
    icon: "crest", accent: "var(--gold)", slotShape: "rect",
    sub: (e) => tEnum('alignment', e.align), blurb: (e) => e.desc,
    pill: (e) => ({ label: tEnum('alignment', e.align), cls: A_TONECLS[e.tone] }),
    hue: (e) => aTone(e.tone),
    search: (e) => [e.name, e.align, e.motto, e.desc].join(" "),
    get facets() {
      return [{ key: "align", label: t('canon.alignment'), of: (e) => e.align, display: (v) => tEnum('alignment', v) }];
    },
    get sorts() {
      return [
        { key: "power", label: t('canon.byInfluence'), cmp: (a, b) => (b.power || 0) - (a.power || 0) },
        { key: "name", label: t('canon.byTitle'), cmp: (a, b) => safeCompare(a.name, b.name) },
      ];
    },
    cardStat: (e) => e.power + "%",
    profile: (e) => (
      <>
        <p className="dprose fac-motto" style={{ color: "var(--gold-lit)" }}>«{e.motto}»</p>
        <p className="dprose" style={{ marginTop: 10 }}>{e.desc}</p>
        <div className="dblk">
          <h3 className="blk-h"><Ic.layers />{t('canon.powerBalance')}</h3>
          <div className="arc-head"><span className="arc-lbl">{t('canon.influence')} · {tEnum('alignment', e.align)}</span><span className="arc-pct">{e.power}%</span></div>
          <Bar pct={e.power} color={"linear-gradient(90deg, color-mix(in srgb," + aTone(e.tone) + " 60%, var(--violet)), " + aTone(e.tone) + ")"} />
          <div style={{ marginTop: 12 }}><Facts rows={[{ k: t('canon.members'), v: e.members }, { k: t('canon.alignment'), v: tEnum('alignment', e.align) }]} /></div>
        </div>
      </>
    ),
  },

  artifacts: {
    get title() { return t('canon.artifacts'); },
    get kicker() { return t('canon.artifactsKicker'); },
    icon: "gem", accent: "var(--gold)", slotShape: "rounded",
    sub: (e) => tEnum('artifactType', e.type), blurb: (e) => e.desc,
    pill: (e) => ({ label: tEnum('rarity', e.rarity), cls: A_TONECLS[e.tone] }),
    hue: (e) => aTone(e.tone),
    search: (e) => [e.name, e.type, e.rarity, e.desc].join(" "),
    get facets() {
      return [
        { key: "rarity", label: t('canon.rarity'), of: (e) => e.rarity, display: (v) => tEnum('rarity', v) },
        { key: "type", label: t('canon.type'), of: (e) => e.type, display: (v) => tEnum('artifactType', v) },
      ];
    },
    get sorts() {
      return [{ key: "name", label: t('canon.byTitle'), cmp: (a, b) => safeCompare(a.name, b.name) }];
    },
    cardStat: (e) => e.rarity,
    profile: (e) => {
      const sc = WORLD.scenes.find((s) => s.n === e.scene);
      return (
        <>
          <p className="dprose">{e.desc}</p>
          <div className="dblk"><Facts rows={[
            { k: t('canon.type'), v: tEnum('artifactType', e.type) }, { k: t('canon.rarity'), v: tEnum('rarity', e.rarity) },
            { k: t('canon.appears'), v: sc ? `${e.scene} · ${sc.title}` : e.scene },
          ]} /></div>
        </>
      );
    },
  },
};

window.ADAPTERS = ADAPTERS;
window.aTone = aTone; window.aHue = aHue;
