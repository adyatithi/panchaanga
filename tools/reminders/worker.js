// Reminders for the Adyatithi pañcāṅga app, by Web Push: a Cloudflare Worker.
//
// The app works out each reminder itself (which days, at what time, in the reader's script and
// language) for the next few weeks, and sends the list here with the phone's push address. This
// Worker keeps it in KV and, every five minutes, sends the reminders that fall due. It computes
// nothing about the pañcāṅga. A list runs out after some weeks; the app sends a fresh one when it
// is opened.
//
//   POST /subscribe    { subscription, items: [{ t, title, body, url }] }  -> { ok, until }
//   POST /unsubscribe  { endpoint }
//   POST /test         { endpoint }    one notification now, to check that it arrives
//   GET  /key          { key }         the public key the app subscribes with
//   POST /ping         usage, once a day from each phone: city, script, language, pages opened
//   GET  /stats?k=…    the usage counts, as a page (for the maintainer; k is the STATS_KEY secret)
//   POST /request-city { place, nearest, km }: opens (or counts on) a "City request" issue
//
// t is the time in minutes since 1970 (UTC). What is stored is a subscription and its reminders,
// nothing else: no name, account or address. A push service that answers 404 or 410 (the reader
// turned notifications off, or removed the app) has its subscription deleted.
//
// Usage goes to Workers Analytics Engine (binding USAGE): counts only, with no identifier, address
// or device detail; the country is Cloudflare's for the request. City requests become GitHub
// issues (secret GH_TOKEN: issues read and write on GH_REPO), approved by hand with a label.
//
// The VAPID key pair is the secret VAPID_JWK (a P-256 private key as JWK), made once by the deploy
// workflow; its public half is the key the app subscribes with.

const MAX_ITEMS = 150;          // per subscription; their times must fit in the key's metadata
const STEP = 5;                 // minutes between runs, as in wrangler.toml's cron
const SUBJECT = 'https://adyatithi.github.io/panchaanga/';
const TTL = 6 * 3600;           // a reminder not delivered within six hours is not worth delivering

const enc = new TextEncoder();
export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

// --- VAPID (RFC 8292) ---

export async function vapidKeys(jwkText) {
  const jwk = JSON.parse(jwkText);
  const priv = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const pub = concat(new Uint8Array([4]), unb64u(jwk.x), unb64u(jwk.y));
  return { priv, pub: b64u(pub) };
}

