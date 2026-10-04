const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { launchHeadlessSession } = require('../security-demo/browser-session');
const analyticsPage = require('../api/analytics-access');
const analyticsData = require('../api/analytics-data');

test('anonymous dashboard renders, changes range, refreshes and recovers from API errors', async () => {
  const original = Object.fromEntries(['VERCEL','VERCEL_ANALYTICS_TOKEN','VERCEL_ANALYTICS_PROJECT_ID'].map(k=>[k,process.env[k]]));
  for(const key of Object.keys(original)) delete process.env[key];
  let failed=false, reads=0;
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    res.status = n => {res.statusCode=n;return res;};
    res.send = body => res.end(body);
    res.json = body => {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
    req.query=Object.fromEntries(url.searchParams);
    if(url.pathname==='/analytics') return analyticsPage(req,res);
    if(url.pathname==='/api/analytics-data') {
      reads++;
      if(failed) return res.status(502).json({error:'Analytics temporarily unavailable.'});
      return analyticsData(req,res);
    }
    const file=path.join(__dirname,'..',url.pathname.replace(/^\//,''));
    if(url.pathname.startsWith('/assets/') && fs.existsSync(file)) {
      res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/webp');
      return fs.createReadStream(file).pipe(res);
    }
    res.statusCode=404;res.end();
  });
  let session;
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    session=await launchHeadlessSession();const {cdp}=session;
    const evaluate=async expression=>(await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value;
    await cdp.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/analytics`});
    const ready=await evaluate(`new Promise((resolve,reject)=>{
      const until=Date.now()+10000; const timer=setInterval(()=>{
        if(document.querySelector('#pageviews-total')?.textContent!=='—' && document.querySelector('#pageviews-total')) {clearInterval(timer);resolve(true)}
        else if(Date.now()>until){clearInterval(timer);reject(new Error('Dashboard did not render'))}
      },50)
    })`);assert.equal(ready,true);
    assert.equal(await evaluate(`document.querySelector('h1').textContent`),'Site analytics');
    assert.equal(await evaluate(`document.querySelector('input[type=password]')===null`),true);
    assert.equal(await evaluate(`document.querySelector('meta[name=robots]').content.includes('noindex')`),true);
    assert.equal(await evaluate(`!!document.querySelector('#traffic-chart svg')`),true);
    for(const days of [7,90,30]) {
      await evaluate(`document.querySelector('[data-range="${days}"]').click()`);
      assert.equal(await evaluate(`new Promise(resolve=>{let timer=setInterval(()=>{if(document.querySelector('#dashboard-status').textContent.includes('last ${days} days')){clearInterval(timer);resolve(true)}},25);setTimeout(()=>{clearInterval(timer);resolve(false)},5000)})`),true);
    }
    const prior=reads; await evaluate(`document.querySelector('#refresh-button').click()`);
    assert.equal(await evaluate(`new Promise(resolve=>setTimeout(()=>resolve(document.querySelector('#dashboard-status').textContent.includes('last 30 days')),300))`),true);
    assert.equal(reads,prior+1);
    failed=true;await evaluate(`document.querySelector('#refresh-button').click()`);
    assert.equal(await evaluate(`new Promise(resolve=>setTimeout(()=>resolve(document.querySelector('#dashboard-status').textContent),300))`),'Analytics temporarily unavailable.');
    failed=false;await evaluate(`document.querySelector('#refresh-button').click()`);
    assert.equal(await evaluate(`new Promise(resolve=>setTimeout(()=>resolve(document.querySelector('#dashboard-status').textContent.includes('last 30 days')),300))`),true);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`),true);
  } finally {
    if(session) await session.close();
    await new Promise(resolve=>server.close(resolve));
    for(const [key,value] of Object.entries(original)) value===undefined ? delete process.env[key] : process.env[key]=value;
  }
});
