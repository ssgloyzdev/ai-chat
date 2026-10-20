export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const sbHeaders = env => ({
  apikey: env.SUPABASE_SERVICE_KEY,
  Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY,
  'Content-Type': 'application/json'
});

export const sbTable = (env, name) => env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + name;
