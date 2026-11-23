// Saves the repainted 360 frame itself (not the page) for a list of finishes and angles.
//   SHOTS="satin@0.19,color:Pearl White@0.5" node tools/paintshot.cjs outDir [mobile]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const out = process.argv[2] || '.', mobile = process.argv[3] === 'mobile';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto(process.env.URL || 'http://127.0.0.1:5173/?nolenis&still');
  await page.waitForFunction(() => document.body.classList.contains('is-ready'), { timeout: 180000 });
  await page.evaluate(() => { const el = document.querySelector('[data-step="studio"]'); const r = el.getBoundingClientRect(); window.scrollTo(0, r.top + scrollY + r.height * 0.4 - innerHeight / 2); });
  await page.waitForTimeout(400); await page.evaluate(() => window.__wf.onScroll());
  await page.waitForFunction(() => window.__wf.film.seqLoaded('spin') >= 1, { timeout: 120000 });
  for (const item of (process.env.SHOTS || 'gloss@0').split(',')) {
    const [f, a] = item.split('@'); const [chip, sw] = f.split(':');
    await page.click(`.chip[data-id="${chip}"]`); if (sw) await page.click(`.swatch[data-name="${sw}"]`);
    await page.evaluate(v => window.__wf.setAngle(v), +a); await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__wf.onScroll(); window.__wf.film.snap(); }); await page.waitForTimeout(300);
    const url = await page.evaluate(() => window.__wf.painter.canvas.toDataURL('image/png'));
    fs.writeFileSync(`${out}/${mobile ? 'm' : 'd'}-${chip}${sw ? '-' + sw.replace(/\W+/g, '') : ''}-${String(Math.round(a * 360)).padStart(3, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();
})();
