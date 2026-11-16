import './styles.css';
import Lenis from 'lenis';
import { TINTS, FINISHES, SWATCHES, FACTORY, TINT_LAYERS, CONTACT } from './data.js';
import { createStory } from './story.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const BASE = import.meta.env.BASE_URL;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => matchMedia('(max-width: 760px)').matches;
const params = new URLSearchParams(location.search);

const ctx = { thermoUser: 1, get mobile() { return isMobile(); } };
let stage = null;

/* ---------------- preloader ---------------- */
const pre = { bar: $('#preloaderBar'), pct: $('#preloaderPct'), fill: $('#preloaderFill'), hex: $('.preloader__hex') };
function setProgress(p) {
  p = Math.min(1, Math.max(0, p));
  pre.bar.style.transform = `scaleX(${p})`; pre.pct.textContent = Math.round(p * 100);
  pre.fill.style.clipPath = `inset(0 ${100 - p * 100}% 0 0)`; pre.hex.style.setProperty('--lit', `${10 + p * 90}%`);
}
function ready() {
  setProgress(1);
  setTimeout(() => { document.body.classList.remove('is-loading'); document.body.classList.add('is-ready'); stage?.setLit(1); lenis?.start(); onScroll(); }, 350);
}

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if (!reducedMotion && matchMedia('(pointer: fine)').matches && !params.has('nolenis')) {
  lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95 }); lenis.stop();
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
}
const scrollToEl = el => { if (!el) return; if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 }); else el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); };
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) return;
  e.preventDefault();
  if (a.dataset.prefill) prefillService(a.dataset.prefill);
  scrollToEl(el);
});

/* ---------------- story + stage ---------------- */
const story = createStory($('#story'));
const stageEl = $('#stage'), nav = $('#nav'), rail = $('#rail');
const ui = { filmBar: $('#filmBar'), filmPct: $('#filmPct'), healBar: $('#healBar'), healTxt: $('#healTxt'), layers: $('#layers') };
let lastChapter = '';

function onScroll() {
  const y = window.scrollY;
  const s = story.sample(y, ctx);
  story.steps.forEach((st, i) => st.el.classList.toggle('is-active', i === s.index && s.active));
  stage?.setTarget(s.state);
  stage?.setHidden(s.state.dim > 0.985);
  stageEl.style.setProperty('--dim', s.state.dim.toFixed(3));
  nav.classList.toggle('is-solid', y > 40);
  rail.classList.toggle('is-off', s.past || s.state.dim > 0.95);
  const ch = s.past ? '' : s.step.chapter;
  if (ch !== lastChapter) {
    lastChapter = ch;
    $$('[data-rail]').forEach(a => a.classList.toggle('is-current', a.dataset.rail === ch));
    $$('.nav__links a').forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === '#' + ({ ppf: 'ppf', ceramic: 'ppf', finish: 'finish', tint: 'tint', thermo: 'thermo' }[ch] || '_')));
  }
  // live readouts
  const film = s.state.film; ui.filmBar.style.transform = `scaleX(${film})`; ui.filmPct.textContent = Math.round(film * 100);
  if (s.step.key === 'heal') { const h = 1 - s.state.scratch; ui.healBar.style.transform = `scaleX(${h})`; ui.healTxt.textContent = h > 0.97 ? 'Healed' : h > 0.05 ? 'Healing…' : 'Scratched'; }
  if (s.step.key === 'layers') ui.layers.style.setProperty('--spread', Math.min(1, Math.max(0, (s.p - 0.08) / 0.45)).toFixed(3));
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { story.measure(); onScroll(); });

