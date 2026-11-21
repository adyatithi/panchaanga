// node tools/reminders/test.mjs: the encryption decrypts as a browser would (RFC 8291), the VAPID
// header verifies, and a run sends what falls due in its five minutes, once.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import worker, { encrypt, vapidKeys, vapidHeader, b64u, unb64u, run, cleanItems } from './worker.js';

const enc = new TextEncoder();
const hkdf = async (salt, ikm, info, n) => new Uint8Array(await crypto.subtle.deriveBits(
  { name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
const cat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };

// A browser's side: its key pair and auth secret, and decryption as RFC 8291 §3 describes it.
async function browser() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub = { endpoint: 'https://push.example.net/send/' + b64u(crypto.getRandomValues(new Uint8Array(9))), keys: { p256dh: b64u(pub), auth: b64u(auth) } };
  const decrypt = async (body) => {
    const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idlen = body[20];
    assert.equal(rs, 4096); assert.equal(idlen, 65);
    const asPub = body.slice(21, 21 + idlen), sealed = body.slice(21 + idlen);
    const peer = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, pair.privateKey, 256));
    const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), pub, asPub), 32);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, sealed));
    assert.equal(plain.at(-1), 2);
    return new TextDecoder().decode(plain.slice(0, -1));
  };
  return { sub, decrypt };
}

const jwk = execFileSync('node', [new URL('./make-vapid.js', import.meta.url).pathname]).toString();
const keys = await vapidKeys(jwk);

// 1. Encryption round trip.
const b = await browser();
assert.equal(await b.decrypt(await encrypt(b.sub, 'नमस्ते — ekādaśī tomorrow')), 'नमस्ते — ekādaśī tomorrow');

