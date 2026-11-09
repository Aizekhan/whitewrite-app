// 🧊 The relief of a «Карта гри» zone in 3D (owner, v2.114). ES module, loaded on demand by gamebible.js:
// import("./gb-terrain.js").then(m => m.terrain3d(el, heights, res, { w, h, heightM, color })) → { update(heights, opts), dispose() }.
// three.js is vendored in app/vendor/three/ and mapped by the import map in "WhiteWrite GameBible.html".
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const GRID = 129; // the mesh is a downsampled grid — the editor keeps the full 513 × 513

function sample(h, res, u, v) {
  const x = u * (res - 1), y = v * (res - 1), x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(res - 1, x0 + 1), y1 = Math.min(res - 1, y0 + 1), tx = x - x0, ty = y - y0;
  const a = h[y0 * res + x0], b = h[y0 * res + x1], c = h[y1 * res + x0], d = h[y1 * res + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

export function terrain3d(el, heights, res, opts) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d0d10);
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 100000);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2018, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.6); scene.add(sun);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49;
  const geo = new THREE.PlaneGeometry(1, 1, GRID - 1, GRID - 1); geo.rotateX(-Math.PI / 2);
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(GRID * GRID * 3), 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false }));
  scene.add(mesh);
  let o = opts, framed = false;

  function update(h, next) {
    o = Object.assign({}, o, next || {});
    const pos = geo.attributes.position, col = geo.attributes.color, w = o.w || 1000, d = o.h || 1000, top = o.heightM || 60;
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const k = j * GRID + i, v = sample(h, res, i / (GRID - 1), j / (GRID - 1)), c = o.color(v);
      pos.setXYZ(k, (i / (GRID - 1) - 0.5) * w, v * top, (j / (GRID - 1) - 0.5) * d); // image top = north = −Z
      col.setXYZ(k, c[0] / 255, c[1] / 255, c[2] / 255);
    }
    pos.needsUpdate = true; col.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    sun.position.set(-w, top * 4 + Math.max(w, d) * 0.6, -d);
    if (!framed) { const r = Math.max(w, d); camera.position.set(r * 0.55, r * 0.5 + top, r * 0.75); camera.far = r * 10; camera.updateProjectionMatrix(); controls.target.set(0, top * 0.3, 0); framed = true; }
  }
  function size() { const W = el.clientWidth || 400, H = el.clientHeight || 300; renderer.setSize(W, H, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%"; camera.aspect = W / H; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(size); ro.observe(el); size();
  let raf = 0; const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); }; loop();
  update(heights);
  return {
    update,
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); geo.dispose(); mesh.material.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
