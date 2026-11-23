// Checks the tint viewer's turn-and-zoom per glass. Usage: node tools/zoomcheck.cjs outDir [mobile] [url]
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '.', mobile = process.argv[3] === 'mobile';
const url = process.argv[4] || 'http://127.0.0.1:5173/?nolenis';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await page.goto(url); await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 180000 });
  await page.evaluate(() => { const el = document.querySelector('[data-step="tint"]'); const r = el.getBoundingClientRect(); window.scrollTo(0, r.top + scrollY + r.height * 0.4 - innerHeight / 2); });
  await page.waitForTimeout(400); await page.evaluate(() => window.__wf.onScroll());
  await page.waitForFunction(() => window.__wf.film.seqLoaded('tspin') >= 1 && window.__wf.film.seqLoaded('ttop') >= 1, null, { timeout: 120000 });
  await page.waitForTimeout(4500);                                  // let the first turn finish
  const tag = mobile ? 'm' : 'd';
  await page.screenshot({ path: `${out}/${tag}-0-start.png` });
  for (const g of ['w', 'f', 'r', 'k', 'o', 'all']) {
    await page.click(`.gchip[data-id="${g}"]`); await page.waitForTimeout(2600);
    const st = await page.evaluate(() => ({ view: window.__wf.ctx.tview, angle: +window.__wf.ctx.tangle.toFixed(3), fk: window.__wf.ctx.tfocus.fk }));
    console.log(tag, g, JSON.stringify(st));
    await page.screenshot({ path: `${out}/${tag}-${g}.png` });
  }
  // zoom follows the window while dragging
  await page.click('.gchip[data-id="f"]'); await page.waitForTimeout(2600);
  const pad = await page.locator('#tspinPad').boundingBox(); const y = pad.y + pad.height * (mobile ? 0.3 : 0.5), x0 = pad.x + pad.width * 0.45;
  if (!mobile) { await page.mouse.move(x0, y); await page.mouse.down(); await page.mouse.move(x0 + 120, y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/${tag}-f-dragged.png` }); }
  console.log(tag, 'errors', errs.length ? errs : 'none'); await b.close();
})();
