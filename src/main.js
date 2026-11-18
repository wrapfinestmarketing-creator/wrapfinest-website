import './styles.css';
import Lenis from 'lenis';
import { TINTS, FINISHES, SWATCHES, TINT_LAYERS, CONTACT } from './data.js';
import { createStory } from './story.js';
import { createFilm } from './film.js';
import { initShop } from './shop.js';
import { createLightbox } from './lightbox.js';
import manifest from './film-manifest.json';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const BASE = import.meta.env.BASE_URL;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => matchMedia('(max-width: 760px)').matches;
const params = new URLSearchParams(location.search);

// live state the story reads on every scroll tick
const ctx = { thermo: 1, tint: 0.64, finish: 'finish-gloss', idle: 0, get mobile() { return isMobile(); } };
let film = null;

/* ---------------- preloader ---------------- */
const pre = { bar: $('#preloaderBar'), pct: $('#preloaderPct'), fill: $('#preloaderFill'), hex: $('.preloader__hex') };
function setProgress(p) {
  p = Math.min(1, Math.max(0, p));
  pre.bar.style.transform = `scaleX(${p})`; pre.pct.textContent = Math.round(p * 100);
  pre.fill.style.clipPath = `inset(0 ${100 - p * 100}% 0 0)`; pre.hex.style.setProperty('--lit', `${10 + p * 90}%`);
}
function ready() {
  setProgress(1);
  setTimeout(() => { document.body.classList.remove('is-loading'); document.body.classList.add('is-ready'); lenis?.start(); onScroll(); }, 300);
}

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if (!reducedMotion && matchMedia('(pointer: fine)').matches && !params.has('nolenis')) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9 }); lenis.stop();
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
}
const scrollToEl = el => { if (!el) return; if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 }); else el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); };
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) return;
  e.preventDefault();
  if (a.dataset.prefill) prefillService(a.dataset.prefill);
  if (a.dataset.add) shop?.add(a.dataset.add, 'YL');
  scrollToEl(el);
});

/* ---------------- story + film ---------------- */
const story = createStory($('#story'));
const stageEl = $('#stage'), scrim = $('#scrim'), nav = $('#nav'), rail = $('#rail');
const stageTag = $('#stageTag'), stageTagName = $('#stageTagName'), stageTagLogo = $('#stageTagLogo'), stageTagLabel = $('#stageTagLabel');
const BRANDS = { f1: { logo: 'brand/f1-autofilms.webp', alt: 'F1 Auto Films', label: 'Film shown' }, jdc: { logo: 'brand/jdc.webp', alt: 'JDC AI Auto Interesting', label: 'Accessory shown' } };
let shop = null;
const ui = { filmBar: $('#filmBar'), filmPct: $('#filmPct'), healBar: $('#healBar'), healTxt: $('#healTxt'), layers: $('#layers') };
let lastChapter = '', lastIndex = -1;
// which media the next step needs, so it is already loading before the visitor gets there
const NEEDS = { hero: ['hero'], film: ['ppf'], impact: ['impact'], heal: ['heal'], pcu: ['outro'], rain: ['rain'], monsoon: ['rain'], studio: ['finish-gloss', 'finish-satin', 'finish-onyx'], tint: ['tint-light', 'tint-dark'], layers: [], chipbare: ['chipbare'], wrapglass: ['wrapglass'], stones: ['stones'], roof: ['roof'], heat: ['heat-bare', 'heat-shield'], install: [], smash: ['smash'], accintro: ['kit-parts'], kitfront: ['kitfront'], kitrear: ['kitrear'], mats: ['mats'], shade: ['shade'], exit: ['shade'] };

