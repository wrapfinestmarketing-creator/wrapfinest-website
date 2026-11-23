# Reference implementation of the live paint shader (src/paint.js mirrors this math).
# A base frame shows the car in solid bright blue. A paint pixel is  d * BASE + s * white:
#   d = diffuse shade of the paint, s = clear-coat reflection. We swap BASE for the target paint.
import numpy as np, cv2
BASE = np.array([0.10, 0.40, 1.0], np.float32)          # r,g,b of the base paint at full shade
RATIO = (BASE[1] - BASE[0]) / (BASE[2] - BASE[0])

FINISHES = {
    # tint (r,g,b), diffuse gain, clear-coat gain, metallic (tinted reflection), satin (0..1)
    'gloss':  dict(c='#b00c1c', kd=0.92, ks=1.0, km=0.55, satin=0),
    'satin':  dict(c='#a30f1e', kd=0.95, ks=0.42, km=0.30, satin=1),
    'onyx':   dict(c='#050506', kd=1.0, ks=1.05, km=0.0, satin=0),
    'orange': dict(c='#ee6a12', kd=1.0, ks=1.0, km=0.1, satin=0),
    'blue':   dict(c='#1230b4', kd=1.0, ks=1.0, km=0.45, satin=0),
    'green':  dict(c='#0f4a2a', kd=1.0, ks=1.0, km=0.45, satin=0),
    'grey':   dict(c='#8b8f92', kd=1.0, ks=0.95, km=0.0, satin=0),
    'white':  dict(c='#f1f1ee', kd=1.0, ks=0.9, km=0.0, satin=0),
    'purple': dict(c='#3a1a66', kd=1.0, ks=1.0, km=0.5, satin=0),
    'yellow': dict(c='#f2cf14', kd=1.0, ks=1.0, km=0.05, satin=0),
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

def repaint(im, f):
    m, d, s = decompose(im)
    T = hexc(f['c'])
    if f['satin']:
        # satin: reflections spread out and dim, shading flattens a little
        k = max(3, int(im.shape[1] / 60) | 1)
        sb = cv2.GaussianBlur(s * m, (0, 0), k) / np.maximum(cv2.GaussianBlur(m, (0, 0), k), 1e-3)
        db = cv2.GaussianBlur(d * m, (0, 0), k / 3) / np.maximum(cv2.GaussianBlur(m, (0, 0), k / 3), 1e-3)
        s = sb * 0.85 + s * 0.15; d = db * 0.7 + d * 0.3
        d = 0.25 + d * 0.75
    Tm = T / max(T.max(), 1e-3)                              # brightened tint for metallic reflections
    out = d[..., None] * f['kd'] * T + s[..., None] * (f['ks'] * (1 - f['km']) + f['ks'] * f['km'] * (0.35 + 0.65 * Tm))
    return im * (1 - m[..., None]) + np.clip(out, 0, 1) * m[..., None]

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
