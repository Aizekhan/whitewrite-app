// 3D viewer for model files on Game Bible cards — GLB only (owner, v2.119.0: FBX / OBJ / glTF / STL are not opened; convert to GLB).
// ES module, loaded on demand by gamebible.js: import("./gb-3d.js").then(m => m.view3d(file, labels, cardFiles)).
// three.js is vendored in app/vendor/three/ (scripts/vendor-three.mjs) and mapped by the import map in "WhiteWrite GameBible.html".
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const MODEL_EXT = /\.glb$/i;

// A GLB carries its textures inside; a rare external texture it names (e.g. "texture_0.png") is looked up by file name
// among the other files of the same card.
function load(file, siblings) {
  if (!MODEL_EXT.test(file.name || "")) return Promise.reject(new Error("GLB only"));
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url === file.url || /^(blob|data):/.test(url)) return url;
    const base = decodeURIComponent(url.split("?")[0]).split(/[\\/]/).pop().toLowerCase();
    const hit = (siblings || []).find((f) => f.name.toLowerCase() === base);
    return hit ? hit.url : url;
  });
  return new Promise((resolve, reject) => {
    new GLTFLoader(manager).load(file.url, (g) => resolve({ root: g.scene, clips: g.animations, meta: gltfRights(g.parser.json) }), undefined, reject);
  });
}