function onScroll() {
  const y = window.scrollY;
  const s = story.sample(y, ctx), sc = s.scene;
  story.steps.forEach((st, i) => st.el.classList.toggle('is-active', i === s.index && s.active));
  film?.set(sc); film?.setHidden(sc.dim > 0.985);
  stageEl.style.setProperty('--dim', sc.dim.toFixed(3));
  scrim.dataset.side = s.active && sc.dim < 0.5 ? sc.side : 'C';
  let prod = s.step.el.dataset.product || '';
  if (prod === 'studio') prod = sel.finish.f1 ? sel.finish.f1 : '';
  const tagOn = !!prod && s.active && sc.dim < 0.5 && !s.past;
  stageTag.classList.toggle('is-on', tagOn);
  if (tagOn) {
    if (stageTagName.textContent !== prod) stageTagName.textContent = prod; stageTag.dataset.side = sc.side === 'R' ? 'R' : 'L';
    const brand = s.step.el.dataset.brand || 'f1';
    if (stageTag.dataset.brand !== brand) { const b = BRANDS[brand]; stageTag.dataset.brand = brand; stageTagLogo.src = BASE + b.logo; stageTagLogo.alt = b.alt; stageTagLabel.textContent = b.label; }
  }
  nav.classList.toggle('is-solid', y > 40);
  rail.classList.toggle('is-off', s.past || sc.dim > 0.95);
  if (s.index !== lastIndex) { lastIndex = s.index; const nx = story.steps[s.index + 1], nn = story.steps[s.index + 2]; film?.preload([...(nx ? NEEDS[nx.key] : []), ...(nn ? NEEDS[nn.key] : [])]); }
  const ch = s.past ? '' : s.step.chapter;
  if (ch !== lastChapter) {
    lastChapter = ch;
    $$('[data-rail]').forEach(a => a.classList.toggle('is-current', a.dataset.rail === ch));
    $$('.nav__links a').forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === '#' + ({ ppf: 'ppf', ceramic: 'ppf', finish: 'finish', tint: 'tint', thermo: 'thermo', acc: 'tesla' }[ch] || '_')));
  }
  // live readouts
  if (sc.meter != null) { ui.filmBar.style.transform = `scaleX(${sc.meter})`; ui.filmPct.textContent = Math.round(sc.meter * 100); }
  if (sc.heal != null) { ui.healBar.style.transform = `scaleX(${sc.heal})`; ui.healTxt.textContent = sc.heal > 0.97 ? 'Healed' : sc.heal > 0.05 ? 'Healing…' : 'Scratched'; }
  if (s.step.key === 'layers') ui.layers.style.setProperty('--spread', Math.min(1, Math.max(0, (s.p - 0.08) / 0.45)).toFixed(3));
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { story.measure(); onScroll(); });

// gentle hero motion while the visitor has not scrolled yet
if (!reducedMotion && !params.has('still')) {
  const t0 = performance.now();
  const tick = now => { requestAnimationFrame(tick); if (window.scrollY > 4 || document.hidden) { if (ctx.idle) { ctx.idle = 0; } return; } ctx.idle = 0.07 * (1 - Math.cos((now - t0) / 2600)) / 2; onScroll(); };
  requestAnimationFrame(tick);
}

