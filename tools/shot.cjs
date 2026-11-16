const { chromium } = require('playwright');
(async()=>{
  const [url,out,w,h,wait] = process.argv.slice(2);
  const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p = await b.newPage({viewport:{width:+(w||1600),height:+(h||900)}});
  p.on('console',m=>{ if(m.type()==='error') console.log('ERR',m.text()); });
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto(url);
  await p.waitForFunction(()=>window.__done===true,{timeout:120000}).catch(()=>console.log('timeout waiting __done'));
  if(wait) await p.waitForTimeout(+wait);
  await p.screenshot({path:out});
  await b.close();
})();
