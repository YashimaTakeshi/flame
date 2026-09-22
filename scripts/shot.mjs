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
await page.screenshot({ path: '/tmp/u2-place.png' });

// タブを順に開く
for (const [name, file] of [['組み','u3-layout'],['地色','u4-color'],['書体','u5-font'],['刻印','u5b-badge'],['情報','u6-info']]) {
  await page.getByRole('tab', { name }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `/tmp/${file}.png` });
}

/*
 * 「アイコンが切れている」を目で探さない。
 * オプション行の矩形に、中の部品が縦方向で収まっているかを測る。
 * 横は横スクロール行なので、はみ出して当たり前（縦だけを見る）。
 */
async function clippedIn(tabName) {
  if (tabName) { await page.getByRole('tab', { name: tabName }).click(); await page.waitForTimeout(250); }
  return page.evaluate(() => {
    const row = document.querySelector('.optrow')?.getBoundingClientRect();
    if (!row) return ['オプション行が無い'];
    const out = [];
    for (const el of document.querySelectorAll('.optrow .wheel__frame, .optrow .wheel__cap, .optrow .checklist, .optrow .iconbtn')) {
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      if (r.top < row.top - 0.5 || r.bottom > row.bottom + 0.5) {
        out.push(`${el.className.split(' ')[0]}「${(el.textContent ?? '').trim().slice(0, 10)}」 ${Math.round(r.top)}〜${Math.round(r.bottom)} が行 ${Math.round(row.top)}〜${Math.round(row.bottom)} からはみ出す`);
      }
    }
    return out;
  });
}

const clipped = {};
for (const t of ['配置', '組み', '地色', '書体', '刻印', '情報']) clipped[t] = await clippedIn(t);

// 配置タブの6比率を順に選んで、どの比率でも列が切れないか
await page.getByRole('tab', { name: '配置' }).click();
await page.waitForTimeout(250);
const ratioWheel = page.locator('.wheel').first();
const ratios = await ratioWheel.locator('.wheel__item').allTextContents();
const perRatio = {};
for (const r of ratios) {
  await ratioWheel.getByRole('radio', { name: r, exact: true }).click();
  await page.waitForTimeout(450);
  perRatio[r] = await clippedIn(null);
  await page.screenshot({ path: `/tmp/u7-place-${r.replace(/[:\/]/g, '-')}.png` });
}
console.log('切れている部品:', JSON.stringify(clipped, null, 1));

/*
 * PC の組み方（desk）。幅 1440 で開き直し、
 *   - 設定の欄に 6 つの節が全部あり、押しボタンの並びが出ていること
 *   - 欄の中の部品が欄の横幅からはみ出さないこと
 *   - 書き出しの窓が真ん中に出ること
 * を見る。ホイールは出ていてはいけない（鼠には向かない）。
 */
const deskCtx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const desk = await deskCtx.newPage();
const deskErrs = [];
desk.on('pageerror', e => deskErrs.push(String(e)));
desk.on('console', m => { if (m.type()==='error' && !m.text().includes('404')) deskErrs.push('[console] '+m.text()); });
await desk.goto(origin, { waitUntil: 'networkidle' });
await desk.setInputFiles('input[type=file]', '/home/user/flame/tests/fixtures/iphone-portrait.jpg');
await desk.waitForSelector('canvas.stage__canvas', { timeout: 15000 });
await desk.waitForTimeout(700);
await desk.screenshot({ path: '/tmp/d1-desk.png' });
const deskReport = await desk.evaluate(() => {
  const side = document.querySelector('.side');
  const sideR = side?.getBoundingClientRect();
  const overflow = [];
  if (sideR) {
    for (const el of document.querySelectorAll('.side .seg__opt, .side .check, .side .iconbtn')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.left < sideR.left - 0.5 || r.right > sideR.right + 0.5) {
        overflow.push(`${el.className.split(' ')[0]}「${(el.textContent ?? '').trim().slice(0, 12)}」が欄の横からはみ出す`);
      }
    }
  }
  const c = document.querySelector('canvas.stage__canvas')?.getBoundingClientRect();
  return {
    layout: document.querySelector('.app')?.getAttribute('data-layout'),
    sections: document.querySelectorAll('.side__sec').length,
    segments: document.querySelectorAll('.side .seg').length,
    wheels: document.querySelectorAll('.wheel').length,
    tabbar: !!document.querySelector('.tabbar'),
    canvasW: c ? Math.round(c.width) : 0,
    overflow,
  };
});
// 押しボタンで選べるか（比率 1:1 → キャンバスが正方形になる）
await desk.locator('.side .seg__opt', { hasText: '1:1' }).first().click();
await desk.waitForTimeout(500);
const square = await desk.evaluate(() => { const c = document.querySelector('canvas.stage__canvas')?.getBoundingClientRect(); return c ? Math.abs(c.width - c.height) < 2 : false; });
// 書き出しの窓
await desk.getByRole('button', { name: '書き出す' }).click();
await desk.waitForTimeout(2500);
const dialog = await desk.evaluate(() => {
  const r = document.querySelector('.sheet')?.getBoundingClientRect();
  if (!r) return null;
  const cx = r.left + r.width / 2;
  return { centered: Math.abs(cx - window.innerWidth / 2) < 4, width: Math.round(r.width), buttons: [...document.querySelectorAll('.sheet .btn')].map(b => b.textContent?.trim()) };
});
await desk.screenshot({ path: '/tmp/d2-desk-export.png' });
console.log('PC の組み方:', JSON.stringify({ ...deskReport, squareAfterPick: square, dialog }, null, 1));
console.log('PC のエラー:', deskErrs.length ? deskErrs : 'なし');
await deskCtx.close();

console.log('比率ごとの配置行:', JSON.stringify(perRatio, null, 1));

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
    // ホイールの中で上下に送られて見えていない行も飛ばす。そこは指が届かなくて正しい
    const atCenter = document.elementFromPoint(cx, cy);
    if (!(atCenter === el || el.contains(atCenter))) return null;
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
