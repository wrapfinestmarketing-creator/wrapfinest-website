import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildStudio } from './studio.js';
import { loadCar } from './car.js';
import { makeRain, Projectile, makeHeatRays } from './fx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export async function createStage({ canvas, base, onProgress, reducedMotion }) {
  const lowPower = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08090b); scene.fog = new THREE.Fog(0x0b0d0f, 30, 90);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 90);

  onProgress?.(0.05);
  const studio = await buildStudio({ renderer, scene, base, lowPower });
  onProgress?.(0.15);
  const car = await loadCar({ base, lowPower, onProgress: p => onProgress?.(0.15 + p * 0.7) });
  const U = car.uniforms, M = car.marks;

  // environment bake (car hidden so it does not reflect itself)
  studio.bakeEnv();
  scene.add(car.group);
  let mirrorGroup = null;
  if (car.mirror) { mirrorGroup = new THREE.Group(); mirrorGroup.add(car.mirror); scene.add(mirrorGroup); }

  // effects
  const rain = makeRain(lowPower ? 450 : 1100); scene.add(rain.mesh);
  const rocks = [0, 1, 2].map(i => new Projectile({ radius: 0.038 + i * 0.006, seed: 11 + i * 17 }));
  const debris = [0, 1, 2].map(i => new Projectile({ radius: 0.06 + i * 0.012, seed: 5 + i * 31, color: 0x5d5148 }));
  const blunt = new Projectile({ radius: 0.085, seed: 99, color: 0x2a2c30 });
  for (const p of [...rocks, ...debris, blunt]) scene.add(p.mesh);
  const roofPts = [V(0.3, 0, -0.2), V(-0.35, 0, -0.75), V(0.1, 0, -1.3), V(-0.25, 0, 0.15), V(0.4, 0, -1.0)].map(p => { p.y = M.roof[0].y + 0.02; return p; });
  const heat = makeHeatRays(roofPts); scene.add(heat.group);
  for (const m of [heat.mIn, heat.mOut, heat.mThrough]) m.uniforms.uDir.value = -1;

  // post
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: lowPower ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), lowPower ? 0.14 : 0.2, 0.4, 1.35);
  composer.addPass(bloom); composer.addPass(new OutputPass());

  // ---------- state ----------
  const cur = { cam: V(5.2, 1.25, 6.6), tgt: V(0, 0.78, 0.1), shift: 0, shiftY: 0, film: 0, wet: 0, rain: 0, impact: 0, scratch: 0, stones: 0, roof: 0, heat: 0, thermo: 0, smash: 0, studio: 0, tint: 0.64, yaw: 0, lit: 0 };
  const tg = { cam: cur.cam.clone(), tgt: cur.tgt.clone(), shift: 0, shiftY: 0, film: 0, wet: 0, rain: 0, impact: 0, scratch: 0, stones: 0, roof: 0, heat: 0, thermo: 0, smash: 0, studio: 0, tint: 0.64, lit: 1 };
  let W = 1, H = 1, aspect = 1, pointerX = 0, pointerY = 0, px = 0, py = 0, yawUser = 0, dragging = false, lastX = 0, running = false, hidden = false, time = 0;
  const wipe = { active: false, t: 0 };

  const resize = () => {
    const r = canvas.getBoundingClientRect(); W = Math.max(2, r.width); H = Math.max(2, r.height); aspect = W / H;
    renderer.setSize(W, H, false); composer.setSize(W, H); camera.aspect = aspect; camera.fov = aspect < 1 ? 60 : 32; camera.updateProjectionMatrix();
  };
  resize(); window.addEventListener('resize', resize);

  window.addEventListener('pointermove', e => { pointerX = (e.clientX / innerWidth) * 2 - 1; pointerY = (e.clientY / innerHeight) * 2 - 1; if (dragging) { yawUser += (e.clientX - lastX) * 0.0075; lastX = e.clientX; } }, { passive: true });
  canvas.addEventListener('pointerdown', e => { if (cur.studio > 0.5) { dragging = true; lastX = e.clientX; canvas.setPointerCapture?.(e.pointerId); canvas.style.cursor = 'grabbing'; } });
  const endDrag = () => { dragging = false; canvas.style.cursor = ''; };
  window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
  if (window.DeviceOrientationEvent && lowPower) window.addEventListener('deviceorientation', e => { if (e.gamma != null) { pointerX = THREE.MathUtils.clamp(e.gamma / 30, -1, 1); pointerY = THREE.MathUtils.clamp(((e.beta ?? 45) - 45) / 30, -1, 1); } }, { passive: true });

  const impOff = () => { for (const v of U.uImp.value) v.w = -1; };
  const tmp = V(0, 0, 0);

  function frame(dt, draw = true) {
    time += dt; U.uTime.value = time;
    const k = reducedMotion ? 30 : 3.6;
    cur.cam.x = damp(cur.cam.x, tg.cam.x, k, dt); cur.cam.y = damp(cur.cam.y, tg.cam.y, k, dt); cur.cam.z = damp(cur.cam.z, tg.cam.z, k, dt);
    cur.tgt.x = damp(cur.tgt.x, tg.tgt.x, k, dt); cur.tgt.y = damp(cur.tgt.y, tg.tgt.y, k, dt); cur.tgt.z = damp(cur.tgt.z, tg.tgt.z, k, dt);
    for (const key of ['shift', 'shiftY', 'wet', 'rain', 'impact', 'stones', 'roof', 'heat', 'thermo', 'smash', 'studio', 'tint', 'lit']) cur[key] = damp(cur[key], tg[key], key === 'lit' ? 1.6 : 4, dt);
    cur.film = damp(cur.film, tg.film, 9, dt); cur.scratch = damp(cur.scratch, tg.scratch, 7, dt);
    px = damp(px, pointerX, 3, dt); py = damp(py, pointerY, 3, dt);

    // finish wipe
    if (wipe.active) { wipe.t = Math.min(1, wipe.t + dt / 1.15); U.uWipe.value = wipe.t * wipe.t * (3 - 2 * wipe.t); if (wipe.t >= 1) { wipe.active = false; U.uColA.value.copy(U.uColB.value); U.uPrmA.value.copy(U.uPrmB.value); U.uWipe.value = 0; } }

    // car yaw (drag + slow turntable in the studio)
    if (cur.studio > 0.5 && !dragging && !reducedMotion) yawUser += dt * 0.1;
    const yawT = tg.studio > 0.5 ? yawUser : Math.round(yawUser / (Math.PI * 2)) * Math.PI * 2;
    if (tg.studio <= 0.5) yawUser = damp(yawUser, yawT, 4, dt);
    cur.yaw = damp(cur.yaw, yawUser, 8, dt);
    car.group.rotation.y = cur.yaw; if (mirrorGroup) mirrorGroup.rotation.y = cur.yaw;

    // uniforms
    U.uFilm.value = cur.film; U.uTint.value = cur.tint; U.uThermo.value = cur.thermo; U.uHeat.value = cur.heat; U.uScr.value.w = cur.scratch;
    car.film.visible = cur.film > 0.002 && cur.film < 0.998;
    car.beads.uniforms.uWet.value = cur.wet; car.beads.mesh.visible = cur.wet > 0.01;
    rain.uniforms.uTime.value = time; rain.uniforms.uAmt.value = cur.rain; rain.mesh.visible = cur.rain > 0.01;
    studio.setLit(cur.lit);

    // projectiles + impacts
    impOff(); let crack = 0;
    if (cur.impact > 0.02) {
      const a = rocks[0].update(time, { from: tmp.copy(M.hood).add(V(0.8, 0.55, 6.0)).clone(), hit: M.hood, out: M.hood.clone().add(V(-0.7, 0.5, 1.5)), period: 2.5, weight: cur.impact });
      if (a >= 0) U.uImp.value[0].set(M.hood.x, M.hood.y, M.hood.z, a);
    } else if (cur.stones > 0.02) {
      rocks.forEach((r, i) => { const h = M.ws[i]; const a = r.update(time, { from: h.clone().add(V(0.5 - i * 0.5, 0.35, 6.2)), hit: h, out: h.clone().add(V(i - 1, 1.0, 1.4)), period: 2.7, offset: i * 0.9, weight: cur.stones }); if (a >= 0) U.uImp.value[i].set(h.x, h.y, h.z, a); });
    } else rocks.forEach(r => (r.mesh.visible = false));
    if (cur.roof > 0.02) {
      debris.forEach((r, i) => { const h = M.roof[i]; const a = r.update(time, { from: h.clone().add(V(0.3 - i * 0.3, 4.2, 0.4)), hit: h, out: h.clone().add(V(0.9 - i * 0.9, 0.25, -0.5)), period: 3.0, offset: i * 1.0, tIn: 0.7, arc: 0.3, weight: cur.roof }); if (a >= 0) U.uImp.value[i].set(h.x, h.y, h.z, a); });
    } else debris.forEach(r => (r.mesh.visible = false));
    if (cur.smash > 0.02) {
      const h = M.sideGlass; const a = blunt.update(time, { from: h.clone().add(V(3.2, 0.5, 0.6)), hit: h, out: h.clone().add(V(1.6, -0.2, 0.2)), period: 3.8, tIn: 0.5, arc: 0.2, weight: cur.smash });
      if (a >= 0) { U.uImp.value[0].set(h.x, h.y, h.z, a); crack = Math.min(1, a * 7) * (1 - THREE.MathUtils.smoothstep(a, 2.5, 3.1)); }
    } else blunt.mesh.visible = false;
    U.uCrk.value.w = crack * cur.smash;

    // heat rays
    heat.group.visible = cur.heat > 0.02;
    if (heat.group.visible) { for (const m of [heat.mIn, heat.mOut, heat.mThrough]) m.uniforms.uTime.value = time; heat.mIn.uniforms.uOp.value = cur.heat; heat.mOut.uniforms.uOp.value = cur.heat * cur.thermo; heat.mThrough.uniforms.uOp.value = cur.heat * (1 - cur.thermo) * 0.9; }

    // camera: fit narrow screens by pulling back along the view direction
    const fit = THREE.MathUtils.clamp((aspect < 1 ? 0.8 : 1.62) / aspect, 1, 2.2);
    tmp.copy(cur.cam).sub(cur.tgt).multiplyScalar(fit).add(cur.tgt);
    camera.position.set(THREE.MathUtils.clamp(tmp.x + px * 0.32, -7.9, 7.9), THREE.MathUtils.clamp(tmp.y - py * 0.14, 0.25, 5.7), THREE.MathUtils.clamp(tmp.z, -13.6, 13.6));
    camera.lookAt(cur.tgt);
    camera.setViewOffset(W, H, -cur.shift * W, cur.shiftY * H, W, H);
    studio.sweep.position.set(px * 3.6, 3.1, 1.5 - py * 3.2);

    if (draw) composer.render(dt);
  }

  let last = 0;
  function loop(now) {
    if (!running) return; requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    if (hidden) return; frame(dt);
  }

  return {
    lowPower, marks: M,
    start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } },
    stop() { running = false; },
    setHidden(v) { hidden = v; },
    /** Apply a story target: { cam:[x,y,z], tgt:[x,y,z], ...numbers } */
    setTarget(s) { tg.cam.set(...s.cam); tg.tgt.set(...s.tgt); for (const key of ['shift', 'shiftY', 'film', 'wet', 'rain', 'impact', 'scratch', 'stones', 'roof', 'heat', 'thermo', 'smash', 'studio']) if (s[key] != null) tg[key] = s[key]; },
    setTint(v) { tg.tint = v; },
    setFinish(f) {
      if (wipe.active) { U.uColA.value.copy(U.uColB.value); U.uPrmA.value.copy(U.uPrmB.value); }
      U.uColB.value.set(f.color); U.uPrmB.value.set(f.rough, f.metal, f.cc, f.ccr); U.uWipe.value = 0; wipe.t = 0; wipe.active = true;
    },
    setLit(v) { tg.lit = v; },
    /** Render one frame synchronously (used by tests and reduced-motion). */
    renderOnce(dt = 0.016) { frame(dt); },
    snap(t) { for (let i = 0; i < 40; i++) frame(0.1, false); if (t != null) time = t; frame(0.016, true); },
  };
}
