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
page.on('console', m => { if (m.type()==='error') errs.push('[console] '+m.text()); });

await page.goto(origin, { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/s1-empty.png' });

// 写真を選ぶ
await page.setInputFiles('input[type=file]', '/home/user/flame/tests/fixtures/mirrorless-landscape.jpg');
await page.waitForSelector('canvas.preview', { timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/s2-loaded.png' });

// 書体と地色を変える
await page.getByRole('button', { name: 'Didot' }).click();
await page.getByRole('button', { name: 'Onyx' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/s3-styled.png' });

// 自己診断
await page.getByRole('button', { name: 'この端末を調べる' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/s4-diag.png', fullPage: true });

console.log('ページ内のエラー:', errs.length ? errs.join('\n') : 'なし');
await b.close(); server.close();
