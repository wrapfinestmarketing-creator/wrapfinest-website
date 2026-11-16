// Records a scroll-through of the site to a video file. Usage: node tools/record.cjs <outDir> [url]
const { chromium } = require('playwright');
(async () => {
  const [out, url = 'http://127.0.0.1:4173/?nolenis'] = process.argv.slice(2);
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
  const p = await c.newPage();
  await p.goto(url);
  await p.waitForFunction(() => document.body.classList.contains('is-ready'), { timeout: 120000 });
  // warm every sequence so playback is smooth
  await p.evaluate(() => window.__wf.film.preload(['hero', 'ppf', 'impact', 'heal', 'rain', 'stones', 'roof', 'smash', 'outro', 'finish-gloss', 'finish-satin', 'finish-onyx', 'finish-orange', 'finish-blue', 'tint-light', 'tint-dark', 'heat-bare', 'heat-shield']));
  await p.waitForTimeout(9000);
  const t0 = Date.now();
  const total = await p.evaluate(() => document.querySelector('#story').getBoundingClientRect().height + 900);
  const stops = { studio: async () => { for (const id of ['satin', 'onyx', 'color']) { await p.click(`.chip[data-id="${id}"]`).catch(() => {}); await p.waitForTimeout(1300); } await p.click('.swatch[data-name="Royal Blue"]').catch(() => {}); await p.waitForTimeout(1300); },
                  tint: async () => { for (const v of [0, 7, 2]) { await p.evaluate(v => { const r = document.querySelector('#tintRange'); r.value = v; r.dispatchEvent(new Event('input')); }, v); await p.waitForTimeout(1100); } },
                  heat: async () => { await p.click('#thermoToggle button[data-on="0"]').catch(() => {}); await p.waitForTimeout(1400); await p.click('#thermoToggle button[data-on="1"]').catch(() => {}); await p.waitForTimeout(1200); } };
  const done = new Set(); let y = 0;
  while (y < total) {
    y += 15; await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(16);
    const hit = await p.evaluate(() => { const a = document.querySelector('.step.is-active'); if (!a) return null; const r = a.getBoundingClientRect(); const pr = (innerHeight / 2 - r.top) / r.height; return pr > 0.4 && pr < 0.5 ? a.dataset.step : null; });
    if (hit && stops[hit] && !done.has(hit)) { done.add(hit); await stops[hit](); }
  }
  await p.waitForTimeout(800);
  console.log('trim', 9.5, 'secs', (Date.now() - t0) / 1000);
  await c.close(); await b.close();
})();