/* ---------------- finish studio ---------------- */
const chipsEl = $('#finishChips'), swEl = $('#swatches'), blurbEl = $('#finishBlurb'), productEl = $('#finishProduct'), selInput = $('#formSelection');
const sel = { finish: FINISHES[0], swatch: SWATCHES[0], tint: TINTS[3] };
function updateSelectionField() {
  const f = sel.finish.swatches ? `${sel.finish.label}: ${sel.swatch.name}` : `${sel.finish.label} (${sel.finish.product})`;
  selInput.value = `${f} · Tint ${sel.tint.name} ${sel.tint.vlt}% VLT`;
}
function applyFinish() {
  const f = sel.finish;
  ctx.finish = f.swatches ? sel.swatch.still : f.still;
  blurbEl.textContent = f.blurb; productEl.textContent = f.swatches ? `${f.product} · ${sel.swatch.name}` : f.product; swEl.hidden = !f.swatches;
  $$('.chip', chipsEl).forEach(c => c.setAttribute('aria-checked', String(c.dataset.id === f.id)));
  $$('.swatch', swEl).forEach(c => c.setAttribute('aria-checked', String(c.dataset.name === sel.swatch.name)));
  updateSelectionField(); onScroll();
}
FINISHES.forEach(f => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.role = 'radio'; b.dataset.id = f.id; b.textContent = f.label; b.setAttribute('aria-checked', 'false'); b.onclick = () => { sel.finish = f; if (f.swatches) film?.preload(SWATCHES.map(s => s.still)); applyFinish(); }; chipsEl.append(b); });
SWATCHES.forEach(s => { const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch'; b.role = 'radio'; b.dataset.name = s.name; b.title = s.name; b.setAttribute('aria-label', s.name); b.style.setProperty('--c', s.color); b.onpointerenter = () => film?.loadStill(s.still); b.onclick = () => { sel.swatch = s; applyFinish(); }; swEl.append(b); });
$$('.chip', chipsEl)[0].setAttribute('aria-checked', 'true');
$('#quoteFinish').addEventListener('click', () => prefillService(sel.finish.service));

/* ---------------- tint slider ---------------- */
const tintUI = { range: $('#tintRange'), name: $('#tintName'), shade: $('#tintShade'), vlt: $('#tintVlt'), irr: $('#tintIrr'), uvr: $('#tintUvr'), tser: $('#tintTser'), heat: $('#tintHeat') };
function applyTint() {
  const t = TINTS[+tintUI.range.value]; sel.tint = t;
  tintUI.name.textContent = t.name; tintUI.shade.textContent = t.shade; tintUI.vlt.textContent = t.vlt;
  tintUI.irr.textContent = t.irr; tintUI.uvr.textContent = t.uvr; tintUI.tser.textContent = t.tser;
  tintUI.heat.style.transform = `scaleX(${Math.max(0.04, (100 - t.tser) / 100)})`;
  tintUI.range.setAttribute('aria-valuetext', `${t.name}, ${t.shade}, ${t.vlt}% VLT`);
  ctx.tint = Math.pow(1 - (t.vlt - 5) / 71, 0.8);          // 5% VLT = fully dark still, 76% = light still
  updateSelectionField(); onScroll();
}
tintUI.range.addEventListener('input', applyTint);

/* 9-layer stack */
(() => {
  const colors = ['#d9dde2', '#aab2bb', '#ef4523', '#6d747d', '#ff7a3d', '#3fa9ff', '#ef4523', '#c9d3dc', '#8a8f98'];
  const stack = document.createElement('div'); stack.className = 'layers__stack';
  const labels = document.createElement('ol'); labels.className = 'layers__labels';
  TINT_LAYERS.forEach((name, i) => {
    const l = document.createElement('div'); l.className = 'layer'; l.style.setProperty('--i', TINT_LAYERS.length - 1 - i); l.style.setProperty('--lc', colors[i] + '55'); stack.append(l);
    const li = document.createElement('li'); li.style.setProperty('--lc', colors[i]); li.innerHTML = `<b>${i + 1}</b>${name}`; labels.append(li);
  });
  ui.layers.append(stack, labels);
})();

/* thermoshield toggle */
$$('#thermoToggle button').forEach(b => b.addEventListener('click', () => { ctx.thermo = +b.dataset.on; $$('#thermoToggle button').forEach(x => x.classList.toggle('is-on', x === b)); onScroll(); }));

/* ---------------- content: gallery, video, reveal ---------------- */
(() => {
  const g = $('#gallery'); let down = false, sx = 0, sl = 0;
  g.addEventListener('pointerdown', e => { g.dataset.dragged = '0'; if (e.pointerType === 'touch') return; down = true; sx = e.clientX; sl = g.scrollLeft; g.classList.add('is-dragging'); });
  window.addEventListener('pointermove', e => { if (!down) return; if (Math.abs(e.clientX - sx) > 6) g.dataset.dragged = '1'; g.scrollLeft = sl - (e.clientX - sx); });
  window.addEventListener('pointerup', () => { down = false; g.classList.remove('is-dragging'); });
  g.addEventListener('keydown', e => { if (e.key === 'ArrowRight') g.scrollBy({ left: 400, behavior: 'smooth' }); if (e.key === 'ArrowLeft') g.scrollBy({ left: -400, behavior: 'smooth' }); });
})();
(() => {
  const reel = $('#reel'), wrap = reel.closest('.reel');
  $('#reelPlay').addEventListener('click', () => { reel.play(); reel.controls = true; wrap.classList.add('is-playing'); });
  $$('.voice').forEach(v => {
    const vid = $('video', v);
    const toggle = () => { if (vid.paused) { $$('.voice video').forEach(o => o !== vid && o.pause()); vid.play(); vid.controls = true; } else vid.pause(); };
    $('button', v).addEventListener('click', toggle);
    vid.addEventListener('play', () => v.classList.add('is-playing')); vid.addEventListener('pause', () => v.classList.remove('is-playing'));
  });
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) e.target.pause?.(); }), { threshold: 0.1 });
  $$('video').forEach(v => io.observe(v));
})();
(() => {
  const els = $$('.content .wrap > *, .gallery figure, .prices article, .voice');
  els.forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = `${(i % 4) * 60}ms`; });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(el => io.observe(el));
})();

