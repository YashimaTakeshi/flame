// Fuchidori 紹介ページで動くスクリプト（defer。先に <head> の boot.js が html.m を付けている。CSP は script-src 'self'）。
//
// 1. 人に教える（端末の共有シート／リンクのコピー）
// 2. スクロールで進む場面。どれも画面に留めた舞台の中で、transform・opacity・clip-path だけを動かす
//    冒頭   … 画面いっぱいの撮って出しが、額の中の定位置へ縮み、余白が広がり、キャプションが打ち出される
//    展示室 … 縦のスクロールで作品の列が横へ進む。作品が中央に来たところで少し止まる
//    出口   … 同じ一枚を七通りに刷ったプリントが、1枚ずつ落ちて束になる
//    帯     … 撮影情報の大きな数字が、壁面の文字のように横へ流れる
//    比率   … 写真はそのままで、額の形と地色が 4:5 → 9:16 → 1:1 → 16:9 と変わる
//    写真と額の位置は、書き出した画像の中で写真が占める矩形（img/frames.json を build-pages.mjs が data-* に写したもの）
// JS が無いとき・「視差効果を減らす」のときは何もしない。CSS の基本の並び（最終の姿）で全部見える。
(() => {
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ── 1. 人に教える ──
  const box = $('[data-share]');
  const data = box && { title: document.title, text: box.dataset.text, url: box.dataset.url };
  if (box) {
    const say = $('.share__done', box);
    const native = $('[data-act="native"]', box);
    if (navigator.share && native) {
      native.hidden = false;
      native.addEventListener('click', () => navigator.share(data).catch(() => {}));
    }
    const copy = $('[data-act="copy"]', box);
    if (copy) {
      copy.hidden = false; // JS が無いと押しても何も起きないので、それまでは隠しておく
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(data.url);
          say.textContent = box.dataset.copied;
        } catch {
          say.textContent = data.url;
        }
      });
    }
  }
  // 冒頭・展示の出口・天の「人に教える」: 共有シートがあれば開く。無ければリンクのまま #share へ（移動は瞬時）
  if (data && navigator.share) {
    $$('[data-tell]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      navigator.share(data).catch(() => {});
    }));
  }

  if (!root.classList.contains('m')) return;
  root.classList.add('m-ok'); // boot.js への合図（本体が動いた）

  // 途中で止まったら、止まった紙面に戻す（入れた位置や大きさも消す）
  const fail = (err) => {
    root.classList.remove('m', 'sda');
    $$('[style]').forEach((el) => el.removeAttribute('style'));
    console.warn(err);
  };
  const safe = (fn) => (...a) => {
    try {
      return fn(...a);
    } catch (err) {
      fail(err);
    }
  };

  safe(() => {
    const sda = root.classList.contains('sda');
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const seg = (q, a, b) => clamp((q - a) / (b - a));
    const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const out = (t) => 1 - (1 - t) ** 3;
    const lerp = (a, b, t) => a + (b - a) * t;
    const mix = (A, B, t) => ({ x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t), w: lerp(A.w, B.w, t), h: lerp(A.h, B.h, t) });
    const nums = (s) => s.trim().split(/\s+/).map(Number);
    const rel = (el, b) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
    };
    const inner = (F, [x, y, w, h]) => ({ x: F.x + x * F.w, y: F.y + y * F.h, w: w * F.w, h: h * F.h });
    // 置いてある矩形 L の要素を、矩形 R に見せる（transform-origin は左上）
    const fit = (el, R, L) => {
      el.style.transform = `translate3d(${(R.x - L.x).toFixed(2)}px,${(R.y - L.y).toFixed(2)}px,0) scale(${(R.w / L.w).toFixed(5)},${(R.h / L.h).toFixed(5)})`;
    };
    const px = (el, R) => {
      el.style.left = `${R.x}px`;
      el.style.top = `${R.y}px`;
      el.style.width = `${R.w}px`;
      el.style.height = `${R.h}px`;
    };
    const show = (el, o, dy = 16) => {
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate3d(0,${((1 - o) * dy).toFixed(1)}px,0)`;
      el.style.visibility = o > 0 ? 'visible' : 'hidden'; // 見えていない間は押せないように
    };

    // 見えてきたら .is-in（CSS のスクロール連動が無いときの代わり）
    if (!sda) {
      const io = new IntersectionObserver((es) => {
        for (const e of es) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }, { rootMargin: '0px 0px -12% 0px' });
      $$('.rv, .loupe').forEach((el) => io.observe(el));
    }

    // 天: 下へ読む間は引っ込め、戻ると出す
    const top = $('.top');
    let lastY = scrollY;
    const header = () => {
      if (!top) return;
      const y = scrollY;
      top.classList.toggle('is-solid', y > 24);
      if (Math.abs(y - lastY) < 8) return;
      top.classList.toggle('is-away', y > lastY && y > 160);
      lastY = y;
    };

    // ── 2. 場面 ──
    // sec … 画面に近いかを見る区間。stage … 画面に留める舞台。cover … 留めずに通り過ぎる要素（帯）
    const scenes = [];
    const scene = (o) => scenes.push({ top: 0, len: 1, vh: 1, q: -1, on: true, ...o });

    // 冒頭: 撮って出し → 額 → キャプション → 作品ラベル
    const hero = $('[data-scene="hero"]');
    if (hero) {
      const stage = $('.hero__stage', hero);
      const photo = $('.hero__photo', hero);
      const print = $('.hero__print', hero);
      const mat = $('.mat', hero);
      const glow = $('.hero__frame .glow', hero);
      const late = $$('.hero__nums, .hero__label', hero);
      const intro = $('.hero__intro', hero);
      const fades = [intro, ...$$('.hero__scrim, .hero__tag, .hero__cue', hero)];
      const crop = nums(photo.dataset.crop);
      const [capL, capW] = nums(print.dataset.cap);
      let L, F, P;
      scene({
        sec: hero,
        stage,
        measure() {
          photo.style.transform = 'none';
          const b = stage.getBoundingClientRect();
          L = rel(photo, b);
          F = rel(print, b);
          P = inner(F, crop);
        },
        render(q) {
          // 写真が縮む（0.03–0.5）→ 余白が写真の縁から外へ広がる（0.38–0.66）→ キャプションを左から打ち出す（0.68–0.8）→ ラベル
          const R = mix(L, P, inOut(seg(q, 0.03, 0.5)));
          fit(photo, R, L);
          fit(mat, mix(R, F, out(seg(q, 0.38, 0.66))), F);
          glow.style.opacity = seg(q, 0.34, 0.7).toFixed(3);
          const w = seg(q, 0.68, 0.8);
          print.style.opacity = w > 0 ? '1' : '0';
          print.style.clipPath = w >= 1 ? 'none' : `inset(0 ${((1 - capL - w * capW) * 100).toFixed(2)}% 0 0)`;
          late.forEach((el, i) => show(el, seg(q, 0.78 + i * 0.04, 0.9 + i * 0.04)));
          const f = 1 - seg(q, 0, 0.14);
          fades.forEach((el) => { el.style.opacity = f.toFixed(3); });
          intro.style.transform = `translate3d(0,${((1 - f) * -28).toFixed(1)}px,0)`;
          intro.style.visibility = f > 0 ? 'visible' : 'hidden';
        },
      });
    }

    // 展示室: 縦のスクロールで横へ。各作品が中央に来た所で hold だけ止まる
    const walk = $('[data-scene="walk"]');
    let walkTo = null;
    if (walk) {
      const stage = $('.walk__stage', walk);
      const track = $('.walk__track', walk);
      const works = $$('.work', walk);
      const nos = works.map((w) => $('.label__no', w)?.textContent ?? '');
      const count = $('.walk__count b', walk);
      const bar = $('.walk__bar i', walk);
      const HOLD = Number(walk.dataset.hold) || 0.26; // 止まる長さ（画面の高さに対する比）
      const PACE = Number(walk.dataset.pace) || 0.9; // 横に 1px 進むのに要る縦のスクロール
      let xs = [], segs = [], run = 1, travel = 0, cur = -1;
      const s = scene({
        sec: walk,
        stage,
        measure() {
          track.style.transform = 'none';
          const vw = stage.clientWidth;
          const V = stage.clientHeight;
          const hold = V * HOLD;
          let prev = 0;
          xs = works.map((w) => (prev = Math.max(prev, w.offsetLeft + w.offsetWidth / 2 - vw / 2)));
          segs = [];
          let acc = 0;
          xs.forEach((x, i) => {
            segs.push({ a: acc, b: acc + hold, x0: x, x1: x, i });
            acc += hold;
            if (i < xs.length - 1) {
              const d = (xs[i + 1] - x) * PACE;
              segs.push({ a: acc, b: acc + d, x0: x, x1: xs[i + 1] });
              acc += d;
            }
          });
          run = acc;
          travel = xs[xs.length - 1] || 0;
          // 高さは CSS が同じ式で先に決めている。ずれていたら（スクロールバーの幅など）ここで合わせる
          const want = Math.round(V + run);
          if (Math.abs(walk.offsetHeight - want) > 1) walk.style.height = `${want}px`;
        },
        render(q) {
          const at = q * run;
          let x = travel;
          for (const g of segs) {
            if (at <= g.b) {
              x = g.x0 === g.x1 ? g.x0 : lerp(g.x0, g.x1, inOut(clamp((at - g.a) / (g.b - g.a))));
              break;
            }
          }
          track.style.transform = `translate3d(${(-x).toFixed(1)}px,0,0)`;
          let best = 0, bd = Infinity;
          xs.forEach((c, i) => {
            const d = Math.abs(c - x);
            if (d < bd) { bd = d; best = i; }
          });
          if (best !== cur) {
            cur = best;
            count.textContent = nos[best];
          }
          bar.style.transform = `scaleX(${(travel ? x / travel : 0).toFixed(4)})`;
        },
      });
      // i 番目の作品が中央で止まっている所へ送る
      walkTo = (i) => {
        const me = scenes[s - 1];
        const g = segs.find((x) => x.i === i);
        if (!g) return false;
        scrollTo(0, Math.round(me.top + (g.a + g.b) / 2));
        return true;
      };
      // キーボードで帯の中にフォーカスが来たら、その作品が中央に来る所までページを送る
      walk.addEventListener('focusin', (e) => {
        const el = e.target.closest('.work');
        if (el) walkTo(works.indexOf(el));
      });
      // 出品目録: 押すと、その作品が中央に来るまで送る
      $$('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
        if (walkTo(Number(a.dataset.go))) e.preventDefault();
      }));
    }

    // 出口: 何枚目までが束に乗るかを決める（落ちる動き自体は CSS の transition）
    const stack = $('[data-scene="stack"]');
    if (stack) {
      const prints = $$('.pr', stack);
      const labels = $$('.now__i', stack);
      let shown = -1;
      scene({
        sec: stack,
        stage: $('.stack__stage', stack),
        measure() {},
        render(q) {
          // 舞台が画面に入るころに1枚目が落ち、留まっている間に残りが1枚ずつ重なる
          const n = Math.min(prints.length, 1 + Math.floor(q * prints.length * 1.12));
          if (n === shown) return;
          shown = n;
          prints.forEach((el, i) => el.classList.toggle('is-in', i < n));
          labels.forEach((el, i) => el.classList.toggle('is-top', i === n - 1));
        },
      });
    }

    // 帯: 通り過ぎる間に、右端から左端まで流れる
    const band = $('.band__row');
    if (band) {
      const wrap = band.parentElement;
      let W = 0, vw = 0;
      scene({
        sec: band.closest('section') || wrap,
        cover: wrap,
        measure() {
          band.style.transform = 'none';
          W = band.scrollWidth;
          vw = wrap.clientWidth;
        },
        render(q) {
          band.style.transform = `translate3d(${(Math.min(0, vw - W) * q).toFixed(1)}px,0,0)`;
        },
      });
    }

    // 比率: 写真はそのまま、額が変わる
    const ratio = $('[data-scene="ratio"]');
    if (ratio) {
      const stage = $('.ratio__stage', ratio);
      const boxEl = $('.ratio__box', ratio);
      const items = $$('.ratio__item', ratio);
      const prints = items.map((i) => $('img', i));
      const mats = $$('.ratio__mat', ratio);
      const photo = $('.ratio__photo', ratio);
      const glow = $('.ratio__glow', ratio);
      const lis = $$('.ratio__list li', ratio);
      const inside = items.map((i) => nums(i.dataset.photo));
      const photoA = Number(photo.getAttribute('width')) / Number(photo.getAttribute('height'));
      const n = items.length;
      const HOLD = 0.34; // 各比率で止まって見せる長さ（1つの切り替えを 1 としたとき）
      const halo = (R) => ({ x: R.x - R.w * 0.45, y: R.y - R.h * 0.32, w: R.w * 1.9, h: R.h * 1.64 });
      let F = [], P = [], Wp = 1, G, cur = -1;
      scene({
        sec: ratio,
        stage,
        measure() {
          const b = boxEl.getBoundingClientRect();
          F = prints.map((p) => rel(p, b));
          P = F.map((f, i) => inner(f, inside[i]));
          Wp = Math.max(...P.map((p) => p.w));
          photo.style.width = `${Wp}px`;
          mats.forEach((m, i) => px(m, F[i]));
          G = halo(F[0]);
          px(glow, G);
          ratio.classList.add('is-laid');
        },
        render(q) {
          const u = q * (n - 1 + HOLD);
          const k = Math.floor(u);
          const x = k >= n - 1 ? n - 1 : k + inOut(seg(u - k, HOLD, 1));
          const i = Math.min(Math.floor(x), n - 2);
          const t = x - i;
          const Fx = mix(F[i], F[i + 1], t);
          const Px = mix(P[i], P[i + 1], t);
          const s = Px.w / Wp;
          photo.style.transform = `translate3d(${Px.x.toFixed(2)}px,${(Px.y + (Px.h - Px.w / photoA) / 2).toFixed(2)}px,0) scale(${s.toFixed(5)})`;
          mats.forEach((m, j) => {
            const o = j === i ? 1 : j === i + 1 ? seg(t, 0.3, 0.7) : 0; // 色は形が変わる途中で素早く替える
            m.style.opacity = o.toFixed(3);
            if (o > 0) fit(m, Fx, F[j]);
          });
          prints.forEach((p, j) => { p.style.opacity = (1 - seg(Math.abs(x - j), 0.02, 0.18)).toFixed(3); });
          fit(glow, halo(Fx), G);
          const on = Math.round(x);
          if (on !== cur) {
            cur = on;
            lis.forEach((li, j) => li.classList.toggle('is-on', j === on));
          }
        },
      });
    }

    // ── 測る・描く ──
    const measure = safe(() => {
      for (const s of scenes) s.measure(); // 先に全部の高さを決めてから、位置を読む
      for (const s of scenes) {
        const el = s.cover || s.sec;
        s.top = el.getBoundingClientRect().top + scrollY;
        s.len = el.offsetHeight;
        s.vh = s.cover ? document.documentElement.clientHeight : s.stage.clientHeight;
        s.q = -1;
      }
      draw(true);
    });
    let queued = false;
    const draw = safe((all) => {
      queued = false;
      header();
      const y = scrollY;
      for (const s of scenes) {
        if (!all && !s.on) continue;
        const q = s.cover ? clamp((y + s.vh - s.top) / (s.len + s.vh)) : clamp((y - s.top) / Math.max(1, s.len - s.vh));
        if (q !== s.q) {
          s.q = q;
          s.render(q);
        }
      }
    });
    addEventListener('scroll', () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(() => draw(false));
      }
    }, { passive: true });

    // 画面から遠い場面は描かない。近づいた場面は層を用意し（is-live）、中の画像を先に読んで展開しておく
    // （舞台の外に隠れている画像は、遅延読み込みが始まらないため）
    const near = new IntersectionObserver((es) => {
      for (const e of es) {
        e.target.classList.toggle('is-live', e.isIntersecting);
        for (const s of scenes) {
          if (s.sec !== e.target) continue;
          s.on = e.isIntersecting;
          s.q = -1;
        }
        if (e.isIntersecting) {
          e.target.querySelectorAll('img[loading="lazy"]').forEach((img) => {
            img.loading = 'eager';
            if (img.decode) img.decode().catch(() => {});
          });
        }
      }
      draw(false);
    }, { rootMargin: '100% 0px' });
    new Set(scenes.map((s) => s.sec)).forEach((sec) => near.observe(sec));

    // 幅か舞台の高さが変わったときだけ測り直す（iPhone のツールバーの出入りでは測らない）
    const probe = scenes.find((s) => s.stage)?.stage;
    let lastW = innerWidth, lastH = probe ? probe.clientHeight : innerHeight, rq = 0;
    addEventListener('resize', () => {
      cancelAnimationFrame(rq);
      rq = requestAnimationFrame(() => {
        const w = innerWidth, h = probe ? probe.clientHeight : innerHeight;
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        measure();
      });
    });
    measure();
    if (document.fonts) document.fonts.ready.then(measure);
    addEventListener('load', measure);
  })();
})();
