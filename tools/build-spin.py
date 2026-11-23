# Builds the 360 studio sequence for the website from four quarter-turn clips.
#   python3 tools/build-spin.py <site-dir> q1.mp4 q2.mp4 q3.mp4 q4.mp4 [--n 72] [--preview dir]
# The clips run side -> front -> other side -> rear -> side, each starting on the frame the last one ended on.
# Output (public/film/spin/{d,m}/): plate.webp = the empty-looking bay (steady background),
# NNNN.webp = the car cut out, cropped to the area the car ever covers. Its alpha channel carries two things:
#   0 .. 0.5  = how solid the cut-out is (soft edge, shadow on the floor)
#   0.5 .. 1  = solid, and how much of the pixel is paint (the paint matte)
# src/paint.js puts each cut-out back on the plate and repaints what the matte marks.
import sys, os, json, subprocess, tempfile, glob, argparse
from concurrent.futures import ThreadPoolExecutor
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from repaint import decompose

ap = argparse.ArgumentParser()
ap.add_argument('site'); ap.add_argument('clips', nargs=4)
ap.add_argument('--n', type=int, default=72); ap.add_argument('--preview', default='')
ap.add_argument('--wd', type=int, default=1920); ap.add_argument('--wm', type=int, default=1080)
a = ap.parse_args()
assert a.n % 4 == 0
per = a.n // 4

def frames_of(clip):
    d = tempfile.mkdtemp(prefix='spin_')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', clip, '-vsync', '0', f'{d}/%04d.png'], check=True)
    return sorted(glob.glob(f'{d}/*.png'))

small = lambda im: cv2.resize(im, (480, 270), interpolation=cv2.INTER_AREA).astype(np.float32)

# ---- pick evenly turned frames: drop the frames where the car is still at each end, then space the rest evenly
picked = []
for qi, clip in enumerate(a.clips):
    fs = frames_of(clip)
    sm = [small(cv2.imread(f))[70:230] for f in fs]
    mot = np.array([np.abs(sm[i + 1] - sm[i]).mean() for i in range(len(sm) - 1)])
    thr = 0.3 * np.median(mot)
    moving = np.where(mot > thr)[0]
    first, last = moving[0], moving[-1] + 1                    # frame `first` is the last still frame, `last` the first settled one
    idx = [int(round(first + (last - first) * k / per)) for k in range(per)]
    print(f'clip {qi + 1}: {len(fs)} frames, turning from {first} to {last}, step {(last - first) / per:.2f}')
    picked += [fs[i] for i in idx]
print('frames', len(picked))

W, H = 1920, 1080
load = lambda f: cv2.resize(cv2.imread(f), (W, H), interpolation=cv2.INTER_AREA) if cv2.imread(f).shape[1] != W else cv2.imread(f)
imgs = [load(f) for f in picked]

# ---- steady background: per-pixel median over the frames in which the car is somewhere else
def rough(im):                                                   # generous car region from the blue paint alone
    s = 0.25; sw, sh = int(W * s), int(H * s)
    m, d, _ = decompose(cv2.resize(im, (sw, sh), interpolation=cv2.INTER_AREA)[..., ::-1].astype(np.float32) / 255)
    k = ((m > 0.5) & (d > 0.3)).astype(np.uint8); k[int(sh * 0.8):] = 0
    k = cv2.morphologyEx(k, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    hull = cv2.convexHull(np.argwhere(k > 0)[:, ::-1].astype(np.int32))
    r = np.zeros((sh, sw), np.uint8); cv2.fillConvexPoly(r, hull, 1)
    r = cv2.dilate(r, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)))
    r = np.maximum(r, cv2.dilate(r, np.ones((int(sh * 0.16), 1), np.uint8), anchor=(0, 0)))
    return cv2.resize(r, (W, H), interpolation=cv2.INTER_NEAREST).astype(bool)
sub = imgs[::2]; covered = np.stack([rough(im) for im in sub])
plate = np.zeros((H, W, 3), np.uint8)
for r0 in range(0, H, 90):
    blk = np.stack([im[r0:r0 + 90] for im in sub]).astype(np.float32)
    cv_ = covered[:, r0:r0 + 90]
    free = np.where(cv_[..., None], np.nan, blk)
    with np.errstate(all='ignore'):
        med = np.nanmedian(free, axis=0)
    plain = np.median(blk, axis=0)
    plate[r0:r0 + 90] = np.where(np.isnan(med), plain, med).astype(np.uint8)
never = covered.all(0)                                           # always behind the car: no background known there

