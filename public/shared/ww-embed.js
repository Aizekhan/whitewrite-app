// Shared shim: when a pillar runs INSIDE the White.html shell (in an iframe),
// hide its own pillar-switcher (the shell owns the menu) and route any
// cross-pillar navigation up to the shell via postMessage instead of a full
// page reload. Standalone (opened directly) → no-op, everything works as before.
(function () {
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
  try { if (new URLSearchParams(location.search).get("embed") === "1") embedded = true; } catch (e) {}
  window.wwEmbedded = embedded;

  if (embedded) {
    document.documentElement.classList.add("ww-embed");
    var style = document.createElement("style");
    // shell provides the one menu → suppress each pillar's own switcher
    style.textContent =
      ".pillswitch{display:none !important;}" +
      ".book-nav{top:max(2vh,12px) !important;}" +
      // shell owns the top nav (≈58px) → push each pillar's own top chrome below it
      ".ww-embed .ws{padding-top:118px !important;}" +
      ".ww-embed .shell{padding-top:118px !important;}" +
      ".ww-embed .wt-root>.brand{top:auto;bottom:18px;}" +
      ".ww-embed .hero-mark{display:none !important;}" +
      // clear the shell logo (top-left) so workspace toolbars don't run under it
      ".ww-embed .ws-head{padding-left:118px !important;}" +
      ".ww-embed .ws-bar{padding-left:118px !important;}";
    (document.head || document.documentElement).appendChild(style);
  }

  function hrefToPillar(href) {
    if (!href) return "book";
    if (href.indexOf("WorldTree") >= 0) return "universe";
    if (href.indexOf("Workspace") >= 0) return "director";
    return "book";
  }

  // Returns true if it handled navigation (embedded). Callers should `return`
  // early when true, skipping their own location-based navigation.
  window.wwGo = function (href) {
    if (!embedded) return false;
    var pillar = hrefToPillar(href);
    var q = "";
    var qi = href.indexOf("?");
    if (qi >= 0) q = href.slice(qi + 1);
    try { window.parent.postMessage({ type: "ww-nav", pillar: pillar, query: q }, "*"); } catch (e) {}
    return true;
  };
}());
