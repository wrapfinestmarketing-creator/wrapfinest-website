// Live paint: repaints the car in a 360 frame on the GPU, so one set of frames serves every finish.
// A frame is the car cut out with a soft alpha edge; it is first put back on the "plate" (the steady
// picture of the bay), which keeps the background perfectly still while the car turns.
// The frames show the car in a solid bright blue that nothing else in the bay shares. A paint pixel is
//   d * BASE + s * white     (d = how lit the paint is, s = the clear-coat reflection on top)
// so we recover d and s per pixel and rebuild the pixel with the chosen paint. tools/repaint.py is the
// reference implementation of the same maths; tools/build-spin.py makes the frames.

const VS = 'attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }';
const FS = `
precision highp float;
uniform sampler2D tex;   // the car cut-out (rgb + alpha)
uniform sampler2D plate; // the bay
uniform vec4 rect;      // where the cut-out sits on the plate: x, y, w, h (0..1)
uniform vec3 tint;      // target paint colour
uniform vec4 k;         // diffuse gain, clear-coat gain, metallic amount, satin amount
uniform float lift;     // < 1 brightens the shaded side of the paint (light colours bounce more light)
uniform vec2 px;        // one texel
uniform float lod;      // mip level used for the satin blur
uniform float aspect;   // cut-out width / height
varying vec2 uv;
const vec3 BASE = vec3(BASE_R, BASE_G, BASE_B);
vec3 split(vec3 c) {    // -> (mask, diffuse, clear coat)
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), ch = mx - mn;
  float ratio = (c.g - c.r) / max(c.b - c.r, 1e-4);
  // where a reflection pushes blue to its limit, green catches up and the hue drifts to cyan: allow for that
  float clip = smoothstep(0.86, 0.97, c.b);
  float hue = smoothstep(HUE_LO0, HUE_LO1, ratio) * (1.0 - smoothstep(mix(HUE_HI0, 1.03, clip), mix(HUE_HI1, 1.1, clip), ratio)) * smoothstep(0.0, 0.02, c.b - max(c.r, c.g) + 0.012);
  float sat = max(smoothstep(0.16, 0.34, ch / max(mx, 1e-3)) * smoothstep(0.03, 0.09, ch), smoothstep(0.012, 0.04, ch) * smoothstep(0.5, 0.62, mx));
  // normally the shade is read from blue minus red; where blue is clipped, green minus red still tells the truth
  float d = mix(ch / (1.0 - BASE.r), (c.g - c.r) / (BASE.g - BASE.r), clip);
  return vec3(hue * sat, d, clamp(mn - d * BASE.r, 0.0, 1.0));
}
void main() {
  vec2 cu = (uv - rect.xy) / rect.zw;
  vec4 f = texture2D(tex, cu);
  float inside = step(0.0, cu.x) * step(cu.x, 1.0) * step(0.0, cu.y) * step(cu.y, 1.0);
  vec3 c = mix(texture2D(plate, uv).rgb, f.rgb, f.a * inside);
  vec3 q = split(c);
  float m = q.x * f.a * inside, d = q.y, s = q.z;
  if (k.w > 0.001 && m > 0.001) {
    // satin: the reflections spread out and dim, and the shading flattens a little
    vec3 acc = vec3(0.0); float wsum = 0.0;
    for (int i = 0; i < 16; i++) {
      float a = float(i) * 2.399963, r = sqrt((float(i) + 0.5) / 16.0);
      vec4 g = texture2D(tex, cu + vec2(cos(a), sin(a) * aspect) * r * px * SATIN_R / rect.z, lod);
      vec3 t = split(g.rgb); t.x *= g.a;
      acc += vec3(t.y * t.y, t.z, t.y) * t.x; wsum += t.x;       // shade is averaged towards the well-lit, unclipped paint
    }
    float softd = acc.x / max(acc.z, 1e-3), softs = acc.y / max(wsum, 1e-3);
    // under a strong reflection the paint colour is partly washed out; take the shade from around it instead
    float ds = mix(d, max(d, softd), smoothstep(0.08, 0.35, s));
    d = mix(d, 0.2 + 0.8 * mix(ds, softd, 0.35), k.w);
    s = mix(s, softs * 0.45 + s * 0.03, k.w);
  }
  vec3 bright = tint / max(max(tint.r, max(tint.g, tint.b)), 1e-3);
  d = pow(max(d, 0.0), lift);
  vec3 o = d * k.x * tint + s * k.y * mix(vec3(1.0), 0.35 + 0.65 * bright, k.z);
  gl_FragColor = vec4(mix(c, clamp(o, 0.0, 1.0), m), 1.0);
}`;

