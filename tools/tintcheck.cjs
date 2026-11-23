// Checks the tint viewer. Usage: node tools/tintcheck.cjs outDir [mobile] [url]
// Saves the tinted car at several angles and film mixes, the top view, page screenshots, and tries the drag.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const out = process.argv[2] || '.', mobile = process.argv[3] === 'mobile';
const url = process.argv[4] || 'http://127.0.0.1:5173/?nolenis&still';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  await page.goto(url);
  await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 180000 });
  await page.evaluate(() => { const el = document.querySelector('[data-step="tint"]'); const r = el.getBoundingClientRect(); window.scrollTo(0, r.top + scrollY + r.height * 0.4 - innerHeight / 2); });
  await page.waitForTimeout(400); await page.evaluate(() => window.__wf.onScroll());
  console.log('tint 360 enabled', await page.evaluate(() => window.__wf.ctx.tspin));
  await page.waitForFunction(() => window.__wf.film.seqLoaded('tspin') >= 1 && window.__wf.film.seqLoaded('ttop') >= 1, null, { timeout: 120000 });
  await page.waitForTimeout(1000);
  const tag = mobile ? 'm' : 'd';
  const settle = async () => { await page.waitForTimeout(900); await page.evaluate(() => { window.__wf.onScroll(); window.__wf.film.snap(); }); await page.waitForTimeout(300); };
  const car = async name => { const u = await page.evaluate(() => window.__wf.tinter.canvas.toDataURL('image/jpeg', 0.9)); fs.writeFileSync(`${out}/${tag}-car-${name}.jpg`, Buffer.from(u.split(',')[1], 'base64')); };
  const pick = async (glass, film) => { await page.click(`.gchip[data-id="${glass}"]`); if (film) await page.click(`.fchip[data-id="${film}"]`); };
  await page.click('.tint__views [data-view="360"]');
  for (const a of (process.env.ANGLES || '0,0.1,0.19,0.25,0.33,0.5,0.62,0.75,0.87').split(',')) { await page.evaluate(v => window.__wf.setTintAngle(v), +a); await settle(); await car('mix-' + String(Math.round(a * 360)).padStart(3, '0')); }
  await page.screenshot({ path: `${out}/${tag}-page-360.png` });
  await pick('all', 'SD5'); await page.evaluate(() => window.__wf.setTintAngle(0.1)); await settle(); await car('all5-036');
  await pick('all', 'A70'); await settle(); await car('all70-036');
  await pick('w', 'M35'); await pick('f', 'SD5'); await page.evaluate(() => window.__wf.setTintAngle(0.19)); await settle(); await car('w35-f5-068');
  await pick('o', 'SD5'); await settle(); console.log('view after picking the roof', await page.evaluate(() => window.__wf.ctx.tview)); await car('top-roof5');
  await pick('o', 'A70'); await pick('k', 'M35'); await settle(); await car('top-roof70'); await page.screenshot({ path: `${out}/${tag}-page-top.png` });
  await page.click('.tint__views [data-view="360"]'); await page.evaluate(() => window.__wf.setTintAngle(0)); await settle();
  const pad = await page.locator('#tspinPad').boundingBox();
  const y = pad.y + pad.height * (mobile ? 0.3 : 0.5), x0 = pad.x + pad.width * (mobile ? 0.7 : 0.4);
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', x0); for (let i = 1; i <= 10; i++) { await touch('touchMove', x0 - i * 16); await page.waitForTimeout(16); } await page.waitForTimeout(200); await touch('touchEnd', 0);
  } else { await page.mouse.move(x0, y); await page.mouse.down(); await page.mouse.move(x0 - 300, y, { steps: 12 }); await page.waitForTimeout(200); await page.mouse.up(); }
  await page.waitForTimeout(500);
  console.log('angle after drag', await page.evaluate(() => window.__wf.ctx.tangle.toFixed(3)), '| quote field:', await page.inputValue('#formSelection'));
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})();
