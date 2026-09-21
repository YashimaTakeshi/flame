import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const DIST = '/home/user/flame/dist';
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.woff2':'font/woff2', '.webmanifest':'application/manifest+json' };
const server = createServer((req,res)=>{
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = resolve(DIST, '.' + p);
  if (!f.startsWith(DIST) || !existsSync(f)) { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, {'content-type': TYPES[extname(f)] ?? 'application/octet-stream'});
  res.end(readFileSync(f));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type()==='error' && !m.text().includes('404')) errs.push('[console] '+m.text()); });

await page.goto(origin, { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/u1-empty.png' });

await page.setInputFiles('input[type=file]', '/home/user/flame/tests/fixtures/iphone-portrait.jpg');
await page.waitForSelector('canvas.stage__canvas', { timeout: 15000 });
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/u2-style.png' });

// タブを順に開く
for (const [name, file] of [['組み','u3-layout'],['地色','u4-color'],['書体','u5-font'],['情報','u6-info']]) {
  await page.getByRole('tab', { name }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `/tmp/${file}.png` });
}

// スクロールが発生していないか
const scrolls = await page.evaluate(() => ({
  body: document.body.scrollHeight > window.innerHeight,
  scrollY: window.scrollY,
  appH: document.querySelector('.app')?.getBoundingClientRect().height,
  winH: window.innerHeight,
  tabbarVisible: (() => { const r = document.querySelector('.tabbar')?.getBoundingClientRect();
    return r ? r.bottom <= window.innerHeight + 1 && r.top >= 0 : false; })(),
  canvasFits: (() => { const c = document.querySelector('canvas.stage__canvas')?.getBoundingClientRect();
    const s = document.querySelector('.stage')?.getBoundingClientRect();
    return c && s ? (c.height <= s.height + 1 && c.width <= s.width + 1) : false; })(),
  // 指で狙えるか。見た目の高さではなく、実際に中心から±21px の位置で
  // そのボタンに当たるかを見る（当たり判定を疑似要素で広げている箇所があるため）
  smallTargets: [...document.querySelectorAll('button')].map(el => {
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width === 0) return null;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // 画面の外にある要素（横スクロール行の続き）は測れないので飛ばす
    if (cx < 0 || cx > window.innerWidth || cy < 0 || cy > window.innerHeight) return null;
    const hits = (y) => {
      if (y < 0 || y > window.innerHeight) return false;
      const h = document.elementFromPoint(cx, y);
      return h === el || el.contains(h) || (h && h.contains(el));
    };
    const reach = hits(cy - 21) && hits(cy + 21);
    return reach ? null : {
      t: el.textContent?.trim().slice(0, 14),
      h: Math.round(r.height),
      topHit: (() => { const h = document.elementFromPoint(cx, cy - 21); return h ? h.className || h.tagName : 'なし'; })(),
      botHit: (() => { const h = document.elementFromPoint(cx, cy + 21); return h ? h.className || h.tagName : 'なし'; })(),
    };
  }).filter(Boolean),
}));
console.log('レイアウト検査:', JSON.stringify(scrolls, null, 1));
console.log('ページ内のエラー:', errs.length ? errs.join('\n') : 'なし');
await b.close(); server.close();
