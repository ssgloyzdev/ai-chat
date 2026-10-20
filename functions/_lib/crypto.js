const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function aesKey(env) {
  if (!env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY belum diatur');
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(env.ENCRYPTION_KEY));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encrypt(text, env) {
  const key = await aesKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return toB64(iv) + '.' + toB64(ct);
}

export async function decrypt(payload, env) {
  const [iv, ct] = String(payload).split('.');
  const key = await aesKey(env);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct));
  return dec.decode(pt);
}

export const mask = k => (k.length <= 8 ? '••••' : k.slice(0, 3) + '…' + k.slice(-4));
