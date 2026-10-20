import { json, sbHeaders, sbTable, UUID } from '../_lib/db.js';
import { encrypt, mask } from '../_lib/crypto.js';

const view = r => ({
  id: r.id,
  name: r.name,
  provider: r.provider,
  baseUrl: r.base_url,
  modelId: r.model_id,
  instruction: r.instruction || '',
  keys: (r.keys || []).map(k => ({ id: k.id, mask: k.m }))
});

export async function onRequestGet({ env }) {
  const r = await fetch(
    sbTable(env, 'ai_models') + '?select=id,name,provider,base_url,model_id,instruction,keys&order=created_at.asc',
    { headers: sbHeaders(env) }
  );
  if (!r.ok) return json({ error: 'Gagal membaca model' }, 502);
  return json((await r.json()).map(view));
}

export async function onRequestPut({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: 'Permintaan tidak valid' }, 400);
  }
  const name = String(b.name || '').trim().slice(0, 80);
  const baseUrl = String(b.baseUrl || '').trim().replace(/\/$/, '');
  const modelId = String(b.modelId || '').trim().slice(0, 200);
  if (!UUID.test(b.id || '') || !name || !modelId || !/^https:\/\//i.test(baseUrl)) {
    return json({ error: 'Data model tidak valid' }, 400);
  }
  const add = (Array.isArray(b.add) ? b.add : []).map(x => String(x).trim()).filter(Boolean).slice(0, 20);
  const keep = Array.isArray(b.keep) ? b.keep : [];

  const cur = await fetch(sbTable(env, 'ai_models') + '?id=eq.' + b.id + '&select=keys', {
    headers: sbHeaders(env)
  });
  if (!cur.ok) return json({ error: 'Gagal membaca model' }, 502);
  const rows = await cur.json();
  const keys = rows.length ? (rows[0].keys || []).filter(k => keep.includes(k.id)) : [];

  try {
    for (const k of add) keys.push({ id: crypto.randomUUID(), e: await encrypt(k, env), m: mask(k) });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
  if (!keys.length) return json({ error: 'Minimal satu API Key' }, 400);

  const row = {
    id: b.id,
    name,
    provider: String(b.provider || 'custom').slice(0, 20),
    base_url: baseUrl,
    model_id: modelId,
    instruction: String(b.instruction || '').slice(0, 8000),
    keys,
    key_index: 0
  };
  const r = await fetch(sbTable(env, 'ai_models') + '?on_conflict=id', {
    method: 'POST',
    headers: { ...sbHeaders(env), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row)
  });
  if (!r.ok) return json({ error: 'Gagal menyimpan model' }, 502);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!UUID.test(id || '')) return json({ error: 'ID tidak valid' }, 400);
  const r = await fetch(sbTable(env, 'ai_models') + '?id=eq.' + id, {
    method: 'DELETE',
    headers: { ...sbHeaders(env), Prefer: 'return=minimal' }
  });
  if (!r.ok) return json({ error: 'Gagal menghapus model' }, 502);
  return json({ ok: true });
}
