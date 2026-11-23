# WrapFinest website

Scroll-driven cinematic site for WrapFinest (Bacolor, Pampanga): paint protection film, wraps, nano ceramic tint, Thermoshield X glass armor.

- `docs/CREATIVE-BRIEF.md` — approved brief and the only facts the site may claim
- `src/` — page logic (`main.js`, `story.js`, `data.js`) and the scroll film player (`film.js`)
- `public/film/` — frame sequences and stills that play as the visitor scrolls
- `public/media/`, `public/brand/` — real photos, videos, logos
- `tools/build-film.sh` — turns source clips and stills into web frames; `tools/snap.cjs` — screenshot checks
- `src/paint.js` — the Finish Studio 360: one set of car frames, repainted live on the GPU for every finish; `tools/build-spin.py` builds those frames from four quarter-turn clips (`tools/repaint.py` is the reference maths), `tools/spincheck.cjs` tests it

## Develop

```bash
npm install
npm run dev
```

## Deploy

Pushing to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).
