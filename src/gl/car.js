import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { HEX_GLSL } from './studio.js';

// Convert quantized/normalized attributes to plain floats and bake the node transform,
// so shaders can use object-space metres directly.
function bakeGeometry(mesh) {
  mesh.updateWorldMatrix(true, false);
  const src = mesh.geometry, geo = new THREE.BufferGeometry();
  const copy = (name, size) => {
    const a = src.getAttribute(name), out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) { out[i * size] = a.getX(i); out[i * size + 1] = a.getY(i); if (size > 2) out[i * size + 2] = a.getZ(i); }
    return new THREE.BufferAttribute(out, size);
  };
  geo.setAttribute('position', copy('position', 3));
  geo.setAttribute('normal', copy('normal', 3));
  geo.setAttribute('uv', copy('uv', 2));
  geo.setIndex(src.getIndex());
  geo.applyMatrix4(mesh.matrixWorld);
  geo.normalizeNormals();
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

export function makeCarUniforms(mask) {
  return {
    tMask: { value: mask },
    uColA: { value: new THREE.Color('#a30d18') }, uColB: { value: new THREE.Color('#a30d18') },
    uPrmA: { value: new THREE.Vector4(0.1, 0.0, 1, 0.02) }, uPrmB: { value: new THREE.Vector4(0.1, 0.0, 1, 0.02) },
    uWipe: { value: 0 }, uFilm: { value: 0 }, uTint: { value: 0.64 }, uThermo: { value: 0 }, uHeat: { value: 0 },
    uTime: { value: 0 }, uLights: { value: 1 },
    uImp: { value: [new THREE.Vector4(0, 0, 0, -1), new THREE.Vector4(0, 0, 0, -1), new THREE.Vector4(0, 0, 0, -1)] },
    uImpCol: { value: new THREE.Color(1.0, 0.55, 0.3) },
    uScr: { value: new THREE.Vector4(1, 0.8, 0.3, 0) },
    uCrk: { value: new THREE.Vector4(1, 1.25, -0.5, 0) },
  };
}

