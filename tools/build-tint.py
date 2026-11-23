# Builds the 360 sequence for the tint viewer from four quarter-turn clips of the red car with clear glass.
#   python3 tools/build-tint.py <site-dir> q1.mp4 q2.mp4 q3.mp4 q4.mp4 [--n 72] [--preview dir] [--cache dir]
# The clips run side -> front -> other side -> rear -> side, each starting on the frame the last one ended on.
# Output in public/film/tspin/:
#   {d,m}/plate.webp  the bay without the car (steady background)
#   {d,m}/NNNN.webp   the car cut out. Alpha 0 .. 0.5 = how solid the cut-out is, 0.5 .. 1 = solid and how much
#                     of the pixel is glass (same layout as tools/build-spin.py, with glass in place of paint)
#   {d,m}/zones.webp  one small picture per frame, in a grid, saying which window a piece of glass belongs to
#                     (grey level = number * 50): 1 windshield, 2 front side, 3 rear side, 4 rear window
# --reverse 4 plays the fourth clip backwards (for a clip that was generated in the other direction).
# src/tint.js darkens each window by the film chosen for it.
import sys, os, json, subprocess, tempfile, glob, argparse, pickle
from concurrent.futures import ThreadPoolExecutor
import numpy as np, cv2
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('site'); ap.add_argument('clips', nargs=4)
ap.add_argument('--n', type=int, default=72); ap.add_argument('--preview', default=''); ap.add_argument('--cache', default='')
ap.add_argument('--reverse', default='')
ap.add_argument('--wd', type=int, default=1920); ap.add_argument('--wm', type=int, default=1080)
a = ap.parse_args()
per = a.n // 4
W, H = 1920, 1080
acc = np.maximum.accumulate
ell = lambda k: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))

def paint_of(im):                                                # the deep red body paint (not the orange floor tiles)
    f = im.astype(np.float32) / 255; b, g, r = f[..., 0], f[..., 1], f[..., 2]
    return (r > 0.16) & (g < 0.34 * r) & (b < 0.42 * r)
def body_of(im):                                                 # the paint in one piece, without specks and floor reflections
    p = cv2.morphologyEx(paint_of(im).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)); p[int(im.shape[0] * 0.66):] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(p)
    if n < 2: return p.astype(bool), (0, 0, 1, 1)
    j = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    ok = np.zeros(n, bool); ok[1:] = (st[1:, cv2.CC_STAT_AREA] > 0.002 * st[j, cv2.CC_STAT_AREA]) & (st[1:, 1] < st[j, 1] + st[j, 3])
    q = np.where(ok)[0]
    return ok[lab], (st[q, 0].min(), st[q, 1].min(), (st[q, 0] + st[q, 2]).max(), (st[q, 1] + st[q, 3]).max())

# ---------------- 1. pick frames that are evenly spaced in angle ----------------
# The clips ease in and out, so equal time steps are not equal turns. The width of the car on screen tells the
# angle: widest side-on, narrowest end-on, and in between close to the width of a turning ellipse.
cache = a.cache and os.path.join(a.cache, 'frames.pkl')
if cache and os.path.exists(cache):
    imgs = pickle.load(open(cache, 'rb'))
