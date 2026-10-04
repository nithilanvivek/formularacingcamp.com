const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const formula = fs.existsSync(path.join(__dirname, '../api/analytics-data.js'));
const handler = require(formula ? '../api/analytics-data.js' : '../api/analytics-dashboard.js');
const safe = require('../lib/public-analytics.js');

function response() {
  return { headers: {}, setHeader(k,v){ this.headers[k.toLowerCase()]=v; },
    status(n){ this.statusCode=n; return this; }, json(body){ this.body=body; return this; } };
}

async function fixture(run) {
  const keys = ['ANALYTICS_DASHBOARD_PASSWORD','VERCEL','VERCEL_ANALYTICS_TOKEN','VERCEL_ANALYTICS_PROJECT_ID','VERCEL_ANALYTICS_TEAM_ID','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const fetch = global.fetch;
  keys.forEach(k => delete process.env[k]);
  process.env.VERCEL='1';
  process.env.VERCEL_ANALYTICS_TOKEN='fixture-server-secret';
  process.env.VERCEL_ANALYTICS_PROJECT_ID='fixture-project';
  try { await run(); } finally {
    global.fetch=fetch;
    keys.forEach(k => saved[k] === undefined ? delete process.env[k] : process.env[k]=saved[k]);
  }
}

function request(method='GET', days='30') {
  return { method, headers:{ host: formula ? 'www.formularacingcamp.com' : 'nithi.land' }, query:{ days, range:days } };
}

test('anonymous real API strips private paths, unknown labels and upstream fields', async () => fixture(async () => {
  const publicPath = formula ? '/preview' : '/projects/conways-game-of-life/';
  const upstreamPrivate = { email:'fixture-person@example.test', ip:'192.0.2.1', token:'fixture-server-secret', requestQuery:'token=fixture-private-id', sessionId:'fixture-session' };
  global.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer fixture-server-secret');
    const query = new URL(url).searchParams;
    const by = query.get('by');
    let data=[];
    if (by==='day') data=[{timestamp:'2026-10-01T00:00:00.000Z',pageviews:20,visitors:12,...upstreamPrivate}];
    if (by==='requestPath') data=[
      {requestPath:publicPath,pageviews:8,visitors:6,...upstreamPrivate},
      {requestPath:'/teeth/fixture-private-id',pageviews:99,visitors:50,...upstreamPrivate},
      {requestPath:'/preview?token=fixture-private-id',pageviews:99,visitors:50},
      {requestPath:'/account/fixture-private-id',pageviews:99,visitors:50},
      {requestPath:'/api/analytics-data',pageviews:99,visitors:50}
    ];
    if (by==='referrerHostname') data=[{referrerHostname:'google.com',pageviews:4,visitors:3,...upstreamPrivate},{referrerHostname:'https://example.com/fixture-private-id',pageviews:2,visitors:1}];
    if (by==='deviceType') data=[{deviceType:'desktop',pageviews:8,visitors:6,...upstreamPrivate},{deviceType:'fixture-private-id',pageviews:1,visitors:1}];
    if (by==='browserName') data=[{browserName:'Chrome',pageviews:8,visitors:6,...upstreamPrivate},{browserName:'fixture-private-id',pageviews:1,visitors:1}];
    if (by==='eventName') data=[{eventName:'App Download',count:2,visitors:1,...upstreamPrivate},{eventName:'fixture-person@example.test',count:3,visitors:2,...upstreamPrivate}];
    return {ok:true,status:200,json:async()=>({data})};
  };
  const res=response(); await handler(request(),res);
  assert.equal(res.statusCode,200);
  assert.match(res.headers['x-robots-tag'],/noindex/);
  assert.match(res.headers['cache-control'],/no-store/);
  assert.deepEqual(res.body.topPages,[{requestPath:safe.publicPath(publicPath),pageviews:8,visitors:6}]);
  assert.deepEqual(Object.keys(res.body.trend[0]).sort(),['pageviews','timestamp','visitors']);
  for(const dimension of ['referrers','devices','browsers']) {
    assert.equal(res.body[dimension].length,2);
    assert.equal(Object.keys(res.body[dimension][0]).length,3);
  }
  const text=JSON.stringify(res.body);
  assert.doesNotMatch(text,/fixture-person|fixture-private-id|fixture-server-secret|fixture-session|192\.0\.2\.1|requestQuery|sessionId/);
  if(formula) {
    assert.equal(res.body.sample,false);
    res.body.actions.forEach(action=>assert.deepEqual(Object.keys(action).sort(),['count','detail','key','metricLabel','name']));
  } else {
    assert.deepEqual(res.body.customEvents,[{eventName:'App Download',count:2,visitors:1},{eventName:'Other events',count:3,visitors:2}]);
  }
}));

