// Prints a new VAPID key pair (a P-256 private key, as JWK) for the Worker's VAPID_JWK secret.
// The deploy workflow runs it once, piping it straight into `wrangler secret put`.
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
process.stdout.write(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }));
