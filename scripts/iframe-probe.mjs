// アーティファクトと同じ「枠の中」の条件で、タブバーが見えるかを確かめる
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
const DIST='/home/user/flame/dist';
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=createServer((q,r)=>{
  let p=decodeURIComponent((q.url??'/').split('?')[0]);
  if(p==='/host'){ // アーティファクトの見え方を模した入れ物
    r.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    r.end(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
      <style>html,body{margin:0;height:100%;background:#555;overflow:hidden}
      .chrome{height:84px;background:#666}
      /* ★枠を「見えている高さ」より 180px 大きくする。
         アーティファクトの枠で実際に起きた状況（タブバーが画面外に出た）を再現する */
      iframe{display:block;width:100%;height:calc(100% - 84px + 180px);border:0}</style>
      <div class=chrome></div><iframe src="/index.html"></iframe>`);
    return;
  }
  if(p==='/')p='/index.html';
  const f=resolve(DIST,'.'+p);
  if(!f.startsWith(DIST)||!existsSync(f)){r.writeHead(404).end();return;}
  r.writeHead(200,{'content-type':TYPES[extname(f)]??'application/octet-stream'});
  r.end(readFileSync(f));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const ctx=await b.newContext({...devices['iPhone 13']});
const page=await ctx.newPage();
await page.goto(origin+'/host',{waitUntil:'networkidle'});
const frame=page.frames().find(f=>f.url().includes('index.html'));
await frame.setInputFiles('input[type=file]','/home/user/flame/tests/fixtures/iphone-portrait.jpg');
await frame.waitForSelector('canvas.stage__canvas');
await page.waitForTimeout(700);
await page.screenshot({path:'/tmp/iframe.png'});
const visibleBottom = await page.evaluate(()=>window.innerHeight);
const frameTop = await page.evaluate(()=>document.querySelector('iframe').getBoundingClientRect().top);
console.log('見えている高さ:', visibleBottom - frameTop, 'px（枠自体はこれより 180px 大きい）');
const visibleH = visibleBottom - frameTop;
console.log(JSON.stringify(await frame.evaluate((visibleH)=>{
  const r=(s)=>{const e=document.querySelector(s);if(!e)return null;const x=e.getBoundingClientRect();return{top:Math.round(x.top),bottom:Math.round(x.bottom)};};
  return {
    innerHeight: window.innerHeight,
    docClientHeight: document.documentElement.clientHeight,
    visualViewport: window.visualViewport ? Math.round(window.visualViewport.height) : null,
    appH: Math.round(document.querySelector('.app').getBoundingClientRect().height),
    tabbar: r('.tabbar'),
    tabbarVisible: (()=>{const x=document.querySelector('.tabbar')?.getBoundingClientRect();
      return x ? (x.bottom <= window.innerHeight+1 && x.top >= 0) : false;})(),
    appHVar: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim() || '(未設定)',
    // ★枠の大きさではなく「見えている高さ」で判定する★
    tabbarWithinVisible: (()=>{const x=document.querySelector('.tabbar')?.getBoundingClientRect();
      return x ? Math.round(x.bottom) <= visibleH + 1 : false;})(),
    optionRowWithinVisible: (()=>{const x=document.querySelector('.optrow')?.getBoundingClientRect();
      return x ? Math.round(x.bottom) <= visibleH + 1 : false;})(),
    visibleH,
  };
}, visibleH),null,1));
await b.close();server.close();
