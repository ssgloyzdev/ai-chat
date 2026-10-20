import { checkToken } from '../_lib/token.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname === '/api/login') return context.next();
  const header = context.request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!(await checkToken(token, context.env))) {
    return new Response(JSON.stringify({ error: 'Tidak diizinkan' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return context.next();
}
