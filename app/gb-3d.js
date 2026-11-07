// 3D viewer for model files on Game Bible cards (glb / gltf / fbx / obj / stl).
// ES module, loaded on demand by gamebible.js: import("./gb-3d.js").then(m => m.view3d(file, labels, cardFiles)).
// three.js comes from unpkg through the import map in "WhiteWrite GameBible.html".
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

export const MODEL_EXT = /\.(glb|gltf|fbx|obj|stl)$/i;

// Textures and .bin buffers the model refers to (e.g. "texture_0.png") are looked up by file name
// among the other files of the same card.
function load(file, siblings) {
  const ext = (file.name.match(MODEL_EXT) || [])[1].toLowerCase();
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url === file.url || /^(blob|data):/.test(url)) return url;
    const base = decodeURIComponent(url.split("?")[0]).split(/[\\/]/).pop().toLowerCase();
    const hit = (siblings || []).find((f) => f.name.toLowerCase() === base);
    return hit ? hit.url : url;
  });
  return new Promise((resolve, reject) => {
    if (ext === "glb" || ext === "gltf") new GLTFLoader(manager).load(file.url, (g) => resolve({ root: g.scene, clips: g.animations, meta: gltfRights(g.parser.json) }), undefined, reject);
    else if (ext === "fbx") new FBXLoader(manager).load(file.url, (o) => resolve({ root: o, clips: o.animations }), undefined, reject);
    else if (ext === "obj") new OBJLoader(manager).load(file.url, (o) => resolve({ root: o, clips: [] }), undefined, reject);
    else new STLLoader(manager).load(file.url, (geo) => {
      geo.computeVertexNormals();
      resolve({ root: new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb9b3a8, roughness: 0.7 })), clips: [] });
    }, undefined, reject);
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
    (opts.rig ? '<div class="v3d-rig"></div>' : '') + (opts.fit ? '<div class="v3d-fit"></div>' : '') + '<div class="v3d-shape" hidden></div><div class="v3d-stage"></div><p class="v3d-hint muted">' + T.hint + '</p>';
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
    if (opts.rig) { frame(); autorig(); return; }
    if (opts.fit) fitting(); else if (clips && clips.length) { mixer = new THREE.AnimationMixer(model); mixer.clipAction(clips[0]).play(); }
    frame();
  }).catch((e) => { info.textContent = T.failed + ": " + (e && e.message ? e.message : e); });

  // the body's shape keys: every mesh that has a morph target of that name follows its slider
  const shapeNow = {};
  function applyShape(k, v) { shapeNow[k] = v; model.traverse((o) => { if (o.morphTargetDictionary && o.morphTargetDictionary[k] != null) o.morphTargetInfluences[o.morphTargetDictionary[k]] = v / 100; }); }
  function shapeKeys() {
    const names = new Set(); model.traverse((o) => { if (o.morphTargetDictionary) Object.keys(o.morphTargetDictionary).forEach((k) => names.add(k)); });
    const keys = Object.keys(opts.labels || opts.shape).filter((k) => names.has(k)); if (!keys.length) return;
    const panel = box.querySelector(".v3d-shape"); panel.hidden = false;
    panel.innerHTML = keys.map((k) => '<label>' + (opts.labels && opts.labels[k] || k) + ' <span>' + (+opts.shape[k] || 0) + '</span><input type="range" min="0" max="100" step="5" value="' + (+opts.shape[k] || 0) + '" data-k="' + k + '"' + (opts.readonly ? ' disabled' : '') + '></label>').join("");
    keys.forEach((k) => applyShape(k, +opts.shape[k] || 0));
    panel.addEventListener("input", (e) => { const k = e.target.dataset.k; if (!k) return; applyShape(k, +e.target.value); e.target.previousElementSibling.textContent = e.target.value; });
    panel.addEventListener("change", (e) => { const k = e.target.dataset.k; if (k && opts.onShape) opts.onShape(k, +e.target.value); });
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

  // 🦴 the auto-rig: 8 markers on a model without a skeleton → the WhiteWrite reference skeleton (opts.rig.ref, Humanoid 65,
  // Mixamo bone names) fitted to them, weights by the distance to the bone segments (4 nearest, a bone never reaches across
  // the body's middle), a SkinnedMesh; opts.fit then plays library clips on it, «Зберегти» exports a GLB + rig.json → opts.rig.onSave.
  function autorig() {
    const RG = opts.rig, L = RG.labels, MK = ["chin", "lwrist", "lelbow", "rwrist", "relbow", "lknee", "rknee", "groin"];
    let panel = box.querySelector(".v3d-rig");
    let has = false; model.traverse((o) => { if (o.isBone || o.isSkinnedMesh) has = true; });
    if (has) { panel.innerHTML = '<p class="v3d-rignow">' + L.hasRig + '</p>'; return; }
    controls.autoRotate = false; box.querySelector('[data-a="rotate"]').setAttribute("aria-pressed", "false");
    const pts = {}, marks = new THREE.Group(), orig = model; scene.add(marks);
    let step = 0, built = null, skel = null, busy = false;
    const bb = () => new THREE.Box3().setFromObject(orig);
    function front() { const b = bb(), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), r = Math.max(s.x, s.y, s.z) || 1;
      home = { pos: new THREE.Vector3(c.x, c.y, c.z + r * 1.9), target: c }; reset(); }
    front();
    function draw() {
      panel.innerHTML = '<ol class="v3d-steps">' + MK.map((k, i) => '<li class="' + (i === step && !built ? "on" : pts[k] ? "done" : "") + '">' + L.mk[k] + '</li>').join("") + '</ol>' +
        '<div class="v3d-rigrow"><span class="v3d-rignow">' + (built ? L.built : step < MK.length ? L.click.replace("{m}", L.mk[MK[step]]) : L.ready) + '</span>' +
        '<button class="btn" data-r="back"' + (step && !built ? '' : ' disabled') + '>' + L.back + '</button>' +
        '<button class="btn" data-r="turn"' + (built ? ' disabled' : '') + '>' + L.turn + '</button>' +
        (built ? '<button class="btn" data-r="redo">' + L.redo + '</button>' + (RG.onSave ? '<button class="btn primary" data-r="save">' + L.save + '</button>' : '')
          : '<button class="btn primary" data-r="build"' + (step === MK.length ? '' : ' disabled') + '>' + L.build + '</button>') + '</div>' +
        '<p class="muted">' + L.hint + '</p>';
    }
    draw();
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
    renderer.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener("pointerup", (e) => {
      if (!down || built || busy || step >= MK.length || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
      const rc = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(ndc, camera); const hits = ray.intersectObject(orig, true); if (!hits.length) return;
      const b = bb(), hgt = b.max.y - b.min.y;
      // the middle of the limb under the cursor: halfway between where the ray enters and leaves it
      const p = hits[1] && hits[1].distance - hits[0].distance < hgt * 0.25 ? hits[0].point.clone().add(hits[1].point).multiplyScalar(0.5) : hits[0].point.clone();
      pts[MK[step]] = p;
      const s = new THREE.Mesh(new THREE.SphereGeometry(hgt * 0.012, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc233, depthTest: false }));
      s.renderOrder = 999; s.position.copy(p); marks.add(s); step++; draw();
    });
    const clearMarks = () => { marks.children.slice().forEach((m) => { marks.remove(m); m.geometry.dispose(); m.material.dispose(); }); };
    panel.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-r]"); if (!b || b.disabled || busy) return;
      const a = b.dataset.r;
      if (a === "back") { step--; delete pts[MK[step]]; const m = marks.children[marks.children.length - 1]; if (m) { marks.remove(m); m.geometry.dispose(); m.material.dispose(); } draw(); }
      else if (a === "turn") { orig.rotation.y += Math.PI / 2; orig.updateMatrixWorld(true); clearMarks(); Object.keys(pts).forEach((k) => delete pts[k]); step = 0; front(); draw(); }
      else if (a === "build") { busy = true; b.disabled = true; try { await build(); } catch (er) { info.textContent = T.failed + ": " + (er && er.message ? er.message : er); } busy = false; draw(); }
      else if (a === "redo") {
        if (mixer) mixer.stopAllAction(); mixer = null;
        scene.remove(built); disposeTree(built); built = null; skel = null; model = orig; scene.add(orig); marks.visible = true;
        const fp = box.querySelector(".v3d-fit"); if (fp) fp.replaceWith(Object.assign(document.createElement("div"), { className: "v3d-fit" })); // the old panel's listeners go with it
        info.textContent = ""; draw();
      }
      else if (a === "save") { busy = true; b.disabled = true; await save(); busy = false; }
    });
    async function build() {
      info.textContent = L.building;
      const g = await new Promise((ok, no) => new GLTFLoader().load(RG.ref, ok, undefined, no));
      g.scene.updateMatrixWorld(true);
      const refB = {}, order = []; let refMin = Infinity, refArm = null;
      g.scene.traverse((o) => {
        if (o.isMesh) refMin = Math.min(refMin, new THREE.Box3().setFromObject(o).min.y);
        if (!o.isBone) return; const k = boneKey(o.name); if (refB[k]) return; if (k === "hips") refArm = o.parent;
        refB[k] = { name: String(o.name).replace(/^mixamorig[:_]?/i, ""), p: o.getWorldPosition(new THREE.Vector3()), q: o.getWorldQuaternion(new THREE.Quaternion()), parent: o.parent && o.parent.isBone ? boneKey(o.parent.name) : null, kids: [] };
        order.push(k);
      });
      order.forEach((k) => { const p = refB[k].parent; if (p) refB[p].kids.push(k); });
      disposeTree(g.scene);
      const r = (k) => refB[k].p, P = Object.assign({}, pts), side = Math.sign(r("leftarm").x - r("hips").x) || 1;
      [["lwrist", "rwrist"], ["lelbow", "relbow"], ["lknee", "rknee"]].forEach(([l, rr]) => { if ((P[l].x - P[rr].x) * side < 0) { const t = P[l]; P[l] = P[rr]; P[rr] = t; } }); // the character's left, whatever was clicked first
      orig.updateMatrixWorld(true);
      const floor = bb().min.y, s = (P.chin.y - P.groin.y) / (r("head").y - r("hips").y);
      if (!(s > 0)) throw new Error(L.badMarks);
      const anchor = { hips: P.groin, head: P.chin, leftforearm: P.lelbow, lefthand: P.lwrist, rightforearm: P.relbow, righthand: P.rwrist, leftleg: P.lknee, rightleg: P.rknee };
      const align = (a, b) => new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());
      const handR = { left: align(r("lefthand").clone().sub(r("leftforearm")), P.lwrist.clone().sub(P.lelbow)), right: align(r("righthand").clone().sub(r("rightforearm")), P.rwrist.clone().sub(P.relbow)) };
      const underHand = (k) => { for (let x = refB[k].parent; x; x = refB[x].parent) if (x === "lefthand" || x === "righthand") return x === "lefthand" ? "left" : "right"; return ""; };
      const T = {};
      order.forEach((k) => {
        const rb = refB[k];
        if (anchor[k]) T[k] = anchor[k].clone();
        else if (["spine", "spine1", "spine2", "neck"].indexOf(k) >= 0) { // along groin → chin, as far up as on the reference
          const f = (r(k).y - r("hips").y) / (r("head").y - r("hips").y);
          T[k] = P.groin.clone().lerp(P.chin, f).add(r(k).clone().sub(r("hips").clone().lerp(r("head"), f)).multiplyScalar(s));
        } else if (k === "leftfoot" || k === "rightfoot") { // the ankle under the knee, as high above the floor as on the reference
          const kn = k === "leftfoot" ? "leftleg" : "rightleg"; T[k] = T[kn].clone().add(r(k).clone().sub(r(kn)).multiplyScalar(s)); T[k].y = floor + (r(k).y - refMin) * s;
        } else if (rb.parent) { const off = r(k).clone().sub(r(rb.parent)).multiplyScalar(s), h = underHand(k); if (h) off.applyQuaternion(handR[h]); T[k] = T[rb.parent].clone().add(off); }
        else T[k] = r(k).clone();
      });
      const prim = (k) => { const kids = refB[k].kids; if (!kids.length) return null; if (kids.length === 1) return kids[0];
        return { hips: "spine", spine2: "neck", lefthand: "lefthandmiddle1", righthand: "righthandmiddle1" }[k] || kids[0]; };
      const W = {};
      order.forEach((k) => { const c = prim(k), rb = refB[k];
        if (c) W[k] = align(r(c).clone().sub(r(k)), T[c].clone().sub(T[k])).multiply(rb.q.clone());
        else W[k] = (rb.parent ? W[rb.parent].clone() : new THREE.Quaternion()).multiply(rb.parent ? refB[rb.parent].q.clone().invert().multiply(rb.q) : rb.q.clone()); });
      // the armature as on the reference (its rotation / scale): the library clips' hips rotation is relative to it
      const armature = new THREE.Object3D(), BN = {}, list = [], aq = refArm.getWorldQuaternion(new THREE.Quaternion()), asc = refArm.getWorldScale(new THREE.Vector3()).x || 1;
      armature.name = "Armature"; refArm.getWorldPosition(armature.position); armature.quaternion.copy(aq); armature.scale.setScalar(asc);
      order.forEach((k) => { const rb = refB[k], bone = new THREE.Bone(); bone.name = "mixamorig:" + rb.name; BN[k] = bone; list.push(bone);
        const pq = (rb.parent ? W[rb.parent] : aq).clone().invert(), pp = rb.parent ? T[rb.parent] : armature.position;
        bone.position.copy(T[k].clone().sub(pp).applyQuaternion(pq).divideScalar(asc)); bone.quaternion.copy(pq.clone().multiply(W[k]));
        (rb.parent ? BN[rb.parent] : armature).add(bone); });
      // weights: the 4 nearest bone segments, 1 / d⁴; a left bone never takes a vertex on the right of the middle (and back)
      const segs = order.filter((k) => prim(k)).map((k) => ({ i: order.indexOf(k), a: T[k], b: T[prim(k)], side: /^left/.test(k) ? 1 : /^right/.test(k) ? -1 : 0 }));
      const cx = T.hips.x, margin = 0.02 * s, eps = 0.01 * s, ab = new THREE.Vector3(), ap = new THREE.Vector3(), cl = new THREE.Vector3(), v = new THREE.Vector3();
      const dist = (a, b) => { ab.subVectors(b, a); const t = Math.max(0, Math.min(1, ap.subVectors(v, a).dot(ab) / (ab.lengthSq() || 1))); return v.distanceTo(cl.copy(a).addScaledVector(ab, t)); };
      const group = new THREE.Group(); group.name = String(file.name || "model").replace(/.[^.]+$/, ""); group.add(armature);
      const meshes = []; orig.traverse((o) => { if (o.isMesh) meshes.push(o); });
      let done = 0; const total = meshes.reduce((n, m) => n + m.geometry.attributes.position.count, 0);
      for (const m of meshes) {
        const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); geo.morphAttributes = {};
        const pos = geo.attributes.position, n = pos.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(pos, i); const best = [];
          for (const sg of segs) {
            if (sg.side && (v.x - cx) * side * sg.side < -margin) continue;
            const d = dist(sg.a, sg.b); if (best.length < 4 || d < best[3].d) { best.push({ i: sg.i, d }); best.sort((x, y) => x.d - y.d); if (best.length > 4) best.pop(); }
          }
          let tot = 0; best.forEach((x) => { x.w = 1 / Math.pow(x.d + eps, 4); tot += x.w; });
          best.forEach((x, j) => { si[i * 4 + j] = x.i; sw[i * 4 + j] = x.w / tot; });
          if (++done % 3000 === 0) { info.textContent = L.weights.replace("{p}", Math.round(done / total * 100)); await new Promise((ok) => requestAnimationFrame(ok)); if (!alive) return; }
        }
        geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
        const sm = new THREE.SkinnedMesh(geo, m.material); sm.name = m.name || "Body"; sm.frustumCulled = false; group.add(sm);
      }
      group.updateMatrixWorld(true); skel = new THREE.Skeleton(list);
      group.traverse((o) => { if (o.isSkinnedMesh) o.bind(skel, new THREE.Matrix4()); });
      scene.remove(orig); marks.visible = false; built = group; model = group; scene.add(group);
      info.textContent = L.built;
      if (opts.fit) fitting();
    }
    async function save() {
      info.textContent = L.saving;
      try {
        const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
        if (mixer) mixer.stopAllAction(); skel.pose(); built.updateMatrixWorld(true); // exported in the bind pose
        const buf = await new GLTFExporter().parseAsync(built, { binary: true }), b = new THREE.Box3().setFromObject(built);
        const report = { schema: "artpipeline.rig/1", skeleton: "mixamo65", body_type: RG.body || "", height_m: Math.round((b.max.y - b.min.y) * 1000) / 1000, bones_found: skel.bones.length,
          bones_missing: [], tris: countTris(built), shape_keys: [], weights: "auto · WhiteWrite (distance to bones)", source: "WhiteWrite autorig (8 markers)" };
        await RG.onSave(new Blob([buf], { type: "model/gltf-binary" }), report);
        info.textContent = L.saved;
      } catch (er) { info.textContent = T.failed + ": " + (er && er.message ? er.message : er); }
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
