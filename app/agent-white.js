// Агент White — the narrow assistant at the top of the World Bible / game GDD (paid plans from Storyteller, paid-features agentWhite).
// The page keeps the conversation (tabs per world / game in localStorage) and runs every tool itself: the folder the author opens
// in the browser (File System Access API, read only), the Bible through window.__bible (gamebible.js), the knowledge base
// (window.WW_KB of the shell, else kb.js loaded here). The server (functions/src/agent.js agentWhite) makes one Claude step per call.
// The history is only appended to, never edited (thinking blocks stay valid); tool results are trimmed when they are made.
(function () {
  "use strict";
  var FN = "https://us-central1-whitewrite-app.cloudfunctions.net/agentWhite";
  var MAX_STEPS = 12, MAX_SEND = 550000, READ_CHARS = 40000, LIST_MAX = 300;
  var TEXT_EXT = /\.(md|markdown|txt|json|csv|tsv|ya?ml|xml|html?|css|js|ts|cs|py|ini|cfg|toml|log|srt|fountain|rtf)$/i;
  var T = {
    uk: { ph: "Запитай агента White: «заповни світ з моєї теки», «де ключ MCP?»…", send: "Надіслати", stop: "■ Стоп", folder: "📂 Тека",
      folderTip: "Відкрий теку з матеріалами — агент читатиме її (лише читання). Працює в Chrome і Edge.", folderNo: "Цей браузер не дає сайтам відкривати теки — спробуй Chrome чи Edge на компʼютері.",
      noFolder: "Теку не відкрито: попроси автора натиснути «📂 Тека».", newTab: "＋ Нова розмова", tab: "Розмова", close: "Закрити вкладку", fold: "Згорнути", unfold: "Розгорнути",
      cost: "Кожен крок агента — реальна вартість ШІ, не більше ≈ {n} токенів за цей крок.", spent: "Витрачено в розмові: {n}",
      lock: "✦ Агент White — з тарифу Storyteller: читає твою теку й пропонує заповнити Біблію, відповідає про сервіс, відкриває розділи.", plans: "Тарифи",
      thinking: "Агент думає…", stopped: "Зупинено автором.", limit: "Агент зробив {n} кроків поспіль і зупинився — напиши «далі», щоб продовжити.",
      tooLong: "Розмова завелика — почни нову вкладку (＋).", lost: "Попередню розмову не вдалося зберегти повністю — нове повідомлення почне її заново.",
      tools: { list_folder: "📂 дивиться теку", read_file: "📄 читає", read_bible: "📜 читає Біблію", kb_search: "❓ шукає в Базі знань", kb_article: "❓ читає статтю",
        propose_world_fill: "✦ пропонує канон світу", propose_cards: "✦ пропонує картки гри", open_section: "↗ відкриває розділ" },
      refused: "Агент не може виконати цей запит.", grant: "Дозволь браузеру читати теку «{d}», щоб агент її бачив." },
    en: { ph: "Ask agent White: «fill the world from my folder», «where is the MCP key?»…", send: "Send", stop: "■ Stop", folder: "📂 Folder",
      folderTip: "Open the folder with your material — the agent will read it (read only). Works in Chrome and Edge.", folderNo: "This browser doesn't let sites open folders — try Chrome or Edge on a computer.",
      noFolder: "No folder is open: ask the author to press «📂 Folder».", newTab: "＋ New chat", tab: "Chat", close: "Close the tab", fold: "Fold", unfold: "Unfold",
      cost: "Each agent step costs the real AI price, never above ≈ {n} tokens for this step.", spent: "Spent in this chat: {n}",
      lock: "✦ Agent White — from the Storyteller plan: reads your folder and proposes how to fill the Bible, answers about the service, opens sections.", plans: "Plans",
      thinking: "The agent is thinking…", stopped: "Stopped by the author.", limit: "The agent made {n} steps in a row and paused — write «continue» to go on.",
      tooLong: "The chat is too long — start a new tab (＋).", lost: "The previous chat could not be saved in full — a new message starts it over.",
      tools: { list_folder: "📂 looks at the folder", read_file: "📄 reads", read_bible: "📜 reads the Bible", kb_search: "❓ searches the Knowledge base", kb_article: "❓ reads an article",
        propose_world_fill: "✦ proposes world canon", propose_cards: "✦ proposes game cards", open_section: "↗ opens a section" },
      refused: "The agent can't do this request.", grant: "Let the browser read the folder «{d}» so the agent can see it." }
  };
  var B = function () { return window.__bible; };
  var L = function () { return T[(B() && B().ctx().lang) === "en" ? "en" : "uk"]; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); };
  var $ = function (id) { return document.getElementById(id); };

  // ---------- state: tabs per world / game ----------
  var key = "", tabs = [], cur = 0, open = false, busy = false, stopAsk = false, dir = null;
  var store = function () { return "ww-agent-" + key; };
  function load() {
    var c = B().ctx(), k = c.worldId + (c.gameId ? "/" + c.gameId : "");
    if (k === key) return false;
    key = k; tabs = []; cur = 0; dir = null;
    try { var d = JSON.parse(localStorage.getItem(store()) || "null"); if (d && d.tabs) { tabs = d.tabs; cur = Math.min(d.cur || 0, tabs.length - 1); } } catch (e) {}
    if (!tabs.length) tabs = [blank()];
    B().folderLoad().then(function (h) { dir = h; draw(); });
    return true;
  }
  function blank() { return { messages: [], shown: [], spent: 0 }; }
  function save() {
    try { localStorage.setItem(store(), JSON.stringify({ tabs: tabs, cur: cur })); }
    catch (e) { // over the browser's quota: keep what was shown, the next message starts the chat over
      try { localStorage.setItem(store(), JSON.stringify({ tabs: tabs.map(function (t) { return { messages: [], shown: t.shown.concat(t.messages.length ? [{ who: "note", text: L().lost }] : []), spent: t.spent }; }), cur: cur })); } catch (e2) {}
    }
  }
  var tab = function () { return tabs[cur]; };

  // ---------- the bar ----------
  function md(s) { // the agent's markdown, minimally: bold, code, line breaks, list dashes
    return esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
  }
  function lineHtml(m) {
    if (m.who === "me") return '<div class="ag-me">' + esc(m.text) + '</div>';
    if (m.who === "ai") return '<div class="ag-ai">' + md(m.text) + '</div>';
    if (m.who === "tool") return '<div class="ag-tool">' + esc(m.text) + '</div>';
    if (m.who === "err") return '<div class="ag-err" role="alert">' + esc(m.text) + '</div>';
    return '<div class="ag-note">' + esc(m.text) + '</div>';
  }
  function draw() {
    var host = $("agent"), b = B(); if (!host || !b) return;
    var c = b.ctx();
    if (!c.owner || !c.worldId) { host.hidden = true; return; }
    host.hidden = false;
    if (!c.may) {
      host.innerHTML = '<div class="ag-row ag-lock"><span>' + esc(L().lock) + '</span><button class="btn" id="ag-plans" type="button">' + esc(L().plans) + '</button></div>';
      $("ag-plans").onclick = function () { try { window.parent.postMessage({ type: "ww-account" }, location.origin); } catch (e) {} };
      return;
    }
    load();
    var t = tab(), X = L(), canPick = !!window.showDirectoryPicker, log = t.shown.length && open, tabsOn = open && (t.shown.length || tabs.length > 1);
    var bytes = JSON.stringify(t.messages).length;
    host.innerHTML = (tabsOn ? '<div class="ag-tabs" role="tablist">' + tabs.map(function (x, i) {
        var name = (x.shown.filter(function (m) { return m.who === "me"; })[0] || {}).text || X.tab + " " + (i + 1);
        return '<span class="ag-tab' + (i === cur ? ' on' : '') + '"><button type="button" role="tab" aria-selected="' + (i === cur) + '" data-agtab="' + i + '">' + esc(name.slice(0, 28)) + '</button>' +
          (tabs.length > 1 ? '<button type="button" class="ag-x" data-agclose="' + i + '" aria-label="' + esc(X.close) + '">×</button>' : '') + '</span>';
      }).join("") + '<button type="button" class="ag-tab ag-new" id="ag-new">' + esc(X.newTab) + '</button><button type="button" class="ag-fold" id="ag-fold" aria-label="' + esc(X.fold) + '">▴</button></div>' : '') +
      (log ? '<div class="ag-log" id="ag-log" aria-live="polite">' + t.shown.map(lineHtml).join("") + (busy ? '<div class="ag-note">' + esc(X.thinking) + '</div>' : '') + '</div>' : '') +
      '<form class="ag-row" id="ag-form"><span class="ag-mark" aria-hidden="true">✦</span><textarea id="ag-in" rows="1" placeholder="' + esc(X.ph) + '" aria-label="' + esc(X.ph) + '"></textarea>' +
      ((t.shown.length || tabs.length > 1) && !open ? '<button type="button" class="btn ghost" id="ag-unfold" aria-label="' + esc(X.unfold) + '">▾ ' + t.shown.filter(function (m) { return m.who === "me"; }).length + '</button>' : '') +
      '<button type="button" class="btn" id="ag-dir" title="' + esc(canPick ? X.folderTip : X.folderNo) + '"' + (canPick ? '' : ' disabled') + '>' + esc(X.folder) + (dir ? ' · ' + esc(dir.name) : '') + '</button>' +
      (busy ? '<button type="button" class="btn" id="ag-stop">' + esc(X.stop) + '</button>' : '<button class="btn primary" id="ag-send">' + esc(X.send) + '</button>') + '</form>' +
      '<p class="ag-cost">' + esc(X.cost.replace("{n}", (c.quote(bytes + 20000) || "…").toLocaleString())) + (t.spent ? ' · ' + esc(X.spent.replace("{n}", t.spent.toLocaleString())) : '') + '</p>';
    var lg = $("ag-log"); if (lg) lg.scrollTop = lg.scrollHeight;
    bind();
  }
  function bind() {
    var inp = $("ag-in");
    inp.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("ag-form").requestSubmit(); } };
    inp.oninput = function () { inp.style.height = "auto"; inp.style.height = Math.min(160, inp.scrollHeight) + "px"; };
    $("ag-form").onsubmit = function (e) { e.preventDefault(); var v = inp.value.trim(); if (!v || busy) return; inp.value = ""; ask(v); };
    $("ag-dir").onclick = async function () {
      if (!window.showDirectoryPicker) return;
      try { dir = await window.showDirectoryPicker({ id: "ww-agent", mode: "read" }); } catch (e) { return; }
      B().folderSave(dir); draw();
    };
    if ($("ag-stop")) $("ag-stop").onclick = function () { stopAsk = true; this.disabled = true; };
    if ($("ag-new")) $("ag-new").onclick = function () { tabs.push(blank()); cur = tabs.length - 1; save(); draw(); $("ag-in").focus(); };
    if ($("ag-fold")) $("ag-fold").onclick = function () { open = false; draw(); };
    if ($("ag-unfold")) $("ag-unfold").onclick = function () { open = true; draw(); };
    [].forEach.call(document.querySelectorAll("[data-agtab]"), function (b) { b.onclick = function () { if (busy) return; cur = +b.dataset.agtab; save(); draw(); }; });
    [].forEach.call(document.querySelectorAll("[data-agclose]"), function (b) { b.onclick = function () {
      if (busy) return; tabs.splice(+b.dataset.agclose, 1); if (!tabs.length) tabs = [blank()]; cur = Math.min(cur, tabs.length - 1); save(); draw(); }; });
  }

  // ---------- the loop: one server step per call, the page runs the tools ----------
  async function call(messages) {
    var c = B().ctx(), token = await firebase.auth().currentUser.getIdToken();
    var r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ worldId: c.worldId, gameId: c.gameId, language: c.lang, messages: messages }) });
    var data = await r.json().catch(function () { return { error: "HTTP " + r.status }; });
    if (!r.ok) throw new Error(data.error || "HTTP " + r.status);
    return data;
  }
  async function ask(text) {
    var t = tab(), X = L();
    if (JSON.stringify(t.messages).length > MAX_SEND) { t.shown.push({ who: "err", text: X.tooLong }); open = true; draw(); return; }
    if (dir && dir.queryPermission && (await dir.queryPermission({ mode: "read" })) !== "granted") { // a click is a user gesture: ask now, the tools can't
      try { await dir.requestPermission({ mode: "read" }); } catch (e) {}
    }
    t.messages.push({ role: "user", content: text }); t.shown.push({ who: "me", text: text });
    busy = true; stopAsk = false; open = true; save(); draw();
    try {
      for (var step = 1; ; step++) {
        var d = await call(t.messages);
        t.spent += d.tokensConsumed || 0;
        t.messages.push({ role: "assistant", content: d.content });
        d.content.forEach(function (b) { if (b.type === "text" && b.text.trim()) t.shown.push({ who: "ai", text: b.text.trim() }); });
        if (d.stopReason === "refusal") t.shown.push({ who: "note", text: X.refused });
        var uses = d.content.filter(function (b) { return b.type === "tool_use"; });
        if (!uses.length) break;
        var results = [];
        for (var i = 0; i < uses.length; i++) {
          var u = uses[i];
          t.shown.push({ who: "tool", text: (X.tools[u.name] || u.name) + toolNote(u) });
          save(); draw();
          var out;
          if (stopAsk) out = { text: "Stopped by the author.", err: true };
          else if (d.stopReason === "max_tokens") out = { text: "The call was cut off (too long). Propose in smaller parts.", err: true };
          else { try { out = { text: await runTool(u.name, u.input || {}) }; } catch (e) { out = { text: String(e.message || e), err: true }; } }
          results.push({ type: "tool_result", tool_use_id: u.id, content: String(out.text).slice(0, READ_CHARS + 2000), is_error: !!out.err });
        }
        t.messages.push({ role: "user", content: results }); // every tool_use gets its result, even when stopping
        if (stopAsk) { t.shown.push({ who: "note", text: X.stopped }); break; }
        if (step >= MAX_STEPS) { t.shown.push({ who: "note", text: X.limit.replace("{n}", MAX_STEPS) }); break; }
        save(); draw();
      }
    } catch (e) { t.shown.push({ who: "err", text: e.message || String(e) }); }
    busy = false; save(); draw();
  }
  function toolNote(u) {
    var i = u.input || {};
    return i.path ? " " + i.path : i.query ? " «" + i.query + "»" : i.name ? " «" + i.name + "»" : i.id ? " " + i.id : i.kind ? " " + i.kind : "";
  }

  async function sub(path) { // a folder below the opened one (no «..», no absolute paths)
    if (!dir) throw new Error(L().noFolder);
    if ((await dir.queryPermission({ mode: "read" })) !== "granted") throw new Error(L().grant.replace("{d}", dir.name));
    var h = dir, parts = String(path || "").replace(/\\/g, "/").split("/").filter(function (p) { return p && p !== "."; });
    if (parts.indexOf("..") >= 0) throw new Error("«..» is not allowed");
    return { h: h, parts: parts };
  }
  async function runTool(name, a) {
    var b = B();
    if (name === "list_folder") {
      var s = await sub(a.path), h = s.h;
      for (var i = 0; i < s.parts.length; i++) h = await h.getDirectoryHandle(s.parts[i]);
      var out = [], more = 0;
      for await (var ent of h.values()) {
        if (out.length >= LIST_MAX) { more++; continue; }
        if (ent.kind === "directory") out.push(ent.name + "/");
        else { var f = await ent.getFile(); out.push(ent.name + "  (" + Math.ceil(f.size / 1024) + " KB)"); }
      }
      out.sort();
      return (out.join("\n") || "(empty)") + (more ? "\n… and " + more + " more" : "");
    }
    if (name === "read_file") {
      var r = await sub(a.path), fh = r.h, last = r.parts.pop();
      if (!last) throw new Error("A file path is needed");
      for (var j = 0; j < r.parts.length; j++) fh = await fh.getDirectoryHandle(r.parts[j]);
      if (!TEXT_EXT.test(last)) throw new Error("Not a text file: " + last + " — ask the author for a .md / .txt copy");
      var text = await (await (await fh.getFileHandle(last)).getFile()).text(), off = Math.max(0, a.offset | 0), part = text.slice(off, off + READ_CHARS);
      return part + (off + READ_CHARS < text.length ? "\n\n[… " + (text.length - off - READ_CHARS) + " more characters — read_file with offset " + (off + READ_CHARS) + "]" : "");
    }
    if (name === "read_bible") return a.what === "list" ? b.list(a.kind) : a.what === "item" ? b.item(a.kind, a.name) : b.overview();
    if (name === "kb_search") return kbSearch(a.query);
    if (name === "kb_article") return kbArticle(a.id);
    if (name === "propose_world_fill") return b.proposeFill(a.fill);
    if (name === "propose_cards") return b.proposeCards(a.cards);
    if (name === "open_section") return b.open(a.id);
    throw new Error("Unknown tool " + name);
  }

  // ---------- the knowledge base: the shell's, else kb.js loaded into this page ----------
  function kb() {
    try { if (window.parent !== window && window.parent.WW_KB) return window.parent.WW_KB; } catch (e) {}
    return window.WW_KB || null;
  }
  function plain(x) {
    if (x == null) return "";
    if (Array.isArray(x)) return x.map(plain).join("\n");
    return String(x).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  }
  function artText(a) {
    return a.title + "\n" + plain(a.lead) + "\n" + (a.body || []).map(function (blk) { return Array.isArray(blk) && typeof blk[1] !== "undefined" && typeof blk[1] !== "function" ? plain(blk[1]) : ""; }).join("\n");
  }
  function kbSearch(q) {
    var K = kb(); if (!K) return "The knowledge base is not loaded";
    var words = String(q || "").toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter(function (w) { return w.length > 2; });
    var hits = (K.articles || []).map(function (a) {
      var txt = artText(a), low = txt.toLowerCase(), title = String(a.title).toLowerCase(), score = 0, line = "";
      words.forEach(function (w) { var stem = w.slice(0, Math.max(4, w.length - 2)); if (low.indexOf(stem) >= 0) score += 1 + (title.indexOf(stem) >= 0 ? 2 : 0); });
      if (score) line = txt.split("\n").filter(function (l) { var ll = l.toLowerCase(); return words.some(function (w) { return ll.indexOf(w.slice(0, Math.max(4, w.length - 2))) >= 0; }); }).slice(1, 4).join(" · ").slice(0, 400);
      return { a: a, score: score, line: line };
    }).filter(function (h) { return h.score; }).sort(function (x, y) { return y.score - x.score; }).slice(0, 6);
    return hits.length ? hits.map(function (h) { return "[" + h.a.id + "] " + h.a.title + " — " + plain(h.a.lead) + (h.line ? "\n   " + h.line : ""); }).join("\n") : "Nothing found for «" + q + "»";
  }
  function kbArticle(id) {
    var K = kb(), a = K && (K.articles || []).filter(function (x) { return x.id === id; })[0];
    return a ? artText(a).slice(0, 20000) : "No article " + id;
  }
  function needKb() {
    if (kb()) return;
    var s = document.createElement("script"); s.src = "kb.js"; document.head.appendChild(s);
  }

  // the Bible tells us when the world / game / plan is known or changes (gamebible.js → ww-bible-ctx)
  // (every render sends it; only a real change redraws, so typing is never wiped by a live snapshot)
  var sig = "";
  window.addEventListener("ww-bible-ctx", function () {
    var c = B() && B().ctx(); if (!c) return;
    var s = [c.worldId, c.gameId, c.may, c.owner, c.lang].join("|");
    if (s === sig || busy) return;
    sig = s; draw();
  });
  window.addEventListener("load", function () { setTimeout(needKb, 2000); });
})();
