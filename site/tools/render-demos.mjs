/**
 * 紹介ページの作例と画面写真を、**アプリ本体で実際に作る**。
 * 写真は依頼者の実写に、作例用の撮影情報を書き込んだもの（real-photos.py）。
 *
 *   npm run build && python3 site/tools/real-photos.py && node site/tools/render-demos.mjs
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

/*
 * 作例ごとの設定。押す部品は画面の名前（読み上げ名）で指す。
 * ratio は比率ボタンの名前の頭（「4:5 の比率」など）。margin は 0=なし〜4=広い。size は 0=極小〜3=大
 */
const R = { OR: '元の比率', FF: '4:5 の比率', TF: '3:4 の比率', SQ: '1:1 の比率', NST: '9:16 の比率', STN: '16:9 の比率' };
const DEMOS = [
  // 冒頭の1枚
  { out: 'hero', photo: 'torii', ratio: R.FF, margin: 3, color: 'White', lines: '3行', size: 2, font: 'Didot' },
  // 撮って出しと、通したあと
  { out: 'after', photo: 'tree', ratio: R.FF, margin: 2, color: 'Ivory', lines: '2行', size: 2, font: 'Futura', film: 'CLASSIC Neg.', shots: true },
  // 同じ写真で額を替える
  { out: 'v-white', photo: 'beach', ratio: R.FF, margin: 3, color: 'White', lines: '2行', size: 2, font: 'Helvetica', film: 'PRO Neg. Std' },
  { out: 'v-black', photo: 'beach', ratio: R.SQ, margin: 3, color: 'Black', lines: '2行', size: 2, font: 'DIN', film: 'PRO Neg. Std' },
  { out: 'v-tall', photo: 'beach', ratio: R.NST, margin: 3, color: 'Warm White', lines: '3行', size: 2, font: 'Didot', film: 'PRO Neg. Std' },
  { out: 'v-bleed', photo: 'beach', ratio: R.OR, margin: 0, color: 'White', lines: '2行', size: 2, font: 'Futura', film: 'PRO Neg. Std' },
  { out: 'v-sakura', photo: 'beach', ratio: R.OR, margin: 2, color: 'Sakura', lines: '2行', size: 2, font: 'Baskerville', film: 'PRO Neg. Std' },
  { out: 'v-wide', photo: 'beach', ratio: R.STN, margin: 3, color: 'Gunmetal', lines: '1行', size: 2, font: 'Futura', film: 'PRO Neg. Std' },
  // SNS の比率
  { out: 'r-45', photo: 'stars', ratio: R.FF, margin: 3, color: 'White', lines: '2行', size: 2, font: 'Futura' },
  { out: 'r-916', photo: 'stars', ratio: R.NST, margin: 3, color: 'Black', lines: '2行', size: 2, font: 'Futura' },
  { out: 'r-11', photo: 'stars', ratio: R.SQ, margin: 3, color: 'Onyx', lines: '2行', size: 2, font: 'Futura' },
  { out: 'r-169', photo: 'stars', ratio: R.STN, margin: 3, color: 'Warm White', lines: '1行', size: 2, font: 'Futura' },
  // ギャラリー用（写真ごとに額の替え方を増やす）
  { out: 't-bleed', photo: 'torii', ratio: R.OR, margin: 0, color: 'White', lines: '2行', size: 2, font: 'Futura' },
  { out: 't-black', photo: 'torii', ratio: R.SQ, margin: 3, color: 'Black', lines: '2行', size: 2, font: 'DIN' },
  { out: 't-ivory', photo: 'torii', ratio: R.STN, margin: 3, color: 'Ivory', lines: '1行', size: 2, font: 'Didot' },
  { out: 'tr-black', photo: 'tree', ratio: R.NST, margin: 3, color: 'Black', lines: '2行', size: 2, font: 'Didot', film: 'CLASSIC Neg.' },
  { out: 'tr-white', photo: 'tree', ratio: R.OR, margin: 3, color: 'White', lines: '3行', size: 2, font: 'Helvetica', film: 'CLASSIC Neg.' },
  { out: 's-ivory', photo: 'stars', ratio: R.OR, margin: 2, color: 'Ivory', lines: '2行', size: 2, font: 'Baskerville' },
  { out: 's-bleed', photo: 'stars', ratio: R.OR, margin: 0, color: 'White', lines: '2行', size: 2, font: 'Futura' },
  { out: 'b-silver', photo: 'beach', ratio: R.TF, margin: 3, color: 'Silver Sand', lines: '2行', size: 2, font: 'Futura', film: 'PRO Neg. Std' },
];
// ONLY=名前,名前 で一部だけ作り直す
const ONLY = process.env.ONLY?.split(',');

async function open(ctx, photo) {
  const page = await ctx.newPage();
  await page.addInitScript(iosShare);
  await page.goto(origin, { waitUntil: 'networkidle' });
  if (photo) {
    await page.setInputFiles('input[type=file]', resolve(WORK, `real-${photo}.jpg`));
    await page.waitForSelector('canvas.stage__canvas', { timeout: 15000 });
    await page.waitForTimeout(600);
  }
  return page;
}

async function tab(page, name) {
  await page.getByRole('tab', { name }).click();
  await page.waitForTimeout(200);
}

async function apply(page, d) {
  await tab(page, 'フレーム');
  await page.getByRole('radio', { name: d.ratio, exact: false }).first().click();
  await page.getByRole('slider', { name: '余白の広さ' }).fill(String(d.margin));
  if (d.margin > 0) await page.getByRole('radio', { name: d.color, exact: true }).click();
  await tab(page, '文字');
  const place = d.margin > 0 ? '文字を下の余白に' : '写真の下に重ねる';
  await page.getByRole('radiogroup', { name: '文字の置き場所' }).getByRole('radio', { name: place, exact: true }).click();
  await page.getByRole('slider', { name: '文字の大きさ' }).fill(String(d.size));
  await tab(page, '情報');
  await page.getByRole('radio', { name: d.lines, exact: true }).click();
  await tab(page, '書体');
  await page.getByRole('radio', { name: d.font, exact: true }).click();
  await tab(page, '刻印');
  if (d.film) await page.getByRole('combobox', { name: '仕上がり（刻む名前）' }).selectOption(d.film);
  await page.getByRole('radio', { name: 'なし', exact: true }).click();
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

const phone = { ...devices['iPhone 13'] };
/** iPhone の Safari と同じく「ファイルを共有できる」ことにする（保存の画面が実機と同じ文言になる） */
const iosShare = () => {
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
  Object.defineProperty(navigator, 'share', { value: async () => {}, configurable: true });
};
if (!ONLY) {
  // 画面写真: 何も開いていないホーム
  const ctx = await browser.newContext(phone);
  const page = await open(ctx, null);
  await page.screenshot({ path: resolve(WORK, 'ui-home.png') });
  await ctx.close();
}
for (const d of DEMOS.filter((x) => !ONLY || ONLY.includes(x.out))) {
  const ctx = await browser.newContext(phone);
  const page = await open(ctx, d.photo);
  await apply(page, d);
  if (d.shots) {
    await tab(page, 'フレーム');
    await page.screenshot({ path: resolve(WORK, 'ui-edit.png') });
    await tab(page, '情報');
    await page.screenshot({ path: resolve(WORK, 'ui-info.png') });
  }
  await exportJpeg(page, d.out);
  if (d.shots) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: resolve(WORK, 'ui-export.png') });
  }
  await ctx.close();
}
await browser.close();
server.close();
