# WrapFinest website

Scroll-driven 3D site for WrapFinest (Bacolor, Pampanga): paint protection film, wraps, nano ceramic tint, Thermoshield X glass armor.

- `docs/CREATIVE-BRIEF.md` — approved brief and the only facts the site may claim
- `src/` — page logic (`main.js`, `story.js`, `data.js`) and the WebGL stage (`gl/`)
- `public/` — 3D model, photos, videos, logos
- `tools/` — offline pipeline for the car model and screenshot checks

## Develop

```bash
npm install
npm run dev
```

## Deploy

Pushing to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).
