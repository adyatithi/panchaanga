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
//
// t is the time in minutes since 1970 (UTC). What is stored is a subscription and its reminders,
// nothing else: no name, account or address. A push service that answers 404 or 410 (the reader
// turned notifications off, or removed the app) has its subscription deleted.
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
  const path = new URL(request.url).pathname;
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
