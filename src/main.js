import './styles.css';
import Lenis from 'lenis';
import { TINTS, ARMOR, GLASS, FINISHES, SWATCHES, TINT_LAYERS, CONTACT } from './data.js';
import { createStory } from './story.js';
import { createFilm } from './film.js';
import { createPainter } from './paint.js';
import { createTinter } from './tint.js';
import { initShop } from './shop.js';
import { createLightbox } from './lightbox.js';
import manifest from './film-manifest.json';
import { track, sectionView, lead, sourceText } from './track.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const BASE = import.meta.env.BASE_URL;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => matchMedia('(max-width: 760px)').matches;
const params = new URLSearchParams(location.search);

// live state the story reads on every scroll tick
const ctx = { thermo: 1, finish: 'finish-gloss', idle: 0, get mobile() { return isMobile(); },
  spin: false, angle: 0, paint: FINISHES[0].paint,              // 360 view: on/off, turns (1 = full turn), live paint recipe
  tc: {} };                                                      // glass configurators (tint, Thermoshield X), see createGlassConfig
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
const NEEDS = { hero: ['hero'], film: ['ppf'], impact: ['impact'], heal: ['heal'], pcu: ['outro'], rain: ['rain'], monsoon: ['rain'], studio: ['finish-gloss', 'finish-satin', 'finish-onyx'], tint: ['tint-light', 'tint-dark'], armor: ['tint-light', 'tint-dark'], layers: [], chipbare: ['chipbare'], wrapglass: ['wrapglass'], stones: ['stones'], roof: ['roof'], heat: ['heat-bare', 'heat-shield'], install: [], smash: ['smash'], accintro: ['kit-parts'], kitfront: ['kitfront'], kitrear: ['kitrear'], mats: ['mats'], shade: ['shade'], exit: ['shade'] };

