// Scroll film player: draws pre-rendered cinematic frames to a 2D canvas.
// A "scene" is { key, layers:[{seq,t}|{still,alpha}], focus:[x,y], anchor, zoom }.
// When the key changes the previous picture crossfades (or wipes) into the new one.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad = n => String(n).padStart(4, '0');

export function createFilm({ canvas, base, manifest, reducedMotion }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const snap = document.createElement('canvas'), sctx = snap.getContext('2d', { alpha: false });
  const isMobile = matchMedia('(max-width: 760px)').matches;
  const variant = isMobile ? 'm' : 'd';
  const seqs = {}, stills = {};
  for (const [name, s] of Object.entries(manifest.seqs)) seqs[name] = { n: s.n, frames: new Array(s.n).fill(null), asked: new Uint8Array(s.n), loaded: 0, waiters: [] };

  // ---------- loading (coarse-to-fine so scrubbing works early) ----------
  const queue = []; let active = 0; const MAX = isMobile ? 4 : 8;
  const pump = () => { while (active < MAX && queue.length) { const job = queue.shift(); active++; job().finally(() => { active--; pump(); }); } };
  const loadImage = url => new Promise((res, rej) => { const img = new Image(); img.decoding = 'async'; img.onload = () => (img.decode ? img.decode().catch(() => {}).then(() => res(img)) : res(img)); img.onerror = rej; img.src = url; });
  function order(n) { const out = [], seen = new Uint8Array(n); for (let step = 16; step >= 1; step >>= 1) for (let i = 0; i < n; i += step) if (!seen[i]) { seen[i] = 1; out.push(i); } if (!seen[n - 1]) out.push(n - 1); return out; }
  function loadSeq(name, front = false) {
    const s = seqs[name]; if (!s || s.started) return; s.started = true;
    const jobs = order(s.n).map(i => () => loadImage(`${base}film/${name}/${variant}/${pad(i + 1)}.webp`).then(img => { s.frames[i] = img; s.loaded++; dirty = true; s.waiters = s.waiters.filter(w => (s.loaded >= w.min ? (w.res(), false) : true)); }).catch(() => { s.loaded++; }));
    if (front) queue.unshift(...jobs); else queue.push(...jobs); pump();
  }
  const whenSeq = (name, min) => new Promise(res => { const s = seqs[name]; if (!s) return res(); loadSeq(name, true); if (s.loaded >= min) res(); else s.waiters.push({ min: Math.min(min, s.n), res }); });
  function loadStill(name) {
    if (stills[name]) return stills[name].promise;
    const e = (stills[name] = { img: null }); e.promise = loadImage(`${base}film/stills/${name}-${variant}.webp`).then(img => { e.img = img; dirty = true; }).catch(() => {}); return e.promise;
  }
  function frameOf(name, t) {
    const s = seqs[name]; if (!s) return null; const f = clamp(Math.round(t * (s.n - 1)), 0, s.n - 1);
    for (let d = 0; d < s.n; d++) { if (f - d >= 0 && s.frames[f - d]) return s.frames[f - d]; if (f + d < s.n && s.frames[f + d]) return s.frames[f + d]; }
    return null;
  }

  // ---------- state ----------
  let W = 2, H = 2, dpr = 1, dirty = true, running = false, hidden = false;
  let target = null, curKey = '', fade = 1, fadeMode = 'fade', px = 0, py = 0, tpx = 0, tpy = 0, last = 0;
  const cur = { t: {}, alpha: {}, ax: 0.5, zoom: 1.06, fx: 0.5, fy: 0.5 };

  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 1.5);
    W = Math.max(2, Math.round(r.width * dpr)); H = Math.max(2, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H; snap.width = W; snap.height = H; dirty = true;
  }
  resize(); window.addEventListener('resize', resize);
  window.addEventListener('pointermove', e => { tpx = (e.clientX / innerWidth) * 2 - 1; tpy = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

  function place(img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (isMobile) {                                              // picture band at the top, text below
      const vis = 0.6 / cur.zoom, s = W / (iw * vis), h = ih * s, top = 58 * dpr;
      const x = clamp(W / 2 - cur.fx * iw * s, W - iw * s, 0);
      return { x, y: top, w: iw * s, h, band: top + h };
    }
    const s = Math.max(W / iw, H / ih) * cur.zoom, w = iw * s, h = ih * s;
    // the picture may slide past the screen edge on the text side; that edge is faded to black
    const over = (target?.over ?? 0.1) * W;
    const x = clamp(cur.ax * W - cur.fx * w - px * 10 * dpr, W - w - over, over), y = clamp(0.52 * H - cur.fy * h - py * 6 * dpr, H - h, 0);
    return { x, y, w, h, band: H };
  }

  function drawScene() {
    ctx.globalAlpha = 1; ctx.fillStyle = '#0a0b0d'; ctx.fillRect(0, 0, W, H);
    if (!target) return; let band = H, drew = false, edge = null;
    for (const L of target.layers) {
      const img = L.seq ? frameOf(L.seq, cur.t[L.seq] ?? L.t) : stills[L.still]?.img; if (!img) continue;
      const a = L.still ? (cur.alpha[L.still] ?? L.alpha ?? 1) : 1; if (a <= 0.003) continue;
      const r = place(img); ctx.globalAlpha = drew ? a : 1; ctx.drawImage(img, r.x, r.y, r.w, r.h); band = r.band; drew = true; edge = r;
    }
    ctx.globalAlpha = 1;
    if (!isMobile && edge) {
      const fw = 0.3 * W;
      if (edge.x > 0.5) { const g = ctx.createLinearGradient(edge.x, 0, edge.x + fw, 0); g.addColorStop(0, 'rgba(10,11,13,1)'); g.addColorStop(1, 'rgba(10,11,13,0)'); ctx.fillStyle = g; ctx.fillRect(edge.x - 1, 0, fw + 1, H); }
      const rx = edge.x + edge.w; if (rx < W - 0.5) { const g = ctx.createLinearGradient(rx, 0, rx - fw, 0); g.addColorStop(0, 'rgba(10,11,13,1)'); g.addColorStop(1, 'rgba(10,11,13,0)'); ctx.fillStyle = g; ctx.fillRect(rx - fw, 0, fw + 1, H); }
    }
    if (isMobile && drew) { const g = ctx.createLinearGradient(0, band - 0.34 * (band - 58 * dpr), 0, band); g.addColorStop(0, 'rgba(10,11,13,0)'); g.addColorStop(1, 'rgba(10,11,13,1)'); ctx.fillStyle = g; ctx.fillRect(0, band - 0.34 * (band - 58 * dpr) - 1, W, 0.34 * (band - 58 * dpr) + 2); }
  }

  function frame(dt) {
    if (!target) return;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 9); let moving = false;
    for (const L of target.layers) {
      if (L.seq) { const c = cur.t[L.seq] ?? L.t, n = c + (L.t - c) * k; if (Math.abs(n - c) > 0.0004) moving = true; cur.t[L.seq] = Math.abs(L.t - n) < 0.0005 ? L.t : n; }
      else { const ta = L.alpha ?? 1, c = cur.alpha[L.still] ?? ta, n = c + (ta - c) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 6)); if (Math.abs(n - c) > 0.002) moving = true; cur.alpha[L.still] = Math.abs(ta - n) < 0.003 ? ta : n; }
    }
    for (const key of ['ax', 'zoom', 'fx', 'fy']) { const tv = target[key], n = cur[key] + (tv - cur[key]) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 4)); if (Math.abs(n - cur[key]) > 0.0003) moving = true; cur[key] = n; }
    const npx = px + (tpx - px) * (1 - Math.exp(-dt * 3)), npy = py + (tpy - py) * (1 - Math.exp(-dt * 3)); if (Math.abs(npx - px) + Math.abs(npy - py) > 0.0006) moving = true; px = npx; py = npy;
    if (fade < 1) { fade = Math.min(1, fade + dt / (fadeMode === 'wipe' ? 0.9 : 0.55)); moving = true; }
    if (!moving && !dirty) return; dirty = false;
    drawScene();
    if (fade < 1) {
      const e = fade * fade * (3 - 2 * fade);
      if (fadeMode === 'wipe') { const x = Math.round(e * W); ctx.drawImage(snap, x, 0, W - x, H, x, 0, W - x, H); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x - 1 * dpr, 0, 2 * dpr, H); const g = ctx.createLinearGradient(x - 60 * dpr, 0, x, 0); g.addColorStop(0, 'rgba(239,69,35,0)'); g.addColorStop(1, 'rgba(239,69,35,0.35)'); ctx.fillStyle = g; ctx.fillRect(x - 60 * dpr, 0, 60 * dpr, H); }
      else { ctx.globalAlpha = 1 - e; ctx.drawImage(snap, 0, 0); ctx.globalAlpha = 1; }
    }
  }
  function loop(now) { if (!running) return; requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; if (!hidden) frame(dt); }

  return {
    isMobile,
    whenSeq, loadSeq, loadStill,
    /** Set the scene for the current scroll position. */
    set(scene) {
      for (const L of scene.layers) { if (L.seq) loadSeq(L.seq, true); else loadStill(L.still); }
      if (scene.key !== curKey) {
        if (curKey && !reducedMotion) { sctx.drawImage(canvas, 0, 0); fade = 0; fadeMode = scene.transition || 'fade'; } else fade = 1;
        for (const L of scene.layers) { if (L.seq) cur.t[L.seq] = L.t; }      // start the new shot where the scroll is
        if (!curKey || isMobile) { cur.ax = scene.ax; cur.zoom = scene.zoom; cur.fx = scene.fx; cur.fy = scene.fy; }
        curKey = scene.key;
      }
      target = scene; dirty = true;
    },
    preload(names) { for (const n of names) (manifest.seqs[n] ? loadSeq(n) : loadStill(n)); },
    setHidden(v) { hidden = v; },
    start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } },
    /** Jump straight to the target (tests, reduced motion). */
    snap() { if (!target) return; for (const L of target.layers) { if (L.seq) cur.t[L.seq] = L.t; else cur.alpha[L.still] = L.alpha ?? 1; } cur.ax = target.ax; cur.zoom = target.zoom; cur.fx = target.fx; cur.fy = target.fy; fade = 1; dirty = true; frame(0.016); },
  };
}
