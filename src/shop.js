// Accessories catalogue + inquiry list. No checkout: the list is sent with the quote form or pasted into Messenger.
import { MODELS, CATEGORIES, ACCESSORIES, priceFor, imgFor, noteFor, galleryFor, peso } from './accessories.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const KEY = 'wf-inquiry-v1';

export function initShop({ base, onChange, lightbox }) {
  const grid = $('#shopGrid'), modelEl = $('#shopModel'), catEl = $('#shopCat'), countEl = $('#shopCount');
  const bar = $('#cartBar'), barCount = $('#cartCount'), barTotal = $('#cartTotal');
  const state = { model: 'YL', cat: 'all' };
  let cart = [];                                                   // [{ id, model }]
  try { const saved = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(saved)) cart = saved.filter(c => ACCESSORIES.some(a => a.id === c.id)); } catch { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* ignore */ } };
  const inCart = (id, model) => cart.some(c => c.id === id && c.model === model);
  const modelLabel = m => MODELS.find(x => x.id === m)?.label || m;

  function lines() {
    return cart.map(c => { const a = ACCESSORIES.find(x => x.id === c.id), p = priceFor(a, c.model); return { ...c, name: a.name, price: p, from: !!a.from, label: `${a.name} (${modelLabel(c.model)})`, priceText: p == null ? 'price on request' : (a.from ? 'from ' : '') + peso(p) }; });
  }
  function summary() {
    const ls = lines(), total = ls.reduce((s, l) => s + (l.price || 0), 0), open = ls.some(l => l.price == null || l.from);
    return { lines: ls, count: ls.length, total, totalText: ls.length ? peso(total) + (open ? '+' : '') : '', text: ls.map(l => `• ${l.label}: ${l.priceText}`).join('\n') + (ls.length ? `\nEstimated total: ${peso(total)}${open ? ' + items on request' : ''}\nFree installation at WrapFinest` : '') };
  }

  function renderBar() {
    const s = summary();
    bar.hidden = !s.count; document.body.classList.toggle('has-cart', !!s.count);
    barCount.textContent = `${s.count} item${s.count === 1 ? '' : 's'}`; barTotal.textContent = s.totalText;
    onChange?.(s);
  }
  function toggle(id) {
    const i = cart.findIndex(c => c.id === id && c.model === state.model);
    if (i >= 0) cart.splice(i, 1); else cart.push({ id, model: state.model });
    save(); renderGrid(); renderBar();
  }

  function renderGrid() {
    const items = ACCESSORIES.filter(a => a.fit.includes(state.model) && (state.cat === 'all' || a.cat === state.cat));
    grid.innerHTML = '';
    for (const a of items) {
      const p = priceFor(a, state.model), added = inCart(a.id, state.model), note = noteFor(a, state.model);
      const card = el('article', 'pcard' + (added ? ' is-added' : ''));
      card.innerHTML = `
        <button type="button" class="pcard__img" data-zoom="${a.id}" aria-label="View larger photos of ${a.name}"><img src="${base}media/acc/${imgFor(a, state.model)}.webp" alt="${a.name}" loading="lazy" width="720" height="720" />${a.tag ? `<span class="pcard__tag mono">${a.tag}</span>` : ''}${extras(a)}<span class="pcard__zoom" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span></button>
        <div class="pcard__body">
          <h3>${a.name}</h3>
          <p>${a.desc}${note ? ` <em>${note}.</em>` : ''}</p>
          <div class="pcard__foot">
            <span class="pcard__price">${p == null ? '<small>Price</small>On request' : `<small>${a.from ? 'From' : modelLabel(state.model)}</small>${peso(p)}`}</span>
            <button type="button" class="pcard__add" aria-pressed="${added}" data-id="${a.id}">${added ? '✓ In your list' : '+ Add to inquiry'}</button>
          </div>
        </div>`;
      grid.append(card);
    }
    countEl.textContent = `${items.length} item${items.length === 1 ? '' : 's'} for ${modelLabel(state.model)}`;
  }
  grid.addEventListener('click', e => {
    const b = e.target.closest('.pcard__add'); if (b) return toggle(b.dataset.id);
    const z = e.target.closest('[data-zoom]'); if (z) openProduct(z.dataset.zoom);
  });

  // small chips on the card: how many real photos / a video are in the viewer
  function extras(a) {
    const n = (a.photos || []).length, v = a.video && (typeof a.video === 'string' || a.video[state.model]);
    if (!n && !v) return '';
    return `<span class="pcard__more mono">${n ? `${n} real photo${n > 1 ? 's' : ''}` : ''}${n && v ? ' · ' : ''}${v ? 'video' : ''}</span>`;
  }

  // zoom viewer with a product panel (price + add to inquiry stay in sync with the card)
  function openProduct(id) {
    const a = ACCESSORIES.find(x => x.id === id); if (!a || !lightbox) return;
    const model = state.model;
    const panel = host => {
      const p = priceFor(a, model), added = inCart(a.id, model), note = noteFor(a, model);
      host.innerHTML = `
        <p class="lb__brand mono"><img src="${base}brand/jdc.webp" alt="" width="40" height="20" /> JDC AI Auto Interesting</p>
        <h3>${a.name}</h3>
        <p class="lb__model mono">For ${modelLabel(model)}${a.tag ? ` · ${a.tag}` : ''}</p>
        <p class="lb__price">${p == null ? 'Price on request' : `${a.from ? '<small>From</small> ' : ''}${peso(p)}`}</p>
        <p class="lb__desc">${a.desc}${note ? ` <em>${note}.</em>` : ''}</p>
        <button type="button" class="btn lb__add" aria-pressed="${added}">${added ? '✓ In your inquiry list' : '+ Add to inquiry'}</button>
        <p class="lb__fine">Free installation at our bay in Pampanga. Official JDC distributor.</p>`;
      host.querySelector('.lb__add').onclick = () => { const i = cart.findIndex(c => c.id === a.id && c.model === model); if (i >= 0) cart.splice(i, 1); else cart.push({ id: a.id, model }); save(); renderGrid(); renderBar(); panel(host); };
    };
    lightbox.open(galleryFor(a, model, base), 0, panel);
  }

  const seg = (host, list, key, cls) => list.forEach(o => {
    const b = el('button', cls, o.label); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(state[key] === o.id));
    b.onclick = () => { state[key] = o.id; [...host.children].forEach(c => c.setAttribute('aria-checked', String(c === b))); renderGrid(); };
    host.append(b);
  });
  seg(modelEl, MODELS, 'model', 'seg__btn'); seg(catEl, CATEGORIES, 'cat', 'pill');
  $('#cartClear').addEventListener('click', () => { cart = []; save(); renderGrid(); renderBar(); });

  // hide the floating bar while the quote form is on screen (the list is shown inside the form there)
  const quote = $('#quote');
  if (quote && 'IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => bar.classList.toggle('is-away', e.isIntersecting)), { threshold: 0.15 }).observe(quote);

  renderGrid(); renderBar();
  return {
    summary,
    add(id, model = 'YL') { if (!inCart(id, model)) { cart.push({ id, model }); save(); renderGrid(); renderBar(); } },
    remove(id, model) { cart = cart.filter(c => !(c.id === id && c.model === model)); save(); renderGrid(); renderBar(); },
    clear() { cart = []; save(); renderGrid(); renderBar(); },
  };
}
