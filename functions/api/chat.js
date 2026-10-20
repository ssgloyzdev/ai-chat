import { json, sbHeaders, sbTable, UUID } from '../_lib/db.js';
import { decrypt } from '../_lib/crypto.js';

const ROLES = ['system', 'user', 'assistant'];

export async function onRequestPost(context) {
  const { request, env } = context;
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: 'Permintaan tidak valid' }, 400);
  }
  const valid =
    Array.isArray(b.messages) &&
    b.messages.length > 0 &&
    b.messages.length <= 500 &&
    b.messages.every(x => x && ROLES.includes(x.role) && typeof x.content === 'string');
  if (!UUID.test(b.modelId || '') || !valid) {
    return json({ error: 'Permintaan tidak valid' }, 400);
  }

  const q = await fetch(sbTable(env, 'ai_models') + '?id=eq.' + b.modelId + '&select=*', {
    headers: sbHeaders(env)
  });
  if (!q.ok) return json({ error: 'Gagal membaca model' }, 502);
  const rows = await q.json();
  if (!rows.length) return json({ error: 'Model tidak ditemukan' }, 404);

  const m = rows[0];
  const keys = m.keys || [];
  const start = m.key_index || 0;
  if (!keys.length) return json({ error: 'Model belum memiliki API Key' }, 400);
  let failedDecrypt = 0;

  for (let i = 0; i < keys.length; i++) {
    const idx = (start + i) % keys.length;
    let apiKey;
    try {
      apiKey = await decrypt(keys[idx].e, env);
    } catch {
      failedDecrypt++;
      continue;
    }
    let r;
    try {
      r = await fetch(m.base_url.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({ model: m.model_id, messages: b.messages, stream: true })
      });
    } catch {
      return json({ error: 'Tidak dapat menghubungi penyedia model' }, 502);
    }
    if (r.status === 429 || r.status === 401 || r.status === 403) {
      if (r.body) r.body.cancel().catch(() => {});
      continue;
    }
    if (!r.ok) {
      const t = await r.text();
      return json({ error: 'Error ' + r.status + ': ' + t.slice(0, 200) }, 502);
    }
    if (idx !== start) {
      context.waitUntil(
        fetch(sbTable(env, 'ai_models') + '?id=eq.' + m.id, {
          method: 'PATCH',
          headers: { ...sbHeaders(env), Prefer: 'return=minimal' },
          body: JSON.stringify({ key_index: idx })
        })
      );
    }
    return new Response(r.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' }
    });
  }
  if (failedDecrypt === keys.length) {
    return json({ error: 'API Key tidak dapat didekripsi, periksa ENCRYPTION_KEY' }, 500);
  }
  return json({ error: 'quota' }, 429);
}