export async function vapidHeader(keys, endpoint, now = Date.now()) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: SUBJECT })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.priv, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${keys.pub}`;
}

// --- Message encryption (RFC 8291, aes128gcm as in RFC 8188) ---

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

// The body to POST to the push service. `local` (an ECDH key pair) and `salt` may be given, for tests.
export async function encrypt(subscription, payload, local, salt) {
  const uaPublic = unb64u(subscription.keys.p256dh);
  const auth = unb64u(subscription.keys.auth);
  local = local || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  salt = salt || crypto.getRandomValues(new Uint8Array(16));
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const peer = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(payload), new Uint8Array([2]));   // 2: the last (and only) record
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const rs = new Uint8Array([0, 0, 16, 0]);                           // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, sealed);
}

// Send one message. Returns the push service's status (201 on success).
export async function push(keys, subscription, message) {
  const body = await encrypt(subscription, JSON.stringify(message));
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(keys, subscription.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(TTL),
      Urgency: 'normal',
    },
    body,
  });
  return res.status;
}

// --- Storing a subscription ---

// The times (minutes since 1970) go in the key's metadata, so that a run can find what is due by
// listing the keys, without reading every subscription.
const stamps = (items) => items.map((i) => i.t.toString(36)).join(',');
const keyOf = async (endpoint) => 's:' + (await sha256hex(endpoint)).slice(0, 32);

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
export function cleanItems(items, now = Date.now()) {
  const nowMin = Math.floor(now / 60000);
  return (Array.isArray(items) ? items : [])
    .map((i) => ({ t: Math.round(Number(i?.t)), title: str(i?.title, 120), body: str(i?.body, 240), url: str(i?.url, 300) }))
    .filter((i) => Number.isFinite(i.t) && i.t >= nowMin && i.t < nowMin + 400 * 24 * 60 && i.title)
    .sort((a, b) => a.t - b.t)
    .slice(0, MAX_ITEMS);
}

function validSubscription(s) {
  try {
    const u = new URL(s.endpoint);
    return u.protocol === 'https:' && unb64u(s.keys.p256dh).length === 65 && unb64u(s.keys.auth).length === 16;
  } catch { return false; }
}

// --- HTTP ---

function cors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ORIGINS || '').split(',').map((s) => s.trim());
  return allowed.includes(origin) ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  } : {};
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/ping' && request.method === 'POST') return ping(request, env);
  if (path === '/stats' && request.method === 'GET') return stats(url, env);
  if (path === '/request-city' && request.method === 'POST') return requestCity(request, env);
  const keys = await vapidKeys(env.VAPID_JWK);
  if (request.method === 'GET' && path === '/key') return { key: keys.pub };
  if (request.method !== 'POST') return [404, { error: 'not found' }];
  const text = await request.text();
  if (text.length > 100000) return [413, { error: 'too large' }];
  let body;
  try { body = JSON.parse(text); } catch { return [400, { error: 'not JSON' }]; }

  if (path === '/subscribe') {
    const sub = body.subscription;
    if (!validSubscription(sub)) return [400, { error: 'bad subscription' }];
    const items = cleanItems(body.items);
    const key = await keyOf(sub.endpoint);
    if (!items.length) { await env.SUBS.delete(key); return { ok: true, until: null }; }
    await env.SUBS.put(key, JSON.stringify({ sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, items }),
      { metadata: { d: stamps(items) }, expiration: Math.floor(items.at(-1).t * 60 + 86400) });
    return { ok: true, count: items.length, until: items.at(-1).t };
  }
  if (path === '/unsubscribe') {
    if (typeof body.endpoint !== 'string') return [400, { error: 'no endpoint' }];
    await env.SUBS.delete(await keyOf(body.endpoint));
    return { ok: true };
  }
  if (path === '/test') {
    // Only to a subscription already stored, so that this cannot be used to send to anyone else.
    const rec = typeof body.endpoint === 'string' && await env.SUBS.get(await keyOf(body.endpoint), 'json');
    if (!rec) return [404, { error: 'not subscribed' }];
    const status = await push(keys, rec.sub, { title: str(body.title, 120) || 'Adyatithi', body: str(body.body, 240), url: rec.items[0]?.url || '' });
    return { ok: status < 300, status };
  }
  return [404, { error: 'not found' }];
}

// --- Usage ---

const word = (v, n = 40) => (typeof v === 'string' && /^[\w .\-]{1,80}$/u.test(v) ? v.slice(0, n) : '');

// One record a day per phone ("day": its choices), and one per page it opened that day ("view").
async function ping(request, env) {
  let b;
  try { b = JSON.parse(await request.text()); } catch { return [400, { error: 'not JSON' }]; }
  const country = request.cf?.country || '';
  const city = word(b.city), channel = word(b.channel, 10), v = word(b.v, 10);
  if (!city) return [400, { error: 'no city' }];
  if (!env.USAGE) return { ok: true };
  if (b.first) {
    env.USAGE.writeDataPoint({ blobs: ['day', city, word(b.script), word(b.lang, 8), channel, word(b.mode, 8), country, v,
      b.reminders ? 'reminders' : '', String(Math.min(20, Number(b.alarms) || 0))], doubles: [1], indexes: [city] });
  }
  for (const view of (Array.isArray(b.views) ? b.views : []).slice(0, 40).map((x) => word(x, 20)).filter(Boolean)) {
    env.USAGE.writeDataPoint({ blobs: ['view', view, city, channel, country], doubles: [1], indexes: [view] });
  }
  return { ok: true };
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The counts for the last 30 days, from the Analytics Engine SQL API (secret CF_ANALYTICS_TOKEN,
// with Account Analytics read).
async function stats(url, env) {
  if (!env.STATS_KEY || url.searchParams.get('k') !== env.STATS_KEY) return [404, { error: 'not found' }];
  if (!env.CF_ANALYTICS_TOKEN) return [503, { error: 'no analytics token' }];
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const q = async (sql) => {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`,
      { method: 'POST', headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}` }, body: sql });
    const j = await r.json().catch(() => ({}));
    return j.data || [];
  };
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
  const by = (blob, kind = 'day') => q(`SELECT ${blob} AS k, SUM(_sample_interval) AS n FROM adyatithi_usage WHERE blob1 = '${kind}' AND ${since} GROUP BY k ORDER BY n DESC LIMIT 200`);
  const [perDay, city, script, lang, channel, mode, country, views, reminders] = await Promise.all([
    q(`SELECT toDate(timestamp) AS k, SUM(_sample_interval) AS n FROM adyatithi_usage WHERE blob1 = 'day' AND ${since} GROUP BY k ORDER BY k DESC`),
    by('blob2'), by('blob3'), by('blob4'), by('blob5'), by('blob6'), by('blob7'), by('blob2', 'view'), by('blob9'),
  ]);
  const table = (title, rows) => `<h2>${esc(title)}</h2><table>${rows.map((r) => `<tr><td>${esc(r.k || '—')}</td><td>${esc(r.n)}</td></tr>`).join('')}</table>`;
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Adyatithi usage</title>
<style>body{font:15px/1.4 system-ui,sans-serif;margin:16px;max-width:40rem}h2{font-size:1rem;margin:1.2rem 0 .3rem}td{padding:.1rem .8rem .1rem 0}tr:nth-child(odd){background:#f4f4f4}</style>
<h1>Adyatithi usage, last ${days} days</h1><p>Phone-days: one per phone per day it opened the app. Pages: opened that day.</p>
${table('Phone-days by date', perDay)}${table('City', city)}${table('Page', views)}${table('Script', script)}${table('Language', lang)}
${table('Channel', channel)}${table('Installed app or browser', mode)}${table('Country', country)}${table('Reminders on', reminders)}`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// --- City requests ---

