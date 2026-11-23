# Top view for the tint viewer, in the same format as the 360 frames of tools/build-tint.py:
#   public/film/ttop/{d,m}/0001.webp  the picture (windshield header drawn in); alpha above 0.5 = glass
#   public/film/ttop/{d,m}/zones.webp which window is which (grey level = number * 50; 5 = roof)
#   python3 tools/build-top.py top.png <site-dir> [--preview file.jpg]
import sys, os, numpy as np, cv2
from PIL import Image
src, site = sys.argv[1], sys.argv[2]
W, H = 1920, 1080
im = cv2.resize(cv2.imread(src), (W, H), interpolation=cv2.INTER_AREA)
# the generated picture has one sheet of glass from the cowl to the first roof bar: draw the windshield header
hd = np.zeros((H, W), np.float32); cv2.rectangle(hd, (775, 350), (791, 730), 1, -1); hd = cv2.GaussianBlur(hd, (0, 0), 1.6)[..., None]
im = (im * (1 - hd) + np.array([14, 13, 13]) * hd).astype(np.uint8)
f = im[..., ::-1].astype(np.float32) / 255; r, g, b = f[..., 0], f[..., 1], f[..., 2]
red = cv2.dilate(((r > 0.25) & (r > 1.8 * np.maximum(g, b))).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
lum = f.mean(-1)
flip = lambda pts: [(x, H - y) for x, y in pts]
poly = {
    'w': [[(600, 312), (560, 360), (537, 450), (530, 540), (537, 630), (560, 720), (600, 770), (700, 737), (783, 723), (783, 357), (700, 343)]],
    'o': [[(784, 357), (990, 372), (1378, 372), (1378, 708), (990, 708), (784, 723)]],
    'k': [[(1438, 412), (1470, 398), (1600, 398), (1636, 416), (1646, 540), (1636, 664), (1600, 702), (1470, 702), (1438, 688)]],
    'f': [[(640, 300), (1005, 296), (1005, 368), (990, 366), (700, 338), (640, 318)]],
    'r': [[(1042, 296), (1480, 300), (1520, 335), (1400, 368), (1042, 368)]],
}
poly['f'].append(flip(poly['f'][0])); poly['r'].append(flip(poly['r'][0]))
num = {'w': 1, 'f': 2, 'r': 3, 'k': 4, 'o': 5}
ids = np.zeros((H, W), np.uint8)
for k, ps in poly.items():
    m = np.zeros((H, W), np.uint8)
    for p in ps: cv2.fillPoly(m, [np.array(p, np.int32)], 1)
    m = m.astype(bool) & ~red
    if k in 'fr': m &= lum < 0.72
    ids[m] = num[k]
matte = cv2.GaussianBlur((ids > 0).astype(np.float32), (0, 0), 1.0)
ids = np.maximum(ids, cv2.dilate(ids, np.ones((7, 7), np.uint8)) * (ids == 0))       # a little wider than the glass; the matte draws the edge
out = os.path.join(site, 'public/film/ttop')
for v, w in (('d', 1920), ('m', 1280)):
    od = os.path.join(out, v); os.makedirs(od, exist_ok=True)
    sz = (w, round(H * w / W))
    rgb = Image.fromarray(im[..., ::-1]).resize(sz, Image.LANCZOS)
    al = cv2.resize(0.5 + 0.5 * matte, sz, interpolation=cv2.INTER_AREA)               # the picture is solid everywhere (alpha >= 0.5); above that: glass
    Image.merge('RGBA', (*rgb.split(), Image.fromarray((al * 255 + 0.5).astype(np.uint8)))).save(f'{od}/0001.webp', quality=86, method=6, alpha_quality=100)
    Image.fromarray(cv2.resize(ids, (sz[0] // 4, sz[1] // 4), interpolation=cv2.INTER_NEAREST) * 50, 'L').save(f'{od}/zones.webp', lossless=True, method=6)
    print(v, os.path.getsize(f'{od}/0001.webp') // 1024, 'KB +', os.path.getsize(f'{od}/zones.webp') // 1024, 'KB')
import json
mf = os.path.join(site, 'src/film-manifest.json'); man = json.load(open(mf))
man['seqs']['ttop'] = {'n': 1, 'rect': [0, 0, 1, 1], 'zones': [1, 1]}
json.dump(man, open(mf, 'w'), separators=(',', ':'))
if '--preview' in sys.argv:
    COL = np.array([(0, 0, 0), (60, 60, 255), (60, 255, 60), (255, 120, 40), (40, 230, 255), (255, 60, 255)], np.float32)
    ov = np.where((ids > 0)[..., None], im * 0.45 + COL[ids] * 0.55, im).astype(np.uint8)
    cv2.imwrite(sys.argv[sys.argv.index('--preview') + 1], ov[230:860, 150:1790], [cv2.IMWRITE_JPEG_QUALITY, 88])