/* ---------------- quote form ---------------- */
function prefillService(name) { const c = $$('#quoteForm input[name="services"]').find(i => i.value === name); if (c) c.checked = true; }
(() => {
  const form = $('#quoteForm'), status = $('#formStatus');
  form.addEventListener('submit', async e => {
    e.preventDefault(); status.className = 'form__status'; status.textContent = '';
    let ok = true;
    $$('[required]', form).forEach(i => { const bad = !i.value.trim(); i.setAttribute('aria-invalid', String(bad)); if (bad) ok = false; });
    const email = form.elements.email; if (email.value && !/^\S+@\S+\.\S+$/.test(email.value)) { email.setAttribute('aria-invalid', 'true'); ok = false; } else email.removeAttribute('aria-invalid');
    if (!ok) { status.classList.add('is-err'); status.textContent = 'Please fill in your name, mobile number and car.'; $('[aria-invalid="true"]', form)?.focus(); return; }
    if (form.elements._honey.value) return;
    const fd = new FormData(form), services = fd.getAll('services').join(', ') || 'Not specified';
    const payload = { _subject: `Quote request: ${fd.get('vehicle')} (${fd.get('name')})`, _template: 'table', _captcha: 'false', Name: fd.get('name'), Mobile: fd.get('phone'), Email: fd.get('email') || '-', Vehicle: fd.get('vehicle'), Services: services, Selection: fd.get('selection') || '-', Accessories: shop?.summary().text || '-', Message: fd.get('message') || '-' };
    const btn = $('button[type="submit"]', form); btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const r = await fetch(CONTACT.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(String(r.status));
      status.classList.add('is-ok'); status.textContent = 'Request sent. We will reply during shop hours, 9AM to 6PM.'; form.reset(); updateSelectionField(); shop?.clear();
    } catch {
      status.classList.add('is-err');
      status.innerHTML = `We could not send that just now. Please message us on <a href="${CONTACT.messenger}" target="_blank" rel="noopener"><u>Messenger</u></a> or call <a href="${CONTACT.phoneHref}"><u>${CONTACT.phone}</u></a>.`;
    } finally { btn.disabled = false; btn.textContent = 'Send request'; }
  });
})();
/* ---------------- zoom viewer ---------------- */
const lightbox = createLightbox({ onOpen: () => lenis?.stop(), onClose: () => lenis?.start() });
// any [data-lightbox] group: clicking one of its images opens all of them in the viewer
const groupItems = g => $$('img', g).map(im => ({ src: im.dataset.full || im.currentSrc || im.src, thumb: im.currentSrc || im.src, alt: im.alt, caption: [...(im.closest('figure')?.querySelector('figcaption')?.childNodes || [])].map(n => n.textContent.trim()).filter(Boolean).join(' · ') }));
$$('[data-lightbox]').forEach(g => {
  $$('img', g).forEach((im, n) => {
    const fig = im.closest('figure') || im; fig.classList.add('is-zoomable'); fig.tabIndex = 0; fig.setAttribute('role', 'button'); fig.setAttribute('aria-label', `View larger: ${im.alt}`);
    fig.addEventListener('click', () => { if (g.dataset.dragged === '1') return; lightbox.open(groupItems(g), n); });
    fig.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lightbox.open(groupItems(g), n); } });
  });
});

/* ---------------- accessories shop ---------------- */
(() => {
  const box = $('#formCart'), list = $('#formCartList'), total = $('#formCartTotal'), copy = $('#formCartCopy');
  const render = sum => {
    box.hidden = !sum.count; list.innerHTML = '';
    for (const l of sum.lines) { const li = document.createElement('li'); li.innerHTML = `<span>${l.label}</span><b>${l.priceText}</b><button type="button" aria-label="Remove ${l.name}">×</button>`; li.querySelector('button').onclick = () => shop.remove(l.id, l.model); list.append(li); }
    total.textContent = sum.count ? `Estimated total ${sum.totalText}` : '';
    if (sum.count) prefillService('Tesla accessories');
  };
  shop = initShop({ base: BASE, onChange: render, lightbox });
  copy.addEventListener('click', async () => {
    const text = `Hi WrapFinest, I'd like to ask about these Tesla accessories:\n${shop.summary().text}`;
    try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied. Paste it in Messenger'; } catch { copy.textContent = 'Could not copy. Please send the form instead'; return; }
    window.open(CONTACT.messenger, '_blank', 'noopener');
  });
})();
$('#year').textContent = new Date().getFullYear();

/* ---------------- boot ---------------- */
async function boot() {
  story.measure(); applyTint(); updateSelectionField(); setProgress(0.04);
  film = createFilm({ canvas: $('#film'), base: BASE, manifest, reducedMotion });
  window.__wf = { film, story, onScroll, ctx };
  // show the page once the hero is scrubbable; everything else streams in behind
  const heroN = manifest.seqs.hero?.n || 0, need = Math.min(heroN, 12);
  let done = 0; const bump = () => setProgress(0.04 + 0.9 * Math.min(1, ++done / Math.max(1, need)));
  const waits = []; for (let i = 1; i <= need; i++) waits.push(film.whenSeq('hero', i).then(bump));
  const timeout = new Promise(r => setTimeout(r, 9000));
  await Promise.race([Promise.all(waits), timeout]);
  onScroll(); film.snap(); film.start(); film.preload(['ppf']);
  story.measure(); ready();
}
if (document.fonts?.ready) document.fonts.ready.then(() => { story.measure(); onScroll(); });
window.addEventListener('load', () => { story.measure(); onScroll(); });
boot();