let placesCache = null;
async function places(env) {
  if (placesCache && Date.now() - placesCache.at < 3600e3) return placesCache.map;
  for (const site of (env.SITES || '').split(',')) {
    const r = await fetch(`${site.trim()}data/places.json`).catch(() => null);
    if (r && r.ok) {
      const map = new Map((await r.json()).map((p) => [p[0], p]));
      placesCache = { at: Date.now(), map };
      return map;
    }
  }
  return new Map();
}

async function gh(env, path, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${env.GH_REPO}${path}`, { ...init, headers: {
    Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'adyatithi-reminders',
    'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (!r.ok) throw new Error(`github ${r.status}`);
  return r.json();
}

async function requestCity(request, env) {
  if (!env.GH_TOKEN) return [503, { error: 'not set up' }];
  let b;
  try { b = JSON.parse(await request.text()); } catch { return [400, { error: 'not JSON' }]; }
  const place = (await places(env)).get(typeof b.place === 'string' ? b.place : '');
  if (!place) return [404, { error: 'unknown place' }];
  const [id, label, lat, lon, tz] = place;
  // One count a minute for a place, however many taps.
  const recent = `rq:${id}`;
  if (await env.SUBS.get(recent)) return { ok: true, counted: false };
  await env.SUBS.put(recent, '1', { expirationTtl: 60 });
  const title = `City request: ${label}`;
  const open = await gh(env, '/issues?labels=city-request&state=open&per_page=100');
  const issue = open.find((i) => i.title === title);
  if (issue) {
    const n = (Number((issue.body || '').match(/Requests: (\d+)/)?.[1]) || 1) + 1;
    await gh(env, `/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ body: issue.body.replace(/Requests: \d+/, `Requests: ${n}`) }) });
    return { ok: true, issue: issue.number, requests: n };
  }
  const nearest = word(b.nearest), km = Math.round(Number(b.km) || 0);
  const body = [`Place: **${label}** (\`${id}\`)`, `Latitude, longitude: ${lat}, ${lon} · time zone ${tz}`,
    nearest ? `Nearest city in the app: ${nearest}, ${km} km` : '', '', 'Requests: 1', '',
    'To add it, give this issue the label `approved`: the Add city workflow builds its three years, publishes them and closes the issue.'].join('\n');
  const made = await gh(env, '/issues', { method: 'POST', body: JSON.stringify({ title, body, labels: ['city-request'] }) });
  return { ok: true, issue: made.number, requests: 1 };
}

// --- The run every five minutes ---

// Send what falls in [from, from + STEP) minutes. The runs' scheduled times tile the timeline, so
// nothing is sent twice; a run that does not happen at all loses its five minutes' reminders.
export async function run(env, scheduledTime) {
  const from = Math.floor(scheduledTime / 60000 / STEP) * STEP;
  const to = from + STEP;
  const keys = await vapidKeys(env.VAPID_JWK);
  let sent = 0, gone = 0, failed = 0, cursor;
  do {
    const page = await env.SUBS.list({ prefix: 's:', cursor });
    for (const k of page.keys) {
      const due = (k.metadata?.d || '').split(',').some((s) => { const t = parseInt(s, 36); return t >= from && t < to; });
      if (!due) continue;
      const rec = await env.SUBS.get(k.name, 'json');
      if (!rec) continue;
      for (const item of rec.items.filter((i) => i.t >= from && i.t < to)) {
        const status = await push(keys, rec.sub, { title: item.title, body: item.body, url: item.url, tag: `${item.t}` }).catch(() => 0);
        if (status === 404 || status === 410) { await env.SUBS.delete(k.name); gone++; break; }
        if (status >= 200 && status < 300) sent++; else failed++;
      }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  if (sent || gone || failed) console.log(JSON.stringify({ from: new Date(from * 60000).toISOString(), sent, gone, failed }));
  return { sent, gone, failed };
}

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    let status = 200, out;
    try {
      out = await handle(request, env);
      if (Array.isArray(out)) [status, out] = out;
    } catch (e) {
      status = 500; out = { error: 'server error' };
      console.log(String(e?.stack || e));
    }
    return new Response(JSON.stringify(out), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(run(env, controller.scheduledTime));
  },
};
