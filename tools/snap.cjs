// Usage: node tools/snap.cjs <outPrefix> <width> <height> <stepKey[:p][,stepKey...]|y:<px>>
const { chromium } = require('playwright');
(async () => {
  const [out, w = 1440, h = 810, list = 'hero', url = 'http://127.0.0.1:5173/?nolenis&still'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type().toUpperCase(), m.text().slice(0, 400)); });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(url);
  await p.waitForFunction(() => document.body.classList.contains('is-ready'), { timeout: 180000 });
  await p.waitForTimeout(1500);
  for (const item of list.split(',')) {
    const [key, pp = '0.4', t] = item.split(':');
    await p.evaluate(([key, pp]) => {
      if (key === 'y') { window.scrollTo(0, +pp); return; }
      const el = document.querySelector(`[data-step="${key}"]`) || document.querySelector(key);
      const r = el.getBoundingClientRect(); const top = r.top + scrollY;
      window.scrollTo(0, Math.max(0, top + r.height * +pp - innerHeight / 2));
    }, [key, pp]);
    await p.waitForTimeout(250);
    await p.evaluate((t) => { window.__wf?.onScroll(); window.__wf?.stage.snap(t ? +t : undefined); }, t);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}_${key.replace(/[^a-z0-9]/gi, '')}${pp !== '0.4' ? '_' + pp : ''}.png` });
  }
  await b.close();
})();
