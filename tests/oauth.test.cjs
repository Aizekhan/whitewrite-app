// 🔌 claude.ai custom connector (v2.149): OAuth metadata, PKCE, redirect checks (functions/src/oauth.js), the key in the path and the
// WWW-Authenticate pointer (mcp.js), Hosting rewrites (firebase.json), server-only collections (firestore.rules), the consent page. Run: npm test
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const oauthSrc = R('functions/src/oauth.js'), mcp = R('functions/src/mcp.js'), rules = R('firestore.rules'), page = R('app/connect.html');
const hosting = JSON.parse(R('firebase.json')).hosting;

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

// the module's pure parts, without Firebase (common.js needs the admin SDK): evaluate the helpers from the source
const pick = (name) => { const m = new RegExp('const ' + name + ' = [^\\n]*').exec(oauthSrc); return m[0]; };
const AC = require('../functions/agent-chat.js');
// eslint-disable-next-line no-new-func
const H = new Function('AC', 'crypto', [pick('ISSUER'), pick('RESOURCE'), pick('b64url'), pick('okRedirect'), pick('protectedResource'),
  oauthSrc.slice(oauthSrc.indexOf('const serverMeta'), oauthSrc.indexOf('const oerr')), 'return { ISSUER, RESOURCE, b64url, okRedirect, protectedResource, serverMeta };'].join('\n'))(AC, crypto);

const meta = H.serverMeta();
check(meta.issuer, 'https://whitewrite.com', 'the issuer is the site');
check(meta.code_challenge_methods_supported.join(), 'S256', 'PKCE S256 only');
check(meta.token_endpoint_auth_methods_supported.join() + '|' + !!meta.registration_endpoint, 'none|true', 'public clients with dynamic registration (claude.ai)');
check(H.protectedResource().resource + '|' + H.protectedResource().authorization_servers[0], 'https://whitewrite.com/mcp|https://whitewrite.com', 'the protected resource points at the issuer');
check(H.okRedirect('https://claude.ai/api/mcp/auth_callback') && H.okRedirect('http://localhost:6274/cb') && !H.okRedirect('http://evil.example/cb') && !H.okRedirect('javascript:alert(1)'), true, 'redirects: https or localhost only');
// PKCE: the RFC 7636 example
const v = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
check(H.b64url(crypto.createHash('sha256').update(v).digest()), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', 'PKCE S256 matches RFC 7636');

// the token flow guards
check(/x\.used \|\| x\.exp < Date\.now\(\)/.test(oauthSrc) && /tx\.update\(ref, \{ used: true \}\)/.test(oauthSrc), true, 'a code works once and expires');
check(/b\.client_id[^\n]*!== c\.clientId \|\| [^\n]*!== c\.redirect/.test(oauthSrc), true, 'the token needs the same client and redirect');
check(/w\.data\(\)\.owner !== uid/.test(oauthSrc) && /allowAPI/.test(oauthSrc) && /\.demo\)/.test(oauthSrc), true, 'only the owner, on a plan with MCP, never the demo game');
check(/AC\.ROLES\.includes\(b\.role\)/.test(oauthSrc) && /role: c\.role/.test(oauthSrc) && /via: 'oauth'/.test(oauthSrc), true, 'the key gets the chosen role and shows it came from the connector');
check(/collection\('mcpKeys'\)\.doc\(sha\(raw\)\)/.test(oauthSrc) && !/raw[^\n]*oauthCodes|oauthCodes[^\n]*raw/.test(oauthSrc), true, 'only the key hash is stored; the code doc never holds a key');

// mcp.js: the key in the path and the pointer to the login
const re = /\/k\/(wwk_[\w-]{20,})\/?$/;
check(mcp.indexOf("/\\/k\\/(wwk_[\\w-]{20,})\\/?$/") > 0, true, 'mcp.js reads the key from /k/<key>');
check(re.exec('/mcp/k/wwk_abcdefghijklmnopqrstuvwxyz012')[1] + '|' + !!re.exec('/k/wwk_short'), 'wwk_abcdefghijklmnopqrstuvwxyz012|false', 'both /mcp/k/… (Hosting) and /k/… (direct), no short junk');
check(/WWW-Authenticate', 'Bearer resource_metadata="https:\/\/whitewrite\.com\/\.well-known\/oauth-protected-resource"/.test(mcp), true, '401 tells the client where to log in');

// Hosting, rules, page
const rw = hosting.rewrites.map((r) => r.source + '>' + (r.function ? r.function.functionId : r.destination));
['/mcp>mcp', '/mcp/**>mcp', '/.well-known/oauth-protected-resource>oauth', '/.well-known/oauth-protected-resource/**>oauth', '/.well-known/oauth-authorization-server>oauth', '/oauth/authorize>/connect.html', '/oauth/**>oauth']
  .forEach((x) => check(rw.includes(x), true, 'rewrite ' + x));
check(rw.indexOf('/oauth/authorize>/connect.html') < rw.indexOf('/oauth/**>oauth'), true, 'the consent page comes before the /oauth/** function');
check(/match \/oauthClients\/\{id\} \{ allow read, write: if false; \}/.test(rules) && /match \/oauthCodes\/\{id\} \{ allow read, write: if false; \}/.test(rules), true, 'OAuth collections are server-only');
check(/\/oauth\/approve/.test(page) && /code_challenge/.test(page) && /error: "access_denied"/.test(page) && /getIdToken/.test(page), true, 'the consent page: approve with the ID token, PKCE passed on, cancel = access_denied');
check(/require\('\.\/src\/oauth'\)/.test(R('functions/index.js')), true, 'the oauth function is exported');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
