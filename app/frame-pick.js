// «⌖ Кадр» — which part of a picture or video shows on a 16:9 card face, or the whole of it.
// Shared by the shell (world covers, White.html) and the Bible (card / dossier faces, gamebible.js).
// A frame is { x, y, fit }: object-position in % (50 50 = the centre) and object-fit cover | contain.
(function () {
  var T = {
    uk: { title: "Кадр на картці", hint: "Перетягни, щоб у рамці була потрібна частина. Стрілки на клавіатурі теж рухають кадр.", cover: "Заповнити рамку", contain: "Показати повністю",
      reset: "По центру", cancel: "Скасувати", save: "Зберегти" },
    en: { title: "Frame on the card", hint: "Drag so the part you need sits in the frame. The arrow keys move it too.", cover: "Fill the frame", contain: "Show it whole",
      reset: "Centre", cancel: "Cancel", save: "Save" },
  };
  var clamp = function (v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 50; };
  function norm(fr) { fr = fr || {}; return { x: clamp(fr.x), y: clamp(fr.y), fit: fr.fit === "contain" ? "contain" : "cover" }; }
  // the inline style of a face <img>/<video>; "" for the default (cover, centre)
  function style(fr) {
    if (!fr) return "";
    fr = norm(fr);
    return "object-fit:" + fr.fit + ";object-position:" + fr.x + "% " + fr.y + "%";
  }
  function css() {
    if (document.getElementById("ww-frame-css")) return;
    var st = document.createElement("style"); st.id = "ww-frame-css";
    st.textContent = ".wwfr{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(0,0,0,.72);backdrop-filter:blur(3px)}" +
      ".wwfr__box{width:min(680px,calc(100vw - 32px));background:#141118;border:1px solid rgba(240,169,59,.4);border-radius:14px;padding:18px;color:#eadfca;font:14px/1.45 system-ui,sans-serif;display:grid;gap:12px}" +
      ".wwfr__box h3{margin:0;font:600 17px Cinzel,serif;color:#f6e3b5}.wwfr__hint{margin:0;font-size:12.5px;color:#a99d88}" +
      ".wwfr__stage{position:relative;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#07060a;cursor:grab;touch-action:none;outline:2px solid rgba(240,169,59,.55)}" +
      ".wwfr__stage:active{cursor:grabbing}.wwfr__stage:focus-visible{outline:3px solid #f0a93b}" +
      ".wwfr__stage img,.wwfr__stage video{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;user-select:none}" +
      ".wwfr__row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.wwfr__sp{flex:1}" +
      ".wwfr button{font:inherit;font-size:13px;color:#d9ccb4;background:#1d1a22;border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:7px 13px;cursor:pointer}" +
      ".wwfr button[aria-pressed=true],.wwfr .wwfr__save{color:#1c1308;border-color:transparent;background:linear-gradient(180deg,#f6cf7e,#f0a93b)}";
    document.head.appendChild(st);
  }
  // opts: { url, video, frame, lang, onSave(frame) → Promise|void }
  function pick(opts) {
    css();
    var L = T[opts.lang === "en" ? "en" : "uk"], fr = norm(opts.frame);
    var box = document.createElement("div"); box.className = "wwfr";
    box.innerHTML = '<div class="wwfr__box" role="dialog" aria-modal="true" aria-labelledby="wwfr-h"><h3 id="wwfr-h">' + L.title + '</h3><p class="wwfr__hint">' + L.hint + '</p>' +
      '<div class="wwfr__stage" tabindex="0" role="application" aria-label="' + L.title + '"></div>' +
      '<div class="wwfr__row"><button type="button" data-fit="cover">' + L.cover + '</button><button type="button" data-fit="contain">' + L.contain + '</button>' +
      '<button type="button" data-reset>' + L.reset + '</button><span class="wwfr__sp"></span>' +
      '<button type="button" data-x>' + L.cancel + '</button><button type="button" class="wwfr__save" data-ok>' + L.save + '</button></div></div>';
    var stage = box.querySelector(".wwfr__stage"), media = document.createElement(opts.video ? "video" : "img");
    media.src = opts.url; media.alt = "";
    if (opts.video) { media.muted = true; media.autoplay = true; media.loop = true; media.playsInline = true; }
    stage.appendChild(media);
    function paint() {
      media.style.cssText = style(fr);
      [].forEach.call(box.querySelectorAll("[data-fit]"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.fit === fr.fit)); });
    }
    var drag = null;
    stage.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, fx: fr.x, fy: fr.y }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var r = stage.getBoundingClientRect(); // dragging the picture right reveals its left side
      fr.x = clamp(drag.fx - (e.clientX - drag.x) / r.width * 150); fr.y = clamp(drag.fy - (e.clientY - drag.y) / r.height * 150); paint();
    });
    stage.addEventListener("pointerup", function () { drag = null; });
    stage.addEventListener("keydown", function (e) {
      var k = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] }[e.key];
      if (k) { e.preventDefault(); fr.x = clamp(fr.x + k[0]); fr.y = clamp(fr.y + k[1]); paint(); }
    });
    function close() { box.remove(); }
    box.addEventListener("click", function (e) {
      var f = e.target.closest("[data-fit]"); if (f) { fr.fit = f.dataset.fit; paint(); return; }
      if (e.target.closest("[data-reset]")) { fr.x = 50; fr.y = 50; paint(); return; }
      if (e.target.closest("[data-x]") || e.target === box) { close(); return; }
      var ok = e.target.closest("[data-ok]");
      if (ok) { ok.disabled = true; Promise.resolve(opts.onSave(norm(fr))).then(close, function () { ok.disabled = false; }); }
    });
    box.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    document.body.appendChild(box); paint(); stage.focus();
  }
  window.wwFrame = { pick: pick, style: style };
})();
