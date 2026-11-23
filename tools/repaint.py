# Reference implementation of the live paint shader (src/paint.js mirrors this math).
# A base frame shows the car in solid bright blue. A paint pixel is  d * BASE + s * white:
#   d = diffuse shade of the paint, s = clear-coat reflection. We swap BASE for the target paint.
# decompose() is the colour classifier that tools/build-spin.py starts the paint matte from;
# repaint() is the repaint itself.
import numpy as np, cv2
BASE = np.array([0.10, 0.40, 1.0], np.float32)          # r,g,b of the base paint at full shade
RATIO = (BASE[1] - BASE[0]) / (BASE[2] - BASE[0])

FINISHES = {
    # tint (r,g,b), diffuse gain, clear-coat gain, metallic (tinted reflection), satin (0..1)
    'gloss':  dict(c='#b00c1c', kd=0.92, ks=1.0, km=0.55, satin=0),
    'satin':  dict(c='#c4161f', kd=0.95, ks=1.0, km=0.55, satin=1),
    'onyx':   dict(c='#050506', kd=1.0, ks=1.05, km=0.0, satin=0),
    'orange': dict(c='#ee6a12', kd=1.0, ks=1.0, km=0.1, satin=0),
    'blue':   dict(c='#1230b4', kd=1.0, ks=1.0, km=0.45, satin=0),
    'green':  dict(c='#0f4a2a', kd=1.0, ks=1.0, km=0.45, satin=0),
    'grey':   dict(c='#8b8f92', kd=1.0, ks=0.9, km=0.0, satin=0),
    'white':  dict(c='#f6f6f3', kd=1.04, ks=0.45, km=0.0, lift=0.7, satin=0),
    'purple': dict(c='#3a1a66', kd=1.0, ks=1.0, km=0.5, satin=0),
    'yellow': dict(c='#f2cf14', kd=1.0, ks=0.9, km=0.05, satin=0),
    'teal':   dict(c='#18a79c', kd=1.0, ks=1.0, km=0.15, satin=0),
}
hexc = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
ss = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b - a), 0, 1))

def decompose(im):
    """im: float rgb 0..1 -> mask m, diffuse d, clear-coat s"""
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx, mn = im.max(-1), im.min(-1); ch = mx - mn
    ratio = (g - r) / np.maximum(b - r, 1e-4)
    clip = ss(0.86, 0.97, b)                                   # clipped blue drifts to cyan under strong reflections
    t = np.clip((ratio - (0.66 + (1.03 - 0.66) * clip)) / ((0.84 + (1.10 - 0.84) * clip) - (0.66 + (1.03 - 0.66) * clip)), 0, 1)
    hue = ss(-0.02, 0.10, ratio) * (1 - t * t * (3 - 2 * t)) * ss(0.0, 0.02, b - np.maximum(r, g) + 0.012)
    sat = np.maximum(ss(0.16, 0.34, ch / np.maximum(mx, 1e-3)) * ss(0.03, 0.09, ch), ss(0.012, 0.04, ch) * ss(0.5, 0.62, mx))
    m = hue * sat
    d = ch / (1 - BASE.min()) * (1 - clip) + (g - r) / (BASE[1] - BASE[0]) * clip     # clipped blue: read the shade from green minus red
    s = np.clip(mn - d * BASE.min(), 0, 1)
    return m, d, s

def repaint(im, f, P=None):
    """im: float rgb 0..1, f: a finish from FINISHES, P: paint matte 0..1 (default: the classifier above).
    Same steps as the shader in src/paint.js; blur widths are for a 1920-wide frame."""
    if P is None: P = (decompose(im)[0] > 0.5).astype(np.float32)
    k = im.shape[1] / 1920
    G = lambda x, sig: cv2.GaussianBlur(x, (0, 0), sig * k)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    d = np.clip(np.maximum((b - r) / (BASE[2] - BASE[0]), (b - g) / (BASE[2] - BASE[1])), 0, 1)
    u = 1 - np.clip((b - 0.85) / 0.12, 0, 1)                 # blue not clipped: the shade can be trusted
    gcl = np.clip((g - 0.9) / 0.08, 0, 1); dd = np.maximum(d, 0.8)
    s0 = np.clip(np.minimum(r - BASE[0] * dd, (g - BASE[1] * dd) * (1 - gcl) + gcl), 0, 1)
    near = G(cv2.blur(s0 * P, (4, 4)), 5)                     # a reflection nearby: do not trust the shade there either
    kk = 1 - np.clip((near - 0.04) / 0.14, 0, 1)
    rel = P * u * kk
    w1 = G(rel, 12); d1 = G(rel * d, 12) / np.maximum(w1, 1e-4)
    d2 = (G(rel * d, 55) + 0.02 * 0.85) / (G(rel, 55) + 0.02)
    t = np.clip((w1 - 0.02) / 0.1, 0, 1); dfill = d1 * t + d2 * (1 - t)      # shade of the clean paint nearby
    d = dfill * (1 - u * kk) + d * u * kk
    s = np.clip(np.minimum(r - BASE[0] * d, (g - BASE[1] * d) * (1 - gcl) + gcl), 0, 1)
    if f.get('satin'):
        sA = G(s0 * P, 30) / np.maximum(G(P, 30), 1e-3); sB = G(s0 * P, 55) / np.maximum(G(P, 55), 1e-3)
        d = (0.25 * dfill + 0.75 * d2) * (0.74 + sB); s = sB + 0.04 * sA
    d = np.power(np.maximum(d, 0), f.get('lift', 1))
    T = hexc(f['c']); Tm = T / max(T.max(), 1e-3)             # brightened tint for metallic reflections
    out = d[..., None] * f['kd'] * T + s[..., None] * (f['ks'] * (1 - f['km']) + f['ks'] * f['km'] * (0.35 + 0.65 * Tm))
    return im * (1 - P[..., None]) + np.clip(out, 0, 1) * P[..., None]

if __name__ == '__main__':
    import sys
    from PIL import Image
    src, out = sys.argv[1], sys.argv[2]
    names = sys.argv[3:] or list(FINISHES)
    im = np.asarray(Image.open(src).convert('RGB').resize((1280, 720), Image.LANCZOS)).astype(np.float32) / 255
    tiles = [np.clip(repaint(im, FINISHES[n]) * 255 + 0.5, 0, 255).astype(np.uint8) for n in names]
    cols = 3 if len(tiles) > 4 else 2; rows = -(-len(tiles) // cols)
    sheet = Image.new('RGB', (cols * 640, rows * 360))
    for i, t in enumerate(tiles): sheet.paste(Image.fromarray(t).resize((640, 360), Image.LANCZOS), ((i % cols) * 640, (i // cols) * 360))
    sheet.save(out, quality=88)
