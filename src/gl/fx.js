import * as THREE from 'three';

// ---------- rain streaks ----------
export function makeRain(count) {
  const pos = new Float32Array(count * 6), seed = new Float32Array(count * 4), end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 12, z = (Math.random() - 0.5) * 14, y = Math.random() * 7;
    pos.set([x, y, z, x, y, z], i * 6);
    const s = Math.random(), v = 0.7 + Math.random() * 0.6; seed.set([s, v, s, v], i * 4); end.set([0, 1], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
    vertexShader: /* glsl */ `attribute vec2 aSeed; attribute float aEnd; uniform float uTime; varying float vA;
      void main(){ vec3 p = position; float sp = 9.0 * aSeed.y; p.y = mod(p.y - uTime * sp + aSeed.x * 7.0, 7.0); p.y += aEnd * 0.28 * aSeed.y; p.x += aEnd * 0.012;
        vA = aEnd; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uAmt; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.75, 0.85, 1.0), (1.0 - vA) * 0.34 * uAmt); }`,
  });
  const lines = new THREE.LineSegments(g, mat); lines.frustumCulled = false; lines.visible = false;
  return { mesh: lines, uniforms: mat.uniforms };
}

// ---------- flying stones / debris ----------
function rockGeometry(r, seed) {
  const g = new THREE.DodecahedronGeometry(r, 0), p = g.getAttribute('position');
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cache = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(3)).join(',');
    if (!cache.has(k)) cache.set(k, 0.72 + rnd() * 0.5);
    const f = cache.get(k); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals(); return g;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
/** Projectile that flies from `from` to `hit`, bounces towards `out`, loops every `period` s. */
export class Projectile {
  constructor({ radius = 0.04, color = 0x6f6a64, seed = 7 }) {
    this.mesh = new THREE.Mesh(rockGeometry(radius, seed), new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true }));
    this.mesh.visible = false; this.age = -1; this.hit = new THREE.Vector3();
  }
  /** t in seconds (looping), weight 0..1 enables. Returns impact age (s) or -1. */
  update(time, { from, hit, out, period = 2.6, offset = 0, tIn = 0.55, weight = 1, arc = 0.35 }) {
    if (weight < 0.02) { this.mesh.visible = false; return -1; }
    const t = ((time + offset) % period + period) % period;
    this.mesh.visible = true; this.hit.copy(hit);
    if (t < tIn) {
      const k = t / tIn, e = k * k;                         // accelerating in
      this.mesh.position.lerpVectors(from, hit, e); this.mesh.position.y += Math.sin(e * Math.PI) * arc * 0.3;
      this.mesh.scale.setScalar(Math.min(1, k * 6) * weight);
      this.mesh.rotation.set(t * 9, t * 7, t * 4); return -1;
    }
    const a = t - tIn, k = Math.min(1, a / 1.1);
    _a.copy(out).sub(hit); _b.copy(hit).addScaledVector(_a, k);
    _b.y += Math.sin(k * Math.PI) * arc - k * k * 0.9;      // bounce arc then fall
    this.mesh.position.copy(_b); this.mesh.rotation.set(a * 5, a * 8, a * 3);
    this.mesh.scale.setScalar(Math.max(0, 1 - k * k) * weight);
    return a;
  }
}

// ---------- heat rays ----------
export function makeHeatRays(points) {
  const group = new THREE.Group(); group.visible = false;
  const mk = (color) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOp: { value: 0 }, uColor: { value: new THREE.Color(color) }, uDir: { value: -1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime, uOp, uDir; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float d = fract(vUv.y * 5.0 + uTime * 0.9 * uDir); float dash = smoothstep(0.0, 0.25, d) * smoothstep(1.0, 0.55, d);
        float fade = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        gl_FragColor = vec4(uColor * 2.2, dash * fade * uOp); }`,
  });
  const mIn = mk(0xff5a1f), mOut = mk(0x4db8ff), mThrough = mk(0xff2a0a);
  const sun = new THREE.Vector3(-0.38, 1, 0.3).normalize(), up = new THREE.Vector3(0, 1, 0);
  const beam = (from, to, mat, r = 0.016) => {
    const len = from.distanceTo(to), g = new THREE.CylinderGeometry(r, r, len, 6, 1, true);
    const m = new THREE.Mesh(g, mat); m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize()); group.add(m); return m;
  };
  for (const p of points) {
    const src = p.clone().addScaledVector(sun, 3.4);
    beam(src, p, mIn);                                         // sunlight coming in (top = far end)
    const refl = sun.clone().reflect(up).negate();             // mirror about the roof normal
    beam(p, p.clone().addScaledVector(new THREE.Vector3(-refl.x, Math.abs(refl.y), -refl.z).normalize(), 2.6), mOut);
    beam(p, p.clone().addScaledVector(sun, -0.75), mThrough, 0.02); // heat passing into the cabin
  }
  return { group, mIn, mOut, mThrough };
}
