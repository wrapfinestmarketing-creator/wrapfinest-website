// Checks the ad tracking without reaching Meta: the pixel script is blocked, so every event stays in fbq's queue.
// Usage: node tools/trackcheck.cjs [url]   (adds ?track so it runs on localhost)
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://127.0.0.1:5173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 810 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  let formBody = null, leadBody = null;
  await page.route('https://connect.facebook.net/**', r => r.abort());
  await page.route('https://formsubmit.co/**', r => { formBody = JSON.parse(r.request().postData()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' }); });
  await page.route('**/api/lead', r => { leadBody = JSON.parse(r.request().postData()); r.fulfill({ status: 200, body: 'ok' }); });
  await page.goto(url + '?nolenis&still&track&utm_source=facebook&utm_medium=paid&utm_campaign=tint-nov&utm_content=360-video&fbclid=TESTCLICK');
  await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 180000 });
  const go = async sel => { await page.evaluate(s => { const el = document.querySelector(s); const r = el.getBoundingClientRect(); window.scrollTo(0, r.top + scrollY + r.height * 0.4 - innerHeight / 2); window.__wf.onScroll(); }, sel); await page.waitForTimeout(500); };
  for (const s of ['[data-step="film"]', '[data-step="studio"]', '[data-step="tint"]', '[data-step="armor"]', '#tesla', '#pricing']) await go(s);
  await go('[data-step="studio"]'); await page.click('.chip[data-id="satin"]');
  await go('[data-step="tint"]'); await page.click('[data-step="tint"] .gchip[data-id="f"]'); await page.click('[data-step="tint"] .fchip[data-id="SD5"]');
  await go('[data-step="armor"]'); await page.click('[data-step="armor"] .fchip[data-id="TX35"]');
  await go('#accessories'); const add = page.locator('#shopGrid button:has-text("Add")').first(); if (await add.count()) await add.click();
  await page.evaluate(() => { const a = document.querySelector('.fab'); a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); });
  await go('#quote');
  await page.fill('#quoteForm [name=name]', 'Juan Dela Cruz'); await page.fill('#quoteForm [name=phone]', '0917 123 4567'); await page.fill('#quoteForm [name=email]', 'juan@example.com');
  await page.fill('#quoteForm [name=vehicle]', 'Tesla Model Y'); await page.evaluate(() => { document.querySelector('#quoteForm input[value="Nano ceramic tint"]').checked = true; });
  await page.evaluate(() => document.querySelector('#quoteForm button[type=submit]').click()); await page.waitForTimeout(1500);
  const q = await page.evaluate(() => (window.fbq?.queue || []).map(a => [...a].map(x => (typeof x === 'object' ? JSON.stringify(x) : x)).join(' | ')));
  console.log('pixel calls:\n  ' + q.join('\n  '));
  console.log('form email "Came from":', formBody && formBody['Came from']);
  console.log('server lead sent (on github.io it is skipped):', leadBody ? JSON.stringify({ ...leadBody, event_id: leadBody.event_id && 'present' }) : 'none');
  console.log('status:', await page.textContent('#formStatus'));
  console.log('errors', errs.length ? errs : 'none'); await b.close();
})();