// base paint of the source frames and the hue window that counts as "paint"
const BASE = { r: 0.10, g: 0.40, b: 1.0, lo0: -0.02, lo1: 0.10, hi0: 0.66, hi1: 0.84 };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const fl = v => (Number.isInteger(v) ? v + '.0' : String(v));

export function createPainter() {
  const canvas = document.createElement('canvas');
  const opts = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'default' };
  let gl = canvas.getContext('webgl2', opts), v2 = !!gl;
  if (!gl) gl = canvas.getContext('webgl', opts);
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  let prog, u = {}, tex, ptex, lastImg = null, lastPlate = null, lastKey = '', lost = false;
  function init() {
    const fs = FS.replace('BASE_R', fl(BASE.r)).replace('BASE_G', fl(BASE.g)).replace('BASE_B', fl(BASE.b))
      .replace('HUE_LO0', fl(BASE.lo0)).replace('HUE_LO1', fl(BASE.lo1)).replace('HUE_HI0', fl(BASE.hi0)).replace('HUE_HI1', fl(BASE.hi1)).replace('SATIN_R', v2 ? '110.0' : '12.0');
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['tex', 'plate', 'rect', 'tint', 'k', 'px', 'lod', 'lift', 'aspect']) u[n] = gl.getUniformLocation(prog, n);
    const mk = unit => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); return t; };
    tex = mk(0); ptex = mk(1); gl.uniform1i(u.tex, 0); gl.uniform1i(u.plate, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    lastImg = null; lastPlate = null; lastKey = '';
  }
  try { init(); } catch (e) { console.warn('paint shader unavailable', e); return null; }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { try { init(); lost = false; } catch { /* stays lost */ } });

  /** Returns a canvas showing cut-out `img` on `plateImg` at `rect`, repainted with `paint`; null if the GPU is not available right now. */
  function render(img, paint, plateImg, rect) {
    if (lost || !plateImg) return null;
    const w = plateImg.naturalWidth || plateImg.width, h = plateImg.naturalHeight || plateImg.height;
    const key = paint.c + '|' + paint.kd + '|' + paint.ks + '|' + paint.km + '|' + (paint.lift || 1) + '|' + paint.satin;
    if (img === lastImg && plateImg === lastPlate && key === lastKey) return canvas;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); lastImg = null; lastPlate = null; }
    if (plateImg !== lastPlate) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ptex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, plateImg); }
    const satin = !!paint.satin, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (img !== lastImg || satin !== (lastKey.endsWith('|1'))) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      if (img !== lastImg) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (satin && v2) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.uniform4f(u.rect, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform3fv(u.tint, hex(paint.c)); gl.uniform4f(u.k, paint.kd, paint.ks, paint.km, paint.satin ? 1 : 0);
    gl.uniform1f(u.lift, paint.lift || 1); gl.uniform1f(u.aspect, iw / ih);
    gl.uniform2f(u.px, 1 / w, 1 / w); gl.uniform1f(u.lod, satin && v2 ? Math.max(0, Math.log2(w / 1920 * 40)) : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    lastImg = img; lastPlate = plateImg; lastKey = key;
    return canvas;
  }
  return { render, canvas };
}