function carMaterial(orig, uniforms) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: orig.map, normalMap: orig.normalMap, normalScale: new THREE.Vector2(0.28, 0.28),
    roughness: 0.5, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.0, ior: 2.2,
  });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vObjN = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform sampler2D tMask; uniform vec3 uColA; uniform vec3 uColB; uniform vec4 uPrmA; uniform vec4 uPrmB;
        uniform float uWipe, uFilm, uTint, uThermo, uHeat, uTime, uLights;
        uniform vec4 uImp[3]; uniform vec3 uImpCol; uniform vec4 uScr; uniform vec4 uCrk;
        varying vec3 vObj; varying vec3 vObjN;
        float wfBody, wfGlass, wfLamp, wfCC, wfCCR, wfRough, wfMetal, wfScratch; vec3 wfEmis;
        ${HEX_GLSL}`)
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
        {
          vec3 mk = texture2D(tMask, vMapUv).rgb;
          wfBody = mk.r; wfGlass = mk.g; wfLamp = mk.b; wfEmis = vec3(0.0);
          float wv = sin(vObj.y * 5.0 + vObj.x * 3.0) * 0.06;
          float zz = vObj.z + wv;
          // finish wipe, nose to tail
          float wipeFront = mix(2.75, -2.75, uWipe);
          float wB = smoothstep(wipeFront - 0.03, wipeFront + 0.03, zz);
          vec3 paint = mix(uColA, uColB, wB);
          vec4 prm = mix(uPrmA, uPrmB, wB);
          // PPF coverage, nose to tail
          float filmFront = mix(2.75, -2.75, uFilm);
          float cov = smoothstep(filmFront - 0.02, filmFront + 0.02, zz);
          float edgeW = exp(-abs(zz - wipeFront) * 26.0) * step(0.002, uWipe) * step(uWipe, 0.998);
          float edgeF = exp(-abs(zz - filmFront) * 26.0) * step(0.002, uFilm) * step(uFilm, 0.998);

          float lum = dot(diffuseColor.rgb, vec3(0.3333));
          float wheel = smoothstep(0.07, 0.2, lum) * (1.0 - wfLamp);
          vec3 other = diffuseColor.rgb * 0.4;
          wfRough = mix(0.75, 0.42, wheel); wfMetal = mix(0.0, 0.35, wheel);
          wfCC = 0.0; wfCCR = 0.2;

          // --- painted body
          wfCC = mix(wfCC, mix(0.8, prm.z, cov), wfBody);
          wfCCR = mix(wfCCR, mix(max(prm.w, 0.12), prm.w, cov), wfBody);
          wfRough = mix(wfRough, mix(max(prm.x, 0.28), prm.x, cov), wfBody); wfMetal = mix(wfMetal, prm.y, wfBody);
          vec3 col = mix(other, paint * 0.6, wfBody);

          // --- self-healing demo scratches (door)
          vec2 sq = vec2(vObj.z - uScr.z, vObj.y - uScr.y);
          float sArea = smoothstep(0.62, 0.15, length(sq)) * step(0.0, vObj.x * uScr.x);
          float sl = 0.0;
          for (int i = 0; i < 3; i++) {
            float fi = float(i); float an = 0.35 + fi * 1.1;
            vec2 d = vec2(cos(an), sin(an));
            float c = dot(sq, d) * 70.0 + wfNoise(sq * 5.0 + fi * 7.3) * 9.0;
            sl += smoothstep(0.965, 1.0, sin(c)) * step(0.42, wfNoise(sq * 3.0 + fi * 11.0));
          }
          wfScratch = clamp(sl, 0.0, 1.0) * sArea * uScr.w * wfBody;
          col = mix(col, vec3(0.5), wfScratch * 0.8);
          wfRough = mix(wfRough, 0.9, wfScratch); wfCC *= 1.0 - wfScratch;

          // --- glass
          float side = smoothstep(0.5, 0.72, abs(vObjN.x));
          float sideGlass = wfGlass * side, topGlass = wfGlass * (1.0 - side);
          float dark = mix(mix(0.72, 0.9, uThermo), uTint, side);
          vec3 gl = mix(vec3(0.07, 0.085, 0.095), vec3(0.003, 0.0035, 0.004), pow(dark, 0.7));
          gl += vec3(0.0, 0.012, 0.03) * uThermo * (1.0 - side);
          gl *= 0.75 + 0.25 * smoothstep(0.9, 1.6, vObj.y);
          col = mix(col, gl, wfGlass);
          wfRough = mix(wfRough, 0.035, wfGlass); wfMetal = mix(wfMetal, 0.0, wfGlass);
          wfCC = mix(wfCC, 1.0, wfGlass); wfCCR = mix(wfCCR, 0.02, wfGlass);

          // --- cracked-but-holding side glass
          vec2 cq = vec2(vObj.z - uCrk.z, vObj.y - uCrk.y); float cr = length(cq); float ca = atan(cq.y, cq.x);
          float spoke = abs(fract(ca / 6.2832 * 13.0 + wfNoise(vec2(cr * 6.0, 2.0)) * 0.5) - 0.5) * cr;
          float ringv = abs(fract(cr * 9.0 + wfNoise(vec2(ca * 2.0, 5.0)) * 0.8) - 0.5);
          float crack = smoothstep(0.011, 0.0, spoke) + smoothstep(0.06, 0.0, ringv) * step(0.5, wfNoise(vec2(ca * 4.0, floor(cr * 9.0)))) * 0.7;
          float cR = uCrk.w * 0.6;
          crack *= smoothstep(cR, cR * 0.55, cr) * step(0.001, uCrk.w) * sideGlass * step(0.0, vObj.x * uCrk.x);
          col = mix(col, vec3(0.75, 0.8, 0.85), clamp(crack, 0.0, 1.0) * 0.8);
          wfRough = mix(wfRough, 0.6, clamp(crack, 0.0, 1.0));
          wfEmis += vec3(0.5, 0.56, 0.62) * crack * 0.35;

          // --- impacts: ripple ring + hex shield flash where armor is installed
          float armored = clamp(wfBody * cov + wfLamp * cov + topGlass * uThermo + sideGlass * uThermo, 0.0, 1.0);
          for (int i = 0; i < 3; i++) {
            vec4 I = uImp[i];
            if (I.w >= 0.0) {
              float d = distance(vObj, I.xyz);
              float ring = exp(-pow((d - I.w * 0.85) * 15.0, 2.0)) * exp(-I.w * 2.4);
              float flash = exp(-d * 10.0) * exp(-I.w * 7.0);
              float hx = wfHexEdge(vec2(vObj.x, vObj.z + vObj.y * 0.6) * 11.0, 0.07) * exp(-d * 3.2) * exp(-I.w * 2.2);
              wfEmis += uImpCol * (ring * 1.4 + flash * 2.2 + hx * 1.3 * armored);
            }
          }

          // --- heat on roof glass: glowing hot without armor, cool with it
          float hn = wfNoise(vObj.xz * 3.0 + uTime * 0.35);
          vec3 hot = vec3(1.0, 0.2, 0.03) * (0.75 + 0.5 * hn);
          vec3 cool = vec3(0.04, 0.22, 0.5) * (0.35 + 0.25 * hn);
          wfEmis += topGlass * uHeat * mix(hot * 1.5, cool, uThermo) * smoothstep(0.25, 0.9, vObjN.y);

          // --- lamps + film / finish edges
          wfEmis += wfLamp * uLights * (vObj.z > 0.0 ? vec3(1.0, 0.97, 0.92) * 3.2 : vec3(1.0, 0.05, 0.02) * 3.0);
          wfEmis += vec3(1.0, 0.3, 0.08) * edgeF * 2.6 * max(wfBody, wfLamp);
          wfEmis += vec3(1.0, 0.95, 0.9) * edgeW * 1.4 * wfBody;
          diffuseColor.rgb = col;
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = wfRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = wfMetal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += wfEmis;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat = saturate(wfCC); material.clearcoatRoughness = clamp(wfCCR, 0.02, 1.0);');
  };
  mat.customProgramCacheKey = () => 'wf-car-v1';
  return mat;
}

// A translucent sheet that hovers ahead of the coverage line and drapes onto the body.
function filmShell(geo, uniforms, map) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uFilm: uniforms.uFilm, uTime: uniforms.uTime, tMask: uniforms.tMask, uUvT: { value: map.matrix } },
    vertexShader: /* glsl */ `
      uniform float uFilm, uTime; uniform mat3 uUvT;
      varying float vBand; varying float vAhead; varying vec3 vN; varying vec3 vV; varying vec2 vUv2;
      void main(){
        vec3 p = position;
        float wv = sin(p.y * 5.0 + p.x * 3.0) * 0.06;
        float front = mix(2.75, -2.75, uFilm);
        float d = front - (p.z + wv);            // > 0 : not yet covered
        vAhead = d; vBand = clamp(d / 1.25, 0.0, 1.0);
        float lift = vBand * vBand * 0.5 + 0.006;
        lift += sin(p.x * 8.0 + uTime * 2.2 + p.z * 5.0) * 0.03 * vBand;
        p += normal * lift; p.y += vBand * vBand * 0.22;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vUv2 = (uUvT * vec3(uv, 1.0)).xy;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFilm; uniform sampler2D tMask;
      varying float vBand; varying float vAhead; varying vec3 vN; varying vec3 vV; varying vec2 vUv2;
      void main(){
        vec3 mk = texture2D(tMask, vUv2).rgb;
        float m = max(mk.r, mk.b);
        float on = step(0.0, vAhead) * step(0.002, uFilm) * step(uFilm, 0.998);
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float a = (1.0 - vBand) * (1.0 - vBand) * (0.1 + fres * 0.75) * m * on;
        vec3 c = mix(vec3(0.75, 0.9, 1.0), vec3(1.0, 0.45, 0.15), exp(-vAhead * 9.0));
        gl_FragColor = vec4(c * 1.4, a);
        if (a < 0.003) discard;
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 6; mesh.frustumCulled = false; return mesh;
}

function waterBeads(carMesh, count, uniforms) {
  const g = carMesh.geometry, n = g.getAttribute('normal'), p = g.getAttribute('position');
  const w = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { const ny = n.getY(i); w[i] = p.getY(i) > 0.62 ? Math.pow(Math.max(0, ny), 2.5) : 0; }
  g.setAttribute('wfWeight', new THREE.BufferAttribute(w, 1));
  const sampler = new MeshSurfaceSampler(carMesh).setWeightAttribute('wfWeight').build();
  const sph = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); sph.rotateX(Math.PI / 2); sph.scale(1, 1, 0.62);
  const seed = new Float32Array(count * 4);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x9fb4c6, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.5, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.5, ior: 1.33, depthWrite: false });
  const u = { uTime: uniforms.uTime, uWet: { value: 0 } };
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aSeed; uniform float uTime; uniform float uWet;')
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        float life = fract(uTime * (0.045 + aSeed.y * 0.07) + aSeed.x);
        float born = smoothstep(aSeed.z, aSeed.z + 0.04, uWet);
        float grow = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.93, 1.0, life));
        float sl = pow(max(0.0, life - 0.5) / 0.5, 2.2);
        transformed *= grow * born * (1.0 + sl * 0.35);
        transformed.x += sl * aSeed.w;`);
  };
  mat.customProgramCacheKey = () => 'wf-bead-v1';
  const inst = new THREE.InstancedMesh(sph, mat, count);
  const P = new THREE.Vector3(), N = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), m4 = new THREE.Matrix4(), down = new THREE.Vector3(0, -1, 0);
  for (let i = 0; i < count; i++) {
    sampler.sample(P, N);
    X.copy(down).addScaledVector(N, -down.dot(N)); const slope = X.length();
    if (slope < 0.05) X.set(1, 0, 0).addScaledVector(N, -N.x); X.normalize(); Y.crossVectors(N, X);
    const s = 0.003 + Math.pow(Math.random(), 2.4) * 0.0085;
    m4.makeBasis(X, Y, N); m4.scale(new THREE.Vector3(s, s, s)); m4.setPosition(P.addScaledVector(N, -s * 0.12));
    inst.setMatrixAt(i, m4);
    seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = 0.03 + Math.random() * 0.9;
    seed[i * 4 + 3] = Math.min(0.22, slope * 0.3) / s;
  }
  sph.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  inst.renderOrder = 5; inst.frustumCulled = false; inst.visible = false;
  return { mesh: inst, uniforms: u };
}

export async function loadCar({ base, onProgress, lowPower }) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const texLoader = new THREE.TextureLoader();
  const [gltf, mask] = await Promise.all([
    loader.loadAsync(base + 'models/model-yl.glb', e => onProgress?.(e.total ? e.loaded / e.total : 0.5)),
    texLoader.loadAsync(base + 'models/car-mask.webp'),
  ]);
  mask.flipY = false; mask.colorSpace = THREE.NoColorSpace; mask.anisotropy = 4;
  let src; gltf.scene.traverse(o => { if (o.isMesh) src = o; });
  const geo = bakeGeometry(src);
  const uniforms = makeCarUniforms(mask);
  const mesh = new THREE.Mesh(geo, carMaterial(src.material, uniforms));
  const group = new THREE.Group(); group.add(mesh);
  const film = filmShell(geo, uniforms, src.material.map); group.add(film);
  const beads = waterBeads(mesh, lowPower ? 1100 : 3200, uniforms); group.add(beads.mesh);
  let mirror = null;
  if (!lowPower) { mirror = new THREE.Mesh(geo, mesh.material); mirror.scale.y = -1; mirror.renderOrder = 0; }

  // landmarks via raycasts (object space == metres)
  const rc = new THREE.Raycaster(); group.updateMatrixWorld(true);
  const hit = (o, d, fallback) => { rc.set(new THREE.Vector3(...o), new THREE.Vector3(...d).normalize()); const h = rc.intersectObject(mesh, false)[0]; return h ? h.point.clone() : new THREE.Vector3(...fallback); };
  const marks = {
    hood: hit([0.28, 4, 1.72], [0, -1, 0], [0.28, 1.0, 1.72]),
    ws: [hit([0.38, 4, 0.82], [0, -1, 0], [0.38, 1.3, 0.82]), hit([-0.3, 4, 0.62], [0, -1, 0], [-0.3, 1.4, 0.62]), hit([0.05, 4, 0.98], [0, -1, 0], [0.05, 1.2, 0.98])],
    roof: [hit([0.25, 4, -0.35], [0, -1, 0], [0.25, 1.7, -0.35]), hit([-0.3, 4, -1.0], [0, -1, 0], [-0.3, 1.68, -1.0]), hit([0.05, 4, 0.1], [0, -1, 0], [0.05, 1.68, 0.1])],
    door: hit([4, 0.8, 0.35], [-1, 0, 0], [0.95, 0.8, 0.35]),
    sideGlass: hit([4, 1.27, -0.45], [-1, 0, 0], [0.8, 1.27, -0.45]),
  };
  uniforms.uScr.value.set(marks.door.x, marks.door.y, marks.door.z, 0);
  uniforms.uCrk.value.set(marks.sideGlass.x, marks.sideGlass.y, marks.sideGlass.z, 0);
  return { group, mesh, film, beads, mirror, uniforms, marks };
}
