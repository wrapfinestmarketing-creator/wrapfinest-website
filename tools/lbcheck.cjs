// Checks the product zoom viewer and gallery viewer. Usage: node tools/lbcheck.cjs outDir [url]
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '.';
const url = process.argv[3] || 'http://127.0.0.1:5173/?nolenis&still';
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [name, opts] of [['desk', { viewport: { width: 1440, height: 900 } }], ['mob', { ...devices['iPhone 13'] }]]) {
    const page = await browser.newPage(opts);
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelector('#accessories').scrollIntoView());
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${name}-grid.png` });
    // open the body kit (has real photos) and the protective set (video)
    await page.click('[data-zoom="mat-carpet"]');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${name}-lb1.png` });
    const box = await page.locator('.lb__media').boundingBox();
    if (name === 'desk') {
      await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${out}/${name}-lb1-zoom.png` });
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3); await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 8 }); await page.mouse.up();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${name}-lb1-pan.png` });
      await page.keyboard.press('Escape');
    } else {
      await page.locator('.lb__close').click();
    }
    await page.waitForTimeout(500);
    await page.click('[data-zoom="body-kit"]');
    await page.waitForTimeout(900);
    await page.locator('.lb__thumb').nth(1).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${name}-lb-kit.png` });
    const state = await page.evaluate(() => ({ open: !document.querySelector('.lb').hidden, n: document.querySelectorAll('.lb__thumb').length, lock: document.documentElement.classList.contains('lb-lock') }));
    console.log(name, 'body-kit viewer', JSON.stringify(state));
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.click('[data-zoom="protective-set"]');
    await page.waitForTimeout(700);
    const n = await page.locator('.lb__thumb').count();
    await page.locator('.lb__thumb').nth(n - 1).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${name}-lb-video.png` });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    // work gallery
    await page.evaluate(() => document.querySelector('#gallery').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(800);
    await page.locator('#gallery figure').nth(0).click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${out}/${name}-lb-work.png` });
    const closedAfterEsc = await page.keyboard.press('Escape').then(() => page.waitForTimeout(400)).then(() => page.evaluate(() => document.querySelector('.lb').hidden));
    console.log(name, 'closed after Esc', closedAfterEsc);
    await page.close();
  }
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})();