// sections reported to Meta (ViewContent) the first time a visitor reaches them
const CHAPTER_NAMES = { ppf: 'Paint protection film', ceramic: 'Ceramic coating', finish: 'Finish Studio', tint: 'Nano ceramic tint', thermo: 'Thermoshield X', acc: 'Tesla accessories' };
function onScroll() {
  const y = window.scrollY;
  for (const g of Object.values(glassCfg)) g.refocus();
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
    sectionView(CHAPTER_NAMES[ch]);
    $$('[data-rail]').forEach(a => a.classList.toggle('is-current', a.dataset.rail === ch));
    $$('.nav__links a').forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === '#' + ({ ppf: 'ppf', ceramic: 'ppf', finish: 'finish', tint: 'tint', thermo: 'thermo', acc: 'tesla' }[ch] || '_')));
  }
  // live readouts
  if (sc.meter != null) { ui.filmBar.style.transform = `scaleX(${sc.meter})`; ui.filmPct.textContent = Math.round(sc.meter * 100); }
  if (sc.heal != null) { ui.healBar.style.transform = `scaleX(${sc.heal})`; ui.healTxt.textContent = sc.heal > 0.97 ? 'Healed' : sc.heal > 0.05 ? 'Healing…' : 'Scratched'; }
  if (s.step.key === 'studio' && s.active) studioSpin.intro();
  const gc = glassCfg[s.step.key]; if (gc && s.active) gc.shown();
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
const sel = { finish: FINISHES[0], swatch: SWATCHES[0] };
const glassCfg = {};                                             // the glass configurators by step: tint, armor
function updateSelectionField() {
  const f = sel.finish.swatches ? `${sel.finish.label}: ${sel.swatch.name}` : `${sel.finish.label} (${sel.finish.product})`;
  selInput.value = [f, ...Object.values(glassCfg).map(g => g.summary()).filter(Boolean)].join(' · ');
}
function applyFinish() {
  const f = sel.finish;
  ctx.finish = f.swatches ? sel.swatch.still : f.still; ctx.paint = f.swatches ? sel.swatch.paint : f.paint;
  blurbEl.textContent = f.blurb; productEl.textContent = f.swatches ? `${f.product} · ${sel.swatch.name}` : f.product; swEl.hidden = !f.swatches;
  $$('.chip', chipsEl).forEach(c => c.setAttribute('aria-checked', String(c.dataset.id === f.id)));
  $$('.swatch', swEl).forEach(c => c.setAttribute('aria-checked', String(c.dataset.name === sel.swatch.name)));
  updateSelectionField(); onScroll();
}
FINISHES.forEach(f => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.role = 'radio'; b.dataset.id = f.id; b.textContent = f.label; b.setAttribute('aria-checked', 'false'); b.onclick = () => { sel.finish = f; if (f.swatches && !ctx.spin) film?.preload(SWATCHES.map(s => s.still)); applyFinish(); track('CustomizeProduct', { content_name: 'Finish Studio', content_ids: [f.id] }); }; chipsEl.append(b); });
SWATCHES.forEach(s => { const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch'; b.role = 'radio'; b.dataset.name = s.name; b.title = s.name; b.setAttribute('aria-label', s.name); b.style.setProperty('--c', s.color); b.onpointerenter = () => { if (!ctx.spin) film?.loadStill(s.still); }; b.onclick = () => { sel.swatch = s; applyFinish(); track('CustomizeProduct', { content_name: 'Finish Studio', content_ids: [s.name] }); }; swEl.append(b); });
$$('.chip', chipsEl)[0].setAttribute('aria-checked', 'true');
$('#quoteFinish').addEventListener('click', () => prefillService(sel.finish.service));

/* ---------------- 360 views ---------------- */
// A car on a turntable: turned by dragging (mouse or finger) or with the arrow keys; it turns once by itself on first view.
const VIEW_NAMES = ['Side view', 'Front three-quarter view', 'Front view', 'Front three-quarter view, other side', 'Other side view', 'Rear three-quarter view', 'Rear view', 'Rear three-quarter view, other side'];
const SPIN_DIR = 1;                                              // +1: dragging right turns the car's near side to the right
function createSpin({ pad, seq, on, get, set }) {
  const spin = { drag: null, v: 0, raf: 0, intro: 0 };          // intro: 0 not played, 1 playing, 2 done
  function setAngle(a) {
    set(a);
    const deg = Math.round((((a % 1) + 1) % 1) * 360) % 360;
    pad.setAttribute('aria-valuenow', String(deg)); pad.setAttribute('aria-valuetext', VIEW_NAMES[Math.round(deg / 45) % 8]);
    onScroll();
  }
  function stop() { cancelAnimationFrame(spin.raf); spin.raf = 0; spin.v = 0; if (spin.intro === 1) spin.intro = 2; }
  function coast() {                                             // keep turning a little after the finger lifts
    let last = performance.now();
    const step = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      spin.v *= Math.exp(-dt * 3.2);
      if (Math.abs(spin.v) < 0.015) { spin.raf = 0; return; }
      setAngle(get() + spin.v * dt); spin.raf = requestAnimationFrame(step);
    };
    spin.raf = requestAnimationFrame(step);
  }
  function intro() {                                             // one slow turn the first time the car is seen
    if (spin.intro || !on() || reducedMotion || params.has('still')) return;
    if ((film?.seqLoaded(seq) ?? 0) < 1) return;                 // wait until every angle is loaded
    spin.intro = 1; const t0 = performance.now(), a0 = get(), DUR = 3400;
    const step = now => {
      if (spin.intro !== 1) return;
      const t = Math.min(1, (now - t0) / DUR), e = t * t * (3 - 2 * t);
      setAngle(a0 + e); if (t < 1) spin.raf = requestAnimationFrame(step); else { spin.intro = 2; spin.raf = 0; }
    };
    spin.raf = requestAnimationFrame(step);
  }
  pad.addEventListener('pointerdown', e => {
    if (e.button > 0 || !on()) return;
    stop(); spin.intro = 2;
    const touch = e.pointerType === 'touch';
    spin.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, a: get(), lx: e.clientX, lt: e.timeStamp, on: !touch, per: Math.max(520, pad.clientWidth * 0.9) };
    if (!touch) { pad.setPointerCapture(e.pointerId); pad.classList.add('is-dragging'); e.preventDefault(); pad.focus({ preventScroll: true }); }
  });
  pad.addEventListener('pointermove', e => {
    const d = spin.drag; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.on) {                                                 // touch: a mostly-sideways move turns the car, anything else scrolls the page
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
      d.on = true; d.x = e.clientX; d.a = get(); pad.setPointerCapture(e.pointerId); pad.classList.add('is-dragging'); return;
    }
    const dt = Math.max(1, e.timeStamp - d.lt) / 1000, inst = SPIN_DIR * (e.clientX - d.lx) / d.per / dt;
    spin.v += (inst - spin.v) * Math.min(1, dt * 18); d.lx = e.clientX; d.lt = e.timeStamp;
    pad.classList.add('is-used');
    setAngle(d.a + SPIN_DIR * dx / d.per);
  });
  const end = e => {
    const d = spin.drag; if (!d || d.id !== e.pointerId) return;
    spin.drag = null; pad.classList.remove('is-dragging');
    if (d.on && e.type === 'pointerup' && e.timeStamp - d.lt < 90 && Math.abs(spin.v) > 0.05 && !reducedMotion) coast(); else spin.v = 0;
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('keydown', e => {
    if (!on()) return;
    if (e.key === 'Home') { e.preventDefault(); stop(); spin.intro = 2; setAngle(0); return; }
    const step = { ArrowRight: 1 / 24, ArrowLeft: -1 / 24, PageUp: 0.25, PageDown: -0.25 }[e.key];
    if (!step) return;
    e.preventDefault(); stop(); spin.intro = 2; pad.classList.add('is-used'); setAngle(get() + step);
  });
  function turnTo(a) {                                           // turn the short way round to angle a
    stop(); spin.intro = 2;
    const a0 = get(), a1 = a0 + ((((a - a0) % 1) + 1.5) % 1) - 0.5;
    if (reducedMotion || Math.abs(a1 - a0) < 0.004) { setAngle(a1); return; }
    const t0 = performance.now(), DUR = 500 + Math.abs(a1 - a0) * 1600;
    const step = now => {
      const t = Math.min(1, (now - t0) / DUR), e = t * t * (3 - 2 * t);
      setAngle(a0 + (a1 - a0) * e); if (t < 1) spin.raf = requestAnimationFrame(step); else spin.raf = 0;
    };
    spin.raf = requestAnimationFrame(step);
  }
  return { setAngle, intro, stop, turnTo };
}
const studioSpin = createSpin({ pad: $('#spinPad'), seq: 'spin', on: () => ctx.spin, get: () => ctx.angle, set: a => { ctx.angle = a; } });
/* ---------------- glass configurators: a film for each glass ---------------- */
// One configurator per section (Nitro tint, Thermoshield X): the same car and glass, its own films and choices.
// Picking a glass turns the car to where that glass is best seen and zooms onto it (the roof: the top view).
const GLASS_VIEW = { w: 0.12, f: 0.04, r: 0.96, k: 0.78, o: 'top' };
function createGlassConfig({ step, films, start, label, mixed, simpleIntro, simpleFilm, specs, quote, alwaysQuote }) {
  const root = $(`[data-step="${step}"]`), q = k => $(`[data-t="${k}"]`, root);
  const ui = { spin: q('spin'), pad: q('pad'), box: q('box'), views: q('views'), glass: q('glass'), films: q('films'), name: q('name'), shade: q('shade'), vlt: q('vlt'), intro: q('intro') };
  const filmOf = id => films.find(t => t.id === id);
  // on: live glass available, angle: turns, view: 360 or top, tints: what each glass lets through (eased),
  // focus: the zoom box, alpha: fallback cross-fade, glass: picked glass, zoom: zoom on after the first pick
  const g = { on: false, angle: 0, view: '360', tints: { key: '', rgb: new Float32Array(15).fill(1) }, focus: { fk: 0 }, alpha: 0.6, glass: 'w', zoom: false, touched: false,
    film: Object.fromEntries(GLASS.map(x => [x.id, filmOf(start[x.id])])) };
  ctx.tc[step] = g;
  const spin = createSpin({ pad: ui.pad, seq: 'tspin', on: () => g.on && g.view === '360', get: () => g.angle, set: a => { g.angle = a; } });
  const now = new Float32Array(15).fill(1); let raf = 0, tick = 0;
  function glide(jump) {                                         // the glass darkens or clears over a moment instead of snapping
    cancelAnimationFrame(raf);
    const goal = GLASS.flatMap(x => g.film[x.id].film); let last = performance.now();
    const stepf = t => {
      const k = jump || reducedMotion ? 1 : 1 - Math.exp(-Math.min(0.05, (t - last) / 1000) * 9); last = t; let far = false;
      for (let i = 0; i < 15; i++) { now[i] += (goal[i] - now[i]) * k; if (Math.abs(goal[i] - now[i]) > 0.002) far = true; else now[i] = goal[i]; }
      g.tints = { key: step + ++tick, rgb: now };
      onScroll(); if (far) raf = requestAnimationFrame(stepf);
    };
    stepf(last);
  }
  function refocus() {
    g.focus = { fk: 0 };
    if (!g.on || !g.zoom || g.glass === 'all') return;           // no zoom until a glass is picked
    const gi = GLASS.findIndex(x => x.id === g.glass), top = g.view === 'top', m = manifest.seqs[top ? 'ttop' : 'tspin'];
    const n = m?.focus?.length || 0; if (!n) return;
    const b = m.focus[top ? 0 : ((Math.round(g.angle * n) % n) + n) % n][gi];
    if (b) g.focus = { fk: 1, fcx: b[0], fcy: b[1], fw: b[2], fh: b[3] };
  }
  function setView(v) {
    g.view = v; spin.stop();
    $$('.chip', ui.views).forEach(b => b.setAttribute('aria-checked', String(b.dataset.view === v)));
    ui.spin.classList.toggle('is-top', v === 'top'); onScroll();
  }
  function show(id) {
    if (!g.on || id === 'all') return;
    const v = GLASS_VIEW[id];
    if (v === 'top') { if (g.view !== 'top') setView('top'); return; }
    if (g.view !== '360') setView('360');
    spin.turnTo(v);
  }
  function apply(jump) {
    const list = GLASS.map(x => g.film[x.id]), all = g.glass === 'all';
    const shown = all ? (list.every(t => t === list[0]) ? list[0] : null) : g.film[g.glass];
    $$('button', ui.glass).forEach(b => {
      b.setAttribute('aria-checked', String(b.dataset.id === g.glass));
      if (b.dataset.id !== 'all') $('b', b).textContent = g.film[b.dataset.id].vlt;
    });
    $$('button', ui.films).forEach(b => b.setAttribute('aria-checked', String(!!shown && b.dataset.id === shown.id)));
    ui.name.textContent = shown ? shown.name : label; ui.shade.textContent = shown ? shown.shade : 'Mixed shades';
    const vs = films.map(t => t.vlt); ui.vlt.textContent = shown ? shown.vlt : `${Math.min(...vs)}–${Math.max(...vs)}`;
    specs?.(shown, list, root);
    const avg = list.reduce((n, t) => n + t.vlt, 0) / list.length;
    g.alpha = Math.pow(1 - (avg - 5) / 65, 0.8);                 // fallback pictures: 5% VLT = the dark one, 70% = the light one
    updateSelectionField(); glide(jump);
  }
  function summary() {
    if (!alwaysQuote && !g.touched) return '';
    const list = GLASS.map(x => g.film[x.id]);
    return `${quote} ` + (list.every(t => t === list[0]) ? `${list[0].vlt}% VLT on all glass` : GLASS.map(x => `${x.name} ${g.film[x.id].vlt}%`).join(', '));
  }
  function init(live) {
    g.on = live;
    ui.box.classList.toggle('tint--simple', !live); ui.views.hidden = !live; ui.spin.hidden = !live;
    if (!live) { g.glass = 'all'; for (const x of GLASS) g.film[x.id] = filmOf(simpleFilm); ui.intro.textContent = simpleIntro; }
    for (const x of [...GLASS, { id: 'all', name: 'All glass' }]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'gchip'; b.role = 'radio'; b.dataset.id = x.id;
      b.innerHTML = x.id === 'all' ? `<span>${x.name}</span>` : `<span>${x.name}</span><b></b>`;
      b.onclick = () => { g.glass = x.id; g.zoom = true; show(x.id); apply(); };
      ui.glass.append(b);
    }
    ui.films.style.setProperty('--n', films.length);
    for (const t of films) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'fchip'; b.role = 'radio'; b.dataset.id = t.id;
      b.style.setProperty('--f', `rgb(${t.film.map(v => Math.round(40 + v * 200)).join(',')})`);
      b.setAttribute('aria-label', `${t.shade}, ${t.vlt}% VLT, ${t.name}`);
      b.innerHTML = `<i></i><b>${t.vlt}</b><span>${t.shade}</span>`;
      b.onclick = () => { g.touched = true; for (const x of GLASS) if (g.glass === 'all' || g.glass === x.id) g.film[x.id] = t; apply(); track('CustomizeProduct', { content_name: label, content_ids: [t.id], content_category: g.glass === 'all' ? 'All glass' : GLASS.find(x => x.id === g.glass).name }); };
      ui.films.append(b);
    }
    $$('.chip', ui.views).forEach(b => { b.onclick = () => setView(b.dataset.view); });
    apply(true);
  }
  // when the section is on screen: one slow turn the first time, and the top view starts loading
  const shown = () => { spin.intro(); if (g.on) film?.preload(['ttop']); };
  return (glassCfg[step] = { step, g, spin, init, refocus, summary, shown, setAngle: spin.setAngle });
}
createGlassConfig({
  step: 'tint', films: TINTS, start: Object.fromEntries(GLASS.map(x => [x.id, x.film])), label: 'F1 Nitro', quote: 'Tint', alwaysQuote: true, simpleFilm: 'M35',
  simpleIntro: 'F1 Nitro rejects up to 99% of infrared heat with zero signal loss. Choose a shade to see it on the car.',
  specs(shown, list, root) {
    const avg = k => list.reduce((n, t) => n + t[k], 0) / list.length, r1 = n => Math.round(n * 10) / 10, set = (k, v) => { $(`[data-t="${k}"]`, root).textContent = v; };
    set('irr', shown ? shown.irr : Math.round(avg('irr'))); set('uvr', shown ? shown.uvr : Math.round(avg('uvr'))); set('tser', shown ? shown.tser : r1(avg('tser')));
    $('[data-t="heat"]', root).style.transform = `scaleX(${Math.max(0.04, (100 - (shown ? shown.tser : avg('tser'))) / 100)})`;
  },
});
createGlassConfig({
  step: 'armor', films: ARMOR, start: { w: 'TX70', f: 'TX35', r: 'TX20', k: 'TX20', o: 'TX20' }, label: 'Thermoshield X', quote: 'Thermoshield X', simpleFilm: 'TX35',
  simpleIntro: 'Thermoshield X goes on the outside of the glass in three shades. Choose one to see it on the car.',
});

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
    const payload = { _subject: `Quote request: ${fd.get('vehicle')} (${fd.get('name')})`, _template: 'table', _captcha: 'false', Name: fd.get('name'), Mobile: fd.get('phone'), Email: fd.get('email') || '-', Vehicle: fd.get('vehicle'), Services: services, Selection: fd.get('selection') || '-', Accessories: shop?.summary().text || '-', Message: fd.get('message') || '-', 'Came from': sourceText() };
    const btn = $('button[type="submit"]', form); btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const r = await fetch(CONTACT.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(String(r.status));
      lead({ name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), services, vehicle: fd.get('vehicle') });
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
  let had = null;
  const render = sum => {
    if (had && sum.count > had.length) {                         // an accessory was added to the list
      const l = sum.lines.find(x => !had.some(h => h.id === x.id && h.model === x.model));
      if (l) track('AddToCart', { content_name: l.label, content_ids: [l.id], content_type: 'product', value: l.price || 0, currency: 'PHP' });
    }
    had = sum.lines;
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
if ('IntersectionObserver' in window) {
  const later = { work: 'Our work', voices: 'Reviews', pricing: 'Pricing', visit: 'Visit the shop', quote: 'Quote form' };
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { sectionView(later[e.target.id]); io.unobserve(e.target); } }), { threshold: 0.3 });
  for (const id of Object.keys(later)) { const el = document.getElementById(id); if (el) io.observe(el); }
}

/* ---------------- boot ---------------- */
async function boot() {
  story.measure(); setProgress(0.04);
  // the 360 studio needs the frames and a GPU; without either the studio falls back to its still pictures
  const painter = manifest.seqs.spin && !params.has('nospin') ? createPainter() : null;
  ctx.spin = !!painter; $('#spin').hidden = !ctx.spin; if (ctx.spin) NEEDS.studio = ['spin'];
  // the same goes for the tint car: 360 and top view with a film per glass, or the old two still pictures
  const tinter = manifest.seqs.tspin && manifest.seqs.ttop && !params.has('nospin') ? createTinter() : null;
  for (const g of Object.values(glassCfg)) { g.init(!!tinter); if (tinter) NEEDS[g.step] = ['tspin', 'ttop']; }
  updateSelectionField();
  film = createFilm({ canvas: $('#film'), base: BASE, manifest, reducedMotion, painter, tinter });
  window.__wf = { film, story, onScroll, ctx, setAngle: studioSpin.setAngle, glass: glassCfg, painter, tinter };
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