test('anonymous API rejects writes, validates ranges and fails safely', async()=>fixture(async()=>{
  const res=response(); await handler(request('POST'),res);
  assert.equal(res.statusCode,405); assert.equal(res.headers.allow,'GET');
  global.fetch=async()=>({ok:true,status:200,json:async()=>({data:[]})});
  for(const [input,days] of [['7',7],['30',30],['90',90],['999',30],['bad',30]]) {
    const result=response(); await handler(request('GET',input),result);
    assert.equal(result.statusCode,200);assert.equal(result.body.range.days,days);
  }
  delete process.env.VERCEL_ANALYTICS_TOKEN;
  const missing=response(); await handler(request(),missing);
  assert.equal(missing.statusCode,503); assert.match(missing.headers['x-robots-tag'],/noindex/);
  process.env.VERCEL_ANALYTICS_TOKEN='fixture-server-secret';
  global.fetch=async()=>({ok:false,status:500,json:async()=>({error:{message:'fixture-private-id'}})});
  const failed=response(); await handler(request(),failed);
  assert.equal(failed.statusCode,502); assert.doesNotMatch(JSON.stringify(failed.body),/fixture-private-id|fixture-server-secret/);
}));

test('sanitization denies identifiers, encoded paths and invalid aggregate numbers',()=>{
  for(const value of ['/teeth/1234','/t/1234','/preview?token=id','/preview#id','/preview%2Fsecret','/admin','',null,'/account/person@example.test','/analytics']) assert.equal(safe.publicPath(value),null);
  assert.equal(safe.publicPath('/index.html'),'/');
  assert.deepEqual(safe.visits([{referrerHostname:'127.0.0.1',pageviews:2},{referrerHostname:'person@example.test',pageviews:3},{referrerHostname:'secret.internal',pageviews:4}],'referrerHostname'),[{referrerHostname:'Other',pageviews:9,visitors:0}]);
  assert.deepEqual(safe.trend([{timestamp:'bad-id',pageviews:5},{timestamp:'2026-10-01',pageviews:Infinity,visitors:-1,token:'secret'}]),[{timestamp:'2026-10-01T00:00:00.000Z',pageviews:0,visitors:0}]);
});

test('crawler-readable noindex covers every analytics route and sitemap excludes them',()=>{
  const root=path.join(__dirname,'..');
  assert.doesNotMatch(fs.readFileSync(path.join(root,'robots.txt'),'utf8'),/Disallow:\s*[^\n]*analytics/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'sitemap.xml'),'utf8'),/\/analytics/);
  const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  const routes=formula ? ['/analytics','/analytics/(.*)','/api/analytics-access','/api/analytics-access/(.*)','/api/analytics-data','/api/analytics-data/(.*)'] : ['/analytics','/analytics/(.*)','/api/analytics-dashboard','/api/analytics-dashboard/(.*)'];
  for(const route of routes) {
    const headers=config.headers.find(row=>row.source===route)?.headers;
    assert.ok(headers,route);
    assert.match(headers.find(row=>row.key==='X-Robots-Tag').value,/noindex/);
    assert.match(headers.find(row=>row.key==='Cache-Control').value,/no-store/);
  }
});
