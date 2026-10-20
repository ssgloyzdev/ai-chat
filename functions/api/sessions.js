import { UUID } from '../_lib/db.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const headers = env => ({
  apikey: env.SUPABASE_SERVICE_KEY,
  Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY,
  'Content-Type': 'application/json'
});

const table = env => env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/chat_sessions';

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    if (!UUID.test(id)) return json({ error: 'ID tidak valid' }, 400);
    const r = await fetch(`${table(env)}?id=eq.${id}&select=*`, { headers: headers(env) });
    if (!r.ok) return json({ error: 'Gagal membaca sesi' }, 502);
    const rows = await r.json();
    if (!rows.length) return json({ error: 'Sesi tidak ditemukan' }, 404);
    return json(rows[0]);
  }
  const r = await fetch(`${table(env)}?select=id,title,updated_at&order=updated_at.desc&limit=200`, {
    headers: headers(env)
  });
  if (!r.ok) return json({ error: 'Gagal membaca daftar sesi' }, 502);
  return json(await r.json());
}

export async function onRequestPut({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Permintaan tidak valid' }, 400);
  }
  if (!UUID.test(body.id || '')) return json({ error: 'ID tidak valid' }, 400);
  const row = {
    id: body.id,
    title: String(body.title || 'Obrolan Baru').slice(0, 120),
    messages: Array.isArray(body.messages) ? body.messages : [],
    updated_at: new Date().toISOString()
  };
  const r = await fetch(table(env) + '?on_conflict=id', {
    method: 'POST',
    headers: { ...headers(env), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row)
  });
  if (!r.ok) return json({ error: 'Gagal menyimpan sesi' }, 502);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!UUID.test(id || '')) return json({ error: 'ID tidak valid' }, 400);
  const r = await fetch(`${table(env)}?id=eq.${id}`, {
    method: 'DELETE',
    headers: { ...headers(env), Prefer: 'return=minimal' }
  });
  if (!r.ok) return json({ error: 'Gagal menghapus sesi' }, 502);
  return json({ ok: true });
}
