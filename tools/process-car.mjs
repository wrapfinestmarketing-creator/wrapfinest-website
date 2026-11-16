// Offline pipeline: Hunyuan raw GLB -> real-proportion, web-optimized Model YL + mask texture.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, simplify, reorder, quantize, prune, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

const SRC = process.env.SRC || '/home/user/wrapfinest-assets/models/hunyuan3.glb';
const OUT = '/home/user/wrapfinest-website/public/models';
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(SRC);
const root = doc.getRoot();
const node = root.listNodes().find(n => n.getMesh());
const prim = node.getMesh().listPrimitives()[0];
const mat = prim.getMaterial();

// ---------- geometry: bake orientation, stretch to Model Y L proportions ----------
const S = 3.92; // model units -> metres
// stretch factor along length (model units, +z = front)
const zones = [ // [z0, z1, k]
  [-9, -0.474, 1.06],   // rear overhang
  [-0.474, -0.224, 1.0],// rear wheel + arch
  [-0.224, 0.209, 1.21],// cabin (long wheelbase)
  [0.209, 0.459, 1.0],  // front wheel + arch
  [0.459, 9, 1.0],      // front overhang
];
const BL = 0.03;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function k(z) { let v = zones[0][2]; for (let i = 1; i < zones.length; i++) v += (zones[i][2] - zones[i - 1][2]) * sm(zones[i][0] - BL, zones[i][0] + BL, z); return v; }
const Z0 = -0.6, Z1 = 0.6, N = 2400, table = new Float64Array(N + 1);
for (let i = 1; i <= N; i++) { const z = Z0 + (i - 0.5) / N * (Z1 - Z0); table[i] = table[i - 1] + k(z) * (Z1 - Z0) / N; }
const mapZ = z => { const f = (z - Z0) / (Z1 - Z0) * N, i = Math.min(N - 1, Math.max(0, Math.floor(f))); return table[i] + (table[i + 1] - table[i]) * (f - i); };

const P = prim.getAttribute('POSITION'), Nn = prim.getAttribute('NORMAL');
const pa = P.getArray(), na = Nn.getArray(), cnt = P.getCount();
let zmin = 1e9, zmax = -1e9, xmin = 1e9, xmax = -1e9;
for (let i = 0; i < cnt; i++) {
  const x = pa[3 * i], y = -pa[3 * i + 2], z = pa[3 * i + 1];          // bake +90deg X rotation
  let nx = na[3 * i], ny = -na[3 * i + 2], nz = na[3 * i + 1];
  const kk = k(z); nz /= kk; const l = Math.hypot(nx, ny, nz) || 1;
  const Zs = mapZ(z) * S;
  pa[3 * i] = x * S; pa[3 * i + 1] = y * S; pa[3 * i + 2] = Zs;
  na[3 * i] = nx / l; na[3 * i + 1] = ny / l; na[3 * i + 2] = nz / l;
  zmin = Math.min(zmin, Zs); zmax = Math.max(zmax, Zs); xmin = Math.min(xmin, x * S); xmax = Math.max(xmax, x * S);
}
const zc = (zmin + zmax) / 2, xc = (xmin + xmax) / 2;
for (let i = 0; i < cnt; i++) { pa[3 * i] -= xc; pa[3 * i + 2] -= zc; }
P.setArray(pa); Nn.setArray(na);
node.setRotation([0, 0, 0, 1]).setTranslation([0, 0, 0]).setScale([1, 1, 1]);
const wz = z => +(mapZ(z) * S - zc).toFixed(3);
const info = { length: +(zmax - zmin).toFixed(3), width: +(xmax - xmin).toFixed(3), height: +(0.431 * S).toFixed(3), rearAxleZ: wz(-0.349), frontAxleZ: wz(0.334), wheelR: +(0.092 * S).toFixed(3) };

