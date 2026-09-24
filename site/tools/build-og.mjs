/**
 * SNS で共有したときの画像（1200×630）。ページと同じ紙色・明朝で、作例を2枚並べる。
 * 明朝体は手元に無いので、描くときだけ Noto Serif JP を借りる（OG_SERIF にファイルの場所。配信物には入れない）。
 *
 *   OG_SERIF=…/noto-serif-jp-japanese-600-normal.woff2 node site/tools/build-og.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(HERE, '../public/fuchidori');
const SERIF = process.env.OG_SERIF;
if (!SERIF) throw new Error('OG_SERIF（明朝体の woff2）を指定してください');
const u = (p) => pathToFileURL(p).href;
const COPY = {
  ja: { k: '写真に撮影情報の額をつける Web アプリ', n: 'F1.8・15秒・ISO3200', h: 'あの夜の設定ごと、<br>額に入れる。' },
  en: { k: 'Frames your photos with their shooting details', n: 'f/1.8 · 15 s · ISO 3200', h: 'Frame the night,<br>settings and all.' },
};
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const lang of ['ja', 'en']) {
  const c = COPY[lang];
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
@font-face{font-family:S;src:url(${u(SERIF)})}
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;background:#f4f2ee;color:#23211f;font-family:S,serif;overflow:hidden;position:relative}
.t{position:absolute;left:72px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center}
.b{font-size:28px;letter-spacing:.06em;margin-bottom:56px}
.k{font-size:17px;color:#6b6760;letter-spacing:.06em;margin-bottom:22px}
.n{font-size:26px;color:#6b6760;letter-spacing:.04em;margin-bottom:10px}
h1{font-size:${lang === 'ja' ? 46 : 50}px;line-height:${lang === 'ja' ? 1.45 : 1.15};font-weight:600;letter-spacing:.02em}
img{position:absolute;box-shadow:0 2px 4px rgba(35,33,31,.1),0 24px 48px -18px rgba(35,33,31,.45)}
.a{height:470px;right:236px;top:80px}.c{height:400px;right:64px;top:150px}
</style></head><body>
<div class="t"><div class="b">Fuchidori</div><div class="k">${c.k}</div><div class="n">${c.n}</div><h1>${c.h}</h1></div>
<img class="c" src="${u(PUB + '/img/after-1120.webp')}"><img class="a" src="${u(PUB + '/img/hero-1280.webp')}">
</body></html>`;
  const f = resolve(HERE, `work/og-${lang}.html`);
  writeFileSync(f, html);
  await page.goto(u(f));
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(PUB, `img/og-${lang}.jpg`), type: 'jpeg', quality: 86 });
  console.log('og', lang);
}
await b.close();
