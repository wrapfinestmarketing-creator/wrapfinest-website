import * as THREE from 'three';

// GLSL shared hexagon helpers (edge distance: 0 at edge, 0.5 at cell centre)
export const HEX_GLSL = /* glsl */ `
float wfHexDist(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }
vec4 wfHexCoords(vec2 uv){
  vec2 r = vec2(1.0, 1.7320508); vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h; vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return vec4(gv, uv - gv);
}
float wfHexEdge(vec2 uv, float w){ vec4 hc = wfHexCoords(uv); float y = 0.5 - wfHexDist(hc.xy); return smoothstep(w, w * 0.35, y); }
float wfHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wfNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wfHash(i), wfHash(i + vec2(1.0, 0.0)), f.x), mix(wfHash(i + vec2(0.0, 1.0)), wfHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;

function hexLightMaterial({ scale = 1, width = 0.05, intensity = 3, sparse = 0, color = 0xffffff }) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: {
      uScale: { value: scale }, uWidth: { value: width }, uIntensity: { value: intensity },
      uLit: { value: 0 }, uSparse: { value: sparse }, uColor: { value: new THREE.Color(color) }, uSize: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `varying vec2 vP; uniform vec2 uSize; void main(){ vP = (uv - 0.5) * uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uScale, uWidth, uIntensity, uLit, uSparse; uniform vec3 uColor; uniform vec2 uSize; varying vec2 vP;
      ${HEX_GLSL}
      void main(){
        vec2 uv = vP * uScale; vec4 hc = wfHexCoords(uv);
        float y = 0.5 - wfHexDist(hc.xy);
        float edge = smoothstep(uWidth, uWidth * 0.45, y);
        float glow = smoothstep(uWidth * 3.5, 0.0, y) * 0.22;
        vec2 c = hc.zw / uScale;                              // cell centre in metres
        vec2 lim = uSize * 0.5 - vec2(0.55) / uScale;
        float inside = step(abs(c.x), lim.x) * step(abs(c.y), lim.y);
        float r = wfHash(hc.zw + 3.7);
        float keep = step(uSparse, wfHash(hc.zw * 1.3 + 9.1));
        float lit = smoothstep(r * 0.92, r * 0.92 + 0.06, uLit);
        float a = (edge + glow) * inside * keep * lit;
        gl_FragColor = vec4(uColor * uIntensity, a);
      }`,
  });
}

function floorTexture(renderer) {
  const S = 2048, M = 24; // 24 m square
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  const px = S / M, tile = 0.4 * px, n = Math.round(M / 0.4);
  g.fillStyle = '#0d0e11'; g.fillRect(0, 0, S, S);
  const orange = (i, j) => {
    const x = (i + 0.5) * 0.4 - M / 2, z = (j + 0.5) * 0.4 - M / 2, ax = Math.abs(x), az = Math.abs(z);
    const frame = (Math.abs(ax - 2.2) < 0.21 && az < 4.2) || (Math.abs(az - 4.0) < 0.21 && ax < 2.4); // frame around the car
    const lane = ax < 0.21 && az > 4.2;                                                               // entry lanes
    const cross = az < 0.21 && ax > 2.4;
    return frame || lane || cross;
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * tile, y = j * tile, o = orange(i, j);
    g.fillStyle = o ? '#9c3116' : ((i + j) % 2 ? '#17191d' : '#131518'); g.fillRect(x + 1, y + 1, tile - 2, tile - 2);
    g.strokeStyle = o ? 'rgba(255,170,130,0.35)' : 'rgba(255,255,255,0.055)'; g.lineWidth = 1.5; g.beginPath();
    const dir = (i + j) % 2;
    for (let k = -4; k <= 8; k++) { const d = k * tile / 5; if (dir) { g.moveTo(x + d, y); g.lineTo(x + d + tile, y + tile); } else { g.moveTo(x + d + tile, y); g.lineTo(x + d, y + tile); } }
    g.save(); g.beginPath(); g.rect(x + 2, y + 2, tile - 4, tile - 4); g.clip(); g.beginPath();
    for (let k = -4; k <= 8; k++) { const d = k * tile / 5; if (dir) { g.moveTo(x + d, y); g.lineTo(x + d + tile, y + tile); } else { g.moveTo(x + d + tile, y); g.lineTo(x + d, y + tile); } }
    g.stroke(); g.restore();
  }
  // soft falloff to black at the borders
  const grd = g.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.5);
  grd.addColorStop(0, 'rgba(8,9,11,0)'); grd.addColorStop(1, 'rgba(8,9,11,1)'); g.fillStyle = grd; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); t.generateMipmaps = true;
  return t;
}

function blobTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const g = cv.getContext('2d');
  const grd = g.createRadialGradient(128, 256, 10, 128, 256, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.92)'); grd.addColorStop(0.6, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.translate(128, 256); g.scale(1, 2); g.translate(-128, -256); g.fillStyle = grd; g.fillRect(0, 0, 256, 512); g.restore();
  return new THREE.CanvasTexture(cv);
}

async function logoTexture(url) {
  const img = new Image(); img.decoding = 'async'; img.src = url;
  await img.decode().catch(() => {});
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 446; const g = cv.getContext('2d');
  try { g.drawImage(img, 0, 0, 1024, 446); } catch { /* ignore */ }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function buildStudio({ renderer, scene, base, lowPower }) {
  const group = new THREE.Group(); scene.add(group);
  const hexMats = [];
  const HW = 8.6, CEIL = 6.1, WALL = 4.4, LEN = 30;           // hall half-width, ceiling, wall-panel top, length

  // shell: dark walls + black ceiling, like the real bay
  const room = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 1.2, CEIL + 1.4, LEN), new THREE.MeshStandardMaterial({ color: 0x1a1e21, roughness: 0.9, metalness: 0, side: THREE.BackSide, envMapIntensity: 0.08 }));
  room.position.y = (CEIL + 1.4) / 2 - 0.02; group.add(room);

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ map: floorTexture(renderer), roughness: 0.36, metalness: 0.2, transparent: !lowPower, opacity: lowPower ? 1 : 0.84, envMapIntensity: 0.16 }));
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = 2; group.add(floor);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ color: 0x08090b }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; outer.renderOrder = 1; group.add(outer);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 6.6), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.92 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = 3; group.add(blob);

  // ---- light tunnel: arches of white panels (ceiling row, 45-degree corners, wall panels) ----
  const ARCH_Z = []; for (let z = -12; z <= 12.01; z += 3) ARCH_Z.push(z);
  const defs = [];                                            // per-arch panel transforms: [x, y, w, h, rotZ]
  const cw = 1.72, cn = 7, cx0 = -((cn - 1) * (cw + 0.08)) / 2;
  for (let i = 0; i < cn; i++) defs.push({ x: cx0 + i * (cw + 0.08), y: CEIL, w: cw, rx: Math.PI / 2, rz: 0 });
  const chamfer = Math.hypot(HW - (cn * (cw + 0.08)) / 2, CEIL - WALL) - 0.1, ccx = (HW + (cn * (cw + 0.08)) / 2) / 2, ccy = (CEIL + WALL) / 2, ca = Math.atan2(CEIL - WALL, HW - (cn * (cw + 0.08)) / 2);
  for (const sx of [-1, 1]) {
    defs.push({ x: sx * ccx, y: ccy, w: chamfer, rx: Math.PI / 2, rz: 0, tilt: sx * (Math.PI / 2 - ca) });
    defs.push({ x: sx * HW, y: WALL - 0.75, w: 1.4, wall: sx });
    defs.push({ x: sx * HW, y: WALL - 2.75, w: 2.5, wall: sx });
  }
  const DEPTH = 1.25, perArch = defs.length;
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide });
  const panels = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), panelMat, ARCH_Z.length * perArch);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x24282b, roughness: 0.6, metalness: 0.3, envMapIntensity: 0.05 });
  const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), frameMat, ARCH_Z.length * perArch);
  const o = new THREE.Object3D(); let n = 0;
  for (const z of ARCH_Z) for (const d of defs) {
    o.position.set(d.x, d.y, z); o.rotation.set(0, 0, 0); o.scale.set(d.w, DEPTH, 1);
    if (d.wall) { o.rotation.set(0, -d.wall * Math.PI / 2, Math.PI / 2); o.scale.set(d.w, DEPTH, 1); o.position.x = d.x - d.wall * 0.06; }
    else if (d.tilt) { o.rotation.set(Math.PI / 2, d.tilt, 0); o.position.y -= 0.04; }
    else { o.rotation.set(Math.PI / 2, 0, 0); o.position.y -= 0.06; }
    o.updateMatrix(); panels.setMatrixAt(n, o.matrix);
    o.scale.set(d.w + 0.16, DEPTH + 0.16, 0.08); o.translateZ(-0.07); o.updateMatrix(); frames.setMatrixAt(n, o.matrix); n++;
  }
  panels.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(panels.count * 3).fill(0), 3);
  panels.frustumCulled = false; frames.frustumCulled = false; group.add(frames, panels);

  // hexagon accents (the WrapFinest signature) on the end wall and one side run
  const addHex = (w, h, opts, pos, rot) => {
    const m = hexLightMaterial(opts); m.uniforms.uSize.value.set(w, h); hexMats.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.position.set(...pos); mesh.rotation.set(...rot); group.add(mesh); return mesh;
  };
  addHex(12, 3.6, { scale: 0.8, width: 0.045, intensity: 1.9, sparse: 0.5 }, [0, 2.2, -LEN / 2 + 0.12], [0, 0, 0]);
  addHex(12, 3.6, { scale: 0.8, width: 0.045, intensity: 1.9, sparse: 0.62 }, [0, 2.2, LEN / 2 - 0.12], [0, Math.PI, 0]);

  // glowing WF sign on the end wall
  const signTex = await logoTexture(base + 'brand/mark-white.svg');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.48), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, color: new THREE.Color(2.6, 0.62, 0.22), toneMapped: false, depthWrite: false }));
  sign.position.set(0, 4.9, -LEN / 2 + 0.1); group.add(sign);

  // lights (the baked environment does most of the work)
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x0a0a0c, 0.3));
  const key = new THREE.DirectionalLight(0xffffff, 0.45); key.position.set(3, 8, 5); scene.add(key);
  const rim = new THREE.PointLight(0xef4523, 22, 16, 2); rim.position.set(-5.5, 1.4, -5.5); scene.add(rim);
  const sweep = new THREE.PointLight(0xffffff, 7, 14, 2); sweep.position.set(0, 3.2, 3); scene.add(sweep);

  let gain = 0.96, lastLit = -1;
  const col = new THREE.Color();
  const setLit = v => {
    for (const m of hexMats) m.uniforms.uLit.value = v;
    if (Math.abs(v - lastLit) < 0.002) return; lastLit = v;
    const N = ARCH_Z.length;
    for (let a = 0; a < N; a++) {                              // arches switch on from the far end forward
      const t = Math.min(1, Math.max(0, (v * (N + 2) - a) / 2)), b = t * t * gain;
      for (let j = 0; j < perArch; j++) { col.setRGB(b, b, b * 1.03); panels.setColorAt(a * perArch + j, col); }
    }
    panels.instanceColor.needsUpdate = true;
  };
  setLit(0);

  // bake the bay into an environment map so the arches reflect across the paint
  const bakeEnv = () => {
    const prev = lastLit; gain = 5.5; lastLit = -1; setLit(1);
    for (const m of hexMats) m.uniforms.uIntensity.value *= 2.2;
    const rt = new THREE.WebGLCubeRenderTarget(lowPower ? 512 : 1024, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cc = new THREE.CubeCamera(0.3, 60, rt); cc.position.set(0, 1.0, 0);
    blob.visible = false; cc.update(renderer, scene); blob.visible = true;
    const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromCubemap(rt.texture).texture; pm.dispose(); rt.dispose();
    scene.environment = env; scene.environmentIntensity = 1.0;
    for (const m of hexMats) m.uniforms.uIntensity.value /= 2.2; gain = 0.96; lastLit = -1; setLit(Math.max(0, prev));
  };

  return { group, floor, blob, sweep, rim, setLit, bakeEnv };
}
