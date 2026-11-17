// ============================================================================
// 🗄 Архів · 🔗 links · project assets of the Game Bible (v2.142, GDD refocus; the first part of gamebible.js moved into its own module —
// ARCHITECTURE «gamebible.js — переробляти поступово»). Claude Code archives a card instead of deleting it (MCP archive_card → card.archived),
// links two cards with a role (link_cards → card.links, shown in «🔗 Що зачепить зміна» by functions/card-refs.js) and points a card at an
// asset of the project (link_project_asset → card.projectAssets). The author restores / deletes archived cards in the section's «🗄 Архів»
// and removes a link or an asset with ✕. gamebible.js calls window.__GB_LINKS(B) once with what it needs (B: getters of its live state).
// ============================================================================
window.__GB_LINKS = function (B) {
  var esc = B.esc, firebase = window.firebase;
  var ARC = { uk: { title: "🗄 Архів", hint: "Картки, які Claude Code переніс в архів, бо вони вже не відповідають грі. Їх немає в меню, позначках етапів і плані. Поверни картку або видали її.",
      back: "↺ Повернути", del: "Видалити", into: "Тепер у: ", unlink: "Прибрати звʼязок", pa: "🔗 У проєкті гри", paHint: "Ассети проєкту, на які вказує ця картка (додає Claude Code).", unpa: "Прибрати", unchecked: "шлях без індексу проєкту" },
    en: { title: "🗄 Archive", hint: "Cards Claude Code moved to the archive because they no longer match the game. They are not in the menu, the stage marks or the plan. Restore a card or delete it.",
      back: "↺ Restore", del: "Delete", into: "Now in: ", unlink: "Remove the link", pa: "🔗 In the game project", paHint: "Assets of the project this card points at (added by Claude Code).", unpa: "Remove", unchecked: "path without a project index" } }[B.LANG];
  var fail = function (e) { B.notify(B.STR.failed + ": " + (e.message || e)); };

  function archHtml(sid) {
    var list = B.archCards().filter(function (c) { return c.section === sid; });
    if (!list.length) return "";
    var title = function (k) { var x = B.allCards().filter(function (y) { return y.key === k; })[0]; return x ? x.title : k; };
    return '<details class="arch"><summary>' + ARC.title + ' · ' + list.length + '</summary><p class="hint">' + esc(ARC.hint) + '</p>' + list.map(function (c) {
      var a = c.archived || {};
      return '<div class="arch-row"><div><b>' + esc(c.title || "…") + '</b>' + (a.reason ? '<p class="muted">' + esc(a.reason) + '</p>' : '') + (a.into ? '<p class="muted">' + esc(ARC.into + title(a.into)) + '</p>' : '') +
        '<p class="muted">' + esc(B.when(a.at) || "") + '</p></div>' + (B.canWrite() ? '<div class="row"><button class="btn" data-unarch="' + esc(c.id) + '">' + ARC.back + '</button><button class="btn danger" data-delarch="' + esc(c.id) + '">' + ARC.del + '</button></div>' : '') + '</div>';
    }).join("") + '</details>';
  }
  function archWire() {
    [].forEach.call(document.querySelectorAll("[data-unarch]"), function (b) { b.onclick = function () { b.disabled = true;
      B.gref().collection("cards").doc(b.dataset.unarch).update({ archived: firebase.firestore.FieldValue.delete(), updatedAt: B.stamp() }).catch(function (e) { b.disabled = false; fail(e); }); }; });
    [].forEach.call(document.querySelectorAll("[data-delarch]"), function (b) { b.onclick = async function () {
      var c = B.archCards().filter(function (x) { return x.id === b.dataset.delarch; })[0]; if (!c || !(await B.askConfirm(B.STR.confirmDel, { danger: true }))) return;
      await Promise.all((c.files || []).filter(function (f) { return !f.linked && !B.pathShared(c, f.path); }).map(function (f) { return firebase.storage().ref(f.path).delete().catch(function () {}); }));
      B.gref().collection("cards").doc(c.id).delete().catch(fail);
    }; });
  }
  // the game card doc that holds a key's links: "c:<id>" — itself, "e:<id>" — the canon entity's game card
  function linkDoc(k) {
    var cards = B.cards();
    if (k.indexOf("e:") === 0) { var c = cards.filter(function (x) { return x.canonRef === k.slice(2); })[0]; return c ? { id: c.id, c: c, canon: { section: c.section, canonRef: c.canonRef } } : null; }
    var g = cards.filter(function (x) { return x.id === k.slice(2) && !x.canonRef; })[0]; return g ? { id: g.id, c: g, canon: {} } : null;
  }
  function unlink(spec, btn) { // "from|to|role"; btn — its ✕ (the chip goes at once: an open card is not re-rendered by the snapshot)
    var p = spec.split("|"), d = linkDoc(p[0]); if (!d || !B.canWrite()) return;
    var rest = (d.c.links || []).filter(function (l) { return !(l.to === p[1] && l.role === p[2]); });
    B.gref().collection("cards").doc(d.id).set(Object.assign({ links: rest, updatedAt: B.stamp() }, d.canon), { merge: true })
      .then(function () { d.c.links = rest; if (btn) { if (btn.previousElementSibling) btn.previousElementSibling.remove(); btn.remove(); } }).catch(fail);
  }
  // a chip of «🔗 Що зачепить зміна» that is a link carries its ✕
  function unlinkBtn(i) {
    return i.unlink && B.canWrite() ? '<button class="btn mini" data-unlink="' + esc(i.unlink) + '" title="' + esc(ARC.unlink) + '" aria-label="' + esc(ARC.unlink + " " + i.name) + '">✕</button>' : '';
  }
  function paHtml(c) {
    var list = c.projectAssets || []; if (!list.length) return "";
    return '<div class="field impact pa"><h4 class="dsub">' + ARC.pa + ' <span class="muted">' + list.length + '</span></h4><p class="hint">' + esc(ARC.paHint) + '</p><ul class="pa-list">' + list.map(function (a, i) {
      return '<li><code>' + esc(a.path || a.guid) + '</code>' + (a.type ? ' <span class="muted">' + esc(a.type) + '</span>' : '') + (a.verified ? '' : ' <span class="muted">· ' + ARC.unchecked + '</span>') +
        (a.note ? '<p class="muted">' + esc(a.note) + '</p>' : '') + (B.canWrite() ? ' <button class="btn mini" data-unpa="' + i + '" aria-label="' + esc(ARC.unpa + " " + (a.path || a.guid)) + '">✕</button>' : '') + '</li>';
    }).join("") + '</ul></div>';
  }
  function unPa(i, btn) {
    var o = B.open(), d = o && linkDoc(o.key); if (!d || !B.canWrite()) return;
    var rest = (d.c.projectAssets || []).filter(function (x, j) { return j !== +i; });
    B.gref().collection("cards").doc(d.id).set(Object.assign({ projectAssets: rest, updatedAt: B.stamp() }, d.canon), { merge: true })
      .then(function () { d.c.projectAssets = rest; o.projectAssets = rest; var box = btn && btn.closest('.pa'); if (box) box.outerHTML = paHtml(o); }).catch(fail);
  }
  // 🔗 the GDD cards a development-log entry updated (MCP submit_development_activity entries[].cards)
  function actCards(e) {
    var l = (e.cards || []).map(function (k) { return B.allCards().filter(function (x) { return x.key === k; })[0]; }).filter(Boolean);
    return l.length ? '<div class="dlinks">' + l.map(function (x) { return '<button class="dlink" data-openref="' + esc(x.key) + '">' + esc(x.title || "…") + '</button>'; }).join("") + '</div>' : '';
  }
  return { archHtml: archHtml, archWire: archWire, unlink: unlink, unlinkBtn: unlinkBtn, paHtml: paHtml, unPa: unPa, actCards: actCards };
};
