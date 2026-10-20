const enc = new TextEncoder();

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const secret = env => env.ADMIN_USERNAME + ':' + env.ADMIN_PASSWORD;

export async function makeToken(env) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const sig = await hmac(String(exp), secret(env));
  return exp + '.' + sig;
}

export async function checkToken(token, env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) return false;
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp, secret(env)));
}
