// Per-type adapters that drive the generic workspace engine: how an entity
// is labelled, searched, filtered, sorted, and how its profile body renders.
const A_ROLE = { lead: "Головний", support: "Другорядний", anta: "Антагоніст" };
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
    title: "Персонажі", kicker: "Дійові особи", icon: "users", accent: "var(--gold)", slotShape: "rounded",
    sub: (e) => e.role, blurb: (e) => e.motivation,
    pill: (e) => ({ label: e.status, cls: e.roleType === "anta" ? "draft" : e.roleType === "lead" ? "ready" : "done" }),
    hue: (e) => aHue(e.roleType),
    search: (e) => [e.name, e.role, e.motivation, e.status, e.arc].join(" "),
    facets: [
      { key: "role", label: "Роль", of: (e) => A_ROLE[e.roleType] },
      { key: "status", label: "Статус", of: (e) => e.status },
    ],
    sorts: [
      { key: "name", label: "За іменем", cmp: (a, b) => safeCompare(a.name, b.name) },
      { key: "arc", label: "За аркою", cmp: (a, b) => (b.prog || 0) - (a.prog || 0) },
    ],
    cardStat: (e) => `${e.prog}%`,
    profile: (e) => (
      <>
        <p className="dprose">{e.motivation}</p>
        <div className="dblk">
          <h3 className="blk-h"><Ic.wand />Арка · {e.prog}%</h3>
          <div className="arc-head"><span className="arc-lbl">{e.arc}</span></div>
          <Bar pct={e.prog} color="linear-gradient(90deg,var(--violet),var(--gold))" />
        </div>
        {e.scenes && e.scenes.length > 0 && <div className="dblk"><h3 className="blk-h"><Ic.clapper />Сцени · {e.scenes.length}</h3><SceneChips list={e.scenes} /></div>}
      </>
    ),
  },

  locations: {
    title: "Локації", kicker: "Місця світу", icon: "map", accent: "var(--gold-lit)", slotShape: "rect",
    sub: (e) => e.type, blurb: (e) => e.desc,
    pill: (e) => ({ label: e.cur ? "Поточна" : "Канон", cls: e.cur ? "review" : "done" }),
    hue: () => "var(--gold)",
    search: (e) => [e.name, e.type, e.desc, (e.atmos || []).join(" ")].join(" "),
    facets: [
      { key: "type", label: "Тип", of: (e) => e.type },
      { key: "atmos", label: "Атмосфера", of: (e) => (e.atmos || [])[0] || "—" },
    ],
    sorts: [{ key: "name", label: "За назвою", cmp: (a, b) => safeCompare(a.name, b.name) }],
    cardStat: (e) => (e.scenes ? e.scenes.length + " сц." : ""),
    profile: (e) => (
      <>
        <div className="chips" style={{ marginTop: 0 }}>
          {(e.atmos || []).map((a) => <span className="chip" key={a}>{a}</span>)}
          {e.cond && <span className="chip chip--gold">{e.cond}</span>}
        </div>
        <p className="dprose" style={{ marginTop: 14 }}>{e.desc}</p>
        {e.palette && <div className="dblk"><h3 className="blk-h"><Ic.palette />Палітра місця</h3><div className="swatches">{e.palette.map((c) => <span className="sw" key={c} style={{ background: c }} />)}</div></div>}
        {e.scenes && e.scenes.length > 0 && <div className="dblk"><h3 className="blk-h"><Ic.clapper />Сцени · {e.scenes.length}</h3><SceneChips list={e.scenes} /></div>}
      </>
    ),
  },

  events: {
    title: "Події", kicker: "Хроніка всесвіту", icon: "flame", accent: "var(--gold)", slotShape: "rect",
    sub: (e) => `Акт ${e.act} · ${e.when}`, blurb: (e) => e.desc,
    pill: (e) => ({ label: e.type, cls: A_TONECLS[e.tone] }),
    hue: (e) => aTone(e.tone),
    search: (e) => [e.title, e.type, e.desc, e.when].join(" "),
    facets: [
      { key: "act", label: "Акт", of: (e) => "Акт " + e.act },
      { key: "type", label: "Тип", of: (e) => e.type },
    ],
    sorts: [{ key: "act", label: "За хронологією", cmp: (a, b) => (a.act || 0) - (b.act || 0) }],
    cardStat: (e) => "Акт " + e.act,
    profile: (e) => (
      <>
        <div className="chips" style={{ marginTop: 0 }}>
          <span className="chip mono">{e.when}</span>
          <span className="chip" style={{ color: aTone(e.tone), borderColor: "color-mix(in srgb," + aTone(e.tone) + " 40%, transparent)" }}>{e.type}</span>
          <span className="chip">Акт {e.act}</span>
        </div>
        <p className="dprose" style={{ marginTop: 14 }}>{e.desc}</p>
      </>
    ),
  },

  factions: {
    title: "Фракції", kicker: "Сили та інтереси", icon: "crest", accent: "var(--gold)", slotShape: "rect",
    sub: (e) => e.align, blurb: (e) => e.desc,
    pill: (e) => ({ label: e.align, cls: A_TONECLS[e.tone] }),
    hue: (e) => aTone(e.tone),
    search: (e) => [e.name, e.align, e.motto, e.desc].join(" "),
    facets: [{ key: "align", label: "Ставлення", of: (e) => e.align }],
    sorts: [
      { key: "power", label: "За впливом", cmp: (a, b) => (b.power || 0) - (a.power || 0) },
      { key: "name", label: "За назвою", cmp: (a, b) => safeCompare(a.name, b.name) },
    ],
    cardStat: (e) => e.power + "%",
    profile: (e) => (
      <>
        <p className="dprose fac-motto" style={{ color: "var(--gold-lit)" }}>«{e.motto}»</p>
        <p className="dprose" style={{ marginTop: 10 }}>{e.desc}</p>
        <div className="dblk">
          <h3 className="blk-h"><Ic.layers />Розклад сил</h3>
          <div className="arc-head"><span className="arc-lbl">Вплив · {e.align}</span><span className="arc-pct">{e.power}%</span></div>
          <Bar pct={e.power} color={"linear-gradient(90deg, color-mix(in srgb," + aTone(e.tone) + " 60%, var(--violet)), " + aTone(e.tone) + ")"} />
          <div style={{ marginTop: 12 }}><Facts rows={[{ k: "Учасники", v: e.members }, { k: "Ставлення", v: e.align }]} /></div>
        </div>
      </>
    ),
  },

  artifacts: {
    title: "Артефакти", kicker: "Ключові об'єкти", icon: "gem", accent: "var(--gold)", slotShape: "rounded",
    sub: (e) => e.type, blurb: (e) => e.desc,
    pill: (e) => ({ label: e.rarity, cls: A_TONECLS[e.tone] }),
    hue: (e) => aTone(e.tone),
    search: (e) => [e.name, e.type, e.rarity, e.desc].join(" "),
    facets: [
      { key: "rarity", label: "Рідкість", of: (e) => e.rarity },
      { key: "type", label: "Тип", of: (e) => e.type },
    ],
    sorts: [{ key: "name", label: "За назвою", cmp: (a, b) => safeCompare(a.name, b.name) }],
    cardStat: (e) => e.rarity,
    profile: (e) => {
      const sc = WORLD.scenes.find((s) => s.n === e.scene);
      return (
        <>
          <p className="dprose">{e.desc}</p>
          <div className="dblk"><Facts rows={[
            { k: "Тип", v: e.type }, { k: "Рідкість", v: e.rarity },
            { k: "З'являється", v: sc ? `${e.scene} · ${sc.title}` : e.scene },
          ]} /></div>
        </>
      );
    },
  },
};

window.ADAPTERS = ADAPTERS;
window.aTone = aTone; window.aHue = aHue;
