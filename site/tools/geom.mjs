// 留める場面の中身が舞台（画面）からはみ出していないか、ラベルとメーターが重ならないかを測る
// node site/tools/geom.mjs [path]  （serve.mjs を先に起動。ORIGIN=http://127.0.0.1:8787 で配信先、VIEWS=390x664,375x553,... で画面を指定）
// iPhone の Safari は 100svh が 660px（SE は 550px）ほどしかない。390×844 だけで確かめると見落とす
import { chromium } from 'playwright';
const path = process.argv[2] ?? '/fuchidori/';
const views = (process.env.VIEWS ?? '320x568,375x553,375x667,390x664,390x844,414x736,430x740,360x640,844x390,667x375,768x1024,820x1180,1024x768,1280x720,1366x768,1440x900,1920x1080').split(',');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
for (const v of views) {
  const [w, h] = v.split('x').map(Number);
  const mobile = w < 1000;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  await page.goto((process.env.ORIGIN ?? 'http://127.0.0.1:8787') + path + (process.env.Q ?? ''), { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const probs = [];
  const at = async (sel, q) => {
    await page.evaluate(({ sel, q }) => {
      const el = document.querySelector(sel);
      const top = el.getBoundingClientRect().top + scrollY;
      scrollTo(0, Math.round(top + (el.offsetHeight - innerHeight) * q));
    }, { sel, q });
    await page.waitForTimeout(900);
  };
  const out = (sel, name) => page.evaluate(({ sel, name, h, w }) => {
    const r = [];
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const rc = el.getBoundingClientRect();
      if (rc.width === 0) continue;
      if (rc.bottom > h + 0.5) r.push(`${name}: ${el.className || el.tagName} bottom ${Math.round(rc.bottom)} > ${h}`);
      if (rc.top < -0.5) r.push(`${name}: ${el.className || el.tagName} top ${Math.round(rc.top)} < 0`);
      if (rc.right > w + 0.5) r.push(`${name}: ${el.className || el.tagName} right ${Math.round(rc.right)} > ${w}`);
      if (rc.left < -0.5) r.push(`${name}: ${el.className || el.tagName} left ${Math.round(rc.left)} < 0`);
    }
    return r;
  }, { sel, name, h, w });
  const m = await page.evaluate(() => document.documentElement.classList.contains('m'));
  if (!m) { console.log(v, 'no .m'); await ctx.close(); continue; }
  // 冒頭の最初: 文とボタンが、下の札・Scroll の合図に重ならないか
  await at('.hero', 0);
  const h0 = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); const cs = getComputedStyle(e); return cs.display === 'none' ? null : e.getBoundingClientRect(); };
    const a = r('.hero__intro'), t = r('.hero__tag'), c = r('.hero__cue'), top = document.querySelector('.top').getBoundingClientRect();
    return { ib: Math.round(a.bottom), it: Math.round(a.top), tt: t && Math.round(t.top), ct: c && Math.round(c.top), topB: Math.round(top.bottom), topH: Math.round(top.height) };
  });
  const lim = Math.min(h0.tt ?? 1e9, h0.ct ?? 1e9);
  if (h0.ib > lim - 4) probs.push(`hero intro bottom ${h0.ib} hits tag/cue ${lim}`);
  if (h0.it < h0.topB) probs.push(`hero intro top ${h0.it} under header ${h0.topB}`);
  if (h0.topH > 60) probs.push(`header height ${h0.topH}`);
  // 冒頭の最後
  await at('.hero', 1);
  probs.push(...await out('.hero__frame, .hero__nums, .hero__label > *', 'hero'));
  // 展示室: 各作品の止まる所
  const n = await page.evaluate(() => document.querySelectorAll('.work').length);
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => document.querySelectorAll('[data-go]')[i].click(), i);
    await page.waitForTimeout(500);
    const g = await page.evaluate((i) => {
      const wk = document.querySelectorAll('.work')[i];
      const f = wk.querySelector('.work__frame').getBoundingClientRect();
      const lb = wk.querySelector('.label').getBoundingClientRect();
      const mt = document.querySelector('.walk__meter');
      const mr = getComputedStyle(mt).display === 'none' ? null : mt.getBoundingClientRect();
      return { f: [f.left, f.top, f.right, f.bottom].map(Math.round), lb: [lb.left, lb.top, lb.right, lb.bottom].map(Math.round), mt: mr && Math.round(mr.top), vw: innerWidth, vh: innerHeight };
    }, i);
    if (g.f[1] < 0) probs.push(`walk ${i + 2}: frame top ${g.f[1]}`);
    if (g.lb[3] > g.vh) probs.push(`walk ${i + 2}: label bottom ${g.lb[3]} > ${g.vh}`);
    else if (g.mt != null && g.lb[3] > g.mt - 4) probs.push(`walk ${i + 2}: label bottom ${g.lb[3]} hits meter ${g.mt}`);
    if (g.lb[2] > g.vw) probs.push(`walk ${i + 2}: label right ${g.lb[2]} > ${g.vw}`);
    const nx = await page.evaluate((i) => { const ws = document.querySelectorAll('.work'); if (i + 1 >= ws.length) return null; const a = ws[i].querySelector('.label').getBoundingClientRect(); const b = ws[i + 1].querySelector('.label').getBoundingClientRect(); return [Math.round(a.right), Math.round(b.left)]; }, i);
    if (nx && nx[0] > nx[1] - 12) probs.push(`walk ${i + 2}: label right ${nx[0]} hits next label ${nx[1]}`);
    if (g.f[0] < 0 || g.f[2] > g.vw) probs.push(`walk ${i + 2}: frame x ${g.f[0]}..${g.f[2]}`);
  }
  // 出口の最後
  await at('.stack', 1);
  probs.push(...await out('.stack__text > *, .now, .stack__exif, .pr.is-in img', 'stack'));
  const ov = await page.evaluate(() => {
    const t = [...document.querySelectorAll('.stack__text > *, .now, .stack__exif')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect());
    const p = [...document.querySelectorAll('.pr.is-in img')].map((e) => e.getBoundingClientRect());
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    let n = 0;
    for (const a of t) for (const q of p) if (hit(a, q)) n++;
    return n;
  });
  if (ov) probs.push(`stack: ${ov} print/text overlaps`);
  // 比率: 各比率で止まる所
  for (const q of [0.02, 0.36, 0.64, 0.99]) {
    await at('.ratio', q);
    probs.push(...(await out('.ratio__head > *, .ratio__list, .ratio__mat', `ratio@${q}`)));
  }
  console.log(v, probs.length ? '\n  - ' + [...new Set(probs)].join('\n  - ') : 'OK');
  await ctx.close();
}
await b.close();
