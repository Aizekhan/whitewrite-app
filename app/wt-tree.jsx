// The World Tree — a symbolic visualization of the canon. A central
// Chronicle node (the heart the universe grows from) plus five branch nodes,
// one per canon category. The tree is the entry point, not a menu.
const { useState: useTreeState } = React;
const WT_NODES = [
  { id: "artifacts",  x: 50,   y: 13 },
  { id: "characters", x: 33,   y: 26 },
  { id: "locations",  x: 67,   y: 26 },
  { id: "events",     x: 27.5, y: 45 },
  { id: "factions",   x: 72.5, y: 45 },
];
// Rich illustrated emblems (custom images for each node type)
const NODE_ART = {
  characters: "assets/node-characters.png",
  locations: "assets/node-locations.png",
  events: "assets/node-events.png",
  artifacts: "assets/node-artifacts.png",
  factions: "assets/node-factions.png"
};

function TreeMap({ onSelect, canon }) {
  const [hover, setHover] = useTreeState(null);
  // Use canon prop if available (real data), fallback to WORLD (mock)
  const dataSource = canon || window.WORLD || {};
  const node = (id, x, y, core) => {
    const A = ADAPTERS[id];
    const I = core ? Ic.scroll : Ic[A.icon];
    const art = core ? "assets/node-chronicle.png" : NODE_ART[id];
    const top = y < 52;
    const title = core ? "Хроніка" : A.title;
    const kick = core ? "Серце всесвіту" : A.kicker;
    const count = core ? (dataSource.events || []).length : (dataSource[id] || []).length;
    return (
      <button key={id} className={`node ${core ? "node--core" : ""} ${art ? "node--art" : ""} ${hover === id ? "is-hot" : ""}`}
        style={{ left: x + "%", top: y + "%" }}
        onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover((h) => (h === id ? null : h))}
        onFocus={() => setHover(id)} onBlur={() => setHover((h) => (h === id ? null : h))}
        onClick={() => onSelect(core ? "chronicle" : id)} aria-label={title} type="button">
        <span className="node__pulse" />
        <span className="node__orb">{art ? <img className="node__art" src={art} alt={title} draggable="false" /> : <I />}</span>
        <span className={`node__label ${top ? "is-top" : "is-bot"}`}>
          <span className="node__title">{title}</span>
          <span className="node__kicker">{kick} · {count}</span>
        </span>
      </button>
    );
  };
  return (
    <div className="tree-stage">
      <div className="tree-frame">
        <img className="tree-img" src="assets/world-tree.jpg" alt="Світове Дерево" draggable="false" />
        <div className="tree-haze" />
        {node("chronicle", 50, 53, true)}
        {WT_NODES.map((n) => node(n.id, n.x, n.y, false))}
      </div>
      <div className="tree-hint">
        <span className="tree-hint__mark">✦</span>
        Кожна гілка росте з однієї історії — торкніться світла
      </div>
    </div>
  );
}

window.TreeMap = TreeMap;
