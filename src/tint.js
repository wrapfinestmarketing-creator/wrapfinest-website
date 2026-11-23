// Live window tint: darkens each window of the car by the film chosen for it, on the GPU.
// A frame is the car cut out of the bay (tools/build-tint.py): its alpha channel carries the cut-out (0 .. 0.5)
// and how much of a pixel is glass (0.5 .. 1). A small "zones" picture, one cell per frame, says which window
// a piece of glass belongs to (grey level = window number * 50): 1 windshield, 2 front side, 3 rear side,
// 4 rear window, 5 roof. A film lets part of the light through (its colour), and its surface still reflects.

const VS = 'attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }';
const FS = `
precision highp float;
varying vec2 uv;
uniform sampler2D tex;    // the car cut-out
uniform sampler2D plate;  // the bay
uniform sampler2D zones;  // which window is which
uniform vec4 rect;        // where the cut-out sits on the plate: x, y, w, h (0..1)
uniform vec4 cell;        // this frame's cell in the zones picture: x, y, w, h (0..1)
uniform vec3 film[5];     // what each window's film lets through (1 = bare glass)
void main() {
  vec2 cu = (uv - rect.xy) / rect.zw;
  vec4 f = texture2D(tex, cu);
  float inside = step(0.0, cu.x) * step(cu.x, 1.0) * step(0.0, cu.y) * step(cu.y, 1.0);
  vec3 c = mix(texture2D(plate, uv).rgb, f.rgb, clamp(f.a * 2.0, 0.0, 1.0) * inside);
  float g = clamp(f.a * 2.0 - 1.0, 0.0, 1.0) * inside;
  if (g < 0.004) { gl_FragColor = vec4(c, 1.0); return; }
  float id = floor(texture2D(zones, cell.xy + clamp(cu, 0.002, 0.998) * cell.zw).r * 5.1 + 0.5);
  if (id < 0.5) { gl_FragColor = vec4(c, 1.0); return; }
  vec3 t = id < 1.5 ? film[0] : id < 2.5 ? film[1] : id < 3.5 ? film[2] : id < 4.5 ? film[3] : film[4];
  // what is behind the glass dims; the bright reflections on its surface stay, more so the darker the film
  float lum = dot(f.rgb, vec3(0.299, 0.587, 0.114)), dark = 1.0 - dot(t, vec3(0.3333));
  vec3 o = f.rgb * t + dark * (0.2 * lum * lum * lum + 0.012) * vec3(0.9, 0.95, 1.0);
  gl_FragColor = vec4(mix(c, o, g), 1.0);
}`;

export function createTinter() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'default' });
  if (!gl) return null;
  let u = {}, tex, ptex, ztex, lastImg = null, lastPlate = null, lastZones = null, lastKey = '', lost = false;
  function texture(unit, filter) {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    return t;
  }
  function init() {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, 'p'); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    for (const n of ['tex', 'plate', 'zones', 'rect', 'cell', 'film']) u[n] = gl.getUniformLocation(prog, n);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    tex = texture(0, gl.LINEAR); ptex = texture(1, gl.LINEAR); ztex = texture(2, gl.NEAREST);     // window numbers must not be blended
    gl.uniform1i(u.tex, 0); gl.uniform1i(u.plate, 1); gl.uniform1i(u.zones, 2);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    lastImg = null; lastPlate = null; lastZones = null; lastKey = '';
  }
  try { init(); } catch (e) { console.warn('tint shader unavailable', e); return null; }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { try { init(); lost = false; } catch { /* stays lost */ } });

  /**
   * Returns a canvas showing cut-out `img` on `plateImg` with its windows tinted, or null while something is still loading.
   * films: { key, rgb: 15 numbers }, plateImg: undefined when the frame fills the whole picture,
   * grid: [columns, rows] of the zones picture, index: which cell is this frame's.
   */
  function render(img, films, plateImg, rect, zonesImg, grid, index) {
    if (lost || plateImg === null || !zonesImg) return null;
    const size = plateImg || img, w = size.naturalWidth || size.width, h = size.naturalHeight || size.height;
    const key = films.key + '|' + index;
    if (img === lastImg && (plateImg || null) === lastPlate && zonesImg === lastZones && key === lastKey) return canvas;
    try {
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); lastImg = null; lastPlate = null; }
      if (plateImg && plateImg !== lastPlate) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ptex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, plateImg); }
      if (zonesImg !== lastZones) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, ztex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, zonesImg); }
      if (img !== lastImg) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); }
      const r = plateImg ? rect : [0, 0, 1, 1];
      gl.uniform4f(u.rect, r[0], r[1], r[2], r[3]);
      gl.uniform4f(u.cell, (index % grid[0]) / grid[0], Math.floor(index / grid[0]) / grid[1], 1 / grid[0], 1 / grid[1]);
      gl.uniform3fv(u.film, films.rgb);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } catch (e) { console.warn('tint render failed', e); lost = true; return null; }
    lastImg = img; lastPlate = plateImg || null; lastZones = zonesImg; lastKey = key;
    return canvas;
  }
  return { render, canvas };
}
