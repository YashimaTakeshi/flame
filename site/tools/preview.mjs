/**
 * 紹介ページを手元で開いて、スマホ幅とパソコン幅で撮る。横にはみ出す要素が無いかも確かめる。
 *
 *   node site/tools/preview.mjs [出力先]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(HERE, '../public');
const OUT = process.argv[2] ?? resolve(HERE, 'work');
// 手元には明朝体が無い（見た目の確認用に Noto Serif JP を借りる。配信物には入れない）
const PREVIEW_SERIF = process.env.PREVIEW_SERIF;
const HEADERS = readFileSync(resolve(PUB, '_headers'), 'utf8');
const CSP = HEADERS.match(/Content-Security-Policy: (.*)/)[1];
const TYPES = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8' };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p === '/__serif.woff2' && PREVIEW_SERIF) { res.writeHead(200, { 'content-type': 'font/woff2' }).end(readFileSync(PREVIEW_SERIF)); return; }
  let f = resolve(PUB, '.' + p);
  if (existsSync(f) && statSync(f).isDirectory()) f = resolve(f, 'index.html');
  if (!f.startsWith(PUB) || !existsSync(f)) { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream', 'content-security-policy': CSP });
  // 手元確認用: CSS の頭に明朝の代わりを差し込む（ページ側は何も変えなくてよい）
  if (PREVIEW_SERIF && extname(f) === '.css') { res.end(`@font-face{font-family:'Noto Serif JP';src:url(/__serif.woff2);font-weight:100 900}\n` + readFileSync(f)); return; }
  res.end(readFileSync(f));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const problems = [];
for (const [name, vp, scheme] of [['phone', { width: 390, height: 844 }, 'light'], ['desk', { width: 1440, height: 900 }, 'light'], ['phone-dark', { width: 390, height: 844 }, 'dark'], ['tablet', { width: 820, height: 1180 }, 'light']]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${name}: ${e}`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`${name}: ${r.status()} ${r.url()}`));
  for (const path of ['/fuchidori/', '/fuchidori/en/', '/fuchidori/privacy/', '/fuchidori/en/privacy/']) {
    await page.goto(origin + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; i.decoding = 'sync'; }));
    // 途中の位置でもはみ出しを測る（動く場面の途中だけはみ出すことがある）
    const midOver = await page.evaluate(async (w) => { let m = 0; for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); m = Math.max(m, document.documentElement.scrollWidth - w); } window.scrollTo(0, 0); return m; }, vp.width);
    if (midOver > 0) problems.push(`${name} ${path}: スクロールの途中で横に ${midOver}px はみ出す`);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => problems.push(`${name} ${path}: 読み込めない画像がある`));
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    // innerWidth ははみ出しに合わせて広がることがあるので、決めた画面の幅と比べる
    const over = await page.evaluate((w) => document.documentElement.scrollWidth - w, vp.width);
    if (over > 0) problems.push(`${name} ${path}: 横に ${over}px はみ出す`);
    const slug = path.replaceAll('/', '_').replace(/^_|_$/g, '');
    if (!name.includes('dark') || path === '/fuchidori/') await page.screenshot({ path: resolve(OUT, `pv-${name}-${slug}.png`), fullPage: true });
  }
  await ctx.close();
}
await b.close();
server.close();
console.log(problems.length ? problems.join('\n') : 'はみ出し・読み込み失敗なし');
