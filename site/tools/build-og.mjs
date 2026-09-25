/**
 * SNS で共有したときの画像（1200×630）。ページと同じ「夜のギャラリー」の見た目で、
 * 炭色の壁に照明の当たった作例（冒頭の鳥居と天の川）を掛け、見出しと撮影情報の数字を添える。
 * 明朝体は手元に無いので、描くときだけ Noto Serif JP を借りる（OG_SERIF にファイルの場所。配信物には入れない）。
 * 欧文は紹介ページと同じ Playfair Display・Jost（public/fuchidori/fonts/）。
 *
 *   OG_SERIF=…/noto-serif-jp-japanese-600-normal.woff2 node site/tools/build-og.mjs
 *   （手元確認用の site/tools/work/preview-serif.woff2 でもよい）
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
// 見出しは紹介ページの h1 と同じ文（build-pages.mjs の hero.h1）
const COPY = {
  ja: { k: '写真に額をつける無料の Web アプリ', h: '撮影情報ごと、<br>写真を額に入れる。', hs: 52, lh: 1.42, cap: '01　湖の鳥居と天の川', spec: '4:5 · White · Didot · 3行' },
  en: { k: 'A free web app that frames your photos', h: 'Frame your photo,<br>shooting details and all.', hs: 46, lh: 1.22, cap: '01　Torii and the Milky Way', spec: '4:5 · White · Didot' },
};
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const lang of ['ja', 'en']) {
  const c = COPY[lang];
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
@font-face{font-family:S;src:url(${u(SERIF)})}
@font-face{font-family:P;src:url(${u(PUB + '/fonts/PlayfairDisplay-regular.woff2')})}
@font-face{font-family:J;src:url(${u(PUB + '/fonts/Jost-regular.woff2')})}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;position:relative;color:#ece7de;font-family:S,serif;
  background:radial-gradient(ellipse 34% 62% at 76% 46%,rgba(255,238,212,.2),rgba(255,238,212,.06) 55%,rgba(255,238,212,0) 80%),#1f1e1c}
.t{position:absolute;left:76px;top:0;bottom:0;width:600px;display:flex;flex-direction:column;justify-content:center}
.b{font:34px/1 P,serif;letter-spacing:.01em;margin-bottom:44px}
.k{font:15px/1.6 J,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#aca69b;margin-bottom:18px;display:flex;align-items:center;gap:14px}
.k i{width:30px;height:1px;background:#aca69b}
h1{font-size:${c.hs}px;line-height:${c.lh};font-weight:600;letter-spacing:.03em}
.n{display:flex;gap:34px;margin-top:34px;padding-top:18px;border-top:1px solid rgba(236,231,222,.16);font:38px/1 P,serif;color:#ece7de}
.n span small{display:block;margin-top:8px;font:12px/1 J,sans-serif;letter-spacing:.12em;color:#7f796f}
.p{position:absolute;right:92px;top:56px;height:462px;box-shadow:0 1px 2px rgba(0,0,0,.45),0 34px 60px -24px rgba(0,0,0,.9)}
.l{position:absolute;right:92px;top:536px;width:370px;font:13px/1.6 J,sans-serif;letter-spacing:.05em;color:#aca69b;display:flex;justify-content:space-between;align-items:baseline;gap:16px;white-space:nowrap}
.l b{font:400 14px/1.5 S,serif;color:#ece7de;letter-spacing:.03em}
</style></head><body>
<div class="t"><div class="b">Fuchidori</div><div class="k">${c.k}</div><h1>${c.h}</h1>
<div class="n"><span>F1.8<small>${lang === 'ja' ? 'F値' : 'APERTURE'}</small></span><span>15s<small>${lang === 'ja' ? 'シャッター速度' : 'SHUTTER'}</small></span><span>ISO3200<small>${lang === 'ja' ? 'ISO感度' : 'ISO'}</small></span></div></div>
<img class="p" src="${u(PUB + '/img/hero-1280.webp')}">
<div class="l"><b>${c.cap}</b><span>${c.spec}</span></div>
</body></html>`;
  const f = resolve(HERE, `work/og-${lang}.html`);
  writeFileSync(f, html);
  await page.goto(u(f));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(PUB, `img/og-${lang}.jpg`), type: 'jpeg', quality: 86 });
  console.log('og', lang);
}
await b.close();
