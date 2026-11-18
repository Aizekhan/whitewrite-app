// ============================================================================
// ⤓ A readable GDD outside WhiteWrite (v2.145, owner: «чого не вистачає з геймдизайну» 6): a one-page pitch (logline, fantasy, pillars,
// loop, comparable games, key pictures) and the full GDD in Markdown or PDF — built in the browser from the game's cards in the order
// of the GDD schema (functions/gdd-schema.js STAGES), no AI, no tokens, any plan. PDF = a print-ready page the browser saves as PDF.
// Every export ends with «Зроблено у WhiteWrite». gamebible.js calls window.__GB_EXPORT(B) once (B: getters of its live state).
// ============================================================================
window.__GB_EXPORT = function (B) {
  var GDD = window.__GDD, esc = B.esc;
  var X = { uk: { made: "Зроблено у WhiteWrite", site: "whitewrite.com", pitch: "Питч", gdd: "Геймдизайн-документ", own: "Свої розділи", toc: "Зміст",
      logline: "Логлайн", fantasy: "Фантазія гравця", pillars: "Стовпи гри", loop: "Ігровий цикл", comps: "Схожі ігри", usp: "Чим вона інша", genre: "Жанр", platform: "Платформа", players: "Гравці", audience: "Аудиторія", business: "Бізнес-модель", risk: "Найризикованіше припущення",
      quests: "Квести", dialogues: "Діалоги", purpose: "Призначення", rules: "Правила", rows: "рядків", empty: "Ще порожньо.", noOverview: "Спершу заповни «Огляд гри» — питч будується з нього.", blocked: "Браузер заблокував нове вікно — дозволь спливні вікна для whitewrite.com." },
    en: { made: "Made with WhiteWrite", site: "whitewrite.com", pitch: "Pitch", gdd: "Game design document", own: "Own sections", toc: "Contents",
      logline: "Logline", fantasy: "Player fantasy", pillars: "Pillars", loop: "Core loop", comps: "Comparable games", usp: "What sets it apart", genre: "Genre", platform: "Platform", players: "Players", audience: "Audience", business: "Business model", risk: "Riskiest assumption",
      quests: "Quests", dialogues: "Dialogues", purpose: "Purpose", rules: "Rules", rows: "rows", empty: "Empty so far.", noOverview: "Fill in “Game overview” first — the pitch is built from it.", blocked: "The browser blocked the new window — allow pop-ups for whitewrite.com." } }[B.LANG];
  var nm = function (o) { return o ? (B.LANG === "en" ? o.en : o.uk) : ""; };
  var live = function () { return B.allCards().filter(function (c) { return !c.hidden && !c.archived; }); };
  var isImg = function (f) { return f && f.url && (/^image\//.test(f.type || "") || /\.(png|jpe?g|gif|webp)$/i.test(f.name || "")); };
  var date = function () { return new Date().toLocaleDateString(B.LANG === "en" ? "en-GB" : "uk-UA"); };
  var byOrder = function (a, b) { return (a.order || 0) - (b.order || 0) || String(a.title || "").localeCompare(String(b.title || "")); };
  var val = function (c, k) { return String(((c && c.fields) || {})[k] || "").trim(); };
  var title = function () { return (B.game() || {}).title || "Game"; };
  var mdCell = function (v) { return String(v == null ? "" : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : v).replace(/\|/g, "\\|").replace(/\n/g, " "); };

  // one card → markdown: the canon description, the fields with their labels, a constructor card's purpose / rules / sections, its pictures
  function cardMd(c) {
    var M = window.__MECH, out = ["#### " + (c.title || "…")];
    if (c.canonDesc && String(c.canonDesc.value || "").trim()) out.push(String(c.canonDesc.value).trim());
    (c.defs || []).forEach(function (d) {
      var v = val(c, d.key); if (!v || d.key === "group" || /^(image|file|prefab|audio|sound|model|scene)$/.test(d.type || "")) return;
      out.push(d.type === "table" || /\n/.test(v) ? "**" + d.label + "**\n\n" + v : "**" + d.label + ":** " + v);
    });
    var m = c.mech;
    if (m && M) {
      if (String(m.purpose || "").trim()) out.push("**" + X.purpose + ":** " + m.purpose.trim());
      if (String(m.rules || "").trim()) out.push("**" + X.rules + "**\n\n" + m.rules.trim());
      var fv = function (f, v) { // a value as the author reads it: option labels, yes / no, row names, card titles
        var opt = function (x) { var o = (f.o || []).filter(function (y) { return y.v === x; })[0]; return o ? M.lbl(o.l, B.LANG) : x; };
        var row = function (id) { var rs = (m.sections || []).filter(function (y) { return y.id === f.ref; })[0], r = rs && (rs.rows || []).filter(function (y) { return y._id === id; })[0]; return r ? M.rowName(rs, r) : id; };
        if (f.t === "bool") return v ? "✓" : "—";
        if (f.t === "sel") return opt(v);
        if (f.t === "multi") return (Array.isArray(v) ? v : [v]).map(opt).join(", ");
        if (f.t === "ref") return row(v);
        if (f.t === "refs") return (Array.isArray(v) ? v : [v]).map(row).join(", ");
        if (f.t === "card") return M.cardTokens(v).map(function (t) { var x = M.resolveCard(t, B.cards()); return x ? x.title : t; }).join(", ");
        return v;
      };
      (m.sections || []).forEach(function (s) {
        var fl = (s.fields || []).filter(function (f) { return f.t !== "sound"; }).slice(0, 7), lab = function (f) { return M.lbl(f.l, B.LANG); };
        if (s.kind === "table") {
          var rows = (s.rows || []).filter(function (r) { return fl.some(function (f) { return r[f.k] !== "" && r[f.k] != null; }); });
          if (!rows.length) return;
          out.push("**" + M.lbl(s.title, B.LANG) + "**\n\n| " + fl.map(lab).map(mdCell).join(" | ") + " |\n|" + fl.map(function () { return " --- "; }).join("|") + "|\n" +
            rows.slice(0, 60).map(function (r) { return "| " + fl.map(function (f) { return r[f.k] === "" || r[f.k] == null ? "" : mdCell(fv(f, r[f.k])); }).join(" | ") + " |"; }).join("\n") +
            (rows.length > 60 ? "\n\n… +" + (rows.length - 60) + " " + X.rows : ""));
        } else {
          var vs = (s.fields || []).filter(function (f) { var v = (s.values || {})[f.k]; return v !== "" && v != null && !(Array.isArray(v) && !v.length) && f.t !== "sound"; });
          if (vs.length) out.push("**" + M.lbl(s.title, B.LANG) + "**\n\n" + vs.map(function (f) { return "- " + lab(f) + ": " + mdCell(fv(f, s.values[f.k])); }).join("\n"));
        }
      });
    }
    (c.files || []).filter(isImg).slice(0, 4).forEach(function (f) { out.push("![" + (f.name || "").replace(/[\[\]]/g, "") + "](" + f.url + ")"); });
    return out.join("\n\n");
  }
  // the GDD in stage order: [{ n, name, sections: [{ id, name, cards }] }] + the author's own sections; quests and dialogues as lists
  function outline() {
    var all = live(), secs = B.gameSections(), known = {}, stages = [];
    GDD.STAGES.forEach(function (st) {
      var ss = GDD.SECTIONS.filter(function (s) { return s.stage === st.n; }).map(function (s) {
        known[s.id] = 1; var here = secs.filter(function (x) { return x.id === s.id; })[0];
        var cs = all.filter(function (c) { return c.section === s.id; }).sort(byOrder);
        var extra = s.id === "quests" ? B.quests() : s.id === "dialogues" ? B.dialogues() : [];
        return here && (cs.length || extra.length) ? { id: s.id, name: B.secName(s.id) || nm(s), cards: cs, extra: extra } : null;
      }).filter(Boolean);
      if (ss.length) stages.push({ n: st.n, name: nm(st), sections: ss });
    });
    var own = secs.filter(function (s) { return !known[s.id]; }).map(function (s) { return { id: s.id, name: B.secName(s.id), cards: all.filter(function (c) { return c.section === s.id; }).sort(byOrder), extra: [] }; }).filter(function (s) { return s.cards.length; });
    if (own.length) stages.push({ n: 0, name: X.own, sections: own });
    return stages;
  }
  function narrMd(list, kind) {
    return list.map(function (q) { var t = q.title || q.id; return "- **" + t + "**" + (q.summary ? " — " + String(q.summary).replace(/\n/g, " ") : "") + (kind === "dialogues" && (q.nodes || []).length ? " (" + q.nodes.length + ")" : ""); }).join("\n");
  }
  function gddMd() {
    var ov = live().filter(function (c) { return c.section === "overview"; })[0], st = outline();
    var out = ["# " + title(), "*" + X.gdd + " · " + date() + "*"];
    if (val(ov, "logline")) out.push("> " + val(ov, "logline"));
    out.push("## " + X.toc + "\n\n" + st.map(function (s) { return "- " + (s.n ? s.n + ". " : "") + s.name; }).join("\n"));
    st.forEach(function (s) {
      out.push("## " + (s.n ? s.n + ". " : "") + s.name);
      s.sections.forEach(function (x) {
        out.push("### " + x.name);
        x.cards.forEach(function (c) { out.push(cardMd(c)); });
        if (x.extra.length) out.push(narrMd(x.extra, x.id));
      });
    });
    out.push("---\n\n" + X.made + " · " + X.site);
    return out.join("\n\n") + "\n";
  }
  function pitchData() {
    var all = live(), ov = all.filter(function (c) { return c.section === "overview"; })[0];
    if (!ov) return null;
    var g = B.game() || {}, pics = [];
    if (g.cover && g.cover.url && !/video/.test(g.cover.type || "")) pics.push(g.cover.url);
    ["artstyle", "refs", "scenes", "characters", "enemies", "locations", "pictures"].forEach(function (sid) {
      all.filter(function (c) { return c.section === sid; }).sort(byOrder).forEach(function (c) { (c.files || []).filter(isImg).slice(0, 1).forEach(function (f) { if (pics.length < 5 && pics.indexOf(f.url) < 0) pics.push(f.url); }); });
    });
    var D = window.__DESIGN, pillars = D ? D.listOf(val(ov, "pillars")) : [];
    return { ov: ov, pics: pics, pillars: pillars, facts: [[X.genre, "genre"], [X.platform, "platform"], [X.players, "players"], [X.audience, "audience"], [X.business, "business"]].map(function (x) { return [x[0], val(ov, x[1])]; }).filter(function (x) { return x[1]; }) };
  }
  function pitchMd() {
    var p = pitchData(); if (!p) return null;
    var out = ["# " + title()];
    if (val(p.ov, "logline")) out.push("> " + val(p.ov, "logline"));
    if (p.pics[0]) out.push("![](" + p.pics[0] + ")");
    if (p.facts.length) out.push(p.facts.map(function (f) { return "**" + f[0] + ":** " + f[1]; }).join(" · "));
    [[X.fantasy, "fantasy"], [X.loop, "loop"], [X.usp, "usp"]].forEach(function (x) { if (val(p.ov, x[1])) out.push("## " + x[0] + "\n\n" + val(p.ov, x[1])); });
    if (p.pillars.length) out.push("## " + X.pillars + "\n\n" + p.pillars.map(function (x) { return "- " + x.text; }).join("\n"));
    if (val(p.ov, "comparables")) out.push("## " + X.comps + "\n\n" + val(p.ov, "comparables"));
    if (p.pics.length > 1) out.push(p.pics.slice(1).map(function (u) { return "![](" + u + ")"; }).join("\n"));
    out.push("---\n\n" + X.made + " · " + X.site);
    return out.join("\n\n") + "\n";
  }
  // a print-ready page in a new window; the browser's «Save as PDF» makes the file
  var CSS = "@page{size:A4;margin:16mm} body{font:14px/1.55 Georgia,'Times New Roman',serif;color:#1d1a16;max-width:760px;margin:24px auto;padding:0 20px} h1{font-size:30px;margin:0 0 6px} h2{font-size:20px;margin:26px 0 8px;border-bottom:1px solid #d8cdb8;padding-bottom:4px;break-after:avoid} h3{font-size:16px;margin:18px 0 6px;color:#7a4b0c;break-after:avoid} h4{font-size:15px;margin:14px 0 4px;break-after:avoid}" +
    " blockquote{font-size:17px;font-style:italic;margin:8px 0 16px;color:#4a4236} table{border-collapse:collapse;width:100%;font-size:12px;margin:6px 0} td,th{border:1px solid #d8cdb8;padding:4px 6px;text-align:left;vertical-align:top} img{max-width:100%;max-height:340px;display:block;margin:8px 0;border-radius:4px} .pics{display:grid;grid-template-columns:repeat(2,1fr);gap:8px} .pics img{max-height:200px;width:100%;object-fit:cover;margin:0}" +
    " .facts{color:#4a4236} .made{margin-top:28px;font-size:12px;color:#8a7f6e;text-align:center} .pitch h2{font-size:16px} @media print{.noprint{display:none}}";
  function inline(s) { return B.md(s); }
  function htmlOf(mdText) { // headings, quotes, pictures and rules here; tables, lists and bold through the Bible's own md()
    return mdText.split(/\n\n/).map(function (blk) {
      var h = blk.match(/^(#{1,4}) (.*)$/); if (h && blk.indexOf("\n") < 0) return "<h" + h[1].length + ">" + esc(h[2]) + "</h" + h[1].length + ">";
      if (/^> /.test(blk)) return "<blockquote>" + esc(blk.slice(2)) + "</blockquote>";
      if (/^---/.test(blk)) return "";
      var imgs = blk.split("\n").filter(function (l) { return /^!\[[^\]]*\]\([^)]+\)$/.test(l); });
      if (imgs.length && imgs.length === blk.split("\n").length) return (imgs.length > 1 ? '<div class="pics">' : '') + imgs.map(function (l) { var u = l.match(/\(([^)]+)\)$/)[1]; return /^https:\/\//.test(u) ? '<img src="' + esc(u) + '" alt="">' : ''; }).join("") + (imgs.length > 1 ? '</div>' : '');
      if (/^\*[^*].*\*$/.test(blk)) return '<p class="facts"><i>' + esc(blk.slice(1, -1)) + '</i></p>';
      return inline(blk);
    }).join("\n");
  }
  function printPage(name, mdText, cls) {
    var w = window.open("", "_blank");
    if (!w) return B.notify(X.blocked);
    w.document.write('<!DOCTYPE html><html lang="' + B.LANG + '"><head><meta charset="utf-8"><title>' + esc(name) + '</title><style>' + CSS + '</style></head><body class="' + (cls || "") + '">' +
      htmlOf(mdText) + '<p class="made">' + esc(X.made) + ' · <a href="https://whitewrite.com">' + X.site + '</a></p></body></html>');
    w.document.close();
    var go = function () { try { w.focus(); w.print(); } catch (e) {} };
    var imgs = [].slice.call(w.document.images), left = imgs.length;
    if (!left) return setTimeout(go, 200);
    imgs.forEach(function (im) { var done = function () { if (--left === 0) setTimeout(go, 200); }; if (im.complete) done(); else { im.onload = done; im.onerror = done; } });
  }
  var slug = function () { return B.slugify(title()) || "game"; };
  return {
    pitchMd: pitchMd, gddMd: gddMd, outline: outline,
    pitch: function () { var t = pitchMd(); if (!t) return B.notify(X.noOverview); printPage(title() + " — " + X.pitch, t, "pitch"); },
    gdd: function (fmt) { var t = gddMd(); if (fmt === "md") return B.download(slug() + ".gdd.md", t, "text/markdown;charset=utf-8"); printPage(title() + " — " + X.gdd, t); },
  };
};
