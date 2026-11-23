// Ad tracking: the Meta Pixel in the browser, the ad source of each visitor, and the lead sent to Meta from the
// server as well (Conversions API, functions/api/lead.js on Cloudflare Pages), so leads still count when the browser
// blocks the pixel. Turned off with ?notrack (tests) and on localhost.

export const PIXEL_ID = '1137726062348177';                         // "WrapFinest Website", Meta ad account 288888353
const SRC_KEY = 'wf-src-v1', SRC_DAYS = 30;
const params = new URLSearchParams(location.search);
const local = /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);
const off = params.has('notrack') || (local && !params.has('track'));

/* ---------- Meta Pixel ---------- */
if (!off) {
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}
const fbq = (...a) => { if (!off && window.fbq) window.fbq(...a); };
export const newEventId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/** A standard Meta event (ViewContent, Contact, CustomizeProduct, AddToCart, Lead, ...). */
export function track(name, data = {}, eventID) { fbq('track', name, data, eventID ? { eventID } : undefined); }

/* ---------- where the visitor came from ---------- */
// The first ad or link that brought someone in the last 30 days is kept, and the latest one too.
function readSource() { try { const s = JSON.parse(localStorage.getItem(SRC_KEY) || 'null'); return s && Date.now() - s.first.t < SRC_DAYS * 864e5 ? s : null; } catch { return null; } }
function captureSource() {
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid'];
  const hit = {}; for (const k of keys) if (params.get(k)) hit[k] = params.get(k).slice(0, 200);
  let ref = ''; try { ref = document.referrer && new URL(document.referrer).hostname !== location.hostname ? new URL(document.referrer).hostname : ''; } catch { /* no referrer */ }
  const now = { ...hit, ref, page: location.pathname + location.search.slice(0, 200), t: Date.now() };
  const s = readSource();
  const fresh = Object.keys(hit).length > 0 || !!ref;
  const next = s ? { first: s.first, last: fresh ? now : s.last } : { first: now, last: now };
  try { localStorage.setItem(SRC_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}
const source = captureSource();
const describe = v => {
  if (!v) return '-';
  const via = v.utm_source ? `${v.utm_source}${v.utm_medium ? ' / ' + v.utm_medium : ''}` : v.fbclid ? 'Facebook/Instagram ad' : v.gclid ? 'Google ad' : v.ttclid ? 'TikTok ad' : v.ref ? v.ref : 'direct visit';
  const bits = [via, v.utm_campaign && `campaign: ${v.utm_campaign}`, v.utm_content && `ad: ${v.utm_content}`, v.utm_term && `term: ${v.utm_term}`, `on ${new Date(v.t).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`];
  return bits.filter(Boolean).join(' · ');
};
/** Readable ad source for the quote email: the first and (when different) the latest. */
export function sourceText() {
  const s = readSource() || source; const a = describe(s.first), b = describe(s.last);
  return a === b ? a : `${a} (first) · ${b} (latest)`;
}

/* ---------- once-per-visit helpers ---------- */
const seen = new Set();
/** ViewContent the first time a section of the site is reached. */
export function sectionView(name) { if (!name || seen.has(name)) return; seen.add(name); track('ViewContent', { content_name: name, content_category: 'Website section' }); }

// any tap on a phone number, Messenger or email link is a Contact
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[href]'); if (!a) return;
  const h = a.getAttribute('href');
  const kind = h.startsWith('tel:') ? 'Phone' : h.includes('m.me/') ? 'Messenger' : h.startsWith('mailto:') ? 'Email' : h.includes('maps.app.goo.gl') || h.includes('google.com/maps') ? 'Directions' : '';
  if (kind) track(kind === 'Directions' ? 'FindLocation' : 'Contact', { content_name: kind });
}, { capture: true });

/* ---------- lead ---------- */
const cookie = k => document.cookie.split('; ').find(c => c.startsWith(k + '='))?.split('=')[1];
/**
 * A quote request: Lead in the browser and, on Cloudflare Pages, the same Lead sent from the server with the
 * contact details (hashed there) so Meta can match it to the person who saw the ad. Both carry one event id,
 * so Meta counts it once.
 */
export function lead({ name, phone, email, services, vehicle }) {
  if (off) return;
  const eventID = newEventId();
  track('Lead', { content_name: services, content_category: vehicle, currency: 'PHP' }, eventID);
  if (/github\.io$/.test(location.hostname)) return;                // the server half runs on Cloudflare Pages only
  const body = { event_id: eventID, event_source_url: location.href.split('#')[0], fbp: cookie('_fbp'), fbc: cookie('_fbc') || ((readSource() || source).last.fbclid ? `fb.1.${Date.now()}.${(readSource() || source).last.fbclid}` : undefined),
    name, phone, email, services, vehicle };
  try { fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {}); } catch { /* best effort */ }
}
