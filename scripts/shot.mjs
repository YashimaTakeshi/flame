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
/*
 * 書き出しの窓（スマホ）。画像が残りの高さに収まり、ボタンまで**スクロールせずに**見えること。
 * ★実測: 以前は画像が幅いっぱいで、保存のボタンが窓の下に隠れていた。★
 */
const fitOf = () => {
  const body = document.querySelector('.sheet__body');
  const box = document.querySelector('.result');
  const img = document.querySelector('.result-img');
  if (!body || !box || !img) return { ok: false, reason: '窓か画像が無い' };
  const b = body.getBoundingClientRect(), k = box.getBoundingClientRect(), i = img.getBoundingClientRect();
  const inside = i.top >= b.top - 0.5 && i.bottom <= b.bottom + 0.5 && i.left >= b.left - 0.5 && i.right >= 0 && i.right <= b.right + 0.5;
  // 枠からのはみ出し（はみ出すと下が切れる。★9:16 で 430px はみ出していた★）
  const spill = Math.round(Math.max(0, i.bottom - k.bottom, k.top - i.top, i.right - k.right, k.left - i.left));
  const scrolls = body.scrollHeight > body.clientHeight + 1;
  const buttonsVisible = [...document.querySelectorAll('.sheet .btn')].every((el) => { const r = el.getBoundingClientRect(); return r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5; });
  // 写った絵の大きさ（contain。全体が見えているか／どれだけ場所を使えているか）
  const ratio = img.naturalWidth / img.naturalHeight;
  const drawnH = Math.min(i.height, i.width / ratio), drawnW = drawnH * ratio;
  return { ok: inside && spill === 0 && !scrolls && buttonsVisible, scrolls, imgInside: inside, spill, buttonsVisible,
    drawn: [Math.round(drawnW), Math.round(drawnH)], area: [Math.round(k.width), Math.round(k.height)] };
};
const phoneDialogs = {};
for (const r of ['9:16', '16:9']) {
  await page.getByRole('tab', { name: '配置' }).click();
  await page.waitForTimeout(250);
  await page.locator('.wheel').first().getByRole('radio', { name: r, exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: '書き出す' }).click();
  await page.waitForTimeout(2500);
  phoneDialogs[r] = await page.evaluate(fitOf);
  await page.screenshot({ path: `/tmp/u8-export-${r.replace(':', '-')}.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}
console.log('書き出しの窓（スマホ）:', JSON.stringify(phoneDialogs));

/*
 * 面は履歴に載る。iPhone の戻るスワイプ（＝history.back）で、アプリごと離れるのではなく面が1段閉じる。
 * ★実測: 以前は面を閉じるつもりで端を払うとページを離れ、写真と設定を失った。★
 */
await page.getByRole('tab', { name: '情報' }).click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: '編集' }).first().click();
await page.waitForTimeout(400);
const sheetOpened = await page.evaluate(() => ({ sheet: !!document.querySelector('.sheet'), hash: location.hash }));
await page.evaluate(() => history.back());
await page.waitForTimeout(500);
const afterBack = await page.evaluate(() => ({
  sheet: !!document.querySelector('.sheet'),
  hash: location.hash,
  photoKept: !!document.querySelector('canvas.stage__canvas'),
}));
// ✕ で閉じたときも印が残らない（次の戻るでアプリを離れるのが正しい）
await page.getByRole('button', { name: '書き出す' }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'やめる' }).click();
await page.waitForTimeout(500);
const afterClose = await page.evaluate(() => ({ sheet: !!document.querySelector('.sheet'), hash: location.hash }));
console.log('戻るで面が閉じる:', JSON.stringify({ opened: sheetOpened, afterBack, afterClose }));
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
/*
 * 書き出しの窓。**縦長（9:16）**で開く。
 * ★実測: 横長や正方形は幅で決まるのでたまたま収まり、縦長だけが枠からはみ出して下が切れていた。★
 */
await desk.locator('.side .seg__opt', { hasText: '9:16' }).first().click();
await desk.waitForTimeout(500);
await desk.getByRole('button', { name: '書き出す' }).click();
await desk.waitForTimeout(2500);
const dialog = await desk.evaluate(() => {
  const r = document.querySelector('.sheet')?.getBoundingClientRect();
  if (!r) return null;
  const cx = r.left + r.width / 2;
  return { centered: Math.abs(cx - window.innerWidth / 2) < 4, width: Math.round(r.width), buttons: [...document.querySelectorAll('.sheet .btn')].map(b => b.textContent?.trim()) };
});
const deskFit = await desk.evaluate(fitOf);
/*
 * 書き出した JPEG に撮影情報が書き戻されているか。表示用の data: URL の先頭を読む。
 * ★実測: 以前は canvas の出力そのままで EXIF が無く、写真アプリで「今日」に並んだ。★
 */
const exifBack = await desk.evaluate(() => {
  const src = document.querySelector('.result-img')?.getAttribute('src') ?? '';
  if (!src.startsWith('data:image/jpeg;base64,')) return { checked: false };
  const bin = atob(src.slice('data:image/jpeg;base64,'.length, 'data:image/jpeg;base64,'.length + 12000));
  return {
    checked: true,
    hasExif: bin.includes('Exif\u0000\u0000'),
    hasModel: bin.includes('iPhone 16 Pro'),
    hasDate: bin.includes('2026:09:21'),
    hasSoftware: bin.includes('flame '),
    noGps: !bin.includes('GPSVersion') && !/\x88\x25/.test(bin.slice(0, 200)),
  };
});
await desk.screenshot({ path: '/tmp/d2-desk-export.png' });
console.log('PC の組み方:', JSON.stringify({ ...deskReport, squareAfterPick: square, dialog: { ...dialog, fit: deskFit, exif: exifBack } }, null, 1));

/*
 * 窓を縮めて PC → スマホの組み方に切り替える。canvas の要素が作り直されるので、
 * 新しい canvas にも描かれていること（真っ暗でないこと）を画素で見る。
 * ★実測: 以前は ref が同じまま中身だけ差し替わり、一度も描かれずに真っ暗だった。★
 */
await desk.keyboard.press('Escape');
await desk.waitForTimeout(300);
await desk.setViewportSize({ width: 480, height: 900 });
await desk.waitForTimeout(900);
const afterShrink = await desk.evaluate(() => {
  const c = document.querySelector('canvas.stage__canvas');
  if (!c) return { layout: null, painted: false, reason: 'canvas が無い' };
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  return { layout: document.querySelector('.app')?.getAttribute('data-layout'), painted: seen.size > 8, colors: seen.size, w: c.width, h: c.height };
});
await desk.screenshot({ path: '/tmp/d3-shrunk.png' });
// 戻しても描かれること
await desk.setViewportSize({ width: 1440, height: 900 });
await desk.waitForTimeout(900);
const afterGrow = await desk.evaluate(() => {
  const c = document.querySelector('canvas.stage__canvas');
  if (!c) return { painted: false };
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  return { layout: document.querySelector('.app')?.getAttribute('data-layout'), painted: seen.size > 8 };
});
console.log('縮めたあと:', JSON.stringify(afterShrink), ' 戻したあと:', JSON.stringify(afterGrow));
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

/*
 * 公開し直した直後、ブラウザが**古い index.html** を持っていると、
 * 消えた名前の部品が 404 になり、題だけ出て真っ黒な画面になる（実機で発生）。
 * 古い HTML を掴んだ状態を作り、自力で取り直して立ち直ることを見る。
 */
const staleHtml = readFileSync(resolve(DIST, 'index.html'), 'utf8')
  .replace(/assets\/index-[\w-]+\.js/, 'assets/index-OLDOLDOL.js')
  .replace(/assets\/index-[\w-]+\.css/, 'assets/index-OLDOLDOL.css');
const staleSrv = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const busted = (req.url ?? '').includes('?');
  if (p === '/') p = '/index.html';
  if (p === '/index.html') {
    // 問い合わせが付くまでは古い HTML を返す（ブラウザのキャッシュを模す）
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    res.end(busted ? readFileSync(resolve(DIST, 'index.html')) : staleHtml);
    return;
  }
  const f = resolve(DIST, '.' + p);
  if (!f.startsWith(DIST) || !existsSync(f)) { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise(ok => staleSrv.listen(0, '127.0.0.1', ok));
const staleCtx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const stalePage = await staleCtx.newPage();
await stalePage.goto(`http://127.0.0.1:${staleSrv.address().port}`, { waitUntil: 'networkidle' });
await stalePage.waitForTimeout(5000);
const revived = await stalePage.evaluate(() => ({
  mounted: (document.getElementById('root')?.childElementCount ?? 0) > 0,
  header: !!document.querySelector('.hdr'),
  // 取り直しの印は人に見せない
  urlClean: location.search === '',
}));
console.log('古い HTML から立ち直るか:', JSON.stringify(revived));
await staleCtx.close(); staleSrv.close();

/*
 * PC の入口。窓に落とす・貼り付ける。どちらもボタン無しで写真が開く。
 */
const FIX_B64 = readFileSync('/home/user/flame/tests/fixtures/iphone-portrait.jpg').toString('base64');
const entryCtx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const entry = await entryCtx.newPage();
await entry.goto(origin, { waitUntil: 'networkidle' });
const fileHandle = (p) => p.evaluateHandle((b64) => {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const dt = new DataTransfer();
  dt.items.add(new File([u8], 'drop.jpg', { type: 'image/jpeg' }));
  return dt;
}, FIX_B64);
await entry.dispatchEvent('.app', 'dragover', { dataTransfer: await fileHandle(entry) });
const highlighted = await entry.evaluate(() => document.querySelector('.app')?.hasAttribute('data-dragging'));
await entry.dispatchEvent('.app', 'drop', { dataTransfer: await fileHandle(entry) });
const dropped = await entry.waitForSelector('canvas.stage__canvas', { timeout: 15000 }).then(() => true).catch(() => false);
const unhighlighted = await entry.evaluate(() => !document.querySelector('.app')?.hasAttribute('data-dragging'));
await entry.reload({ waitUntil: 'networkidle' });
await entry.evaluate((b64) => {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const dt = new DataTransfer();
  dt.items.add(new File([u8], 'paste.jpg', { type: 'image/jpeg' }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
}, FIX_B64);
const pasted = await entry.waitForSelector('canvas.stage__canvas', { timeout: 15000 }).then(() => true).catch(() => false);
console.log('PC の入口:', JSON.stringify({ highlighted, dropped, unhighlighted, pasted }));
await entryCtx.close();

await b.close(); server.close();
