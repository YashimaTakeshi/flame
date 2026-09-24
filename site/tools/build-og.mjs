/**
 * SNS で共有したときの画像（1200×630）。ページと同じ書体・紙色で、作例を2枚並べる。
 *
 *   node site/tools/build-og.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(HERE, '../public/fuchidori');
const APPFONTS = resolve(HERE, '../../public/fonts');
const u = (p) => pathToFileURL(p).href;
const COPY = {
  ja: { h: '写真に、<br>撮影情報の縁取りを。', s: 'ブラウザで開くだけ。写真は端末の外に出ません。' },
  en: { h: 'Frame your photos<br>with their story.', s: 'Runs in your browser. Photos never leave your device.' },
};
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const lang of ['ja', 'en']) {
  const c = COPY[lang];
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
@font-face{font-family:Jost;src:url(${u(PUB + '/fonts/Jost-bold.woff2')});font-weight:700}
@font-face{font-family:Jost;src:url(${u(PUB + '/fonts/Jost-regular.woff2')});font-weight:400}
@font-face{font-family:NSJ;src:url(${u(APPFONTS + '/NotoSansJP-regular.woff2')})}
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#f6f4f1;color:#1c1b19;font-family:Jost,NSJ,sans-serif;overflow:hidden;position:relative}
.t{position:absolute;left:80px;top:0;bottom:0;width:500px;display:flex;flex-direction:column;justify-content:center}
.b{display:flex;align-items:center;gap:14px;font-size:30px;font-weight:700;letter-spacing:.04em;margin-bottom:44px}
.m{width:30px;height:30px;border:3px solid currentColor;border-radius:4px;position:relative}.m:after{content:'';position:absolute;inset:4px 4px 9px;background:currentColor;border-radius:1px}
h1{margin:0;font-size:${lang === 'ja' ? 48 : 54}px;line-height:${lang === 'ja' ? 1.35 : 1.1};font-weight:700}
p{margin:28px 0 0;font-size:20px;color:#5b5852}
img{position:absolute;box-shadow:0 2px 4px rgba(0,0,0,.08),0 24px 48px -16px rgba(0,0,0,.35)}
.a{height:440px;right:210px;top:110px}.c{height:370px;right:48px;top:170px}
</style></head><body>
<div class="t"><div class="b"><span class="m"></span>Fuchidori</div><h1>${c.h}</h1><p>${c.s}</p></div>
<img class="c" src="${u(PUB + '/img/demo-city-1280.webp')}"><img class="a" src="${u(PUB + '/img/demo-dusk-1280.webp')}">
</body></html>`;
  const f = resolve(HERE, `work/og-${lang}.html`);
  writeFileSync(f, html);
  await page.goto(u(f));
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(PUB, `img/og-${lang}.jpg`), type: 'jpeg', quality: 86 });
  console.log('og', lang);
}
await b.close();
