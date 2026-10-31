// Production build for Firebase Hosting: app/ → dist/
//
// app/ stays the editable source and still runs as-is (in-browser Babel, dev React).
// dist/ is what ships:
//   • every .jsx is precompiled with the SAME @babel/standalone version and the SAME
//     options it uses for <script type="text/babel"> (presets react+env, ES5, strict),
//     so global-scope semantics are identical — only the compile moves to build time;
//   • compiled scripts load with `defer` (Babel ran them after parsing, in order — same);
//   • React/ReactDOM development UMD → production UMD; the Babel CDN tag is removed.
//
// Usage: node scripts/build-app.mjs   (also runs as hosting predeploy)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Babel = require('@babel/standalone');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'dist');

// Mirrors buildBabelOptions() in @babel/standalone for a classic text/babel script.
const BABEL_OPTS = {
  presets: ['react', 'env'],
  plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
  targets: { browsers: undefined },
  comments: false,
  compact: true,
};

const REACT_PROD = {
  'react.development.js': {
    file: 'react.production.min.js',
    sri: 'sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z',
  },
  'react-dom.development.js': {
    file: 'react-dom.production.min.js',
    sri: 'sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1',
  },
};

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

// Empty dist/ rather than deleting it (Windows locks a directory a server is serving from)
fs.mkdirSync(OUT, { recursive: true });
for (const ent of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, ent), { recursive: true, force: true });
fs.cpSync(SRC, OUT, {
  recursive: true,
  filter: (p) => !path.basename(p).startsWith('.') && !p.includes('node_modules'),
});

// 1) Compile .jsx → .js
const versions = {};
let compiled = 0;
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { walk(p); continue; }
    if (!ent.name.endsWith('.jsx')) continue;
    const rel = path.relative(OUT, p).split(path.sep).join('/');
    const src = fs.readFileSync(p, 'utf8');
    let code;
    try {
      code = Babel.transform(src, { ...BABEL_OPTS, filename: rel }).code;
    } catch (e) {
      console.error(`✗ ${rel}: ${e.message}`);
      process.exit(1);
    }
    const outRel = rel.replace(/\.jsx$/, '.js');
    if (fs.existsSync(path.join(OUT, outRel))) { console.error(`✗ ${outRel} already exists — rename one of them`); process.exit(1); }
    fs.writeFileSync(path.join(OUT, outRel), code);
    fs.rmSync(p);
    versions[rel] = { outRel, v: hash(code) };
    compiled++;
  }
})(OUT);

// 2) Rewrite HTML entry points
let swapped = 0;
for (const name of fs.readdirSync(OUT).filter((f) => f.endsWith('.html'))) {
  const file = path.join(OUT, name);
  let html = fs.readFileSync(file, 'utf8');

  html = html.replace(
    /<script\s+type="text\/babel"\s+src="([^"?]+\.jsx)(?:\?[^"]*)?"><\/script>/g,
    (m, src) => {
      const key = src.replace(/^\//, '');
      const info = versions[key];
      if (!info) { console.error(`✗ ${name}: no compiled output for ${src}`); process.exit(1); }
      swapped++;
      return `<script defer src="${src.replace(/\.jsx$/, '.js')}?v=${info.v}"></script>`;
    }
  );

  // Cache-bust plain local scripts too (firebase/*.js, i18n.js, …) by content hash
  html = html.replace(/(<script\s+src=")(?!https?:)([^"?]+\.js)(?:\?[^"]*)?(")/g, (m, pre, src, post) => {
    const f = path.join(OUT, decodeURI(src).replace(/^\//, ''));
    return fs.existsSync(f) ? `${pre}${src}?v=${hash(fs.readFileSync(f))}${post}` : m;
  });

  html = html.replace(/[ \t]*<script src="https:\/\/unpkg\.com\/@babel\/standalone[^"]*"[^>]*><\/script>\r?\n?/g, '');

  for (const [dev, prod] of Object.entries(REACT_PROD)) {
    html = html.replace(
      new RegExp(`(<script src="https://unpkg\\.com/react(?:-dom)?@[^/]+/umd/)${dev.replace(/\./g, '\\.')}" integrity="[^"]*"`),
      `$1${prod.file}" integrity="${prod.sri}"`
    );
  }

  if (/text\/babel|babel\.min\.js|\.development\.js/.test(html)) {
    console.error(`✗ ${name}: dev-only script left after rewrite`);
    process.exit(1);
  }
  fs.writeFileSync(file, html);
}

console.log(`✓ dist/ built: ${compiled} jsx compiled, ${swapped} script tags rewritten`);
