/**
 * 紹介ページの作例と画面写真を、**アプリ本体で実際に作る**。
 * 作例の絵は demo-photos.py が作る（実写が用意できたら work/ の絵を差し替えて流し直す）。
 *
 *   npm run build && python3 site/tools/demo-photos.py && node site/tools/render-demos.mjs
 *
 * 書き出しは画面の「書き出す」から。結果の画像（data: の JPEG）をそのまま受け取る。
 */
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '../../dist');
const WORK = resolve(HERE, 'work');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = resolve(DIST, '.' + p);
  if (!f.startsWith(DIST) || !existsSync(f)) { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

/** 作例ごとの設定。押す部品は画面の名前（読み上げ名）で指す */
const DEMOS = [
  {
    out: 'demo-dusk', photo: 'dusk.jpg',
    frame: { ratio: '4:5 の比率', margin: 3, color: 'White' },
    text: { place: '下', lines: '3行', size: 1 },
    font: 'Futura', film: 'CLASSIC CHROME', badge: 'なし',
  },
  {
    out: 'demo-sea', photo: 'sea.jpg',
    frame: { ratio: '元の比率', margin: 2, color: 'Ivory' },
    text: { place: '下', lines: '2行', size: 1 },
    font: 'Didot',
  },
  {
    out: 'demo-city', photo: 'city.jpg',
    frame: { ratio: '1:1 の比率', margin: 3, color: 'Black' },
    text: { place: '下', lines: '2行', size: 1 },
    font: 'DIN',
  },
];

async function open(ctx, photo) {
  const page = await ctx.newPage();
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.setInputFiles('input[type=file]', resolve(WORK, photo));
  await page.waitForSelector('canvas.stage__canvas', { timeout: 15000 });
  await page.waitForTimeout(600);
  return page;
}

async function tab(page, name) {
  await page.getByRole('tab', { name }).click();
  await page.waitForTimeout(200);
}

async function apply(page, d) {
  await tab(page, 'フレーム');
  await page.getByRole('radio', { name: d.frame.ratio, exact: false }).first().click();
  await page.getByRole('slider', { name: '余白の広さ' }).fill(String(d.frame.margin));
  await page.getByRole('radio', { name: d.frame.color, exact: true }).click();
  await tab(page, '文字');
  await page.getByRole('radiogroup', { name: '文字の置き場所' }).getByRole('radio', { name: `文字を${d.text.place}の余白に`, exact: true }).click();
  await page.getByRole('slider', { name: '文字の大きさ' }).fill(String(d.text.size));
  await tab(page, '情報');
  await page.getByRole('radio', { name: d.text.lines, exact: true }).click();
  await tab(page, '書体');
  await page.getByRole('radio', { name: d.font, exact: true }).click();
  if (d.film) {
    await tab(page, '刻印');
    await page.getByRole('combobox', { name: '仕上がり（刻む名前）' }).selectOption(d.film);
    await page.getByRole('radio', { name: d.badge, exact: true }).click();
  }
  await page.waitForTimeout(800);
}

async function exportJpeg(page, out) {
  await page.getByRole('button', { name: '書き出す' }).first().click();
  const img = page.locator('img.result-img[src^="data:image/jpeg"]');
  await img.waitFor({ timeout: 60000 });
  const src = await img.getAttribute('src');
  writeFileSync(resolve(WORK, `${out}.jpg`), Buffer.from(src.split(',')[1], 'base64'));
  console.log('作例', out);
}

const phone = await browser.newContext({ ...devices['iPhone 13'] });
for (const d of DEMOS) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await open(ctx, d.photo);
  await apply(page, d);
  if (d.out === 'demo-dusk') {
    // 画面写真（スマホ）: フレームと文字のタブ
    await tab(page, 'フレーム');
    await page.screenshot({ path: resolve(WORK, 'ui-phone-frame.png') });
    await tab(page, '情報');
    await page.screenshot({ path: resolve(WORK, 'ui-phone-info.png') });
  }
  await exportJpeg(page, d.out);
  await ctx.close();
}
await phone.close();

// 画面写真（PC）
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
{
  const page = await open(desk, 'dusk.jpg');
  await page.screenshot({ path: resolve(WORK, 'ui-desk.png') });
}
await browser.close();
server.close();
