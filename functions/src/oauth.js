// 🔌 WhiteWrite MCP as a custom connector in claude.ai (owner, v2.149): Settings → Connectors → Add custom connector → https://whitewrite.com/mcp
// OAuth 2.1 the way MCP clients expect it (authorization code + PKCE S256, dynamic client registration, no client secret):
//   GET  /.well-known/oauth-protected-resource[/mcp]  → where to log in (mcp.js answers 401 with WWW-Authenticate pointing here)
//   GET  /.well-known/oauth-authorization-server      → the endpoints
//   POST /oauth/register                              → a client (claude.ai registers itself; oauthClients/{id})
//   GET  /oauth/authorize                             → the page app/connect.html (firebase.json): the author logs in, picks a game and a role
//   GET  /oauth/client?id=                            → the client's name and redirect host for that page
//   POST /oauth/approve   (Firebase ID token)         → the author's yes: a one-time code (oauthCodes/{sha}, 10 min) → back to the client
//   POST /oauth/token                                 → code + verifier → a NEW agent key of the chosen role (mcpKeys, like «🔑 Ключі агентів»)
// The access token IS a wwk_ key: it never expires; revoking it in «🔑 Ключі агентів» cuts the connector off (Claude asks to log in again).
// The raw key exists only in the token answer — Firestore keeps its sha256, as for every key. Served through Firebase Hosting rewrites
// (firebase.json) because the .well-known paths must sit at the root of the origin.
const crypto = require('crypto');
const { onRequest, admin, db, getPlanBudget } = require('./common');
const AC = require('../agent-chat.js');

const ISSUER = 'https://whitewrite.com';
const RESOURCE = ISSUER + '/mcp';
const CODE_TTL = 10 * 60 * 1000;
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ROLE_UK = { designer: 'Геймдизайнер', programmer: 'Програміст', readonly: 'Лише читання' };
const okRedirect = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || (x.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(x.hostname)); } catch (e) { return false; } };

const protectedResource = () => ({ resource: RESOURCE, authorization_servers: [ISSUER], bearer_methods_supported: ['header'], resource_name: 'WhiteWrite' });
const serverMeta = () => ({
  issuer: ISSUER, authorization_endpoint: ISSUER + '/oauth/authorize', token_endpoint: ISSUER + '/oauth/token', registration_endpoint: ISSUER + '/oauth/register',
  response_types_supported: ['code'], grant_types_supported: ['authorization_code'], code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'], scopes_supported: AC.ROLES,
});
const oerr = (res, status, error, description) => res.status(status).json({ error, error_description: description });

async function register(req, res) {
  const b = req.body || {};
  const uris = (Array.isArray(b.redirect_uris) ? b.redirect_uris : []).map((u) => str(u, 500)).filter(Boolean).slice(0, 10);
  if (!uris.length || !uris.every(okRedirect)) return oerr(res, 400, 'invalid_redirect_uri', 'redirect_uris: https only');
  const id = 'wwc_' + crypto.randomBytes(12).toString('hex'), name = str(b.client_name, 80) || new URL(uris[0]).hostname;
  await db.collection('oauthClients').doc(id).set({ redirect_uris: uris, name, createdAt: ts() });
  return res.status(201).json({ client_id: id, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: name, redirect_uris: uris,
    token_endpoint_auth_method: 'none', grant_types: ['authorization_code'], response_types: ['code'] });
}

async function clientInfo(req, res) {
  const c = await db.collection('oauthClients').doc(str(req.query.id, 60)).get();
  if (!c.exists) return oerr(res, 404, 'invalid_client', 'Unknown client');
  return res.json({ name: c.data().name, hosts: [...new Set(c.data().redirect_uris.map((u) => new URL(u).hostname))] });
}

