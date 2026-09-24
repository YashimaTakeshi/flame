/**
 * 紹介ページ（日本語・英語）とプライバシーポリシーを書き出す。
 * 同じ組みを2言語で持つので、文面だけを言語ごとに持ち、組みは1つにする。
 *
 *   node site/tools/build-pages.mjs
 *
 * 書いてよいのは、アプリが**今できること**だけ（docs/design.md の計画ではなく src/ の実装）。
 * 例: オフラインでは動かない（Service Worker が無い）ので「オフライン」とは書かない。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(HERE, '../public');
const SITE = 'https://yashimastudio.com';
const APP = 'https://fuchidori.yashimastudio.com/';
const UPDATED = { ja: '2026年9月24日', en: 'September 24, 2026' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const T = {
  ja: {
    base: '/fuchidori/',
    title: 'Fuchidori — 写真に、撮影情報の縁取りを',
    desc: '写真からカメラ・レンズ・露出を読み取り、余白と文字を整えて書き出す無料の Web アプリ。インストール不要。写真は端末の外に出ません。',
    eyebrow: 'Photo frame & caption',
    h1: '写真に、<br>撮影情報の縁取りを。',
    lead: 'カメラ・レンズ・露出・撮影日を写真から読み取り、余白と文字を整えて書き出します。ブラウザで開くだけ、インストールも登録も要りません。',
    open: 'アプリを開く',
    openNote: '無料・登録不要',
    shotAlt: 'Fuchidori の編集画面。夕暮れの湖の写真に白い余白と撮影情報が付いている',
    galleryNum: 'Works',
    galleryH: '同じ写真でも、額が変わると見え方が変わる',
    galleryP: '比率・余白・地色・書体を選ぶだけ。文字の大きさや位置は、写真の大きさに合わせて自動で整います。',
    gallery: [
      ['demo-dusk', '夕暮れの湖。4:5・White・Futura・3行', '4:5 · White · Futura · 3行'],
      ['demo-sea', '灯台のある海。元の比率・Ivory・Didot・2行', '元の比率 · Ivory · Didot · 2行'],
      ['demo-city', '夜の街並み。1:1・Black・DIN・2行', '1:1 · Black · DIN · 2行'],
    ],
    galleryNote: '作例の画像はイメージです（写真の代わりに描いた絵を、Fuchidori で縁取りしたもの）。撮影情報も作例用の値です。',
    featNum: 'Features',
    featH: '整えるための道具を、必要なだけ',
    featP: '細かく作り込むこともできますが、写真を選んだ時点で、そのまま出せる形に整っています。',
    features: [
      ['撮影情報を自動で', 'カメラ・レンズ・F値・シャッター速度・ISO・焦点距離・撮影日を写真から読み取ります。富士フイルムのフィルムシミュレーション名にも対応。記録が無い項目は手で入力できます。'],
      ['SNS の比率にそのまま', '元の比率のほか、4:5・3:4・2:3・1:1・9:16・16:9・1.91:1。Instagram・X・Threads・TikTok に投稿する形で書き出せます。'],
      ['余白・地色・枠線', '余白は「なし」から「広い」までの5段。「なし」なら写真の上に文字を重ねます。地色は9色、写真の枠線は5段。'],
      ['14種類の書体', 'Helvetica・Futura・DIN・Didot 風などの欧文書体（太字を含む）と日本語の書体。字の大きさと字間も選べます。'],
      ['文字の並びを自由に', '1〜4行。どの情報を何行目に出すかはドラッグで入れ替え。区切り文字（, · / — | 空白）や日付の書き方も選べます。'],
      ['動画にも同じ縁取り', '60秒までの動画にも、写真と同じ額と文字を付けて書き出せます（ブラウザが動画の書き出しに対応している場合）。'],
    ],
    privH: '写真は、端末の外に出ません',
    privP: '読み込みから書き出しまで、すべてお使いの端末のブラウザの中で処理します。',
    priv: [
      ['<strong>アップロードしません。</strong>', '写真や動画をサーバーに送る仕組みがありません。'],
      ['<strong>アクセス解析・広告を入れていません。</strong>', 'Cookie も使いません。'],
      ['<strong>位置情報を取り除いて書き出します。</strong>', '撮影情報（EXIF）は残し、GPS だけを消します。'],
      ['<strong>設定はこの端末にだけ残ります。</strong>', '次に開いたとき、前回の額から始められます。'],
    ],
    privLink: 'プライバシーポリシー',
    howNum: 'How to',
    howH: '使い方は3つだけ',
    steps: [
      ['写真を選ぶ', '真ん中の枠を押して写真か動画を選びます。パソコンならドラッグ＆ドロップや貼り付けでも。'],
      ['整える', '比率・余白・文字・書体を選びます。下のタブを切り替えながら、仕上がりを見て決められます。'],
      ['保存・共有', 'iPhone は共有シートから「画像を保存」やそのまま SNS へ。パソコンは保存先を選んでダウンロード。'],
    ],
    homeNum: 'Install',
    homeH: 'ホーム画面に置くと、アプリのように使えます',
    homeP: 'App Store からのインストールは要りません。ホーム画面のアイコンから、ブラウザの枠なしで開けます。',
    home: [
      ['iPhone・iPad（Safari）', ['Safari でアプリを開く', '下の共有ボタン（□に↑）を押す', '「ホーム画面に追加」を選ぶ']],
      ['Android（Chrome）', ['Chrome でアプリを開く', '右上の︙メニューを押す', '「ホーム画面に追加」または「アプリをインストール」を選ぶ']],
    ],
    specNum: 'Specs',
    specH: '動作環境と書き出し',
    specs: [
      ['対応ブラウザ', 'iPhone・iPad の Safari、Android の Chrome、パソコンの Chrome・Edge・Safari（いずれも最新版を推奨）'],
      ['写真', 'JPEG で書き出し（長辺 4096px）。撮影情報（EXIF）は残し、位置情報は消します'],
      ['動画', '60秒まで。MP4 で書き出し（長辺 1920px）。ブラウザによって MOV・WebM になることがあります'],
      ['料金', '無料。アカウント登録も要りません'],
    ],
    endH: 'お気に入りの一枚に、縁取りを。',
    foot: 'プライバシーポリシー',
    fontLic: '書体のライセンス',
    tm: '記載の会社名・製品名は、各社の商標または登録商標です。Fuchidori は各社とは関係のない個人の制作物です。',
    langJa: '日本語',
    langEn: 'English',
  },
  en: {
    base: '/fuchidori/en/',
    title: 'Fuchidori — Frame your photos with their story',
    desc: 'A free web app that reads camera, lens and exposure from your photo and adds a clean frame and caption. No install. Your photos never leave your device.',
    eyebrow: 'Photo frame & caption',
    h1: 'Frame your photos<br>with their story.',
    lead: 'Fuchidori reads the camera, lens, exposure and date from your photo, then lays out a clean border and caption, ready to share. It runs in your browser: nothing to install, no account.',
    open: 'Open the app',
    openNote: 'Free · No sign-up · Interface in Japanese',
    shotAlt: 'The Fuchidori editor showing a dusk lake photo with a white border and shooting details',
    galleryNum: 'Works',
    galleryH: 'Same photo, different frame, new mood',
    galleryP: 'Pick a ratio, margin, colour and typeface. Text size and position adapt to the photo automatically.',
    gallery: [
      ['demo-dusk', 'A lake at dusk. 4:5, White, Futura, 3 lines', '4:5 · White · Futura · 3 lines'],
      ['demo-sea', 'A sea with a lighthouse. Original ratio, Ivory, Didot, 2 lines', 'Original · Ivory · Didot · 2 lines'],
      ['demo-city', 'A city at night. 1:1, Black, DIN, 2 lines', '1:1 · Black · DIN · 2 lines'],
    ],
    galleryNote: 'Sample images are illustrations framed with Fuchidori, not real photographs. The shooting details are sample values.',
    featNum: 'Features',
    featH: 'Just the tools you need to finish a photo',
    featP: 'Fine-tune everything if you like, but the moment you open a photo, it is already laid out and ready to save.',
    features: [
      ['Shooting details, automatically', 'Camera, lens, aperture, shutter speed, ISO, focal length and date are read from the photo, including FUJIFILM film simulation names. Anything missing can be typed in.'],
      ['Ready for social media', 'Keep the original ratio or choose 4:5, 3:4, 2:3, 1:1, 9:16, 16:9 or 1.91:1 for Instagram, X, Threads and TikTok.'],
      ['Margin, colour, border', 'Five margin steps from none to wide. With no margin, the caption sits on the photo. Nine background colours and five border weights.'],
      ['14 type styles', 'Latin faces in the style of Helvetica, Futura, DIN, Didot and more (including bold weights), plus a Japanese face. Adjust size and letter spacing.'],
      ['Arrange the caption', 'One to four lines. Drag items to choose which line they appear on. Pick a separator (, · / — | space) and a date format.'],
      ['Video, too', 'Add the same frame and caption to videos up to 60 seconds (where the browser supports video export).'],
    ],
    privH: 'Your photos never leave your device',
    privP: 'Everything from opening to exporting happens inside the browser on your device.',
    priv: [
      ['<strong>No uploads.</strong>', 'There is no mechanism that sends photos or videos to a server.'],
      ['<strong>No analytics, no ads.</strong>', 'No cookies either.'],
      ['<strong>Location removed on export.</strong>', 'Shooting details (EXIF) are kept; GPS is stripped.'],
      ['<strong>Settings stay on this device.</strong>', 'Next time, you start from your last frame.'],
    ],
    privLink: 'Privacy policy',
    howNum: 'How to',
    howH: 'Three steps',
    steps: [
      ['Choose a photo', 'Tap the frame in the middle to pick a photo or video. On a computer you can also drag and drop or paste.'],
      ['Adjust', 'Choose ratio, margin, caption and typeface, switching tabs while you watch the result.'],
      ['Save or share', 'On iPhone, use the share sheet to save the image or post it directly. On a computer, choose where to save it.'],
    ],
    homeNum: 'Install',
    homeH: 'Add it to your home screen for an app-like experience',
    homeP: 'No App Store needed. Launch it from its icon, without the browser bar.',
    home: [
      ['iPhone & iPad (Safari)', ['Open the app in Safari', 'Tap the Share button (square with an arrow)', 'Choose “Add to Home Screen”']],
      ['Android (Chrome)', ['Open the app in Chrome', 'Tap the ⋮ menu at the top right', 'Choose “Add to Home screen” or “Install app”']],
    ],
    specNum: 'Specs',
    specH: 'Requirements & output',
    specs: [
      ['Browsers', 'Safari on iPhone and iPad, Chrome on Android, and Chrome, Edge or Safari on a computer (latest versions recommended)'],
      ['Photos', 'Exported as JPEG (4096 px on the long edge). EXIF is kept; location is removed'],
      ['Videos', 'Up to 60 seconds. Exported as MP4 (1920 px on the long edge), or MOV / WebM depending on the browser'],
      ['Language', 'The app interface is currently in Japanese'],
      ['Price', 'Free. No account required'],
    ],
    endH: 'Give your favourite shot the frame it deserves.',
    foot: 'Privacy policy',
    fontLic: 'Font licence',
    tm: 'Company and product names are trademarks or registered trademarks of their respective owners. Fuchidori is an independent project and is not affiliated with them.',
    langJa: '日本語',
    langEn: 'English',
  },
};

const PRIVACY = {
  ja: {
    base: '/fuchidori/privacy/',
    title: 'プライバシーポリシー — Fuchidori',
    desc: 'Fuchidori が扱う情報と、その扱い方について。',
    h1: 'プライバシーポリシー',
    body: `
<p>Fuchidori（以下「本アプリ」）は、写真や動画に撮影情報の縁取りを付ける Web アプリです。本アプリは、利用者の写真や個人に関する情報をできるだけ扱わないように作っています。このページでは、本アプリが扱う情報と、その扱い方を説明します。</p>

<h2>1. 写真と動画</h2>
<p>写真・動画の読み込み、撮影情報（EXIF など）の読み取り、縁取り、書き出しは、すべて利用者の端末のブラウザの中で行います。本アプリには、写真や動画を外部のサーバーへ送信する仕組みがありません。</p>
<p>書き出した写真には、元の撮影情報（EXIF）を残します。ただし、位置情報（GPS）は取り除きます。</p>

<h2>2. 端末に保存する情報</h2>
<p>次回も同じ設定から始められるよう、額の設定（比率・余白・地色・書体など）や、利用者が入力したタイトル・作者名を、端末のブラウザの保存領域（localStorage）に保存します。これらの情報は端末の外へ送信しません。ブラウザのサイトデータを消去すると削除されます。</p>

<h2>3. アクセス解析・広告・Cookie</h2>
<p>本アプリと本ページは、アクセス解析ツール・広告・Cookie を使用していません。</p>

<h2>4. 配信について</h2>
<p>本アプリと本ページの配信には Cloudflare, Inc. のサービスを利用しています。ページを表示する際、通信の仕組み上、Cloudflare が IP アドレスなどの接続情報を処理することがあります。詳しくは <a href="https://www.cloudflare.com/ja-jp/privacypolicy/" rel="noopener">Cloudflare のプライバシーポリシー</a>をご覧ください。</p>

<h2>5. 外部への提供</h2>
<p>本アプリは利用者の情報を収集していないため、第三者に提供することはありません。</p>

<h2>6. 改定</h2>
<p>本ポリシーの内容は、必要に応じて改定することがあります。改定した場合は、このページでお知らせします。</p>
`,
  },
  en: {
    base: '/fuchidori/en/privacy/',
    title: 'Privacy Policy — Fuchidori',
    desc: 'What information Fuchidori handles, and how.',
    h1: 'Privacy Policy',
    body: `
<p>Fuchidori (“the app”) is a web app that adds a frame and shooting details to photos and videos. It is designed to handle as little of your information as possible. This page explains what the app handles and how.</p>

<h2>1. Photos and videos</h2>
<p>Opening photos and videos, reading shooting details (such as EXIF), framing and exporting all happen inside the browser on your device. The app has no mechanism for sending photos or videos to an external server.</p>
<p>Exported photos keep the original shooting details (EXIF), except for location (GPS), which is removed.</p>

<h2>2. Information stored on your device</h2>
<p>So you can pick up where you left off, the app stores your frame settings (ratio, margin, colour, typeface and so on) and any title or author name you enter in your browser’s storage (localStorage). This information is never sent off your device, and is deleted when you clear the site data in your browser.</p>

<h2>3. Analytics, advertising and cookies</h2>
<p>The app and this site do not use analytics tools, advertising or cookies.</p>

<h2>4. Hosting</h2>
<p>The app and this site are delivered using services from Cloudflare, Inc. When a page is displayed, Cloudflare may process connection information such as your IP address as part of delivering it. See <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare’s privacy policy</a> for details.</p>

<h2>5. Sharing with third parties</h2>
<p>The app does not collect your information, so it is not shared with any third party.</p>

<h2>6. Changes</h2>
<p>This policy may be updated when necessary. Any changes will be posted on this page.</p>
`,
  },
};

const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function head(lang, t, alt, { ogImage = true } = {}) {
  const url = SITE + t.base;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ja" href="${SITE}${alt.ja}">
<link rel="alternate" hreflang="en" href="${SITE}${alt.en}">
<link rel="alternate" hreflang="x-default" href="${SITE}${alt.ja}">
<meta name="theme-color" content="#f6f4f1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141414" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/fuchidori/img/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/fuchidori/img/apple-touch-icon.png">
<link rel="preload" href="/fuchidori/fonts/Jost-bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/fuchidori/assets/site.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fuchidori">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${lang === 'ja' ? 'ja_JP' : 'en_US'}">
${ogImage ? `<meta property="og:image" content="${SITE}/fuchidori/img/og-${lang}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
</head>`;
}

function top(lang, t, alt) {
  const other = lang === 'ja' ? alt.en : alt.ja;
  const ja = lang === 'ja' ? `<span aria-current="true">${T.ja.langJa}</span>` : `<a href="${other}" hreflang="ja" lang="ja">${T.ja.langJa}</a>`;
  const en = lang === 'en' ? `<span aria-current="true">${T.en.langEn}</span>` : `<a href="${other}" hreflang="en" lang="en">${T.en.langEn}</a>`;
  return `<header class="wrap top">
  <a class="brand" href="${t.home ?? t.base}"><span class="brand__mark" aria-hidden="true"></span>Fuchidori</a>
  <nav class="lang" aria-label="${lang === 'ja' ? '言語' : 'Language'}">${ja}${en}</nav>
</header>`;
}

function foot(lang, t, privacyHref) {
  return `<footer class="wrap foot">
  <div class="foot__row">
    <span class="latin">© 2026 Yashima Studio</span>
    <nav aria-label="${lang === 'ja' ? 'フッター' : 'Footer'}">
      <a href="${privacyHref}">${t.foot}</a>
      <a href="/fuchidori/licenses/Jost-OFL.txt">${t.fontLic}</a>
    </nav>
  </div>
  <p>${t.tm}</p>
</footer>`;
}

const img = (name, alt, sizes, w, h, eager = false) =>
  `<img src="/fuchidori/img/${name}-${w}.webp" srcset="/fuchidori/img/${name}-${w}.webp ${w}w, /fuchidori/img/${name}-${w * 2}.webp ${w * 2}w" sizes="${sizes}" width="${w}" height="${h}" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;

function landing(lang) {
  const t = T[lang];
  const alt = { ja: T.ja.base, en: T.en.base };
  const priv = PRIVACY[lang].base;
  const sizesGallery = '(max-width: 600px) 92vw, (max-width: 860px) 46vw, 340px';
  const dims = { 'demo-dusk': [640, 800], 'demo-sea': [640, 824], 'demo-city': [640, 640] };
  return `${head(lang, t, alt)}
<body>
${top(lang, t, alt)}
<main>
  <section class="wrap hero">
    <div>
      <p class="eyebrow">${t.eyebrow}</p>
      <h1>${t.h1}</h1>
      <p class="lead">${t.lead}</p>
      <div class="cta">
        <a class="btn" href="${APP}">${t.open}${ARROW}</a>
        <span class="cta__note">${t.openNote}</span>
      </div>
    </div>
    <div class="device">${img('ui-phone-frame', t.shotAlt, '(max-width: 860px) 78vw, 300px', 390, 664, true)}</div>
  </section>

  <section class="wrap sec" aria-labelledby="works">
    <div class="sec__hd">
      <div><span class="sec__num">${t.galleryNum}</span><h2 id="works">${t.galleryH}</h2></div>
      <p>${t.galleryP}</p>
    </div>
    <div class="gallery">
${t.gallery.map(([n, a, c]) => `      <figure>${img(n, a, sizesGallery, ...dims[n])}<figcaption>${c}</figcaption></figure>`).join('\n')}
    </div>
    <p class="gallery__note">${t.galleryNote}</p>
  </section>

  <section class="wrap sec" aria-labelledby="features">
    <div class="sec__hd">
      <div><span class="sec__num">${t.featNum}</span><h2 id="features">${t.featH}</h2></div>
      <p>${t.featP}</p>
    </div>
    <ul class="features">
${t.features.map(([h, p], i) => `      <li><span class="k">0${i + 1}</span><h3>${h}</h3><p>${p}</p></li>`).join('\n')}
    </ul>
  </section>

  <section class="wrap sec" aria-labelledby="private">
    <div class="private">
      <div>
        <h2 id="private">${t.privH}</h2>
        <p>${t.privP}</p>
        <p><a href="${priv}">${t.privLink}</a></p>
      </div>
      <ul>
${t.priv.map(([a, b]) => `        <li>${a} ${b}</li>`).join('\n')}
      </ul>
    </div>
  </section>

  <section class="wrap sec" aria-labelledby="how">
    <div class="sec__hd">
      <div><span class="sec__num">${t.howNum}</span><h2 id="how">${t.howH}</h2></div>
    </div>
    <ol class="steps">
${t.steps.map(([h, p]) => `      <li><h3>${h}</h3><p>${p}</p></li>`).join('\n')}
    </ol>
  </section>

  <section class="wrap sec" aria-labelledby="install">
    <div class="sec__hd">
      <div><span class="sec__num">${t.homeNum}</span><h2 id="install">${t.homeH}</h2></div>
      <p>${t.homeP}</p>
    </div>
    <div class="cols">
${t.home.map(([h, items]) => `      <div class="card"><h3>${h}</h3><ol>${items.map((x) => `<li>${x}</li>`).join('')}</ol></div>`).join('\n')}
    </div>
  </section>

  <section class="wrap sec" aria-labelledby="specs">
    <div class="sec__hd">
      <div><span class="sec__num">${t.specNum}</span><h2 id="specs">${t.specH}</h2></div>
    </div>
    <dl class="specs">
${t.specs.map(([k, v]) => `      <dt>${k}</dt><dd>${v}</dd>`).join('\n')}
    </dl>
  </section>

  <section class="wrap end">
    <h2>${t.endH}</h2>
    <div class="cta"><a class="btn" href="${APP}">${t.open}${ARROW}</a></div>
  </section>
</main>
${foot(lang, t, priv)}
</body>
</html>
`;
}

function privacy(lang) {
  const t = { ...T[lang], ...PRIVACY[lang], home: T[lang].base };
  const alt = { ja: PRIVACY.ja.base, en: PRIVACY.en.base };
  return `${head(lang, t, alt, { ogImage: false })}
<body>
${top(lang, t, alt)}
<main class="wrap doc">
  <h1>${t.h1}</h1>
  <p class="date">${lang === 'ja' ? `制定日：${UPDATED.ja}` : `Effective: ${UPDATED.en}`}</p>
${t.body.trim()}
</main>
${foot(lang, t, t.base)}
</body>
</html>
`;
}

const write = (path, html) => {
  const f = resolve(PUB, '.' + path, 'index.html');
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
  console.log(f);
};
for (const lang of ['ja', 'en']) {
  write(T[lang].base, landing(lang));
  write(PRIVACY[lang].base, privacy(lang));
}
