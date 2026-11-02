// ============================================================================
// The game's visual style — SINGLE SOURCE for the Game Bible (window.__STYLE, copy in app/firebase/ made by
// scripts/build-app.mjs), the AI style check (src/style.js) and the MCP server (get_style_guide / check_style). Edit THIS file.
// ============================================================================
// Style cards live in worlds/{w}/games/{g}/cards with section "artstyle": the overall style is the first card of the
// group «Загальний стиль» / «Overall style» (or a card with no group); every other card is a biome whose «places»
// field lists its locations / levels, one per line. A card (or a location name) takes the biome whose list has its
// title, subsection or location, else the overall style. Palette — the biome's if set, else the overall one;
// colours to avoid add up. AI results are kept per picture: cards/{id}.styleAi[fileId] = { score, verdict, summary,
// issues[], fixes[], sig, style, at } — `sig` (styleSig) tells when the style changed since (the result is stale).

const OVERALL = ['Загальний стиль', 'Overall style'];
const BRIEF_FIELDS = [ // the order the AI and the agent read them in
  ['manifesto', 'Manifesto'], ['palette', 'Palette'], ['avoid', 'Colours to avoid'], ['light', 'Light & mood'],
  ['materials', 'Materials & textures'], ['shapes', 'Shapes & silhouette'], ['budget', 'Polygon & texture budget'], ['rules', 'Do / don\'t'],
];

function parsePal(v) {
  return String(v || '').split('\n').map(function (l) {
    var m = l.match(/#([0-9a-f]{6})\b\s*(?:[—–-]\s*)?(.*)/i);
    return m ? { hex: '#' + m[1].toLowerCase(), name: m[2].trim() } : null;
  }).filter(Boolean);
}
function low(v) { return String(v || '').replace(/^[\s\-*•·]+/, '').trim().toLowerCase(); }
function fl(c) { return (c && c.fields) || {}; }

// styleCards: the raw card docs of the section (any order is fine — sorted by `order`); names: the card's title,
// subsection and location (or just a location name). → { overall, biome } (either may be null)
function resolveStyle(styleCards, names) {
  var st = (styleCards || []).filter(function (c) { return c && c.section === 'artstyle' && !c.hidden; })
    .slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  var overall = st.filter(function (c) { var g = fl(c).group || ''; return !g || OVERALL.indexOf(g) >= 0; })[0] || null;
  var want = (names || []).map(low).filter(Boolean);
  var biome = st.filter(function (c) {
    return c !== overall && String(fl(c).places || '').split('\n').some(function (l) { l = low(l); return l && want.indexOf(l) >= 0; });
  })[0] || null;
  return { overall: overall, biome: biome };
}
function palettes(r) {
  var bp = parsePal(fl(r.biome).palette), op = parsePal(fl(r.overall).palette);
  return { palette: bp.length ? bp : op, avoid: parsePal(fl(r.overall).avoid).concat(parsePal(fl(r.biome).avoid)) };
}
function styleName(r) { return ((r.biome || r.overall || {}).title) || ''; }
// Changes whenever anything the AI judges by changes (texts, palettes, the reference pictures)
function styleSig(r) {
  var raw = [r.overall, r.biome].map(function (c) {
    if (!c) return '-';
    var f = fl(c);
    return (c.id || '') + '|' + BRIEF_FIELDS.map(function (k) { return f[k[0]] || ''; }).join('|') + '|' +
      (c.files || []).filter(isPic).map(function (x) { return x.id || x.url; }).join(',');
  }).join('#');
  var h = 5381;
  for (var i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function isPic(f) { return /^image\//.test((f && f.type) || '') || /\.(png|jpe?g|gif|webp)$/i.test((f && f.name) || ''); }

// The style as text: for the AI prompt and the MCP answer
function styleBrief(r) {
  var out = [];
  [['OVERALL STYLE', r.overall], ['BIOME', r.biome]].forEach(function (p) {
    var c = p[1]; if (!c) return;
    var f = fl(c);
    out.push(p[0] + ' — "' + (c.title || '') + '"' + (p[0] === 'BIOME' && f.places ? ' (locations: ' + String(f.places).split('\n').map(low).filter(Boolean).join(', ') + ')' : ''));
    BRIEF_FIELDS.forEach(function (k) { if (String(f[k[0]] || '').trim()) out.push('  ' + k[1] + ': ' + String(f[k[0]]).trim().replace(/\n/g, '; ')); });
  });
  if (r.biome && !parsePal(fl(r.biome).palette).length && r.overall) out.push('  (the biome uses the overall palette)');
  return out.join('\n');
}

// The AI's answer → a clean result (score 0…100; verdict follows the score so the badge and the words agree)
function cleanVerdict(p) {
  p = p || {};
  var n = Math.round(Number(p.score));
  var score = isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  var arr = function (a, k) { return (Array.isArray(a) ? a : []).map(function (x) { return String(x == null ? '' : x).trim().slice(0, 300); }).filter(Boolean).slice(0, k); };
  return { score: score, verdict: score == null ? 'unknown' : score >= 70 ? 'fits' : score >= 40 ? 'partly' : 'off',
    summary: String(p.summary || '').trim().slice(0, 400), issues: arr(p.issues, 5), fixes: arr(p.fixes, 5) };
}

var STYLE = { OVERALL: OVERALL, BRIEF_FIELDS: BRIEF_FIELDS, parsePal: parsePal, resolveStyle: resolveStyle, palettes: palettes, styleName: styleName,
  styleSig: styleSig, styleBrief: styleBrief, cleanVerdict: cleanVerdict, isPic: isPic };
if (typeof module !== 'undefined' && module.exports) module.exports = STYLE;
if (typeof window !== 'undefined') window.__STYLE = STYLE;