// the author's yes on app/connect.html → a one-time code for the client
async function approve(req, res) {
  let uid;
  try { uid = (await admin.auth().verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer /, ''))).uid; } catch (e) { return res.status(401).json({ error: 'Увійди у WhiteWrite' }); }
  const b = req.body || {}, worldId = str(b.worldId, 120), gameId = str(b.gameId, 120), role = AC.ROLES.includes(b.role) ? b.role : '';
  const clientId = str(b.client_id, 60), redirect = str(b.redirect_uri, 500), challenge = str(b.code_challenge, 128);
  if (!role || !worldId || !gameId) return res.status(400).json({ error: 'Обери гру й роль' });
  if (b.code_challenge_method !== 'S256' || !/^[\w-]{43,128}$/.test(challenge)) return res.status(400).json({ error: 'Потрібен PKCE S256' });
  const c = await db.collection('oauthClients').doc(clientId).get();
  if (!c.exists || !c.data().redirect_uris.includes(redirect)) return res.status(400).json({ error: 'Невідомий застосунок або адреса повернення' });
  const [w, g, u] = await Promise.all([db.collection('worlds').doc(worldId).get(), db.collection('worlds').doc(worldId).collection('games').doc(gameId).get(), db.collection('users').doc(uid).get()]);
  if (!w.exists || !g.exists || w.data().owner !== uid) return res.status(403).json({ error: 'Підключити агента може лише власник гри' });
  if (g.data().demo) return res.status(423).json({ error: 'Демо-гра — лише для читання' });
  if (!getPlanBudget((u.exists && u.data().plan) || 'free').allowAPI) return res.status(403).json({ error: 'MCP — частина Worldbuilder', code: 'PLAN_REQUIRED' });
  const code = crypto.randomBytes(24).toString('hex');
  await db.collection('oauthCodes').doc(sha(code)).set({ uid, worldId, gameId, role, clientId, redirect, challenge, client: c.data().name, game: str(g.data().title, 80),
    exp: Date.now() + CODE_TTL, used: false, expireAt: new Date(Date.now() + 24 * 3600 * 1000) });
  const back = new URL(redirect); back.searchParams.set('code', code); if (b.state) back.searchParams.set('state', str(b.state, 500));
  back.searchParams.set('iss', ISSUER);
  return res.json({ redirect: back.toString() });
}

async function token(req, res) {
  const b = req.body || {};
  if (b.grant_type !== 'authorization_code') return oerr(res, 400, 'unsupported_grant_type', 'authorization_code only');
  const ref = db.collection('oauthCodes').doc(sha(str(b.code, 100)));
  let c;
  try {
    c = await db.runTransaction(async (tx) => {
      const d = await tx.get(ref), x = d.exists ? d.data() : null;
      if (!x || x.used || x.exp < Date.now()) return null;
      tx.update(ref, { used: true });
      return x;
    });
  } catch (e) { c = null; }
  if (!c) return oerr(res, 400, 'invalid_grant', 'The code is unknown, used or expired');
  if (str(b.client_id, 60) !== c.clientId || str(b.redirect_uri, 500) !== c.redirect) return oerr(res, 400, 'invalid_grant', 'client_id / redirect_uri do not match');
  if (b64url(crypto.createHash('sha256').update(str(b.code_verifier, 200)).digest()) !== c.challenge) return oerr(res, 400, 'invalid_grant', 'PKCE check failed');
  const raw = 'wwk_' + crypto.randomBytes(32).toString('base64url');
  await db.collection('mcpKeys').doc(sha(raw)).set({ uid: c.uid, worldId: c.worldId, gameId: c.gameId, role: c.role, prefix: raw.slice(0, 12),
    label: str(c.client + ' · ' + ROLE_UK[c.role], 80), via: 'oauth', createdAt: ts() });
  res.set('Cache-Control', 'no-store');
  return res.json({ access_token: raw, token_type: 'Bearer', scope: c.role });
}

exports.oauth = onRequest({ region: 'us-central1', invoker: 'public', timeoutSeconds: 30 }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*').set('Access-Control-Allow-Headers', 'Authorization, Content-Type, mcp-protocol-version').set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  const p = String(req.path || '').replace(/\/+$/, '');
  try {
    if (/\/\.well-known\/oauth-protected-resource(\/mcp)?$/.test(p)) return res.json(protectedResource());
    if (/\/\.well-known\/(oauth-authorization-server|openid-configuration)(\/.*)?$/.test(p)) return res.json(serverMeta());
    if (p.endsWith('/oauth/register') && req.method === 'POST') return await register(req, res);
    if (p.endsWith('/oauth/client') && req.method === 'GET') return await clientInfo(req, res);
    if (p.endsWith('/oauth/approve') && req.method === 'POST') return await approve(req, res);
    if (p.endsWith('/oauth/token') && req.method === 'POST') return await token(req, res);
    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error('[oauth]', p, e);
    return oerr(res, 500, 'server_error', 'Server error');
  }
});
exports._oauth = { serverMeta, protectedResource, okRedirect, b64url, ISSUER, RESOURCE };
