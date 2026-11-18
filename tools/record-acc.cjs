// Records a scroll-through of the Tesla accessories section. Usage: node tools/record-acc.cjs <outDir> [url]
const { chromium } = require('playwright');
(async () => {
  const [out, url = 'http://127.0.0.1:5173/?nolenis'] = process.argv.slice(2);
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
  const p = await c.newPage();
  await p.goto(url);
  await p.waitForFunction(() => document.body.classList.contains('is-ready'), { timeout: 120000 });
  await p.evaluate(() => { localStorage.clear(); window.__wf.film.preload(['kit-parts', 'kitfront', 'kitrear', 'mats', 'shade']); });
  const top = async sel => p.evaluate(s => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);
  let y = (await top('#tesla')) - 200; await p.evaluate(y => window.scrollTo(0, y), y);
  await p.waitForTimeout(9000);
  console.log('start', Date.now());
  const end = (await top('#accessories')) + 520;
  while (y < end) { y += 6; await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(16); }
  await p.waitForTimeout(700);
  for (const n of [0, 2]) { await p.click(`.pcard__add >> nth=${n}`).catch(() => {}); await p.waitForTimeout(650); }
  await p.click('#shopCat button:nth-child(3)').catch(() => {}); await p.waitForTimeout(900);
  await p.click('.pcard__add >> nth=1').catch(() => {}); await p.waitForTimeout(900);
  await p.click('#shopModel button:nth-child(3)').catch(() => {}); await p.waitForTimeout(600);
  await p.click('#shopCat button:nth-child(1)').catch(() => {}); await p.waitForTimeout(1500);
  await c.close(); await b.close();
})();
