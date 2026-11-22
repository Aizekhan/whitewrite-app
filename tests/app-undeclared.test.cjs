// No name is used that nothing declares (v2.160.4: a declaration dropped with an old block — «qqAll is not defined» broke the whole
// Production plan page the moment the analysis had open questions, and «Застосувати» lost applyScaffold). Each app script is walked
// with Babel's scope: every referenced or assigned bare name must be declared in the file or be a browser global. Run: npm test
const fs = require('fs'), path = require('path'), B = require('@babel/standalone');
let fails = 0;
const app = path.join(__dirname, '..', 'app');
const known = new Set(Object.getOwnPropertyNames(globalThis).concat(['createImageBitmap', 'WhiteWrite', 'define', 'module', 'exports', 'require'], ['window','document','navigator','location','localStorage','sessionStorage','firebase','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame','fetch','URL','Blob','FileReader','Image','alert','confirm','prompt','getComputedStyle','matchMedia','history','HTMLElement','Event','CustomEvent','MutationObserver','ResizeObserver','IntersectionObserver','performance','crypto','atob','btoa','Node','File','FormData','AbortController','TextEncoder','TextDecoder','Audio','speechSynthesis','SpeechSynthesisUtterance','structuredClone','queueMicrotask','screen','innerWidth','innerHeight','scrollTo','open','print','top','self','parent','frames','opener','devicePixelRatio','DOMParser','XMLSerializer','Option','CSS','caches','indexedDB','Worker','WebSocket','EventSource','BroadcastChannel','ClipboardItem','DataTransfer','KeyboardEvent','MouseEvent','PointerEvent','Range','Selection','getSelection','arguments','undefined','NaN','Infinity','THREE','JSZip','pdfjsLib','React','ReactDOM']));
const files = fs.readdirSync(app).filter((f) => /\.js$/.test(f)).map((f) => path.join(app, f))
  .concat(fs.readdirSync(path.join(app, 'firebase')).filter((f) => /\.js$/.test(f)).map((f) => path.join(app, 'firebase', f)));
files.forEach((f) => {
  const name = path.relative(app, f).split(path.sep).join('/');
  if (/\.mjs$|gb-3d\.js$|cosmograph/.test(name)) return; // ES modules are checked by the build
  const seen = new Map();
  try {
    B.transform(fs.readFileSync(f, 'utf8'), { ast: false, code: false, sourceType: 'script', plugins: [() => ({ visitor: {
      ReferencedIdentifier(p) { const n = p.node.name; if (!p.scope.hasBinding(n, true) && !seen.has(n)) seen.set(n, p.node.loc.start.line); },
      AssignmentExpression(p) { const l = p.node.left; if (l.type === 'Identifier' && !p.scope.hasBinding(l.name, true) && !seen.has(l.name)) seen.set(l.name, l.loc.start.line); } } })] });
  } catch (e) { return; } // a parse error is app-syntax's to report
  const bad = [...seen].filter(([n]) => !known.has(n) && !n.startsWith('__'));
  const ok = !bad.length; console.log((ok ? 'PASS ' : 'FAIL ') + name + ' declares every name it uses' + (ok ? '' : ': ' + bad.map(([n, l]) => n + ' (line ' + l + ')').join(', '))); if (!ok) fails++;
});
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