function countTris(root) {
  let tris = 0;
  root.traverse((o) => { if (o.isMesh && o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return Math.round(tris);
}
// What a glTF says about its own rights: asset.copyright, asset.extras, XMP packets (dc:rights, cc:license…).
function gltfRights(json) {
  const a = (json && json.asset) || {}, x = ((json && json.extensions) || {}).KHR_xmp_json_ld;
  const parts = [a.copyright, a.extras && JSON.stringify(a.extras), x && x.packets && JSON.stringify(x.packets)].filter(Boolean);
  return parts.length ? parts.join(" · ").slice(0, 600) : "";
}
// Polygon (triangle) count and rights text of a model file, without showing it — gamebible.js marks heavy models and their licence.
// geometry and textures live on the GPU / in memory until disposed — a model nobody shows must be freed at once
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    [].concat(o.material || []).forEach((m) => { Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
  });
}
// A still of the model for a card (the Forge shows a character's own model instead of an empty frame): rendered once off-screen, the
// GPU freed at once; opts.shape = { Thin: 0–100, … } bends the body like the sliders do. Resolves { url, keys, bones, skinned } — the model's shape key
// names, its bone names (boneKey) and whether it has a skin: the Forge tells from them whether the model is ready for the animations.
export async function modelShot(file, siblings, opts) {
  const r = await load(file, siblings), root = r.root, w = 360, h = 480, shape = (opts && opts.shape) || {}, keys = new Set(), bones = new Set(); let skinned = false;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  try {
    renderer.setSize(w, h, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(0xffffff, 2.4);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2622, 2.2)); sun.position.set(2, 4, 3); scene.add(sun); scene.add(root);
    root.traverse((o) => { if (o.morphTargetDictionary) Object.keys(o.morphTargetDictionary).forEach((k) => keys.add(k)); if (o.isBone) bones.add(boneKey(o.name)); if (o.isSkinnedMesh) skinned = true; });
    root.traverse((o) => { if (o.morphTargetDictionary) Object.keys(shape).forEach((k) => { const i = o.morphTargetDictionary[k]; if (i != null) o.morphTargetInfluences[i] = (+shape[k] || 0) / 100; }); });
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const fov = 30, half = Math.max(s.y, s.x * h / w) * 0.56, dist = half / Math.tan(fov / 2 * Math.PI / 180) + s.z / 2;
    const camera = new THREE.PerspectiveCamera(fov, w / h, dist / 100, dist * 10);
    camera.position.set(c.x, c.y, c.z + dist); camera.lookAt(c);
    renderer.render(scene, camera);
    return { url: renderer.domElement.toDataURL("image/webp", 0.85), keys: [...keys], bones: [...bones], skinned };
  } finally { disposeTree(root); renderer.dispose(); renderer.forceContextLoss(); }
}
export async function modelInfo(file, siblings) { const r = await load(file, siblings); const out = { tris: countTris(r.root), rights: r.meta || "" }; disposeTree(r.root); return out; }

// Bones are matched by name, whatever the exporter did to it: "mixamorig:Hips", "mixamorigHips", "Hips" → "hips"
function boneKey(n) { return String(n || "").replace(/^.*mixamorig[:_]?/i, "").replace(/[^a-z0-9]/gi, "").toLowerCase(); }

// opts.shape = { Thin: 0–100, … } → the morph targets of that name; opts.labels names them, opts.onShape(key, value) saves a moved slider
// opts.fit — 🎞 the Forge fitting room: { clips: [{ id, name, url }] (WhiteWrite library GLBs, one skeleton), clip (first id),
//   items: [{ id, title, file, siblings, bind: skinned|rigid, bone }], labels, notes: [text], onOk(itemId, clipName) }
// A library clip is played on the model by bone names (rotations; the hips' height scaled to the model), a skinned item is
// re-bound to the model's skeleton, a rigid one hangs on its bone. Only what it looks like — clipping is checked in Unity / Blender.
export function view3d(file, T, siblings, onShot, opts) {
  opts = opts || {};
  const box = document.createElement("div");
  box.className = "v3d";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", file.name);
  box.innerHTML = '<div class="v3d-head"><b></b><span class="muted v3d-info">' + T.loading + '</span>' +
    '<button class="btn" data-a="rotate" aria-pressed="true">' + T.rotate + '</button>' +
    '<button class="btn" data-a="wire" aria-pressed="false">' + T.wire + '</button>' +
    '<button class="btn" data-a="reset">' + T.reset + '</button>' +
    (onShot ? '<button class="btn" data-a="shot" title="' + T.shotTip + '">' + T.shot + '</button>' : '') +
    '<button class="btn" data-a="close">' + T.close + '</button></div>' +
    (opts.fit ? '<div class="v3d-fit"></div>' : '') + '<div class="v3d-shape" hidden></div><div class="v3d-stage"></div><p class="v3d-hint muted">' + T.hint + '</p>';
  box.querySelector("b").textContent = file.name;
  document.body.appendChild(box);
  const stage = box.querySelector(".v3d-stage"), info = box.querySelector(".v3d-info");

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101012);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2622, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  let mixer = null, home = null, model = null;
  const clock = new THREE.Clock();

  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  function frame() { // fit the camera to the model, ground grid under it
    const b = new THREE.Box3().setFromObject(model), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const r = Math.max(s.x, s.y, s.z) || 1;
    const grid = new THREE.GridHelper(r * 3, 12, 0x3a3630, 0x24221f);
    grid.position.set(c.x, b.min.y, c.z);
    scene.add(grid);
    camera.near = r / 100; camera.far = r * 100; camera.updateProjectionMatrix();
    home = { pos: new THREE.Vector3(c.x + r * 1.2, c.y + r * 0.7, c.z + r * 1.6), target: c };
    reset();
    const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString();
    info.textContent = fmt(s.x) + " × " + fmt(s.y) + " × " + fmt(s.z) + " · " + countTris(model).toLocaleString() + " " + T.tris;
  }
  function reset() { if (!home) return; camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); }

  let alive = true;
  renderer.setAnimationLoop(() => {
    if (mixer) mixer.update(clock.getDelta());
    controls.update();
    renderer.render(scene, camera);
  });
  const ro = new ResizeObserver(size);
  ro.observe(stage);
  size();

  load(file, siblings).then(({ root, clips }) => {
    if (!alive) { disposeTree(root); return; } // closed while loading: never added to the scene
    model = root;
    scene.add(model);
    if (opts.shape) shapeKeys();
    if (opts.fit) fitting(); else if (clips && clips.length) { mixer = new THREE.AnimationMixer(model); mixer.clipAction(clips[0]).play(); }
    frame();
  }).catch((e) => { info.textContent = T.failed + ": " + (e && e.message ? e.message : e); });

  // the body's shape keys: every mesh that has a morph target of that name follows its slider
  const shapeNow = {};
  function applyShape(k, v) { shapeNow[k] = v; model.traverse((o) => { if (o.morphTargetDictionary && o.morphTargetDictionary[k] != null) o.morphTargetInfluences[o.morphTargetDictionary[k]] = v / 100; }); }
  function shapeKeys() {
    const names = new Set(); model.traverse((o) => { if (o.morphTargetDictionary) Object.keys(o.morphTargetDictionary).forEach((k) => names.add(k)); });
    if (opts.build) return buildPanel(names);
    const keys = Object.keys(opts.labels || opts.shape).filter((k) => names.has(k)); if (!keys.length) return;
    const panel = box.querySelector(".v3d-shape"); panel.hidden = false;
    panel.innerHTML = keys.map((k) => '<label>' + (opts.labels && opts.labels[k] || k) + ' <span>' + (+opts.shape[k] || 0) + '</span><input type="range" min="0" max="100" step="5" value="' + (+opts.shape[k] || 0) + '" data-k="' + k + '"' + (opts.readonly ? ' disabled' : '') + '></label>').join("");
    keys.forEach((k) => applyShape(k, +opts.shape[k] || 0));
    panel.addEventListener("input", (e) => { const k = e.target.dataset.k; if (!k) return; applyShape(k, +e.target.value); e.target.previousElementSibling.textContent = e.target.value; });
    panel.addEventListener("change", (e) => { const k = e.target.dataset.k; if (k && opts.onShape) opts.onShape(k, +e.target.value); });
  }
  // opts.build = { fat, muscle, height, min, max, base, toShape(build) → key weights, labels, unit, comma, onBuild(key, value) }: the Forge's
  // build — one thin ↔ heavy slider, muscle and the height (the model scaled by height / base); the shape key sliders only on a model that has the keys
  function buildPanel(names) {
    const B = opts.build, L = B.labels || {}, has = ["Thin", "Heavy", "Muscular"].some((k) => names.has(k)), s0 = model.scale.clone(), now = { fat: +B.fat || 0, muscle: +B.muscle || 0, height: +B.height || 0 };
    const fmt = (k, v) => k === "height" ? (+v).toFixed(2).replace(".", B.comma ? "," : ".") + (B.unit || "") : k === "fat" && +v > 0 ? "+" + v : String(v);
    const row = (k, min, max, step) => '<label>' + (L[k] || k) + ' <span>' + fmt(k, now[k]) + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + now[k] + '" data-b="' + k + '"' + (opts.readonly ? ' disabled' : '') + '></label>';
    const html = (has ? row("fat", -100, 100, 5) + row("muscle", 0, 100, 5) : "") + (B.max > B.min && now.height ? row("height", B.min, B.max, 0.01) : "");
    if (!html) return;
    const apply = () => { const sh = B.toShape(now); Object.keys(sh).forEach((k) => applyShape(k, sh[k])); if (B.base && now.height) model.scale.copy(s0).multiplyScalar(now.height / B.base); };
    const panel = box.querySelector(".v3d-shape"); panel.hidden = false; panel.innerHTML = html; apply();
    panel.addEventListener("input", (e) => { const k = e.target.dataset.b; if (!k) return; now[k] = +e.target.value; e.target.previousElementSibling.textContent = fmt(k, now[k]); apply(); });
    panel.addEventListener("change", (e) => { const k = e.target.dataset.b; if (k && B.onBuild) B.onBuild(k, +e.target.value); });
  }
  // 🎞 the fitting room
  function fitting() {
    const F = opts.fit, L = F.labels, panel = box.querySelector(".v3d-fit"), bones = {}, worn = {}, cache = {};
    model.traverse((o) => { if (o.isBone) { const k = boneKey(o.name); if (!bones[k]) bones[k] = o; } });
    const rigged = !!bones.hips;
    let action = null, speed = 1, clipName = "", missNoted = false;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    panel.innerHTML = (rigged && F.clips.length ? '<label>' + L.clip + ' <select data-f="clip">' + F.clips.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === F.clip ? " selected" : "") + '>' + esc(c.name) + '</option>').join("") + '</select></label>' +
        '<button class="btn" data-f="play" aria-pressed="true">' + L.pause + '</button>' +
        '<label>' + L.speed + ' <select data-f="speed">' + [0.25, 0.5, 1, 1.5].map((v) => '<option value="' + v + '"' + (v === 1 ? " selected" : "") + '>' + v + '×</option>').join("") + '</select></label>' +
        (F.items.some((it) => it.bind !== "rigid") ? '<button class="btn" data-f="check" title="' + esc(L.checkTip) + '">' + L.check + '</button>' : '') : '') +
      (F.items.length ? '<span class="v3d-wear"><b>' + L.wear + '</b>' + F.items.map((it) => '<label><input type="checkbox" data-f="wear" value="' + esc(it.id) + '" checked> ' + esc(it.title) + '</label>' +
        (F.onOk ? '<button class="btn mini" data-f="ok" data-id="' + esc(it.id) + '">' + L.ok + '</button>' : '')).join("") + '</span>' : '') +
      '<ul class="v3d-notes"></ul>';
    const notes = panel.querySelector(".v3d-notes");
    const note = (t) => { const li = document.createElement("li"); li.textContent = t; notes.appendChild(li); };
    (F.notes || []).forEach(note);
    if (!rigged) note(L.noRig);
    mixer = new THREE.AnimationMixer(model);
    // a library clip on this model: rotation tracks by bone name, the hips' position scaled from the library rest to the model's
    function retarget(g) {
      const src = g.animations[0]; if (!src) return null;
      let sh = null; g.scene.traverse((o) => { if (o.isBone && !sh && boneKey(o.name) === "hips") sh = o; });
      const th = bones.hips, ratio = sh && Math.abs(sh.position.y) > 1e-6 ? th.position.y / sh.position.y : 1, missing = new Set(), tracks = [];
      src.tracks.forEach((t) => {
        const i = t.name.lastIndexOf("."), node = t.name.slice(0, i), prop = t.name.slice(i + 1), b = bones[boneKey(node)];
        if (!b) { missing.add(node); return; }
        if (prop === "quaternion") { const c = t.clone(); c.name = b.uuid + ".quaternion"; tracks.push(c); }
        else if (prop === "position" && b === th) { const c = t.clone(); c.name = b.uuid + ".position"; c.values = c.values.map((v) => v * ratio); tracks.push(c); }
      });
      disposeTree(g.scene);
      return { clip: new THREE.AnimationClip(src.name, src.duration, tracks), missing: missing.size };
    }
    function play(id) {
      const c = F.clips.find((x) => x.id === id); if (!c || !rigged) return;
      clipName = c.name; info.textContent = L.loading;
      const go = (r) => {
        if (!alive || !r) return;
        if (r.missing && !missNoted) { missNoted = true; note(L.missing.replace("{n}", r.missing)); }
        mixer.stopAllAction(); action = mixer.clipAction(r.clip); action.timeScale = speed; action.play();
        info.textContent = c.name;
        const pb = panel.querySelector('[data-f="play"]'); if (pb) { pb.textContent = L.pause; pb.setAttribute("aria-pressed", "true"); }
      };
      if (cache[id]) return go(cache[id]);
      new GLTFLoader().load(c.url, (g) => { cache[id] = retarget(g); go(cache[id]); }, undefined, (e) => { info.textContent = T.failed + ": " + (e && e.message ? e.message : e); });
    }
    // an item on the model: skinned — its meshes re-bound to the model's bones; rigid — on its bone, the bone's scale undone
    async function wear(it) {
      const r = await load(it.file, it.siblings), obj = r.root;
      if (!alive) { disposeTree(obj); return null; }
      if (it.bind === "rigid") {
        const b = bones[boneKey(it.bone)];
        if (!b) { note(L.noBone.replace("{t}", it.title).replace("{b}", it.bone || "—")); disposeTree(obj); return null; }
        model.updateMatrixWorld(true); const sc = new THREE.Vector3(); b.getWorldScale(sc); obj.scale.divide(sc); b.add(obj);
      } else {
        let skinned = 0; const miss = new Set(), keys = new Set();
        obj.traverse((o) => {
          if (o.morphTargetDictionary) Object.keys(o.morphTargetDictionary).forEach((k) => keys.add(k));
          if (!o.isSkinnedMesh) return; skinned++; o.frustumCulled = false;
          const nb = o.skeleton.bones.map((x) => { const t = bones[boneKey(x.name)]; if (!t) miss.add(x.name); return t || x; });
          o.bind(new THREE.Skeleton(nb, o.skeleton.boneInverses), o.bindMatrix);
        });
        if (!skinned) note(L.noSkin.replace("{t}", it.title));
        else if (miss.size) note(L.itemMiss.replace("{t}", it.title).replace("{n}", miss.size));
        const off = Object.keys(shapeNow).filter((k) => shapeNow[k] > 0 && !keys.has(k));
        if (skinned && off.length) note(L.noShape.replace("{t}", it.title).replace("{k}", off.join(", ")));
        model.add(obj);
      }
      Object.keys(shapeNow).forEach((k) => applyShape(k, shapeNow[k]));
      return obj;
    }
    F.items.forEach((it) => { worn[it.id] = wear(it).catch((e) => { note(it.title + ": " + T.failed + " — " + (e && e.message ? e.message : e)); return null; }); });
    panel.addEventListener("change", (e) => {
      const f = e.target.dataset.f;
      if (f === "clip") play(e.target.value);
      else if (f === "speed") { speed = +e.target.value; if (action) action.timeScale = speed; }
      else if (f === "wear") { const on = e.target.checked; Promise.resolve(worn[e.target.value]).then((o) => { if (o) o.visible = on; }); }
    });
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-f]"); if (!b) return;
      if (b.dataset.f === "check") { clipCheck(b); return; }
      if (b.dataset.f === "play" && action) { clearDots(); const on = b.getAttribute("aria-pressed") !== "true"; action.paused = !on; b.setAttribute("aria-pressed", on); b.textContent = on ? L.pause : L.play; }
      else if (b.dataset.f === "ok") { b.disabled = true; Promise.resolve(F.onOk(b.dataset.id, clipName)).then(() => { b.textContent = L.okDone; }, () => { b.disabled = false; }); }
    });
    if (F.clip) play(F.clip);

    // ⚠ the clipping check: the clip sampled at N frames; a body vertex that lies under the armour in the rest pose (its nearest
    // armour point inside a triangle, behind the surface) and comes out in front of that surface in a frame is a poke-through.
    // Skinned items only (a sword in the hand touches it by design); the result goes to F.onCheck(itemId, result, details).
    let dots = null;
    function clearDots() { if (dots) { scene.remove(dots); dots.geometry.dispose(); dots.material.dispose(); dots = null; } }
    async function clipCheck(btn) {
      if (!action || btn.disabled) return;
      btn.disabled = true; clearDots();
      const all = await Promise.all(F.items.map((it) => worn[it.id])), inItem = new Set(), list = [];
      all.forEach((o) => { if (o) o.traverse((x) => inItem.add(x)); });
      F.items.forEach((it, i) => { if (it.bind !== "rigid" && all[i] && all[i].visible) list.push({ it, o: all[i] }); });
      const body = []; model.traverse((o) => { if (o.isSkinnedMesh && !inItem.has(o)) body.push(o); });
      if (!list.length || !body.length) { note(L.checkNothing); btn.disabled = false; return; }
      const bx = new THREE.Box3().setFromObject(model), hgt = (bx.max.y - bx.min.y) || 1, R = hgt * 0.04, EPS = hgt * 0.001;
      const v = new THREE.Vector3(), cp = new THREE.Vector3(), nrm = new THREE.Vector3(), tri = new THREE.Triangle();
      const worldVerts = (m) => { const n = m.geometry.attributes.position.count, out = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; } return out; };
      const trisOf = (meshes) => { const arr = [];
        meshes.forEach((m) => { const p = worldVerts(m), ix = m.geometry.index, n = ix ? ix.count : p.length / 3;
          for (let i = 0; i + 2 < n; i += 3) [0, 1, 2].forEach((j) => { const a = ix ? ix.getX(i + j) : i + j; arr.push(p[a * 3], p[a * 3 + 1], p[a * 3 + 2]); }); });
        return new Float32Array(arr); };
      const gridOf = (T) => { const g = new Map();
        for (let t = 0; t < T.length; t += 9) {
          const lo = [0, 1, 2].map((d) => Math.floor(Math.min(T[t + d], T[t + 3 + d], T[t + 6 + d]) / R)), hi = [0, 1, 2].map((d) => Math.floor(Math.max(T[t + d], T[t + 3 + d], T[t + 6 + d]) / R));
          for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = x + "," + y + "," + z; (g.get(k) || g.set(k, []).get(k)).push(t); }
        } return g; };
      // the nearest armour triangle within R: the signed distance to its plane and whether the nearest point is inside it (not off its edge)
      const nearest = (T, g, x, y, z) => {
        v.set(x, y, z); const cx = Math.floor(x / R), cy = Math.floor(y / R), cz = Math.floor(z / R), seen = new Set(); let best = R * R, bt = -1;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
          const l = g.get((cx + a) + "," + (cy + b) + "," + (cz + c)); if (!l) continue;
          for (const t of l) { if (seen.has(t)) continue; seen.add(t);
            tri.a.set(T[t], T[t + 1], T[t + 2]); tri.b.set(T[t + 3], T[t + 4], T[t + 5]); tri.c.set(T[t + 6], T[t + 7], T[t + 8]);
            tri.closestPointToPoint(v, cp); const d = cp.distanceToSquared(v); if (d < best) { best = d; bt = t; } }
        }
        if (bt < 0) return null;
        tri.a.set(T[bt], T[bt + 1], T[bt + 2]); tri.b.set(T[bt + 3], T[bt + 4], T[bt + 5]); tri.c.set(T[bt + 6], T[bt + 7], T[bt + 8]); tri.getNormal(nrm);
        const pd = nrm.dot(cp.subVectors(v, tri.a)); return { pd, inside: Math.abs(Math.abs(pd) - Math.sqrt(best)) < EPS * 0.5 };
      };
      const domBone = (m, i) => { const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight; if (!si) return "";
        let bi = 0; for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, bi)) bi = j;
        const bn = m.skeleton.bones[si.getComponent(i, bi)], k = boneKey(bn && bn.name); return (L.bones && L.bones[k.replace(/^(left|right)/, "")]) ? (/^left/.test(k) ? L.left + " " : /^right/.test(k) ? L.right + " " : "") + L.bones[k.replace(/^(left|right)/, "")] : k; };
      const t0 = action.time, wasPaused = action.paused, N = 24, dur = action.getClip().duration;
      action.paused = true;
      // the rest pose: which body vertices the armour covers
      body[0].skeleton.pose(); model.updateMatrixWorld(true);
      const res = list.map(({ it, o }) => { const meshes = []; o.traverse((x) => { if (x.isMesh) meshes.push(x); }); return { it, meshes, covered: [], frames: 0, max: 0, bones: {}, worst: { n: 0, t: 0, pts: [] } }; });
      const rest = body.map(worldVerts);
      res.forEach((r) => { const T = trisOf(r.meshes), g = gridOf(T);
        rest.forEach((p, bi) => { for (let i = 0; i < p.length / 3; i++) { const h = nearest(T, g, p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); if (h && h.inside && h.pd <= EPS) r.covered.push(bi, i); } }); });
      for (let k = 0; k < N; k++) {
        info.textContent = L.checking.replace("{n}", k + 1).replace("{t}", N);
        await new Promise((ok) => requestAnimationFrame(ok)); if (!alive) return;
        const t = dur * k / N; action.time = t; mixer.update(0); model.updateMatrixWorld(true);
        const bp = body.map(worldVerts);
        res.forEach((r) => { if (!r.covered.length) return; const T = trisOf(r.meshes), g = gridOf(T), pts = []; let n = 0;
          for (let j = 0; j < r.covered.length; j += 2) { const bi = r.covered[j], i = r.covered[j + 1], p = bp[bi], h = nearest(T, g, p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
            if (h && h.inside && h.pd > EPS) { n++; pts.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); r.max = Math.max(r.max, h.pd); const bn = domBone(body[bi], i); r.bones[bn] = (r.bones[bn] || 0) + 1; } }
          if (n >= Math.max(3, r.covered.length / 2 * 0.002)) r.frames++; if (n > r.worst.n) r.worst = { n, t, pts }; }); // a frame counts from a few points up, not a stray vertex
      }
      const cm = (d) => Math.max(0.1, Math.round((hgt > 0.5 && hgt < 5 ? d * 100 : d / hgt * 175) * 10) / 10);
      let worst = null;
      for (const r of res) {
        let result, det;
        if (!r.covered.length) { result = "warning"; det = L.clipFar; }
        else if (!r.frames) { result = "passed"; det = L.clipOk.replace("{n}", N); r.worst.n = 0; }
        else {
          const top = Object.keys(r.bones).sort((a, b) => r.bones[b] - r.bones[a]).slice(0, 4).join(", ");
          result = r.max < hgt * 0.006 && r.frames <= N / 8 ? "warning" : "failed";
          det = L.clipBad.replace("{f}", r.frames).replace("{n}", N).replace("{v}", r.worst.n).replace("{all}", r.covered.length / 2).replace("{cm}", cm(r.max)).replace("{b}", top);
          if (!worst || r.worst.n > worst.worst.n) worst = r;
        }
        note("«" + r.it.title + "»: " + det);
        if (F.onCheck) await Promise.resolve(F.onCheck(r.it.id, result, det + " · " + clipName)).catch(() => {});
      }
      if (worst) { // stop on the worst frame and mark the vertices that come through
        action.time = worst.worst.t; mixer.update(0);
        const pb = panel.querySelector('[data-f="play"]'); if (pb) { pb.textContent = L.play; pb.setAttribute("aria-pressed", "false"); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(worst.worst.pts, 3));
        dots = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff3b30, size: hgt * 0.014, depthTest: false })); dots.renderOrder = 999; scene.add(dots);
      } else { action.time = t0; action.paused = wasPaused; mixer.update(0); }
      info.textContent = clipName; btn.disabled = false;
    }
  }

  function close() {
    alive = false;
    renderer.setAnimationLoop(null);
    ro.disconnect();
    controls.dispose();
    disposeTree(scene);
    renderer.dispose();
    renderer.forceContextLoss(); // browsers cap live WebGL contexts: give this one back now
    document.removeEventListener("keydown", onKey, true);
    box.remove();
    if (opener && opener.focus) opener.focus();
  }
  function onKey(e) { if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); close(); } }
  const opener = document.activeElement;
  document.addEventListener("keydown", onKey, true);
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a;
    if (a === "close") close();
    else if (a === "reset") reset();
    else if (a === "shot" && model) { // render now and read the canvas in the same task (no preserveDrawingBuffer needed)
      b.disabled = true;
      renderer.render(scene, camera);
      renderer.domElement.toBlob((blob) => {
        Promise.resolve(blob && onShot(blob)).then(() => { info.textContent = T.shotDone; }, (er) => { info.textContent = T.failed + ": " + (er && er.message ? er.message : er); })
          .then(() => { b.disabled = false; });
      }, "image/png");
    }
    else if (a === "rotate") { controls.autoRotate = !controls.autoRotate; b.setAttribute("aria-pressed", controls.autoRotate); }
    else if (a === "wire" && model) {
      const on = b.getAttribute("aria-pressed") !== "true";
      model.traverse((o) => { [].concat(o.material || []).forEach((m) => { m.wireframe = on; }); });
      b.setAttribute("aria-pressed", on);
    }
  });
  box.querySelector('[data-a="close"]').focus();
}