# ---- only the paint may be blue: the clips give greys, glass and the floor a faint blue cast, which is
# clipped back to neutral everywhere outside the paint matte
def unblue(im, keep=None):
    b = im[..., 0]; lim = np.maximum(im[..., 1], im[..., 2]).astype(np.int16) - 6       # a touch below neutral, so compression noise cannot bring blue back
    lim = np.clip(lim, 0, 255).astype(np.uint8)
    nb = np.minimum(b, lim) if keep is None else np.where(keep, b, np.minimum(b, lim))
    out = im.copy(); out[..., 0] = nb; return out
plate = unblue(plate)

# ---- paint matte: which pixels of the car are paint. The clearly blue pixels are certain. A reflection can wash
# the blue out completely, so bright patches are added when paint is what they border; patches that border glass
# or trim stay out, and so do the lamps (large patches of pure white) and anything warm (tail-lights, calipers).
def paint_matte(im, sil):
    f = im[..., ::-1].astype(np.float32) / 255
    m, d, _ = decompose(f)
    car = cv2.resize(sil, (W, H), interpolation=cv2.INTER_NEAREST)
    near = cv2.dilate(car, np.ones((9, 9), np.uint8)).astype(bool); car = car.astype(bool)
    core = ((m > 0.5) & (d > 0.22) & near).astype(np.uint8)
    core = cv2.morphologyEx(core, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(core)
    area = st[:, cv2.CC_STAT_AREA]; big = area[1:].max()
    md = np.bincount(lab.ravel(), weights=d.ravel(), minlength=n) / np.maximum(area, 1)
    drop = (area < 0.0002 * big) | ((md < 0.5) & (area < 0.5 * big)); drop[0] = False      # specks; the car mirrored in the floor
    core = (core > 0) & ~drop[lab]
    mx, mn = f.max(-1), f.min(-1)
    bright = car & ~core & (mx > 0.5) & ~(f[..., 0] > f[..., 2] + 0.10)
    neutral = bright & (mn > 0.8) & (mx - mn < 0.06)
    n, lab, st, _ = cv2.connectedComponentsWithStats(neutral.astype(np.uint8))
    lampc = st[:, cv2.CC_STAT_AREA] > 2600; lampc[0] = False
    lamp = cv2.dilate(lampc[lab].astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    cand = bright & ~lamp
    # solid patches: paint if paint is what they border (inside the car)
    solid = cv2.morphologyEx(cand.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid)
    labd = cv2.dilate(lab.astype(np.float32), np.ones((7, 7), np.uint8)).astype(np.int32)
    ring = (labd > 0) & (lab == 0) & car & ~cand
    frac = np.bincount(labd[ring & core], minlength=n) / np.maximum(np.bincount(labd[ring], minlength=n), 1)
    ok = (frac > 0.6) | ((frac > 0.4) & (st[:, cv2.CC_STAT_AREA] < 500)); ok[0] = False
    P = core | ok[lab]
    # thin leftovers (rims of those patches, fine lines): paint if most of what is around them is paint
    ref = (car & ~(cand & ~P)).astype(np.float32)
    fr = cv2.blur(P.astype(np.float32), (13, 13)) / np.maximum(cv2.blur(ref, (13, 13)), 1e-3)
    P = (P | (cand & ~P & (fr > 0.55))).astype(np.uint8)
    # one pixel wider: an edge pixel is paint mixed with its neighbour, and the repaint handles that mix correctly
    P = cv2.dilate(P, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    return cv2.GaussianBlur(P.astype(np.float32), (0, 0), 0.8)

# ---- car silhouette per frame -> soft alpha
def silhouette(im):
    s = 0.5; sw, sh = int(W * s), int(H * s)
    a_ = cv2.resize(im, (sw, sh), interpolation=cv2.INTER_AREA); p_ = cv2.resize(plate, (sw, sh), interpolation=cv2.INTER_AREA)
    m, d, _ = decompose(a_[..., ::-1].astype(np.float32) / 255)
    blue = (m > 0.5) & (d > 0.3)
    diff = np.abs(a_.astype(np.int16) - p_).max(-1) > 34
    k = (blue | diff).astype(np.uint8)
    k |= cv2.resize(never.astype(np.uint8), (sw, sh), interpolation=cv2.INTER_NEAREST)
    k[: int(sh * 0.22)] = 0; k[int(sh * 0.86):] = 0              # the car never reaches the ceiling or the near floor
    k = cv2.morphologyEx(k, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    k = cv2.morphologyEx(k, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(k)
    core = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); k = (lab == core).astype(np.uint8)
    ff = k.copy(); cv2.floodFill(ff, np.zeros((sh + 2, sw + 2), np.uint8), (0, 0), 1); k = k | (1 - ff)   # fill holes (glass, wheels)
    k = cv2.morphologyEx(k, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    return k

def alpha_of(k):
    sh, sw = k.shape
    body = cv2.dilate(k, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    ground = cv2.dilate(k, np.ones((int(sh * 0.11), 1), np.uint8), anchor=(0, 0))       # reach below the car for its shadow
    ground = cv2.dilate(ground, np.ones((1, 15), np.uint8))
    al = np.maximum(body, ground).astype(np.float32)
    al = cv2.GaussianBlur(al, (0, 0), 5)
    al = np.clip((al - 0.08) / 0.84, 0, 1)
    return cv2.resize(al, (W, H), interpolation=cv2.INTER_LINEAR)

sils = [silhouette(im) for im in imgs]
mattes = [paint_matte(im, k) for im, k in zip(imgs, sils)]
imgs = [unblue(im, cv2.dilate((P > 0.02).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)) for im, P in zip(imgs, mattes)]
alphas = [alpha_of(k) for k in sils]
union = np.max(np.stack([al > 0.004 for al in alphas]), axis=0)
ys, xs = np.where(union)
pad = 8
x0, x1 = max(0, xs.min() - pad) // 16 * 16, min(W, -(-(xs.max() + pad) // 16) * 16)
y0, y1 = max(0, ys.min() - pad) // 16 * 16, min(H, -(-(ys.max() + pad) // 16) * 16)
print('crop', x0, y0, x1, y1, '->', x1 - x0, 'x', y1 - y0)

# ---- write
out = os.path.join(a.site, 'public/film/spin')
for v, w, q, qp in (('d', a.wd, 80, 84), ('m', a.wm, 72, 80)):
    od = os.path.join(out, v); os.makedirs(od, exist_ok=True)
    for f in glob.glob(od + '/*.webp'): os.remove(f)
    sc = w / W
    pl = Image.fromarray(plate[..., ::-1]).resize((w, round(H * sc)), Image.LANCZOS)
    pl.save(f'{od}/plate.webp', quality=qp, method=6)
    total = 0
    size = (round((x1 - x0) * sc), round((y1 - y0) * sc))
    def save(i):
        code = np.clip(alphas[i], 0, 1) * (0.5 + 0.5 * mattes[i])     # see the header: cut-out below 0.5, paint matte above
        rgb = Image.fromarray(imgs[i][y0:y1, x0:x1, ::-1]).resize(size, Image.LANCZOS)
        ac = cv2.resize(code[y0:y1, x0:x1], size, interpolation=cv2.INTER_AREA)           # no overshoot: the two halves must not bleed into each other
        pi = Image.merge('RGBA', (*rgb.split(), Image.fromarray((ac * 255 + 0.5).astype(np.uint8))))
        fn = f'{od}/{i + 1:04d}.webp'; pi.save(fn, quality=q, method=6, alpha_quality=100); return os.path.getsize(fn)
    with ThreadPoolExecutor(4) as ex: total = sum(ex.map(save, range(len(imgs))))
    print(v, 'plate', os.path.getsize(f'{od}/plate.webp') // 1024, 'KB; frames', total // 1024, 'KB total,', total // 1024 // len(imgs), 'KB each')

mf = os.path.join(a.site, 'src/film-manifest.json'); man = json.load(open(mf))
man['seqs']['spin'] = {'n': len(imgs), 'plate': 1, 'rect': [round(x0 / W, 5), round(y0 / H, 5), round((x1 - x0) / W, 5), round((y1 - y0) / H, 5)]}
json.dump(man, open(mf, 'w'), separators=(',', ':'))

if a.preview:
    os.makedirs(a.preview, exist_ok=True)
    cv2.imwrite(f'{a.preview}/plate.jpg', cv2.resize(plate, (1280, 720)))
    tiles = []
    for i in range(0, len(imgs), max(1, len(imgs) // 12)):
        al = alphas[i][..., None]; comp = imgs[i] * al + plate * (1 - al)
        vis = np.hstack([cv2.resize(comp.astype(np.uint8), (640, 360)), cv2.resize((np.dstack([alphas[i]] * 3) * 255).astype(np.uint8), (640, 360))])
        tiles.append(vis)
    tiles = tiles[:12]
    cv2.imwrite(f'{a.preview}/mattes.jpg', np.vstack([np.hstack(tiles[r * 2:r * 2 + 2]) for r in range(len(tiles) // 2)]), [cv2.IMWRITE_JPEG_QUALITY, 82])
    # the composited turn as a clip, to judge smoothness
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', '24', '-i', '-', '-vf', 'scale=960:-2', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', f'{a.preview}/turn.mp4'], stdin=subprocess.PIPE)
    for im, al in zip(imgs, alphas): ff.stdin.write((im * al[..., None] + plate * (1 - al[..., None])).astype(np.uint8).tobytes())
    ff.stdin.close(); ff.wait()