// ---------- textures: mask (R body, G glass, B lights), compact base + normal ----------
const tex = {}; for (const t of root.listTextures()) { const n = t.getName(); tex[n.includes('normal') ? 'normal' : n.includes('rough') ? 'orm' : 'base'] = t; }
const SZ = 2048;
const base = await sharp(tex.base.getImage()).resize(SZ, SZ).removeAlpha().raw().toBuffer();
const orm = await sharp(tex.orm.getImage()).resize(SZ, SZ).removeAlpha().raw().toBuffer();
const mask = Buffer.alloc(SZ * SZ * 3); let cb = 0, cg = 0, cl = 0;
for (let i = 0; i < SZ * SZ; i++) {
  const r = base[3 * i] / 255, g = base[3 * i + 1] / 255, b = base[3 * i + 2] / 255;
  const rough = orm[3 * i + 1] / 255, metal = orm[3 * i + 2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0;
  const red = Math.max(0, r - Math.max(g, b));
  const body = Math.min(1, Math.max(0, (red - 0.18) / 0.22)) * Math.min(1, Math.max(0, (metal - 0.12) / 0.2));
  const glass = Math.min(1, Math.max(0, (0.33 - rough) / 0.1)) * Math.min(1, Math.max(0, (0.25 - metal) / 0.1)) * Math.min(1, Math.max(0, (0.45 - mx) / 0.15));
  const light = Math.min(1, Math.max(0, (mx - 0.62) / 0.2)) * Math.min(1, Math.max(0, (0.5 - sat) / 0.25));
  mask[3 * i] = body * 255; mask[3 * i + 1] = glass * 255; mask[3 * i + 2] = light * 255;
  cb += body; cg += glass; cl += light;
}
info.maskCoverage = { body: +(cb / SZ / SZ).toFixed(3), glass: +(cg / SZ / SZ).toFixed(3), lights: +(cl / SZ / SZ).toFixed(4) };
fs.mkdirSync(OUT, { recursive: true });
await sharp(mask, { raw: { width: SZ, height: SZ, channels: 3 } }).blur(0.6).webp({ quality: 92 }).toFile(`${OUT}/car-mask.webp`);
tex.base.setImage(await sharp(tex.base.getImage()).resize(1024, 1024).webp({ quality: 86 }).toBuffer()).setMimeType('image/webp');
{
  const nrm = await sharp(tex.normal.getImage()).resize(SZ, SZ).removeAlpha().raw().toBuffer();
  const mk = await sharp(mask, { raw: { width: SZ, height: SZ, channels: 3 } }).blur(2.5).raw().toBuffer();
  for (let i = 0; i < SZ * SZ; i++) { const g = Math.min(1, mk[3 * i + 1] / 255 * 1.6); nrm[3 * i] += (128 - nrm[3 * i]) * g; nrm[3 * i + 1] += (128 - nrm[3 * i + 1]) * g; nrm[3 * i + 2] += (255 - nrm[3 * i + 2]) * g; }
  tex.normal.setImage(await sharp(nrm, { raw: { width: SZ, height: SZ, channels: 3 } }).webp({ quality: 92 }).toBuffer()).setMimeType('image/webp');
}
mat.setMetallicRoughnessTexture(null).setRoughnessFactor(0.5).setMetallicFactor(0).setDoubleSided(false).setName('car');
node.setName('car'); node.getMesh().setName('car');
doc.createExtension(ALL_EXTENSIONS.find(e => e.EXTENSION_NAME === 'EXT_texture_webp')).setRequired(true);

// glass landmarks from mask sampled at vertices (for scene choreography)
const UV = prim.getAttribute('TEXCOORD_0').getArray();
const maskRaw = await sharp(`${OUT}/car-mask.webp`).raw().toBuffer();
const g = { ws: [], roof: [], side: [], rear: [] };
const bb = () => ({ min: [9, 9, 9], max: [-9, -9, -9], n: 0 });
const boxes = { windshield: bb(), roof: bb(), sideL: bb(), rearGlass: bb(), bodyHood: bb() };
const add = (b, x, y, z) => { b.n++; b.min[0] = Math.min(b.min[0], x); b.min[1] = Math.min(b.min[1], y); b.min[2] = Math.min(b.min[2], z); b.max[0] = Math.max(b.max[0], x); b.max[1] = Math.max(b.max[1], y); b.max[2] = Math.max(b.max[2], z); };
for (let i = 0; i < cnt; i++) {
  const u = Math.min(SZ - 1, Math.max(0, Math.floor((UV[2 * i] % 1) * SZ))), v = Math.min(SZ - 1, Math.max(0, Math.floor((UV[2 * i + 1] % 1) * SZ)));
  const m = maskRaw.subarray((v * SZ + u) * 3, (v * SZ + u) * 3 + 3);
  const x = pa[3 * i], y = pa[3 * i + 1], z = pa[3 * i + 2], nx = na[3 * i], ny = na[3 * i + 1], nz = na[3 * i + 2];
  if (m[1] > 128) {
    if (ny > 0.85) add(boxes.roof, x, y, z);
    else if (nz > 0.35 && ny > 0.3) add(boxes.windshield, x, y, z);
    else if (nz < -0.3 && ny > 0.2) add(boxes.rearGlass, x, y, z);
    else if (nx > 0.6) add(boxes.sideL, x, y, z);
  }
  if (m[0] > 128 && ny > 0.8 && z > info.frontAxleZ - 0.3) add(boxes.bodyHood, x, y, z);
}
for (const kx in boxes) { boxes[kx].min = boxes[kx].min.map(v => +v.toFixed(2)); boxes[kx].max = boxes[kx].max.map(v => +v.toFixed(2)); }
info.boxes = boxes;

// ---------- optimise + write ----------
await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: +(process.env.RATIO || 0.4), error: 0.0004 }), prune());
{ // smooth the windshield / roof glass (removes seat imprints), position-welded so UV seams stay closed
  const pr = root.listMeshes()[0].listPrimitives()[0];
  const Pp = pr.getAttribute('POSITION'), Np = pr.getAttribute('NORMAL'), Tp = pr.getAttribute('TEXCOORD_0'), idx = pr.getIndices().getArray();
  const pp = Pp.getArray(), nn = Np.getArray(), tt = Tp.getArray(), vc = Pp.getCount();
  const key = i => `${Math.round(pp[3*i]*2000)},${Math.round(pp[3*i+1]*2000)},${Math.round(pp[3*i+2]*2000)}`;
  const gmap = new Map(), gid = new Int32Array(vc); let ng = 0;
  for (let i = 0; i < vc; i++) { const k2 = key(i); let g2 = gmap.get(k2); if (g2 === undefined) { g2 = ng++; gmap.set(k2, g2); } gid[i] = g2; }
  const gp = new Float64Array(ng * 3), inSet = new Uint8Array(ng).fill(1), seen = new Uint8Array(ng);
  for (let i = 0; i < vc; i++) {
    const g2 = gid[i]; gp[3*g2] = pp[3*i]; gp[3*g2+1] = pp[3*i+1]; gp[3*g2+2] = pp[3*i+2]; seen[g2] = 1;
    const u = Math.min(SZ-1, Math.max(0, Math.floor(tt[2*i]*SZ))), v = Math.min(SZ-1, Math.max(0, Math.floor(tt[2*i+1]*SZ)));
    const isGlass = maskRaw[(v*SZ+u)*3+1] > 150, top = nn[3*i+1] > 0.25 && Math.abs(nn[3*i]) < 0.55;
    if (!(isGlass && top && pp[3*i+1] > 1.0)) inSet[g2] = 0;
  }
  const nb = Array.from({ length: ng }, () => new Set());
  for (let f = 0; f < idx.length; f += 3) { const a = gid[idx[f]], b = gid[idx[f+1]], c = gid[idx[f+2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  // only move vertices well inside the glass (2 rings from the edge)
  let core = inSet.slice();
  for (let r = 0; r < 2; r++) { const nx = core.slice(); for (let g2 = 0; g2 < ng; g2++) if (core[g2]) for (const o of nb[g2]) if (!core[o]) { nx[g2] = 0; break; } core = nx; }
  const moving = []; for (let g2 = 0; g2 < ng; g2++) if (core[g2]) moving.push(g2);
  const tmpP = new Float64Array(ng * 3);
  for (let it = 0; it < 220; it++) {
    for (const g2 of moving) { let x = 0, y = 0, z = 0, c = 0; for (const o of nb[g2]) { x += gp[3*o]; y += gp[3*o+1]; z += gp[3*o+2]; c++; } tmpP[3*g2] = x/c; tmpP[3*g2+1] = y/c; tmpP[3*g2+2] = z/c; }
    for (const g2 of moving) { gp[3*g2] += (tmpP[3*g2]-gp[3*g2])*0.6; gp[3*g2+1] += (tmpP[3*g2+1]-gp[3*g2+1])*0.6; gp[3*g2+2] += (tmpP[3*g2+2]-gp[3*g2+2])*0.6; }
  }
  for (let i = 0; i < vc; i++) { const g2 = gid[i]; if (core[g2]) { pp[3*i] = gp[3*g2]; pp[3*i+1] = gp[3*g2+1]; pp[3*i+2] = gp[3*g2+2]; } }
  // recompute normals on the glass set
  const gn = new Float64Array(ng * 3);
  for (let f = 0; f < idx.length; f += 3) { const a = idx[f], b = idx[f+1], c = idx[f+2];
    const ux = pp[3*b]-pp[3*a], uy = pp[3*b+1]-pp[3*a+1], uz = pp[3*b+2]-pp[3*a+2], vx = pp[3*c]-pp[3*a], vy = pp[3*c+1]-pp[3*a+1], vz = pp[3*c+2]-pp[3*a+2];
    const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
    for (const q of [a, b, c]) { const g2 = gid[q]; gn[3*g2] += nx; gn[3*g2+1] += ny; gn[3*g2+2] += nz; } }
  for (let i = 0; i < vc; i++) { const g2 = gid[i]; if (inSet[g2]) { const l = Math.hypot(gn[3*g2], gn[3*g2+1], gn[3*g2+2]) || 1; nn[3*i] = gn[3*g2]/l; nn[3*i+1] = gn[3*g2+1]/l; nn[3*i+2] = gn[3*g2+2]/l; } }
  // crease-aware smoothing of ALL shading normals: keeps silhouettes, gives clean mirror reflections
  { const g0 = new Float64Array(ng * 3), cnt2 = new Float64Array(ng);
    for (let i = 0; i < vc; i++) { const g2 = gid[i]; g0[3*g2] += nn[3*i]; g0[3*g2+1] += nn[3*i+1]; g0[3*g2+2] += nn[3*i+2]; cnt2[g2]++; }
    for (let g2 = 0; g2 < ng; g2++) { const l = Math.hypot(g0[3*g2], g0[3*g2+1], g0[3*g2+2]) || 1; g0[3*g2] /= l; g0[3*g2+1] /= l; g0[3*g2+2] /= l; }
    let cur = g0, nxt = new Float64Array(ng * 3);
    const ITER = +(process.env.NSMOOTH || 14);
    for (let it = 0; it < ITER; it++) {
      for (let g2 = 0; g2 < ng; g2++) { const ax = cur[3*g2], ay = cur[3*g2+1], az = cur[3*g2+2]; let x = ax, y = ay, z = az;
        for (const o of nb[g2]) { const d = ax*cur[3*o] + ay*cur[3*o+1] + az*cur[3*o+2]; if (d > 0.82) { const w = d * d; x += cur[3*o]*w; y += cur[3*o+1]*w; z += cur[3*o+2]*w; } }
        const l = Math.hypot(x, y, z) || 1; nxt[3*g2] = x/l; nxt[3*g2+1] = y/l; nxt[3*g2+2] = z/l; }
      const t2 = cur; cur = nxt; nxt = t2 === g0 ? new Float64Array(ng * 3) : t2;
    }
    for (let i = 0; i < vc; i++) { const g2 = gid[i]; nn[3*i] = cur[3*g2]; nn[3*i+1] = cur[3*g2+1]; nn[3*i+2] = cur[3*g2+2]; }
  }
  Pp.setArray(pp); Np.setArray(nn); info.smoothed = moving.length;
}
await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(`${OUT}/model-yl.glb`, doc);
info.tris = root.listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;
info.bytes = { glb: fs.statSync(`${OUT}/model-yl.glb`).size, mask: fs.statSync(`${OUT}/car-mask.webp`).size };
fs.writeFileSync('/home/user/wrapfinest-website/src-car-info.json', JSON.stringify(info, null, 1));
console.log(JSON.stringify(info, null, 1));