else:
    picked = []
    for qi, clip in enumerate(a.clips):
        d = tempfile.mkdtemp(prefix='tspin_')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', clip, '-vsync', '0', f'{d}/%04d.png'], check=True)
        fs = sorted(glob.glob(f'{d}/*.png'))
        if str(qi + 1) in a.reverse.split(','): fs = fs[::-1]
        w = []
        for f in fs:
            _, (x0, _, x1, _) = body_of(cv2.resize(cv2.imread(f), (960, 540), interpolation=cv2.INTER_AREA)); w.append(x1 - x0)
        w = cv2.GaussianBlur(np.array(w, np.float32)[None], (0, 0), 1.5)[0]
        lo, hi = min(w[:4].mean(), w[-4:].mean()), max(w[:4].mean(), w[-4:].mean())
        u = np.sqrt(np.clip((w ** 2 - lo ** 2) / (hi ** 2 - lo ** 2), 0, 1))           # |cos| of the angle away from side-on
        p = np.arccos(u) / (np.pi / 2)                                                  # 0 side-on .. 1 end-on
        if w[0] < w[-1]: p = 1 - p                                                      # this clip turns from end-on to side-on
        # near side-on and end-on the width hardly changes, so only the middle of the turn is measured; a smooth
        # ease curve fitted to that middle part gives the angle of every frame
        t = np.arange(len(fs), dtype=np.float32); mid = (p > 0.15) & (p < 0.8)
        ease = lambda x, b: x + b * (3 * x * x - 2 * x ** 3 - x)
        best = None
        for t0 in range(-12, 30, 2):
            for t1 in range(len(fs) - 30, len(fs) + 12, 2):
                x = np.clip((t - t0) / (t1 - t0), 0, 1)
                for b in (0, 0.25, 0.5, 0.75, 1):
                    e = float(((ease(x, b) - p)[mid] ** 2).sum())
                    if best is None or e < best[0]: best = (e, t0, t1, b)
        _, t0, t1, b = best
        fit = ease(np.clip((t - t0) / (t1 - t0), 0, 1), b); fit = (fit - fit[0]) / (fit[-1] - fit[0])
        idx = [int(np.argmin(np.abs(fit - k / per))) for k in range(per)]
        print(f'clip {qi + 1}: {len(fs)} frames, turn fitted from {t0} to {t1}, ease {b}, picked', idx)
        picked += [fs[i] for i in idx]
    def load(f):
        im = cv2.imread(f); return im if im.shape[1] == W else cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA)
    imgs = [load(f) for f in picked]
    if cache: os.makedirs(a.cache, exist_ok=True); pickle.dump(imgs, open(cache, 'wb'))
N = len(imgs); print('frames', N)
bodies = [body_of(im) for im in imgs]
boxes = np.array([b[1] for b in bodies], np.float32)

# ---------------- 2. steady background ----------------
# Per-pixel median over the frames in which the car is somewhere else. "Somewhere else" needs a guess of where the
# car is: its paint, whatever lies between paint in a row or a column, some margin, and the floor under it.
def guess(i):
    p = bodies[i][0]
    k = ((acc(p, axis=1) & acc(p[:, ::-1], axis=1)[:, ::-1]) | (acc(p, axis=0) & acc(p[::-1], axis=0)[::-1])).astype(np.uint8)
    k = cv2.dilate(k, ell(31))
    return np.maximum(k, cv2.dilate(k, np.ones((150, 1), np.uint8), anchor=(0, 0))).astype(bool)
cov = np.stack([guess(i) for i in range(N)])
plate = np.zeros((H, W, 3), np.uint8)
for r0 in range(0, H, 60):
    blk = np.stack([im[r0:r0 + 60] for im in imgs]).astype(np.float32)
    free = np.where(cov[:, r0:r0 + 60][..., None], np.nan, blk)
    with np.errstate(all='ignore'):
        import warnings; warnings.simplefilter('ignore'); med = np.nanmedian(free, axis=0)
    plate[r0:r0 + 60] = np.where(np.isnan(med), np.median(blk, axis=0), med).astype(np.uint8)
valid = (~cov).sum(0) >= 3                                       # elsewhere the car is always in the way: no background known
del cov
# The floor under and around the car is never seen without the car, so no clean background exists there; the
# frames themselves are used there instead (fully solid cut-out), with a soft edge into the plate.
WALL = 660
unknown = ~valid; unknown[:WALL - 40] = False
unknown = cv2.dilate(unknown.astype(np.uint8), ell(31))
solid_floor = np.clip(cv2.GaussianBlur(unknown.astype(np.float32), (0, 0), 10) * 1.6 - 0.3, 0, 1)
# Behind the car the back wall is upright light panels on a dark wall, the same from top to bottom, so the wall just
# above the hidden area is carried down into it. That is enough to find the car's outline around the windows.
for x in range(W):                                               # the panels end just below row WALL
    bad = np.where(~valid[:WALL, x])[0]
    if not len(bad): continue
    y0 = bad[0]
    if y0 < 48: continue
    plate[y0:WALL, x] = np.median(plate[y0 - 40:y0 - 8, x].astype(np.float32), axis=0)
    valid[y0:WALL, x] = True

