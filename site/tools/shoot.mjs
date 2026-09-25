/**
 * ページをスクロールしながら撮る（動きのある紙面の確認用）。
 *
 *   node site/tools/shoot.mjs <URL> <出力先> [phone|desk|both]
 *
 * 撮るもの
 *   <幅>-step-NN.png … 画面1枚ずつ（0.6 画面ずつ送り、動きが落ち着くのを待ってから撮る）
 *   <幅>-reduced.png … 「視差効果を減らす」を入れたときのページ全体
 *   report.json      … 横のはみ出し（画面の幅と比べた、途中の位置での最大）、コンソールのエラー・CSP 違反、読み込めなかったもの、転送量
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [url, out, which = 'both'] = process.argv.slice(2);
if (!url || !out) throw new Error('使い方: node site/tools/shoot.mjs <URL> <出力先> [phone|desk|both]');
mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const VIEWS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const report = {};
for (const name of which === 'both' ? ['phone', 'desk'] : [which]) {
  const r = (report[name] = { errors: [], failed: [], bytes: 0, firstViewBytes: 0, overflowPx: 0, steps: 0 });
  for (const reduced of [false, true]) {
    const ctx = await b.newContext({ ...VIEWS[name], reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    if (!reduced) {
      page.on('console', (m) => (m.type() === 'error' || /Refused|Content Security Policy/.test(m.text())) && r.errors.push(m.text()));
      page.on('pageerror', (e) => r.errors.push(String(e)));
      page.on('requestfailed', (q) => r.failed.push(q.url()));
      page.on('response', async (res) => { if (res.status() >= 400) r.failed.push(`${res.status()} ${res.url()}`); try { r.bytes += (await res.body()).length; } catch {} });
    }
    await page.goto(url, { waitUntil: 'networkidle' });
    if (!reduced) {
      r.firstViewBytes = r.bytes;
      await page.screenshot({ path: resolve(out, `${name}-step-00.png`) });
      const H = await page.evaluate(() => document.documentElement.scrollHeight);
      const vh = VIEWS[name].viewport.height;
      let i = 1;
      for (let y = Math.round(vh * 0.6); y < H; y += Math.round(vh * 0.6), i++) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(450);
        await page.screenshot({ path: resolve(out, `${name}-step-${String(i).padStart(2, '0')}.png`) });
        // はみ出しは、決めた画面の幅と比べる（innerWidth ははみ出しに合わせて広がることがある）。途中の位置の最大
        r.overflowPx = Math.max(r.overflowPx, await page.evaluate((w) => document.documentElement.scrollWidth - w, VIEWS[name].viewport.width));
      }
      r.steps = i;
    } else {
      await page.evaluate(() => document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; }));
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: resolve(out, `${name}-reduced.png`), fullPage: true });
    }
    await ctx.close();
  }
}
await b.close();
writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
