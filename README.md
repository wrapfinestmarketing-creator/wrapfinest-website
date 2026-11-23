# WrapFinest website

Scroll-driven cinematic site for WrapFinest (Bacolor, Pampanga): paint protection film, wraps, nano ceramic tint, Thermoshield X glass armor.

- `docs/CREATIVE-BRIEF.md` — approved brief and the only facts the site may claim
- `src/` — page logic (`main.js`, `story.js`, `data.js`) and the scroll film player (`film.js`)
- `public/film/` — frame sequences and stills that play as the visitor scrolls
- `public/media/`, `public/brand/` — real photos, videos, logos
- `tools/build-film.sh` — turns source clips and stills into web frames; `tools/snap.cjs` — screenshot checks
- `src/tint.js` — the tint viewer: a 360 and a top view of the car with a film per glass, darkened live on the GPU; `tools/build-tint.py` builds the 360 frames (cut-out, glass matte, which window is which) from four quarter-turn clips, `tools/build-top.py` builds the top view, `tools/tintcheck.cjs` tests it
- `src/paint.js` — the Finish Studio 360: one set of car frames, repainted live on the GPU for every finish; `tools/build-spin.py` builds those frames from four quarter-turn clips (`tools/repaint.py` is the reference maths), `tools/spincheck.cjs` tests it and `tools/paintshot.cjs` saves the repainted frames for review

## Develop

```bash
npm install
npm run dev
```

## Deploy

Pushing to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).
