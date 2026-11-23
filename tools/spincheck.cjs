// Checks the 360 Finish Studio. Usage: node tools/spincheck.cjs outDir [mobile] [url]
// Shoots a grid of finishes x angles, then drags the car and checks that it turned.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '.';
const mobile = process.argv[3] === 'mobile';
const url = process.argv[4] || 'http://127.0.0.1:5173/?nolenis&still';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 300)); });
  await page.goto(url);
  await page.waitForFunction(() => document.body.classList.contains('is-ready'), { timeout: 180000 });
  await page.evaluate(() => { const el = document.querySelector('[data-step="studio"]'); const r = el.getBoundingClientRect(); window.scrollTo(0, r.top + scrollY + r.height * 0.4 - innerHeight / 2); });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__wf.onScroll());
  console.log('spin enabled', await page.evaluate(() => window.__wf.ctx.spin));
  await page.waitForFunction(() => window.__wf.film.seqLoaded('spin') >= 1, { timeout: 120000 });
  await page.waitForTimeout(1200);
  const tag = mobile ? 'mob' : 'desk';
  const shot = async name => { await page.evaluate(() => { window.__wf.onScroll(); window.__wf.film.snap(); }); await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${tag}-${name}.png` }); };
  const pick = async (chip, swatch) => {
    await page.click(`.chip[data-id="${chip}"]`);
    if (swatch) await page.click(`.swatch[data-name="${swatch}"]`);
    await page.waitForTimeout(1300);
  };
  const list = (process.env.SHOTS || 'gloss@0,gloss@0.125,gloss@0.25,gloss@0.5,gloss@0.75,satin@0,satin@0.125,onyx@0.125,color:Pearl White@0.125,color:Sun Yellow@0.625,color:Signal Orange@0.375,color:Racing Green@0.875').split(',');
  for (const item of list) {
    const [f, a] = item.split('@'); const [chip, sw] = f.split(':');
    await pick(chip, sw); await page.evaluate(v => window.__wf.setAngle(v), +a);
    await page.waitForTimeout(500);
    await shot(`${chip}${sw ? '-' + sw.replace(/\W+/g, '') : ''}-${String(Math.round(a * 360)).padStart(3, '0')}`);
  }
  // drag test
  await page.evaluate(() => window.__wf.setAngle(0));
  const pad = await page.locator('#spinPad').boundingBox();
  const y = pad.y + pad.height * (mobile ? 0.3 : 0.55), x0 = pad.x + pad.width * (mobile ? 0.7 : 0.75);
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', x0); for (let i = 1; i <= 10; i++) { await touch('touchMove', x0 - i * 16); await page.waitForTimeout(16); } await page.waitForTimeout(200); await touch('touchEnd', 0);
  } else {
    await page.mouse.move(x0, y); await page.mouse.down(); await page.mouse.move(x0 - 300, y, { steps: 12 }); await page.waitForTimeout(200); await page.mouse.up();
  }
  await page.waitForTimeout(500);
  console.log('angle after drag', await page.evaluate(() => window.__wf.ctx.angle.toFixed(3)), 'aria', await page.getAttribute('#spinPad', 'aria-valuetext'));
  await shot('after-drag');
  await page.focus('#spinPad'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  console.log('angle after 2 x ArrowRight', await page.evaluate(() => window.__wf.ctx.angle.toFixed(3)));
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})();
