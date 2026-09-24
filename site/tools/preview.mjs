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
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8' };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let f = resolve(PUB, '.' + p);
  if (existsSync(f) && statSync(f).isDirectory()) f = resolve(f, 'index.html');
  if (!f.startsWith(PUB) || !existsSync(f)) { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const problems = [];
for (const [name, vp, scheme] of [['phone', { width: 390, height: 844 }, 'light'], ['desk', { width: 1440, height: 900 }, 'light'], ['phone-dark', { width: 390, height: 844 }, 'dark']]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`${name}: ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`${name}: ${r.status()} ${r.url()}`));
  for (const path of ['/fuchidori/', '/fuchidori/en/', '/fuchidori/privacy/', '/fuchidori/en/privacy/']) {
    await page.goto(origin + path, { waitUntil: 'networkidle' });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) problems.push(`${name} ${path}: 横に ${over}px はみ出す`);
    const slug = path.replaceAll('/', '_').replace(/^_|_$/g, '');
    if (!name.includes('dark') || path === '/fuchidori/') await page.screenshot({ path: resolve(OUT, `pv-${name}-${slug}.png`), fullPage: true });
  }
  await ctx.close();
}
await b.close();
server.close();
console.log(problems.length ? problems.join('\n') : 'はみ出し・読み込み失敗なし');
