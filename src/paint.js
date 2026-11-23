// Live paint: repaints the car in a 360 frame on the GPU, so one set of frames serves every finish.
// A frame is the car cut out of the bay; it is first put back on the "plate" (the steady picture of the bay),
// which keeps the background perfectly still while the car turns. The frame's alpha channel carries both the
// cut-out (0 .. 0.5) and the paint matte (0.5 .. 1), see tools/build-spin.py.
// The frames show the car in a solid bright blue. A paint pixel is
//   d * BASE + s * white     (d = how lit the paint is, s = the clear-coat reflection on top)
// so we recover d and s per pixel and rebuild the pixel with the chosen paint.
// Under a strong reflection the blue is washed out and d cannot be read, so d is filled in there from the
// clean paint around it. That takes blurred copies of the frame, made in a few small passes (the buffers
// below); the same copies give the satin finish its soft, spread-out reflections.
// tools/repaint.py is the reference implementation of the same maths.

const VS = flip => `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * 0.5 + 0.5, ${flip ? '0.5 - p.y * 0.5' : 'p.y * 0.5 + 0.5'}); gl_Position = vec4(p, 0.0, 1.0); }`;
const COMMON = `
precision highp float;
varying vec2 uv;
const vec3 BASE = vec3(0.10, 0.40, 1.0);   // the paint of the source frames at full shade
const float D0 = 0.85;                    // its usual shade, used where nothing better is known
// -> x: shade d, y: reflection s (first estimate), z: 1 where blue is not clipped, so d can be trusted
vec3 split(vec3 c) {
  float d = clamp(max((c.b - c.r) / (BASE.b - BASE.r), (c.b - c.g) / (BASE.b - BASE.g)), 0.0, 1.0);
  float dd = max(d, 0.8), gcl = clamp((c.g - 0.9) / 0.08, 0.0, 1.0);
  float s = clamp(min(c.r - BASE.r * dd, mix(c.g - BASE.g * dd, 1.0, gcl)), 0.0, 1.0);
  return vec3(d, s, 1.0 - clamp((c.b - 0.85) / 0.12, 0.0, 1.0));
}
float matte(float a) { return clamp(a * 2.0 - 1.0, 0.0, 1.0); }
`;
// frame -> small buffer: (trusted shade, reflection, trust, matte), each weighted by the matte
const FS_SPLIT = COMMON + `
uniform sampler2D src; uniform vec2 off;
void main() {
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec4 f = texture2D(src, uv + (vec2(float(i), float(j)) * 2.0 - 1.0) * off);
    float P = matte(f.a); vec3 q = split(f.rgb);
    acc += vec4(P * q.z * q.x, P * q.y, P * q.z, P);
  }
  gl_FragColor = acc * 0.25;
}`;
const FS_BLUR = COMMON + `
uniform sampler2D src; uniform vec2 dir; uniform float sig;
void main() {
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = -4; i <= 4; i++) { float w = exp(-0.5 * float(i * i) / (sig * sig)); acc += texture2D(src, uv + dir * float(i)) * w; ws += w; }
  gl_FragColor = acc / ws;
}`;
// shade next to a reflection is not trusted either (video compression leaves halos there)
const FS_TRUST = COMMON + `
uniform sampler2D src, nearTex;
void main() {
  vec4 a = texture2D(src, uv);
  float k = 1.0 - clamp((texture2D(nearTex, uv).g - 0.04) / 0.14, 0.0, 1.0);
  gl_FragColor = vec4(a.r * k, a.g, a.b * k, a.a);
}`;
const FS_DOWN = COMMON + `
uniform sampler2D src; uniform vec2 off;
void main() {
  gl_FragColor = 0.25 * (texture2D(src, uv + off) + texture2D(src, uv - off) + texture2D(src, uv + vec2(off.x, -off.y)) + texture2D(src, uv + vec2(-off.x, off.y)));
}`;
const FS_FINAL = COMMON + `
uniform sampler2D tex;     // the car cut-out
uniform sampler2D plate;   // the bay
uniform sampler2D nearTex; // reflections, slightly blurred
uniform sampler2D fine;    // trusted shade, blurred a little
uniform sampler2D mid;     // ... more
uniform sampler2D wide;    // ... a lot
uniform vec4 rect;         // where the cut-out sits on the plate: x, y, w, h (0..1)
uniform vec3 tint;         // target paint colour
uniform vec4 k;            // diffuse gain, clear-coat gain, metallic amount, satin (0 or 1)
uniform float lift;        // < 1 brightens the shaded side of the paint
void main() {
  vec2 cu = (uv - rect.xy) / rect.zw;
  vec4 f = texture2D(tex, cu);
  float inside = step(0.0, cu.x) * step(cu.x, 1.0) * step(0.0, cu.y) * step(cu.y, 1.0);
  vec3 c = mix(texture2D(plate, uv).rgb, f.rgb, clamp(f.a * 2.0, 0.0, 1.0) * inside);
  float P = matte(f.a) * inside;
  if (P < 0.002) { gl_FragColor = vec4(c, 1.0); return; }
  vec3 q = split(f.rgb);
  vec4 a = texture2D(fine, cu), m1 = texture2D(mid, cu), m2 = texture2D(wide, cu);
  float kk = 1.0 - clamp((texture2D(nearTex, cu).g - 0.04) / 0.14, 0.0, 1.0);
  float d1 = a.r / max(a.b, 1e-4), d2 = (m2.r + 0.02 * D0) / (m2.b + 0.02);
  float dfill = mix(d2, d1, clamp((a.b - 0.02) / 0.1, 0.0, 1.0));   // shade of the clean paint nearby
  float d = mix(dfill, q.x, q.z * kk);
  float gcl = clamp((f.g - 0.9) / 0.08, 0.0, 1.0);
  float s = clamp(min(f.r - BASE.r * d, mix(f.g - BASE.g * d, 1.0, gcl)), 0.0, 1.0);
  if (k.w > 0.5) {
    // satin: the reflections spread out into a soft sheen, which also models the form of the body
    float sA = m1.g / max(m1.a, 1e-3), sB = m2.g / max(m2.a, 1e-3);
    d = mix(dfill, d2, 0.75) * (0.74 + sB);
    s = sB + 0.04 * sA;
  }
  d = pow(max(d, 0.0), lift);
  vec3 bright = tint / max(max(tint.r, max(tint.g, tint.b)), 1e-3);
  vec3 o = d * k.x * tint + s * k.y * mix(vec3(1.0), 0.35 + 0.65 * bright, k.z);
  gl_FragColor = vec4(mix(c, clamp(o, 0.0, 1.0), P), 1.0);
}`;

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export function createPainter() {
  const canvas = document.createElement('canvas');
  const opts = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'default' };
  let gl = canvas.getContext('webgl2', opts); const v2 = !!gl;
  if (!gl) gl = canvas.getContext('webgl', opts);
  if (!gl) return null;

  let P = {}, tex, ptex, bufs = null, bufKey = '', lastImg = null, lastPlate = null, lastKey = '', lost = false;
  function program(vs, fs, names) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(prog, 0, 'p'); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const u = {}; for (const n of names) u[n] = gl.getUniformLocation(prog, n);
    return { prog, u };
  }
  function texture(unit) {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return t;
  }
  // a small render target; half-float where the GPU can, as the buffers hold small weighted sums
  let fmt = null;
  function target(w, h) {
    const make = f => {
      const t = texture(7); gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, w, h, 0, gl.RGBA, f.type, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      if (!ok) { gl.deleteFramebuffer(fb); gl.deleteTexture(t); return null; }
      return { t, fb, w, h };
    };
    if (!fmt) {
      const byte = { internal: gl.RGBA, type: gl.UNSIGNED_BYTE }; let half = null;
      if (v2) { if (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')) half = { internal: gl.RGBA16F, type: gl.HALF_FLOAT }; }
      else { const e = gl.getExtension('OES_texture_half_float'); if (e && gl.getExtension('OES_texture_half_float_linear') && gl.getExtension('EXT_color_buffer_half_float')) half = { internal: gl.RGBA, type: e.HALF_FLOAT_OES }; }
      const probe = half && make(half);
      if (probe) { fmt = half; return probe; }
      fmt = byte;
    }
    return make(fmt);
  }
  function init() {
    P = {
      split: program(VS(false), FS_SPLIT, ['src', 'off']),
      blur: program(VS(false), FS_BLUR, ['src', 'dir', 'sig']),
      trust: program(VS(false), FS_TRUST, ['src', 'nearTex']),
      down: program(VS(false), FS_DOWN, ['src', 'off']),
      final: program(VS(true), FS_FINAL, ['tex', 'plate', 'nearTex', 'fine', 'mid', 'wide', 'rect', 'tint', 'k', 'lift']),
    };
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    tex = texture(0); ptex = texture(1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    fmt = null; bufs = null; bufKey = ''; lastImg = null; lastPlate = null; lastKey = '';
  }
  try { init(); } catch (e) { console.warn('paint shader unavailable', e); return null; }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { try { init(); lost = false; } catch { /* stays lost */ } });

  const bind = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };
  function pass(p, dst, textures, set) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null); gl.viewport(0, 0, dst ? dst.w : canvas.width, dst ? dst.h : canvas.height);
    gl.useProgram(p.prog);
    let i = 0; for (const [name, t] of Object.entries(textures)) { bind(i, t); gl.uniform1i(p.u[name], i); i++; }
    if (set) set(p.u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  // blur widths below are in pixels of a 1920-wide plate; a buffer texel is 4 of those (16 in the small buffers)
  function blur(src, tmp, dst, sigTexels) {
    const step = sigTexels > 2 ? 1.5 : 1, sig = sigTexels / step;
    pass(P.blur, tmp, { src: src.t }, u => { gl.uniform2f(u.dir, step / src.w, 0); gl.uniform1f(u.sig, sig); });
    pass(P.blur, dst, { src: tmp.t }, u => { gl.uniform2f(u.dir, 0, step / src.h); gl.uniform1f(u.sig, sig); });
  }
  function analyse(rect) {
    const qw = Math.max(8, Math.round(rect[2] * 480)), qh = Math.max(8, Math.round(rect[3] * 270)), key = qw + 'x' + qh;
    if (key !== bufKey) {
      const sw = Math.ceil(qw / 4), sh = Math.ceil(qh / 4);
      bufs = { a: target(qw, qh), b: target(qw, qh), c: target(qw, qh), d: target(qw, qh), e: target(sw, sh), f: target(sw, sh), g: target(sw, sh) };
      if (Object.values(bufs).some(b => !b)) throw new Error('no render target');
      bufKey = key;
    }
    const { a, b, c, d, e, f, g } = bufs;
    pass(P.split, a, { src: tex }, u => gl.uniform2f(u.off, 0.25 / qw, 0.25 / qh));
    blur(a, c, b, 1.25);                                                       // b: reflections nearby
    pass(P.trust, d, { src: a.t, nearTex: b.t });
    blur(d, c, a, 3);                                                          // a: fine (12 px)
    pass(P.down, e, { src: a.t }, u => gl.uniform2f(u.off, 1 / qw, 1 / qh));
    blur(e, f, g, 1.7);                                                        // g: mid (30 px)
    blur(g, f, e, 2.9);                                                        // e: wide (55 px)
  }

  /** Returns a canvas showing cut-out `img` on `plateImg` at `rect`, repainted with `paint`; null if the GPU is not available right now. */
  function render(img, paint, plateImg, rect) {
    if (lost || !plateImg) return null;
    const w = plateImg.naturalWidth || plateImg.width, h = plateImg.naturalHeight || plateImg.height;
    const key = paint.c + '|' + paint.kd + '|' + paint.ks + '|' + paint.km + '|' + (paint.lift || 1) + '|' + (paint.satin ? 1 : 0);
    if (img === lastImg && plateImg === lastPlate && key === lastKey) return canvas;
    try {
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; lastImg = null; lastPlate = null; }
      if (plateImg !== lastPlate) { bind(1, ptex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, plateImg); }
      if (img !== lastImg) { bind(0, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); analyse(rect); }
      const { a, b, e, g } = bufs;
      pass(P.final, null, { tex, plate: ptex, nearTex: b.t, fine: a.t, mid: g.t, wide: e.t }, u => {
        gl.uniform4f(u.rect, rect[0], rect[1], rect[2], rect[3]);
        gl.uniform3fv(u.tint, hex(paint.c)); gl.uniform4f(u.k, paint.kd, paint.ks, paint.km, paint.satin ? 1 : 0);
        gl.uniform1f(u.lift, paint.lift || 1);
      });
    } catch (e) { console.warn('paint render failed', e); lost = true; return null; }
    lastImg = img; lastPlate = plateImg; lastKey = key;
    return canvas;
  }
  return { render, canvas };
}
