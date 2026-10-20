import { makeToken, safeEqual } from '../_lib/token.js';

const res = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return res({ error: 'Permintaan tidak valid' }, 400);
  }
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    return res({ error: 'Server belum dikonfigurasi' }, 500);
  }
  const okUser = safeEqual(body.username || '', env.ADMIN_USERNAME);
  const okPass = safeEqual(body.password || '', env.ADMIN_PASSWORD);
  if (!(okUser && okPass)) {
    await new Promise(r => setTimeout(r, 500));
    return res({ error: 'Username atau password salah' }, 401);
  }
  return res({ token: await makeToken(env) });
}
