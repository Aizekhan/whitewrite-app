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
export async function modelInfo(file, siblings) { const r = await load(file, siblings); return { tris: countTris(r.root), rights: r.meta || "" }; }

export function view3d(file, T, siblings, onShot) {
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
    '<div class="v3d-stage"></div><p class="v3d-hint muted">' + T.hint + '</p>';
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
    if (!alive) return;
    model = root;
    scene.add(model);
    if (clips && clips.length) { mixer = new THREE.AnimationMixer(model); mixer.clipAction(clips[0]).play(); }
    frame();
  }).catch((e) => { info.textContent = T.failed + ": " + (e && e.message ? e.message : e); });

  function close() {
    alive = false;
    renderer.setAnimationLoop(null);
    ro.disconnect();
    controls.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      [].concat(o.material || []).forEach((m) => { Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
    });
    renderer.dispose();
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
