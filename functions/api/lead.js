// Cloudflare Pages Function: POST /api/lead
// Sends a quote request to Meta as a server-side Lead (Conversions API), next to the browser pixel's Lead with the
// same event id, so Meta counts it once but still sees it when the browser blocked the pixel.
// Needs the secret META_CAPI_TOKEN (Cloudflare Pages > Settings > Variables and Secrets). Optional: META_TEST_CODE,
// the code from Events Manager > Test events, while testing.
const PIXEL_ID = '1137726062348177';
const GRAPH = 'https://graph.facebook.com/v21.0';

const enc = new TextEncoder();
async function sha256(v) {
  if (!v) return undefined;
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(v));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const clean = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
function phPhone(p) {                                              // 0998 564 0802 -> 639985640802
  let d = clean(p, 40).replace(/\D/g, '');
  if (d.startsWith('0')) d = '63' + d.slice(1);
  else if (d.length === 10 && d.startsWith('9')) d = '63' + d;
  return d.length >= 10 ? d : '';
}

export async function onRequestPost({ request, env }) {
  if (!env.META_CAPI_TOKEN) return new Response(null, { status: 204 });   // not set up yet: the browser pixel still counts the lead
  let b; try { b = await request.json(); } catch { return new Response('bad request', { status: 400 }); }
  const origin = request.headers.get('Origin') || '';
  if (origin && new URL(origin).host !== new URL(request.url).host) return new Response('forbidden', { status: 403 });

  const parts = clean(b.name, 120).toLowerCase().split(/\s+/).filter(Boolean);
  const user_data = {
    client_ip_address: request.headers.get('CF-Connecting-IP') || undefined,
    client_user_agent: request.headers.get('User-Agent') || undefined,
    fbp: clean(b.fbp) || undefined,
    fbc: clean(b.fbc) || undefined,
    em: await sha256(clean(b.email, 200).toLowerCase()),
    ph: await sha256(phPhone(b.phone)),
    fn: await sha256(parts[0]),
    ln: await sha256(parts.length > 1 ? parts[parts.length - 1] : ''),
    country: await sha256('ph'),
  };
  for (const k of Object.keys(user_data)) if (!user_data[k]) delete user_data[k];
  const event = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    event_id: clean(b.event_id, 80) || undefined,
    action_source: 'website',
    event_source_url: clean(b.event_source_url, 500) || undefined,
    user_data,
    custom_data: { content_name: clean(b.services), content_category: clean(b.vehicle), currency: 'PHP' },
  };
  const payload = { data: [event], ...(env.META_TEST_CODE ? { test_event_code: env.META_TEST_CODE } : {}) };
  const r = await fetch(`${GRAPH}/${PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return new Response(r.ok ? 'ok' : 'meta error', { status: r.ok ? 200 : 502 });
}
export const onRequest = () => new Response('method not allowed', { status: 405 });
