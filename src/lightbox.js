// Full-screen media viewer: images (zoom + pan) and videos, prev/next, thumbnails, optional product panel.
// Desktop: click or wheel to zoom, drag to pan. Touch: double-tap or pinch to zoom, swipe to change, swipe down to close.

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX = 4;

export function createLightbox({ onOpen, onClose } = {}) {
  const root = el('div', 'lb');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Image viewer');
  root.innerHTML = `
    <div class="lb__main">
      <div class="lb__stage" tabindex="-1"></div>
      <button type="button" class="lb__nav lb__nav--prev" aria-label="Previous">‹</button>
      <button type="button" class="lb__nav lb__nav--next" aria-label="Next">›</button>
      <div class="lb__bar mono"><span class="lb__count"></span><span class="lb__hint"></span></div>
      <div class="lb__thumbs" role="tablist"></div>
    </div>
    <aside class="lb__info" hidden></aside>
    <button type="button" class="lb__close" aria-label="Close viewer">×</button>`;
  document.body.append(root);
  const stage = root.querySelector('.lb__stage'), thumbs = root.querySelector('.lb__thumbs'), info = root.querySelector('.lb__info');
  const count = root.querySelector('.lb__count'), hint = root.querySelector('.lb__hint');
  const prevBtn = root.querySelector('.lb__nav--prev'), nextBtn = root.querySelector('.lb__nav--next');
  const fine = matchMedia('(pointer: fine)').matches;

  let items = [], index = 0, media = null, lastFocus = null, infoRender = null;
  // zoom state for the current image
  let z = 1, tx = 0, ty = 0;
  const pointers = new Map();
  let gesture = null;   // { type: 'pan'|'pinch'|'swipe', ... }
  let lastTap = 0;

  function apply(anim) {
    if (!media || media.tagName !== 'IMG') return;
    media.style.transition = anim ? 'transform 0.35s cubic-bezier(0.2, 0.7, 0.1, 1)' : 'none';
    media.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${z})`;
    root.classList.toggle('is-zoomed', z > 1.01);
  }
  // keep the zoomed image covering the stage (no empty gaps when panning)
  function bound() {
    if (!media) return;
    const sw = stage.clientWidth, sh = stage.clientHeight, w = media.offsetWidth * z, h = media.offsetHeight * z;
    const mx = Math.max(0, (w - sw) / 2), my = Math.max(0, (h - sh) / 2);
    tx = clamp(tx, -mx, mx); ty = clamp(ty, -my, my);
  }
  // zoom to scale s keeping the stage point (px, py) fixed (coords relative to stage centre)
  function zoomAt(s, px, py, anim) {
    s = clamp(s, 1, MAX);
    const k = s / z;
    tx = px - (px - tx) * k; ty = py - (py - ty) * k; z = s;
    if (z <= 1.01) { z = 1; tx = 0; ty = 0; }
    bound(); apply(anim);
  }
  const rel = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };
  const reset = () => { z = 1; tx = 0; ty = 0; apply(false); };

  function show(i) {
    if (!items.length) return;
    index = (i + items.length) % items.length;
    const it = items[index];
    stage.querySelectorAll('video').forEach(v => v.pause());
    stage.innerHTML = '';
    if (it.type === 'video') {
      media = el('video', 'lb__media');
      Object.assign(media, { src: it.src, controls: true, playsInline: true, preload: 'metadata' });
      if (it.poster) media.poster = it.poster;
      hint.textContent = '';
    } else {
      media = el('img', 'lb__media');
      media.alt = it.alt || '';
      media.draggable = false;
      // show the small version at once if we have it, then swap in the large one
      if (it.thumb && it.thumb !== it.src) { media.src = it.thumb; const big = new Image(); big.onload = () => { if (items[index] === it) media.src = it.src; }; big.src = it.src; }
      else media.src = it.src;
      hint.textContent = fine ? 'Click or scroll to zoom' : 'Double-tap or pinch to zoom';
    }
    stage.append(media);
    if (it.caption) stage.append(el('p', 'lb__cap', it.caption));
    reset();
    const many = items.length > 1;
    prevBtn.hidden = nextBtn.hidden = !many; thumbs.hidden = !many;
    count.textContent = many ? `${index + 1} / ${items.length}` : '';
    [...thumbs.children].forEach((t, n) => { t.setAttribute('aria-selected', String(n === index)); if (n === index) t.scrollIntoView({ block: 'nearest', inline: 'center' }); });
    // warm the neighbours
    for (const d of [1, -1]) { const n = items[(index + d + items.length) % items.length]; if (n && n.type !== 'video') new Image().src = n.src; }
  }

  function open(list, start = 0, panel = null) {
    items = list.filter(Boolean); if (!items.length) return;
    lastFocus = document.activeElement;
    thumbs.innerHTML = '';
    items.forEach((it, n) => {
      const b = el('button', 'lb__thumb' + (it.type === 'video' ? ' is-video' : ''));
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', `Show item ${n + 1}`);
      const im = el('img'); im.src = it.type === 'video' ? it.poster || '' : it.thumb || it.src; im.alt = ''; im.loading = 'lazy'; b.append(im);
      b.onclick = () => show(n); thumbs.append(b);
    });
    infoRender = panel;
    info.hidden = !panel; root.classList.toggle('has-info', !!panel);
    if (panel) panel(info);
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('is-open'));
    document.documentElement.classList.add('lb-lock');
    onOpen?.();
    show(start);
    root.querySelector('.lb__close').focus({ preventScroll: true });
  }
  function close() {
    if (root.hidden) return;
    stage.querySelectorAll('video').forEach(v => v.pause());
    root.classList.remove('is-open');
    document.documentElement.classList.remove('lb-lock');
    setTimeout(() => { root.hidden = true; stage.innerHTML = ''; media = null; }, 250);
    onClose?.();
    lastFocus?.focus?.({ preventScroll: true });
  }

  prevBtn.onclick = () => show(index - 1);
  nextBtn.onclick = () => show(index + 1);
  root.querySelector('.lb__close').onclick = close;
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight' && z === 1) show(index + 1);
    else if (e.key === 'ArrowLeft' && z === 1) show(index - 1);
    else if (e.key === '+' || e.key === '=') zoomAt(z * 1.5, 0, 0, true);
    else if (e.key === '-') zoomAt(z / 1.5, 0, 0, true);
    else if (e.key === 'Tab') { // keep focus inside the dialog
      const f = [...root.querySelectorAll('button:not([hidden]), a[href], video')].filter(x => x.offsetParent);
      if (!f.length) return; const a = f[0], b = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); } else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    }
  });

  // ---- pointer gestures on the stage
  stage.addEventListener('wheel', e => { if (!media || media.tagName !== 'IMG') return; e.preventDefault(); const [px, py] = rel(e); zoomAt(z * Math.exp(-e.deltaY * 0.0022), px, py, false); }, { passive: false });
  stage.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    if (!media || media.tagName !== 'IMG') { if (e.target === stage) close(); return; }
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const r = stage.getBoundingClientRect();
      gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), z0: z, cx: (a.x + b.x) / 2 - r.left - r.width / 2, cy: (a.y + b.y) / 2 - r.top - r.height / 2, tx0: tx, ty0: ty };
    } else {
      gesture = { type: z > 1 ? 'pan' : 'swipe', x0: e.clientX, y0: e.clientY, tx0: tx, ty0: ty, moved: 0, onMedia: e.target === media };
    }
  });
  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.type === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const s = clamp(gesture.z0 * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d, 1, MAX), k = s / gesture.z0;
      z = s; tx = gesture.cx - (gesture.cx - gesture.tx0) * k; ty = gesture.cy - (gesture.cy - gesture.ty0) * k; bound(); apply(false);
      return;
    }
    const dx = e.clientX - gesture.x0, dy = e.clientY - gesture.y0;
    gesture.moved = Math.max(gesture.moved, Math.hypot(dx, dy));
    if (gesture.type === 'pan') { tx = gesture.tx0 + dx; ty = gesture.ty0 + dy; bound(); apply(false); root.classList.add('is-panning'); }
    else if (gesture.type === 'swipe') { media.style.transition = 'none'; media.style.transform = Math.abs(dy) > Math.abs(dx) && dy > 0 ? `translate3d(0, ${dy}px, 0)` : `translate3d(${dx}px, 0, 0)`; root.style.setProperty('--lb-fade', String(1 - clamp(dy / 500, 0, 0.5))); }
  });
  const end = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    root.classList.remove('is-panning');
    if (!gesture) return;
    const g = gesture;
    if (g.type === 'pinch') { if (pointers.size === 1) { const [p] = [...pointers.values()]; gesture = { type: 'pan', x0: p.x, y0: p.y, tx0: tx, ty0: ty, moved: 99 }; } else gesture = null; if (z <= 1.01) reset(); return; }
    gesture = null;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (g.type === 'swipe') {
      root.style.removeProperty('--lb-fade');
      if (g.moved > 50 && Math.abs(dx) > Math.abs(dy) && items.length > 1) return show(index + (dx < 0 ? 1 : -1));
      if (g.moved > 90 && dy > Math.abs(dx)) return close();
      apply(true);
    }
    if (g.moved < 8 && e.type === 'pointerup') {
      // tap / click: desktop click toggles zoom; touch needs a double tap
      const now = performance.now(), [px, py] = rel(e);
      if (!g.onMedia && z === 1) return close();   // tap on the dark backdrop
      if (e.pointerType === 'mouse' || now - lastTap < 320) { lastTap = 0; z > 1.01 ? zoomAt(1, 0, 0, true) : zoomAt(2.5, px, py, true); }
      else lastTap = now;
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  addEventListener('resize', () => { if (!root.hidden) { bound(); apply(false); } });

  return { open, close, refreshInfo: () => infoRender && infoRender(info), get isOpen() { return !root.hidden; } };
}
