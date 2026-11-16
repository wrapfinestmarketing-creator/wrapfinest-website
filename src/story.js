// Scroll story: maps scroll position to a film scene (which clip, which frame) for each step.
const clamp01 = t => Math.min(1, Math.max(0, t));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// side: where the text panel sits (L/R/C). The car is anchored to the opposite side on desktop.
// fx/fy: the point of the picture that should stay in view (0..1). zoom: extra scale over "cover".
const S = (key, layers, o = {}) => ({ key, layers, side: 'L', fx: 0.5, fy: 0.55, zoom: 1.06, over: 0.12, dim: 0, ...o });

export const KEYS = {
  hero: (p, c) => S('hero', [{ seq: 'hero', t: clamp01((p - 0.5) * 2) * 0.92 + c.idle }], { side: 'L', fx: 0.5, fy: 0.55, zoom: 1.02, over: 0.17 }),
  film: p => S('ppf', [{ seq: 'ppf', t: clamp01((p - 0.06) / 0.8) }], { side: 'L', fx: 0.5, fy: 0.6, zoom: 1.12, meter: clamp01((p - 0.06) / 0.8) }),
  impact: p => S('impact', [{ seq: 'impact', t: clamp01(p * 1.05) }], { side: 'R', fx: 0.5, fy: 0.6 }),
  heal: p => S('heal', [{ seq: 'heal', t: smooth(0.12, 0.85, p) }], { side: 'L', fx: 0.5, fy: 0.5, zoom: 1.08, mzoom: 1.5, mfx: 0.62, heal: smooth(0.12, 0.85, p) }),
  pcu: p => S('outro', [{ seq: 'outro', t: p * 0.35 }], { side: 'C', dim: 0.8 }),
  rain: p => S('rain', [{ seq: 'rain', t: p * 0.55 }], { side: 'R', fx: 0.5, fy: 0.6 }),
  monsoon: p => S('rain', [{ seq: 'rain', t: 0.55 + p * 0.45 }], { side: 'L', fx: 0.56, fy: 0.6 }),
  studio: (p, c) => S('finish:' + c.finish, [{ still: c.finish, alpha: 1 }], { side: 'L', fx: 0.5, fy: 0.5, zoom: 1.04, transition: 'wipe' }),
  tint: (p, c) => S('tint', [{ still: 'tint-light', alpha: 1 }, { still: 'tint-dark', alpha: c.tint }], { side: 'R', fx: 0.56, fy: 0.42, zoom: 1.5 }),
  layers: (p, c) => S('tint', [{ still: 'tint-light', alpha: 1 }, { still: 'tint-dark', alpha: c.tint }], { side: 'C', fx: 0.56, fy: 0.42, zoom: 1.5, dim: 0.84 }),
  stones: p => S('stones', [{ seq: 'stones', t: clamp01(p * 1.05) }], { side: 'L', fx: 0.5, fy: 0.45 }),
  roof: p => S('roof', [{ seq: 'roof', t: clamp01(p * 1.05) }], { side: 'R', fx: 0.5, fy: 0.45 }),
  heat: (p, c) => S('heat', [{ still: 'heat-bare', alpha: 1 }, { still: 'heat-shield', alpha: c.thermo }], { side: 'L', fx: 0.52, fy: 0.45 }),
  install: (p, c) => S('heat', [{ still: 'heat-bare', alpha: 1 }, { still: 'heat-shield', alpha: c.thermo }], { side: 'C', fx: 0.52, fy: 0.45, dim: 0.86 }),
  smash: p => S('smash', [{ seq: 'smash', t: clamp01(p * 1.05) }], { side: 'L', fx: 0.5, fy: 0.5, zoom: 1.08 }),
  exit: p => S('outro', [{ seq: 'outro', t: 0.35 + p * 0.65 }], { side: 'C', dim: smooth(0.35, 0.95, p) }),
};

export function createStory(root) {
  const steps = [...root.querySelectorAll('[data-step]')].map(el => ({ el, key: el.dataset.step, chapter: el.dataset.chapter, top: 0, height: 1 }));
  let vh = innerHeight;
  const measure = () => { vh = innerHeight; const sy = scrollY; for (const s of steps) { const r = s.el.getBoundingClientRect(); s.top = r.top + sy; s.height = r.height; } };
  /** Returns the scene for the current scroll position plus bookkeeping. */
  function sample(scrollTop, ctx) {
    const yc = scrollTop + vh * 0.5;
    let i = 0; for (let n = 0; n < steps.length; n++) if (yc >= steps[n].top) i = n;
    const st = steps[i], p = clamp01((yc - st.top) / st.height);
    const last = steps[steps.length - 1], past = yc > last.top + last.height;
    const scene = KEYS[st.key](p, ctx);
    scene.ax = ctx.mobile ? 0.5 : scene.side === 'L' ? 0.68 : scene.side === 'R' ? 0.32 : 0.5;
    if (scene.side === 'C') scene.over = 0;
    if (ctx.mobile && scene.mzoom) { scene.zoom = scene.mzoom; if (scene.mfx != null) scene.fx = scene.mfx; }
    // ease the dimming in and out near step edges so cards do not pop
    const next = steps[i + 1], prev = steps[i - 1];
    if (next) { const b = smooth(0.86, 1, p); scene.dim += (KEYS[next.key](0, ctx).dim - scene.dim) * b * 0.5; }
    if (prev) { const b = 1 - smooth(0, 0.14, p); scene.dim += (KEYS[prev.key](1, ctx).dim - scene.dim) * b * 0.5; }
    if (past) scene.dim = 1;
    const active = i === 0 || (p > 0.02 && p < 0.985) || !next;
    return { scene, index: i, p, active, past, step: st, nextKey: next?.key };
  }
  return { steps, measure, sample };
}