/* ---------------- finish studio ---------------- */
const chipsEl = $('#finishChips'), swEl = $('#swatches'), blurbEl = $('#finishBlurb'), productEl = $('#finishProduct'), selInput = $('#formSelection');
const sel = { finish: FINISHES[0], swatch: SWATCHES[0], tint: TINTS[3] };
function updateSelectionField() {
  const f = sel.finish.swatches ? `${sel.finish.label}: ${sel.swatch.name}` : `${sel.finish.label} (${sel.finish.product})`;
  selInput.value = `${f} · Tint ${sel.tint.name} ${sel.tint.vlt}% VLT`;
}
function applyFinish() {
  const f = sel.finish;
  const color = f.swatches ? sel.swatch.color : f.color || FACTORY.color;
  const metal = f.swatches && sel.swatch.metal != null ? sel.swatch.metal : f.metal;
  stage?.setFinish({ color, rough: f.rough, metal, cc: f.cc, ccr: f.ccr });
  blurbEl.textContent = f.blurb; productEl.textContent = f.product; swEl.hidden = !f.swatches;
  $$('.chip', chipsEl).forEach(c => c.setAttribute('aria-checked', String(c.dataset.id === f.id)));
  $$('.swatch', swEl).forEach(c => c.setAttribute('aria-checked', String(c.dataset.name === sel.swatch.name)));
  updateSelectionField();
}
FINISHES.forEach(f => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.role = 'radio'; b.dataset.id = f.id; b.textContent = f.label; b.setAttribute('aria-checked', 'false'); b.onclick = () => { sel.finish = f; applyFinish(); }; chipsEl.append(b); });
SWATCHES.forEach(s => { const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch'; b.role = 'radio'; b.dataset.name = s.name; b.title = s.name; b.setAttribute('aria-label', s.name); b.style.setProperty('--c', s.color); b.onclick = () => { sel.swatch = s; applyFinish(); }; swEl.append(b); });
$$('.chip', chipsEl)[0].setAttribute('aria-checked', 'true');
$('#quoteFinish').addEventListener('click', () => prefillService(sel.finish.swatches ? 'Color change wrap' : 'Paint protection film'));

/* ---------------- tint slider ---------------- */
const tintUI = { range: $('#tintRange'), name: $('#tintName'), shade: $('#tintShade'), vlt: $('#tintVlt'), irr: $('#tintIrr'), uvr: $('#tintUvr'), tser: $('#tintTser'), heat: $('#tintHeat') };
function applyTint() {
  const t = TINTS[+tintUI.range.value]; sel.tint = t;
  tintUI.name.textContent = t.name; tintUI.shade.textContent = t.shade; tintUI.vlt.textContent = t.vlt;
  tintUI.irr.textContent = t.irr; tintUI.uvr.textContent = t.uvr; tintUI.tser.textContent = t.tser;
  tintUI.heat.style.transform = `scaleX(${Math.max(0.04, (100 - t.tser) / 100)})`;
  tintUI.range.setAttribute('aria-valuetext', `${t.name}, ${t.shade}, ${t.vlt}% VLT`);
  stage?.setTint(1 - t.vlt / 100); updateSelectionField();
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
$$('#thermoToggle button').forEach(b => b.addEventListener('click', () => { ctx.thermoUser = +b.dataset.on; $$('#thermoToggle button').forEach(x => x.classList.toggle('is-on', x === b)); onScroll(); }));

/* ---------------- content: gallery, video, reveal ---------------- */
(() => {
  const g = $('#gallery'); let down = false, sx = 0, sl = 0, moved = 0;
  g.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; down = true; sx = e.clientX; sl = g.scrollLeft; moved = 0; g.classList.add('is-dragging'); });
  window.addEventListener('pointermove', e => { if (!down) return; moved = e.clientX - sx; g.scrollLeft = sl - moved; });
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
    const payload = { _subject: `Quote request: ${fd.get('vehicle')} (${fd.get('name')})`, _template: 'table', _captcha: 'false', Name: fd.get('name'), Mobile: fd.get('phone'), Email: fd.get('email') || '-', Vehicle: fd.get('vehicle'), Services: services, Selection: fd.get('selection') || '-', Message: fd.get('message') || '-' };
    const btn = $('button[type="submit"]', form); btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const r = await fetch(CONTACT.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(String(r.status));
      status.classList.add('is-ok'); status.textContent = 'Request sent. We will reply during shop hours, 9AM to 6PM.'; form.reset(); updateSelectionField();
    } catch {
      status.classList.add('is-err');
      status.innerHTML = `We could not send that just now. Please message us on <a href="${CONTACT.messenger}" target="_blank" rel="noopener"><u>Messenger</u></a> or call <a href="${CONTACT.phoneHref}"><u>${CONTACT.phone}</u></a>.`;
    } finally { btn.disabled = false; btn.textContent = 'Send request'; }
  });
})();
$('#year').textContent = new Date().getFullYear();

/* ---------------- boot ---------------- */
async function boot() {
  story.measure(); applyTint(); updateSelectionField(); setProgress(0.03);
  const canvas = $('#gl');
  const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); } catch { return false; } })();
  if (!hasGL || params.has('nogl')) { document.body.classList.add('no-gl'); ready(); return; }
  try {
    const { createStage } = await import('./gl/stage.js');
    stage = await createStage({ canvas, base: BASE, reducedMotion, onProgress: p => setProgress(0.03 + p * 0.92) });
    stage.setTint(1 - sel.tint.vlt / 100);
    stage.setTarget(story.sample(window.scrollY, ctx).state);
    stage.snap(); stage.setLit(0); if (params.has('still')) stage.setLit(1); else stage.start();
    window.__wf = { stage, story, onScroll };
  } catch (err) {
    console.error('[WrapFinest] 3D stage failed, using fallback', err);
    document.body.classList.add('no-gl');
  }
  story.measure(); ready();
}
if (document.fonts?.ready) document.fonts.ready.then(() => { story.measure(); onScroll(); });
window.addEventListener('load', () => { story.measure(); onScroll(); });
boot();
