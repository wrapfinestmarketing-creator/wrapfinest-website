// Exercises the accessories shop: filter, add items, check the form list. Usage: node tools/shopcheck.cjs <outPrefix> [w] [h]
const { chromium } = require('playwright');
(async () => {
  const [out, w = 1440, h = 900] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:5173/?nolenis&still');
  await p.waitForFunction(() => document.body.classList.contains('is-ready'), { timeout: 120000 });
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => document.body.classList.contains('is-ready'));
  const count = async () => p.$$eval('.pcard', els => els.length);
  await p.evaluate(() => document.querySelector('#accessories').scrollIntoView()); await p.waitForTimeout(600);
  const res = { YL: await count() };
  await p.click('#shopModel button:nth-child(3)'); res.M3 = await count();
  await p.click('#shopModel button:nth-child(2)'); res.Y = await count();
  await p.click('#shopModel button:nth-child(1)');
  await p.click('#shopCat button:nth-child(3)'); res.shadeYL = await count();
  await p.click('.pcard__add >> nth=0'); await p.click('.pcard__add >> nth=1');
  await p.click('#shopCat button:nth-child(4)'); await p.click('.pcard__add >> nth=0');          // body kit (on request)
  await p.click('#shopCat button:nth-child(1)');
  res.bar = await p.$eval('#cartBar', e => e.hidden ? 'hidden' : e.innerText.replace(/\n/g, ' | '));
  await p.evaluate(() => window.scrollBy(0, 240)); await p.waitForTimeout(700);
  await p.screenshot({ path: out + '_grid.png' });
  await p.evaluate(() => document.querySelector('.real').scrollIntoView({ block: 'start' })); await p.waitForTimeout(900);
  await p.screenshot({ path: out + '_real.png' });
  await p.evaluate(() => document.querySelector('#quoteForm').scrollIntoView({ block: 'center' })); await p.waitForTimeout(900);
  res.formList = await p.$$eval('#formCartList li', els => els.map(e => e.innerText.replace(/\n/g, ' ')));
  res.formTotal = await p.$eval('#formCartTotal', e => e.innerText);
  res.accChecked = await p.$eval('input[value="Tesla accessories"]', e => e.checked);
  res.barAway = await p.$eval('#cartBar', e => e.classList.contains('is-away'));
  await p.screenshot({ path: out + '_form.png' });
  // remove one line
  await p.click('#formCartList li button >> nth=0'); res.afterRemove = await p.$$eval('#formCartList li', els => els.length);
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