// 2. The VAPID header: a JWT for the push service's origin, signed by the key the app was given.
const header = await vapidHeader(keys, b.sub.endpoint);
const [, t, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
assert.equal(k, keys.pub);
const [h64, c64, s64] = t.split('.');
assert.equal(JSON.parse(new TextDecoder().decode(unb64u(c64))).aud, 'https://push.example.net');
const verifyKey = await crypto.subtle.importKey('raw', unb64u(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, unb64u(s64), enc.encode(`${h64}.${c64}`)));

// 3. A run, against an in-memory KV and push service.
const store = new Map();
const SUBS = {
  async put(k, v, o) { store.set(k, { v, m: o?.metadata }); },
  async get(k, type) { const e = store.get(k); return e ? (type === 'json' ? JSON.parse(e.v) : e.v) : null; },
  async delete(k) { store.delete(k); },
  async list({ prefix }) { return { keys: [...store].filter(([k]) => k.startsWith(prefix)).map(([name, e]) => ({ name, metadata: e.m })), list_complete: true }; },
};
const env = { SUBS, VAPID_JWK: jwk, ORIGINS: 'https://adyatithi.github.io' };
const sent = [];
let answer = 201;
globalThis.fetch = async (url, init) => { sent.push({ url, body: init.body, headers: init.headers }); return { status: answer }; };

const now = Date.UTC(2026, 10, 21, 13, 0);       // 18:30 IST
const min = (d) => Math.floor(d / 60000);
const req = (path, body, method = 'POST') => new Request('https://reminders.adyatithi.workers.dev' + path,
  { method, headers: { Origin: 'https://adyatithi.github.io', 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
const RealNow = Date.now; Date.now = () => now;
const items = [
  { t: min(now) + 30, title: 'Ēkādaśī', body: 'Tomorrow', url: 'https://adyatithi.github.io/panchaanga/#/Chennai/2026-11-22' },
  { t: min(now) + 32, title: 'Second, same window', body: '', url: '' },
  { t: min(now) + 90, title: 'Later', body: '', url: '' },
  { t: min(now) - 10, title: 'Past: dropped', body: '', url: '' },
];
let res = await worker.fetch(req('/subscribe', { subscription: b.sub, items }), env);
assert.equal(res.status, 200);
assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://adyatithi.github.io');
assert.equal((await res.json()).count, 3);
res = await worker.fetch(req('/key', null, 'GET'), env);
assert.equal((await res.json()).key, keys.pub);

// Runs every five minutes from now to two hours on: each item is sent once, in its own window.
const got = [];
for (let t = now; t < now + 2 * 3600e3; t += 5 * 60e3) {
  sent.length = 0;
  await run(env, t);
  for (const s of sent) got.push({ at: (t - now) / 60e3, msg: JSON.parse(await b.decrypt(s.body)), auth: s.headers.Authorization });
}
assert.deepEqual(got.map((g) => [g.at, g.msg.title]), [[30, 'Ēkādaśī'], [30, 'Second, same window'], [90, 'Later']]);
assert.match(got[0].auth, /^vapid t=.+, k=/);
assert.equal(got[0].msg.url, items[0].url);

// The test endpoint sends only to a stored subscription.
sent.length = 0;
res = await worker.fetch(req('/test', { endpoint: b.sub.endpoint, title: 'Test' }), env);
assert.equal((await res.json()).ok, true);
assert.equal(JSON.parse(await b.decrypt(sent[0].body)).title, 'Test');
res = await worker.fetch(req('/test', { endpoint: 'https://push.example.net/other' }), env);
assert.equal(res.status, 404);

// A push service that answers 410 has the subscription deleted.
await worker.fetch(req('/subscribe', { subscription: b.sub, items: [{ t: min(now) + 30, title: 'x' }] }), env);
answer = 410;
await run(env, now + 30 * 60e3);
assert.equal(store.size, 0);

// Junk is refused or cleaned.
res = await worker.fetch(req('/subscribe', { subscription: { endpoint: 'http://insecure', keys: {} }, items }), env);
assert.equal(res.status, 400);
assert.equal(cleanItems([{ t: 'x', title: 'a' }, { t: min(now) + 5 }, ...Array.from({ length: 200 }, (_, i) => ({ t: min(now) + i + 1, title: 'n' }))], now).length, 150);
// Usage: a day record and one per page; nothing else is written.
const points = [];
env.USAGE = { writeDataPoint: (p) => points.push(p) };
res = await worker.fetch(req('/ping', { city: 'Chennai', script: 'devanagari', lang: 'en', channel: 'nightly', mode: 'app', first: true, views: ['dina', 'kala', '<bad>'], v: 'v43' }), env);
assert.equal(res.status, 200);
assert.deepEqual(points.map((p) => p.blobs.slice(0, 3)), [['day', 'Chennai', 'devanagari'], ['view', 'dina', 'Chennai'], ['view', 'kala', 'Chennai']]);
res = await worker.fetch(new Request('https://reminders.adyatithi.workers.dev/stats?k=wrong'), { ...env, STATS_KEY: 'secret' });
assert.equal(res.status, 404);

// City requests: a known place opens an issue; a second request (after the minute) counts on it.
const issues = [];
const site = { 'https://adyatithi.github.io/panchaanga/data/places.json': [['Madurai', 'Madurai', 9.92, 78.12, 'Asia/Calcutta']] };
globalThis.fetch = async (url, init = {}) => {
  if (site[url]) return { ok: true, status: 200, json: async () => site[url] };
  const u = new URL(url);
  if (u.pathname.endsWith('/issues') && (init.method || 'GET') === 'GET') return { ok: true, json: async () => issues };
  if (u.pathname.endsWith('/issues') && init.method === 'POST') { const b = JSON.parse(init.body); const i = { number: 7, ...b }; issues.push(i); return { ok: true, json: async () => i }; }
  if (/\/issues\/7$/.test(u.pathname)) { issues[0].body = JSON.parse(init.body).body; return { ok: true, json: async () => issues[0] }; }
  return { ok: false, status: 404, text: async () => 'not found', json: async () => ({}) };
};
const cityEnv = { ...env, GH_TOKEN: 't', GH_REPO: 'adyatithi/panchaanga', SITES: 'https://adyatithi.github.io/panchaanga/' };
res = await worker.fetch(req('/request-city', { place: 'Madurai', nearest: 'Tiruchirappalli', km: 120 }), cityEnv);
assert.deepEqual(await res.json(), { ok: true, issue: 7, requests: 1 });
assert.equal(issues[0].title, 'City request: Madurai');
assert.deepEqual(issues[0].labels, ['city-request']);
res = await worker.fetch(req('/request-city', { place: 'Madurai' }), cityEnv);
assert.equal((await res.json()).counted, false);                    // within the minute
store.delete('rq:Madurai');
res = await worker.fetch(req('/request-city', { place: 'Madurai' }), cityEnv);
assert.equal((await res.json()).requests, 2);
assert.match(issues[0].body, /Requests: 2/);
res = await worker.fetch(req('/request-city', { place: 'Atlantis' }), cityEnv);
assert.equal(res.status, 404);

// The stats page and the blog answer as pages, not as JSON of an object.
res = await worker.fetch(new Request('https://reminders.adyatithi.workers.dev/stats?k=secret'), { ...env, STATS_KEY: 'secret', CF_ANALYTICS_TOKEN: 't', ACCOUNT_ID: 'a' });
assert.match(res.headers.get('Content-Type'), /text\/html/);
assert.match(await res.text(), /Errors from Cloudflare/);          // the fake fetch answers 404

// The blog: from the feed and sitemap when the archive is refused.
const { blogPosts } = await import('./worker.js');
const RSS = '<rss><channel><item><title><![CDATA[Why two Ekādaśīs?]]></title><link>https://adyatithi.substack.com/p/two?utm=1</link><description><![CDATA[<p>Smārta &amp; Vaiṣṇava</p>]]></description><pubDate>Tue, 10 Nov 2026 05:00:00 GMT</pubDate></item></channel></rss>';
const SM = '<urlset><url><loc>https://adyatithi.substack.com/p/two</loc><lastmod>2026-11-10</lastmod></url><url><loc>https://adyatithi.substack.com/p/the-ayanamsha</loc><lastmod>2026-09-01</lastmod></url><url><loc>https://adyatithi.substack.com/about</loc></url></urlset>';
let bp = await blogPosts(async (u) => { if (u.includes('/api/')) throw new Error('HTTP 403'); if (u.endsWith('/feed')) return RSS; if (u.endsWith('sitemap.xml')) return SM; throw new Error('HTTP 404'); });
assert.equal(bp.source, 'feed');
assert.deepEqual(bp.groups.Posts.map((p) => [p.t, p.s, p.d]), [['Why two Ekādaśīs?', 'Smārta & Vaiṣṇava', '2026-11-10'], ['The ayanamsha', '', '2026-09-01']]);
bp = await blogPosts(async (u) => (u.includes('archive') ? (u.endsWith('offset=0') ? [{ title: 'A', section_id: 1, post_date: '2026-11-01T00:00:00Z', slug: 'a' }] : [])
  : u.includes('sections') ? [{ id: 1, name: 'Festivals' }] : ''));
assert.deepEqual(Object.keys(bp.groups), ['Festivals']);

// Feedback: an issue, once for the same words, refused when too short.
issues.length = 0;
res = await worker.fetch(req('/feedback', { kind: 'data', title: 'Wrong sunrise', text: 'Sunrise in Chennai looks a minute early.', context: 'City: Chennai' }), cityEnv);
const fb = await res.json();
assert.equal(fb.issue, 7);
assert.equal(issues[0].title, '[data] Wrong sunrise');
assert.deepEqual(issues[0].labels, ['feedback', 'data']);
assert.match(issues[0].body, /City: Chennai/);
res = await worker.fetch(req('/feedback', { kind: 'data', title: 'Wrong sunrise', text: 'Sunrise in Chennai looks a minute early.' }), cityEnv);
assert.equal((await res.json()).duplicate, true);
res = await worker.fetch(req('/feedback', { kind: 'app', text: 'short' }), cityEnv);
assert.equal(res.status, 400);

Date.now = RealNow;
console.log('reminders worker: all checks passed');
