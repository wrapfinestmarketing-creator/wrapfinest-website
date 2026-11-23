# WrapFinest website

Scroll-driven cinematic site for WrapFinest (Bacolor, Pampanga): paint protection film, wraps, nano ceramic tint, Thermoshield X glass armor.

- `docs/CREATIVE-BRIEF.md` — approved brief and the only facts the site may claim
- `src/` — page logic (`main.js`, `story.js`, `data.js`) and the scroll film player (`film.js`)
- `public/film/` — frame sequences and stills that play as the visitor scrolls
- `public/media/`, `public/brand/` — real photos, videos, logos
- `tools/build-film.sh` — turns source clips and stills into web frames; `tools/snap.cjs` — screenshot checks
- `src/tint.js` — the tint viewer: a 360 and a top view of the car with a film per glass, darkened live on the GPU; `tools/build-tint.py` builds the 360 frames (cut-out, glass matte, which window is which) from four quarter-turn clips, `tools/build-top.py` builds the top view, `tools/tintcheck.cjs` and `tools/zoomcheck.cjs` test it (SEC=armor tests the Thermoshield X configurator, which reuses the same viewer)
- `src/paint.js` — the Finish Studio 360: one set of car frames, repainted live on the GPU for every finish; `tools/build-spin.py` builds those frames from four quarter-turn clips (`tools/repaint.py` is the reference maths), `tools/spincheck.cjs` tests it and `tools/paintshot.cjs` saves the repainted frames for review

## Ad tracking

- `src/track.js`: the Meta Pixel (dataset "WrapFinest Website", 1137726062348177, ad account 288888353). It sends PageView, ViewContent per section, CustomizeProduct (finish, tint and Thermoshield X choices), AddToCart (accessories), Contact (phone, Messenger, email taps) and Lead (quote form). It also keeps the ad or link a visitor came from (utm tags, fbclid) and adds it to the quote email as "Came from". Off on localhost unless `?track`; `?notrack` turns it off anywhere.
- `functions/api/lead.js`: Cloudflare Pages Function that sends each quote request to Meta's Conversions API as well, with the same event id, so a lead counts even when the browser blocks the pixel. Needs the secret `META_CAPI_TOKEN` in Cloudflare Pages; `META_TEST_CODE` sends to Meta's Test events while testing.
- `public/privacy.html`: privacy notice; `public/_headers`: cache rules on Cloudflare Pages; `tools/trackcheck.cjs` tests the events with Meta stubbed out.

## Develop

```bash
npm install
npm run dev
```

## Deploy

Pushing to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).