# ---------------- 3. per frame: cut-out, paint, glass ----------------
def cutout(im):                                                  # generous: whatever differs from the bay, and everything where the bay is unknown
    k = ((((np.abs(im.astype(np.int16) - plate).max(-1) > 30) | paint_of(im)) & valid) | ~valid).astype(np.uint8)
    k[: int(H * 0.15)] = 0; k[int(H * 0.86):] = 0
    k = cv2.morphologyEx(k, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    k = cv2.morphologyEx(k, cv2.MORPH_CLOSE, ell(21))
    n, lab, st, _ = cv2.connectedComponentsWithStats(k)
    k = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    ff = k.copy(); cv2.floodFill(ff, np.zeros((H + 2, W + 2), np.uint8), (0, 0), 1); k = k | (1 - ff)
    return cv2.morphologyEx(k, cv2.MORPH_OPEN, ell(9))
def paint_matte(im, roi):                                        # paint including the reflections on it (bright patches that paint surrounds)
    f = im.astype(np.float32) / 255
    core = cv2.morphologyEx((paint_of(im) & roi).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    cand = roi & ~core & (f.max(-1) > 0.45)
    solid = cv2.morphologyEx(cand.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid)
    labd = cv2.dilate(lab.astype(np.float32), np.ones((7, 7), np.uint8)).astype(np.int32)
    ring = (labd > 0) & (lab == 0) & roi & ~cand
    frac = np.bincount(labd[ring & core], minlength=n) / np.maximum(np.bincount(labd[ring], minlength=n), 1)
    ok = frac > 0.6; ok[0] = False
    P = core | ok[lab]
    ref = (roi & ~(cand & ~P)).astype(np.float32)
    fr = cv2.blur(P.astype(np.float32), (13, 13)) / np.maximum(cv2.blur(ref, (13, 13)), 1e-3)
    return P | (cand & ~P & (fr > 0.55))
def glass_of(i, cut):
    im = imgs[i]; x0, y0, x1, y1 = boxes[i].astype(int)
    roi = np.zeros((H, W), bool); roi[max(0, y0 - 30):y1 + 60, max(0, x0 - 40):x1 + 40] = True
    P = paint_matte(im, roi)
    rows = np.where(cut.any(1))[0]; top = rows.min(); bot = np.percentile(np.where(cut > 0)[0], 99.5)
    belt = int(top + 0.43 * (bot - top))                         # glass sits in the upper part of the car; lamps and wheels below
    g = (cut > 0) & ~cv2.dilate(P.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    g[belt:] = False
    g = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    # small dark pieces are not windows: mirror caps, the black roof seen edge-on, trim
    lum = im.astype(np.float32).mean(-1) / 255
    n, lab, st, _ = cv2.connectedComponentsWithStats(g)
    if n > 1:
        big = st[1:, cv2.CC_STAT_AREA].max(); drop = np.zeros(n, bool)
        for j in range(1, n):
            ml = np.median(lum[lab == j]); ar = st[j, cv2.CC_STAT_AREA]
            if (ar < 0.25 * big and ml < 0.17) or (ar < 0.06 * big and ml < 0.27): drop[j] = True
        g[drop[lab]] = 0
    return g.astype(bool)

# ---------------- 4. which window is which ----------------
# A simple turntable model says where each window should be on screen at a given angle; every piece of glass takes
# the name of the nearest one. Front and rear side windows are one piece (the pillar between them is black), so that
# piece is cut at the pillar: near where the model expects it, exactly where the darkest upright band is.
LEN = 4.98                                                       # car length in metres
CX = float((boxes[0, 0] + boxes[0, 2] + boxes[N // 2, 0] + boxes[N // 2, 2]) / 4)
SC = float(((boxes[0, 2] - boxes[0, 0]) + (boxes[N // 2, 2] - boxes[N // 2, 0])) / 2) / LEN
KAPPA = 0.10                                                     # perspective: nearer parts look this much bigger per metre
def zones_of(i, g):
    th = 2 * np.pi * i / N; c, sn = np.cos(th), np.sin(th)
    proj = lambda X, Y: CX + SC * (-X * c + Y * sn) * (1 + KAPPA * (X * sn + Y * c))
    side = 1 if c > 0 else -1
    nose_left = c > 0                                            # the nose is on the left of the picture while cos > 0
    lum = imgs[i].astype(np.float32).mean(-1) / 255
    xx = np.arange(W)[None, :]; yy = np.arange(H)[:, None]
    z = np.zeros((H, W), np.uint8)                               # 1 windshield, 2 front side, 3 rear side, 4 rear window
    ys = np.where(g.any(1))[0]
    if not len(ys): return z, g
    top, belt = ys.min(), ys.max()
    def pillar(xb_, xt_, span=70):
        """a slanted line from the window base (xb_ at the belt) to the roof (xt_ at the top), moved sideways to sit on the darkest band of the glass"""
        rows = np.arange(top, belt + 1); best = (-1, 0)
        for d in range(-span, span + 1, 3):
            xl = np.round(xb_ + (xt_ - xb_) * (belt - rows) / max(belt - top, 1)).astype(int) + d
            ok = (xl >= 0) & (xl < W); r, x = rows[ok], xl[ok]
            on = g[r, x]
            if on.sum() < 10: continue
            score = (lum[r, x][on] < 0.17).mean() * min(1, on.sum() / (0.4 * len(rows)))
            if score > best[0]: best = (score, d)
        d = best[1]
        return lambda: xb_ + d + (xt_ - xb_) * (belt - yy) / max(belt - top, 1)
    def beyond(line, towards_nose):
        x_line = line()
        return (xx < x_line) if (towards_nose == nose_left) else (xx > x_line)
    if sn > 0.15 and abs(c) > 0.15:
        # front corner: the near A-pillar parts the windshield from the side windows, the B-pillar the two side windows
        a_line = pillar(proj(0.95, side * 0.8), proj(0.2, side * 0.64))
        ws = beyond(a_line, True) & g; z[ws] = 1
        b_line = pillar(proj(-0.26, side * 0.84), proj(-0.32, side * 0.7))
        rest = g & ~ws
        z[rest & beyond(b_line, True)] = 2; z[rest & ~beyond(b_line, True)] = 3
        if (z == 2).sum() < 0.35 * (z == 3).sum(): z[z == 3] = 2      # near end-on only the front door glass shows next to the windshield
        return z, g
    if sn < -0.15 and abs(c) > 0.15:
        # rear corner: the C-pillar (body coloured) parts the rear window from the rear side window, the B-pillar the side windows
        c_line = pillar(proj(-1.95, side * 0.8), proj(-1.55, side * 0.62))
        rw = beyond(c_line, False) & g; z[rw] = 4
        b_line = pillar(proj(-0.26, side * 0.84), proj(-0.32, side * 0.7))
        rest = g & ~rw
        z[rest & beyond(b_line, True)] = 2; z[rest & ~beyond(b_line, True)] = 3
        if (z == 3).sum() < 0.35 * (z == 2).sum(): z[z == 2] = 3      # near end-on only the rear door glass shows next to the rear window
        if (z == 4).sum() < 0.2 * ((z == 2) | (z == 3)).sum(): z[z == 4] = 3   # near side-on that is only the small quarter glass, tinted with the rear doors
        return z, g
    if abs(c) > 0.15:
        # side on: only the side windows, parted by the B-pillar
        b_line = pillar(proj(-0.26, side * 0.84), proj(-0.32, side * 0.7))
        z[g & beyond(b_line, True)] = 2; z[g & ~beyond(b_line, True)] = 3
        return z, g
    # straight at the nose or the tail: one big window, with a sliver of side glass at each edge
    big = 4 if sn < 0 else 1
    z[g] = big
    if g.any():
        xs = np.where(g.any(0))[0]; w = xs.max() - xs.min()
        edge = (xx < xs.min() + 0.07 * w) | (xx > xs.max() - 0.07 * w)
        n, lab, st, _ = cv2.connectedComponentsWithStats((g & edge).astype(np.uint8))
        for j in range(1, n):
            if st[j, cv2.CC_STAT_HEIGHT] > 0.5 * (belt - top): z[lab == j] = 2 if big == 1 else 3
    return z, g

def one(i):
    cut = cutout(imgs[i]); z, g = zones_of(i, glass_of(i, cut)); return cut, g, z
with ThreadPoolExecutor(4) as ex: res = list(ex.map(one, range(N)))
cuts, glasses, zones = [r[0] for r in res], [r[1] for r in res], [r[2] for r in res]

if a.preview:
    os.makedirs(a.preview, exist_ok=True); cv2.imwrite(f'{a.preview}/plate.jpg', cv2.resize(plate, (1280, 720)))
    COL = {1: (60, 60, 255), 2: (60, 255, 60), 3: (255, 120, 40), 4: (40, 230, 255)}
    for s0 in range(0, N, 12):
        tiles = []
        for i in range(s0, min(N, s0 + 12)):
            ov = imgs[i].copy()
            for k, col in COL.items(): ov[zones[i] == k] = (0.45 * ov[zones[i] == k] + 0.55 * np.array(col)).astype(np.uint8)
            un = glasses[i] & (zones[i] == 0); ov[un] = (0.4 * ov[un] + 0.6 * np.array((255, 0, 255))).astype(np.uint8)
            cnt, _ = cv2.findContours(cuts[i], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); cv2.drawContours(ov, cnt, -1, (0, 255, 0), 1)
            t = cv2.resize(ov[300:640, 150:1770], (900, 189)); cv2.putText(t, str(i), (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2); tiles.append(t)
        while len(tiles) % 2: tiles.append(np.zeros_like(tiles[0]))
        cv2.imwrite(f'{a.preview}/zones{s0 // 12}.jpg', np.vstack([np.hstack(tiles[k:k + 2]) for k in range(0, len(tiles), 2)]), [cv2.IMWRITE_JPEG_QUALITY, 86])
if os.environ.get('STAGE') == 'zones': sys.exit()

# ---------------- 5. write ----------------
def alpha_of(k):
    body = cv2.dilate(k, ell(25))
    ground = cv2.dilate(cv2.dilate(k, np.ones((120, 1), np.uint8), anchor=(0, 0)), np.ones((1, 31), np.uint8))   # reach below the car for its shadow
    al = cv2.GaussianBlur(np.maximum(body, ground).astype(np.float32), (0, 0), 10)
    return np.clip((al - 0.08) / 0.84, 0, 1)
# The floor around the car: its shadow and reflection move with the car, and no frame shows that floor without the
# car, so the plate cannot be trusted there. Every frame keeps its own floor across the whole area the car ever
# stands on, down past the tyres, blending into the plate only at the far edges.
foot = np.max(np.stack(cuts), axis=0).astype(np.uint8); foot[:WALL - 60] = 0
foot = cv2.dilate(foot, np.ones((1, 161), np.uint8))
foot = np.maximum(foot, cv2.dilate(foot, np.ones((160, 1), np.uint8), anchor=(0, 0)))
floor = np.clip(cv2.GaussianBlur(foot.astype(np.float32), (0, 0), 22) * 1.5 - 0.25, 0, 1)
floor[:WALL - 60] = 0; floor = cv2.GaussianBlur(floor, (0, 0), 6)
alphas = [np.maximum(np.maximum(alpha_of(k), solid_floor), floor) for k in cuts]
mattes = [cv2.GaussianBlur(g.astype(np.float32), (0, 0), 0.8) for g in glasses]
union = np.max(np.stack([al > 0.004 for al in alphas]), axis=0)
ys, xs = np.where(union); pad = 8
x0, x1 = max(0, xs.min() - pad) // 16 * 16, min(W, -(-(xs.max() + pad) // 16) * 16)
y0, y1 = max(0, ys.min() - pad) // 16 * 16, min(H, -(-(ys.max() + pad) // 16) * 16)
print('crop', x0, y0, x1, y1, '->', x1 - x0, 'x', y1 - y0)
out = os.path.join(a.site, 'public/film/tspin')
for v, w, q, qp in (('d', a.wd, 80, 84), ('m', a.wm, 72, 80)):
    od = os.path.join(out, v); os.makedirs(od, exist_ok=True)
    for f in glob.glob(od + '/*.webp'): os.remove(f)
    sc = w / W
    Image.fromarray(plate[..., ::-1]).resize((w, round(H * sc)), Image.LANCZOS).save(f'{od}/plate.webp', quality=qp, method=6)
    size = (round((x1 - x0) * sc), round((y1 - y0) * sc))
    def save(i):
        code = alphas[i] * (0.5 + 0.5 * mattes[i])
        rgb = Image.fromarray(imgs[i][y0:y1, x0:x1, ::-1]).resize(size, Image.LANCZOS)
        ac = cv2.resize(code[y0:y1, x0:x1], size, interpolation=cv2.INTER_AREA)
        pi = Image.merge('RGBA', (*rgb.split(), Image.fromarray((ac * 255 + 0.5).astype(np.uint8))))
        fn = f'{od}/{i + 1:04d}.webp'; pi.save(fn, quality=q, method=6, alpha_quality=100); return os.path.getsize(fn)
    with ThreadPoolExecutor(4) as ex: total = sum(ex.map(save, range(N)))
    print(v, 'plate', os.path.getsize(f'{od}/plate.webp') // 1024, 'KB; frames', total // 1024, 'KB total,', total // 1024 // N, 'KB each')
# zones: a quarter of the frame size per frame, a little wider than the glass (the glass matte in the frame draws the real edge)
cols = 9; rows = -(-N // cols)
zd = [cv2.dilate(z, np.ones((7, 7), np.uint8))[y0:y1, x0:x1] for z in zones]
for v, w in (('d', a.wd), ('m', a.wm)):
    cw, ch = round((x1 - x0) * w / W / 4), round((y1 - y0) * w / W / 4)
    atlas = np.zeros((rows * ch, cols * cw), np.uint8)
    for i in range(N): atlas[(i // cols) * ch:(i // cols + 1) * ch, (i % cols) * cw:(i % cols + 1) * cw] = cv2.resize(zd[i], (cw, ch), interpolation=cv2.INTER_NEAREST) * 50
    Image.fromarray(atlas, 'L').save(f'{out}/{v}/zones.webp', lossless=True, method=6)
    print(v, 'zones', atlas.shape[1], 'x', atlas.shape[0], os.path.getsize(f'{out}/{v}/zones.webp') // 1024, 'KB')
# where each window is in every frame (plate coordinates 0..1: centre x, centre y, width, height), for the zoom
def box(m):
    ys, xs = np.where(m)
    if len(xs) < 400: return 0
    xa, xb = np.percentile(xs, [3, 97]); ya, yb = np.percentile(ys, [3, 97])
    return [round((xa + xb) / 2 / W, 4), round((ya + yb) / 2 / H, 4), round((xb - xa) / W, 4), round((yb - ya) / H, 4)]
focus = [[box(z == k) for k in (1, 2, 3, 4)] for z in zones]
mf = os.path.join(a.site, 'src/film-manifest.json'); man = json.load(open(mf))
man['seqs']['tspin'] = {'n': N, 'plate': 1, 'rect': [round(x0 / W, 5), round(y0 / H, 5), round((x1 - x0) / W, 5), round((y1 - y0) / H, 5)], 'zones': [cols, rows], 'focus': focus}
json.dump(man, open(mf, 'w'), separators=(',', ':'))
