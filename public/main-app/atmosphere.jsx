// Atmosphere: gold dust particles, ambient light, the Keeper presence.
const { useRef, useEffect, useState } = React;

// ---------------------------------------------------------------------------
// Floating gold motes drifting through warm library air.
function Particles({ density = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let raf, w, h, motes = [];
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.round((w * h) / 26000 * density);
      motes = new Array(count).fill(0).map(spawn);
    }
    function spawn() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.7,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.05 - Math.random() * 0.22,
        a: 0.1 + Math.random() * 0.5,
        tw: Math.random() * Math.PI * 2,
        tws: 0.005 + Math.random() * 0.02,
      };
    }
    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy;
        m.tw += m.tws;
        if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
        if (m.x < -10) m.x = w + 10;
        if (m.x > w + 10) m.x = -10;
        const flick = 0.55 + 0.45 * Math.sin(m.tw);
        const alpha = m.a * flick;
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
        g.addColorStop(0, `rgba(255, 224, 160, ${alpha})`);
        g.addColorStop(0.4, `rgba(214, 173, 98, ${alpha * 0.5})`);
        g.addColorStop(1, "rgba(214, 173, 98, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }
    resize();
    tick();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [density]);

  return <canvas ref={ref} className="particles" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// The Keeper — a presence made of shadow and warm rim-light, never a cartoon.
// Built from soft gradients only (a suggested hooded figure), heavily blurred.
function Keeper({ variant = "cover", whisper, whisperKey }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!whisper) { setShown(false); return; }
    setShown(false);
    const t1 = setTimeout(() => setShown(true), 60);
    return () => clearTimeout(t1);
  }, [whisper, whisperKey]);

  return (
    <div className={`keeper keeper--${variant}`} aria-hidden="true">
      <div className="keeper__figure">
        <div className="keeper__halo" />
        <div className="keeper__robe" />
        <div className="keeper__hood" />
        <div className="keeper__rim" />
      </div>
      {variant === "cover" && (
        <div className={`keeper__whisper ${shown ? "is-shown" : ""}`}>{whisper}</div>
      )}
    </div>
  );
}

// A whisper that surfaces from the Keeper while reading — narrator's voice,
// not a chat bubble. Fades in, lingers, dissolves.
function KeeperWhisper({ text, signal }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!text) return;
    setVisible(false);
    const a = setTimeout(() => setVisible(true), 80);
    const b = setTimeout(() => setVisible(false), 7200);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [text, signal]);
  if (!text) return null;
  return (
    <div className={`whisper-rail ${visible ? "is-shown" : ""}`}>
      <span className="whisper-rail__mark" />
      <p className="whisper-rail__text">{text}</p>
      <span className="whisper-rail__who">Хранитель</span>
    </div>
  );
}

Object.assign(window, { Particles, Keeper, KeeperWhisper });
