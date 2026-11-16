// Scroll story: maps scroll position to a target scene state (camera + effect weights).
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.min(1, Math.max(0, t));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const ZERO = { shift: 0, shiftY: 0, film: 0, wet: 0, rain: 0, impact: 0, scratch: 0, stones: 0, roof: 0, heat: 0, thermo: 0, smash: 0, studio: 0, dim: 0 };

// Each key returns the scene state for local progress p (0..1) through its step.
// side: which side the text panel sits on (car shifts to the other side on desktop).
export const KEYS = {
  hero: p => ({ cam: [5.2, 1.25 + p * 0.3, 6.6], tgt: [0, 0.78, 0.1], side: 'L' }),
  film: p => { const t = smooth(0.06, 0.86, p); return { cam: mix3([6.6, 1.45, 4.4], [6.9, 1.9, -3.4], t), tgt: [0, 0.8, 0], side: 'L', film: clamp01((p - 0.08) / 0.74) }; },
  impact: () => ({ cam: [2.7, 1.85, 5.4], tgt: [0.1, 0.95, 1.6], side: 'R', film: 1, impact: 1 }),
  heal: p => ({ cam: [4.7, 1.15, 1.5], tgt: [0.9, 0.82, 0.3], side: 'L', film: 1, scratch: 1 - smooth(0.3, 0.72, p) }),
  pcu: () => ({ cam: [7.6, 2.4, -5.6], tgt: [0, 0.9, 0], side: 'C', film: 1, dim: 0.8 }),
  rain: p => ({ cam: [-3.5, 2.35 - p * 0.2, 4.7], tgt: [0, 1.0, 1.0], side: 'R', film: 1, wet: 1, rain: 1 }),
  monsoon: () => ({ cam: [-5.8, 1.25, -3.6], tgt: [0, 0.9, -0.4], side: 'L', film: 1, wet: 1, rain: 0.75 }),
  studio: () => ({ cam: [-5.7, 1.5, 5.5], tgt: [0, 0.8, 0], side: 'L', film: 1, studio: 1 }),
  tint: p => ({ cam: [8.1, 1.35, -0.9 + p * 0.6], tgt: [0, 1.08, -0.4], side: 'R', film: 1 }),
  layers: () => ({ cam: [6.2, 1.9, -4.2], tgt: [0, 1.0, -0.4], side: 'C', film: 1, dim: 0.82 }),
  stones: () => ({ cam: [3.1, 1.95, 5.2], tgt: [0, 1.25, 0.9], side: 'L', film: 1, thermo: 1, stones: 1 }),
  roof: p => ({ cam: [3.9, 4.6 + p * 0.3, 1.7], tgt: [0, 1.5, -0.5], side: 'R', film: 1, thermo: 1, roof: 1 }),
  heat: (p, ctx) => ({ cam: [-4.5, 4.0, 3.0], tgt: [0, 1.45, -0.3], side: 'L', film: 1, thermo: ctx.thermoUser, heat: 1 }),
  install: () => ({ cam: [-3.2, 5.6, -2.2], tgt: [0, 1.3, -0.4], side: 'C', film: 1, thermo: 1, dim: 0.82 }),
  smash: () => ({ cam: [4.4, 1.55, -2.4], tgt: [0.9, 1.2, -0.6], side: 'L', film: 1, thermo: 1, smash: 1 }),
  exit: () => ({ cam: [7.2, 2.4, 7.2], tgt: [0, 0.8, 0], side: 'C', film: 1, thermo: 1, dim: 1 }),
};

export function createStory(root) {
  const steps = [...root.querySelectorAll('[data-step]')].map(el => ({ el, key: el.dataset.step, chapter: el.dataset.chapter, top: 0, height: 1 }));
  let vh = innerHeight;
  const measure = () => { vh = innerHeight; const sy = scrollY; for (const s of steps) { const r = s.el.getBoundingClientRect(); s.top = r.top + sy; s.height = r.height; } };
  const full = (key, p, ctx) => {
    const s = { ...ZERO, ...KEYS[key](p, ctx) };
    if (ctx.mobile) { s.shift = 0; s.shiftY = s.side === 'C' ? 0 : key === 'hero' ? 0.2 : 0.17; }
    else { s.shift = s.side === 'L' ? 0.17 : s.side === 'R' ? -0.17 : 0; s.shiftY = 0; }
    return s;
  };
  /** Returns { state, index, p, active } for the current scroll position. */
  function sample(scrollTop, ctx) {
    const yc = scrollTop + vh * 0.5;
    let i = 0; for (let n = 0; n < steps.length; n++) if (yc >= steps[n].top) i = n;
    const st = steps[i], p = clamp01((yc - st.top) / st.height);
    const last = steps[steps.length - 1], past = yc > last.top + last.height;
    let state = full(st.key, p, ctx), blend = 0;
    const next = steps[i + 1];
    if (next) {
      const len = Math.min(vh * 0.62, st.height * 0.42), edge = 1 - len / st.height;
      blend = smooth(edge, 1, p);
      if (blend > 0) { const b = full(next.key, 0, ctx); const a = state; state = { ...a }; for (const k in a) { if (k === 'cam' || k === 'tgt') state[k] = mix3(a[k], b[k], blend); else if (typeof a[k] === 'number') state[k] = lerp(a[k], b[k] ?? 0, blend); } }
    }
    if (past) state.dim = 1;
    // hero stays active from the very top
    const active = blend < 0.5 && (i === 0 || p > 0.015);
    return { state, index: i, p, blend, active, past, step: st };
  }
  return { steps, measure, sample };
}
