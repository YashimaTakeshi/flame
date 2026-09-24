/**
 * 紹介ページ（日本語・英語）とプライバシーポリシーを書き出す。
 * 同じ組みを2言語で持つので、文面だけを言語ごとに持ち、組みは1つにする。
 *
 *   node site/tools/build-pages.mjs
 *
 * 書いてよいのは、アプリが**今できること**だけ（docs/design.md の計画ではなく src/ の実装）。
 * 例: オフラインでは動かない（Service Worker が無い）ので「オフライン」とは書かない。
 *
 * 言い回しの決まり（AI が書いたように見える癖を避ける）
 *   - 「〜だけ」「すべて」「〜しましょう」「シームレス」を使わない。三つ並べの決まり文句を作らない
 *   - 見出しは中身の要約にする（見出しだけ拾い読みして全体が分かること）
 *   - 撮る人の言葉（撮って出し・設定・額）と、具体的な数字で書く
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(HERE, '../public');
const SIZES = JSON.parse(readFileSync(resolve(HERE, 'image-sizes.json'), 'utf8'));
const SITE = 'https://yashimastudio.com';
const APP = 'https://fuchidori.yashimastudio.com/';
const UPDATED = { ja: '2026年9月24日', en: 'September 24, 2026' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enc = encodeURIComponent;

/** 画像。小さい方を src に、2倍を srcset に。縦横は実寸から */
function img(name, alt, sizes, { eager = false, w1 } = {}) {
  const [a, b] = Object.keys(SIZES).filter((k) => k.startsWith(name + '-') && /^\d+$/.test(k.slice(name.length + 1)))
    .map((k) => Number(k.slice(name.length + 1))).sort((x, y) => x - y);
  const small = w1 ?? a;
  const [w, h] = SIZES[`${name}-${small}`];
  return `<img src="/fuchidori/img/${name}-${small}.webp" srcset="/fuchidori/img/${name}-${a}.webp ${a}w, /fuchidori/img/${name}-${b}.webp ${b}w" sizes="${sizes}" width="${w}" height="${h}" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}

const T = {
  ja: {
    base: '/fuchidori/',
    title: 'Fuchidori（ふちどり）— 写真に撮影情報の額をつける',
    desc: '写真を選ぶと、カメラ・レンズ・F値・シャッター速度・ISO を読み取り、余白に小さく組んで書き出します。ブラウザで開く Web アプリ。無料・登録なし。写真はサーバーに送りません。',
    nav: { lang: '言語', open: 'アプリを開く' },
    kicker: '写真に撮影情報の額をつける Web アプリ',
    h1num: 'F1.8・15秒・ISO3200',
    h1: 'あの夜の設定ごと、<br>額に入れる。',
    lead: '写真を選ぶと、カメラとレンズ、露出の記録を読み取って、余白に小さく組みます。比率と地色を決めたら、そのまま保存して投稿へ。ブラウザで動くので、インストールも登録もいりません。',
    open: 'アプリを開く',
    free: '無料で使えます',
    heroAlt: '琵琶湖の鳥居と天の川の写真に白い額がつき、下に撮影日・カメラ・露出が3行で入っている',
    heroCap: '作例｜4:5・White・Didot・3行',

    wallLabel: '作例',
    wall: [
      ['after', '冬の木と二人のシルエット。アイボリーの額'],
      ['v-bleed', '夕日の浜辺の散歩。額なしで写真に文字を重ねたもの'],
      ['r-916', '天の川を見上げる二人。黒い 9:16 の額'],
      ['v-black', '夕日の浜辺の散歩。黒い正方形の額'],
      ['r-45', '天の川を見上げる二人。白い 4:5 の額'],
    ],
    loupeH: 'カメラが残した記録を読んで、写真の下に3行で組む',
    loupeP: '撮影日、カメラ、レンズ、焦点距離、F値、シャッター速度、ISO。写真のファイルに入っている記録をそのまま使います。記録が無い項目は、その場で打ち込めます。',
    loupeAlt: '冒頭の作例の文字の部分を拡大したもの。2025.05.24、SONY ILCE-7M4、FE 20mm F1.8 G, 20mm, F1.8 15s ISO3200 の3行',
    map: [
      ['1行目', '撮影日　<span class="note">書き方は 2025.05.24／2025年5月24日 など6通り</span>'],
      ['2行目', 'カメラ　<span class="note">太字で目立たせる</span>'],
      ['3行目', 'レンズ・焦点距離・F値・シャッター速度・ISO'],
    ],
    loupeNote: '富士フイルムの写真は、フィルムシミュレーション名（CLASSIC CHROME など）も読み取ります。どの項目を何行目に出すかはドラッグで入れ替えられ、行数は1〜4行から選べます。',
    infoAlt: 'Fuchidori の「情報」の画面。行数・区切り文字・日付の書き方と、項目ごとの入力欄が並ぶ',
    infoCap: '「情報」の画面。項目ごとに、その場で書き換えられる',

    baH: '撮って出しの一枚が、額に入るとこうなる',
    before: '撮って出し',
    after: 'Fuchidori を通したあと｜4:5・Ivory・Futura',
    beforeAlt: '夕暮れの丘に立つ冬の木と二人のシルエット。額のない元の写真',
    afterAlt: '同じ写真にアイボリーの額がつき、下に撮影日とカメラの情報が2行で入っている',

    worksH: '同じ写真でも、額を替えると印象が変わる',
    worksP: '比率は8種類、地色は9色、書体は14種類。余白を「なし」にすると、文字を写真の上に重ねます。',
    works: [
      ['v-bleed', 'wide', '余白なし（文字を写真に重ねる）｜元の比率・Futura', '夕日の浜辺で犬と散歩する人のシルエット。額はなく、写真の下端に白い文字が重なっている'],
      ['v-white', '', '4:5・White・Helvetica', '同じ浜辺の写真に白い額'],
      ['v-tall', '', '9:16・Warm White・Didot・3行', '同じ写真を縦長の 9:16 に。上下に広い余白'],
      ['v-black', '', '1:1・Black・DIN', '同じ写真に黒い正方形の額'],
      ['v-sakura', '', '元の比率・Sakura・Baskerville', '同じ写真に淡い桜色の細い額'],
      ['v-wide', '', '16:9・Gunmetal・Futura・1行', '同じ写真に濃い灰色の横長の額'],
    ],

    ratiosH: '投稿先の形に合わせて、そのまま書き出す',
    ratios: [
      ['r-45', '4:5', 'Instagram の縦長'],
      ['r-916', '9:16', 'ストーリーズ・リール・TikTok'],
      ['r-11', '1:1', 'Instagram・X の正方形'],
      ['r-169', '16:9', 'X・YouTube の横長'],
    ],
    ratiosAlt: (r) => `天の川を見上げる二人の写真を ${r} の額で書き出したもの`,
    ratiosNote: 'ほかに、元の比率・3:4・2:3・1.91:1。',

    privH: '写真は、どこにも送りません',
    privP: '読み込みから書き出しまで、お使いのスマホやパソコンのブラウザの中で処理します。Fuchidori のサーバーには、写真を受け取る仕組みがありません。',
    facts: [
      ['アップロードしない', '写真も動画も、端末の外に出ません。'],
      ['位置情報を消して書き出す', 'カメラや露出の記録は残し、GPS だけを外します。'],
      ['アクセス解析・広告・Cookie なし', '誰が何を作ったかを、こちらでは知りようがありません。'],
    ],
    privLink: 'プライバシーポリシー',

    howH: '選んで、整えて、保存する',
    steps: [
      ['ui-home', '写真を選ぶ', 'まん中の枠を押して、写真か動画を選びます。パソコンなら、ドラッグや貼り付けでも。', 'Fuchidori を開いたところ。まん中に写真を選ぶ枠がある'],
      ['ui-edit', '整える', '比率・余白・地色・文字を、下のタブで切り替えながら決めます。', '編集の画面。上に仕上がり、下に比率・余白・地色の操作'],
      ['ui-export', '保存する', 'iPhone は共有シートから写真に保存。Instagram や X にもそのまま送れます。', '書き出しの画面。「写真に保存 / 共有」のボタン'],
    ],
    homeNote: 'ホーム画面に追加すると、アプリのように開けます。iPhone は Safari の共有ボタンから「ホーム画面に追加」、Android は Chrome のメニューから「ホーム画面に追加」。',

    shareH: '写真を撮る友だちに、このページを',
    shareP: '気に入ったら、写真仲間に教えてください。リンクを送ると、作例の画像つきで表示されます。',
    shareText: 'Fuchidori — 写真に撮影情報の額をつける、無料の Web アプリ',
    share: { native: '共有する', x: 'X でポスト', line: 'LINE で送る', copy: 'リンクをコピー', copied: 'リンクをコピーしました' },

    specH: '動作環境と書き出し',
    specs: [
      ['対応ブラウザ', 'iPhone・iPad の Safari、Android の Chrome、パソコンの Chrome・Edge・Safari（最新版を推奨）'],
      ['写真', 'JPEG で書き出し（長辺 4,096px）。撮影情報は残し、位置情報は消します'],
      ['動画', '60秒まで、同じ額と文字をつけて書き出し（長辺 1,920px の MP4。ブラウザによって MOV・WebM）'],
      ['料金', '無料。アカウント登録もいりません'],
    ],

    foot: { privacy: 'プライバシーポリシー', nav: 'フッター' },
    notes: [
      '作例の撮影情報は、説明のために入れた値です。',
      '記載の会社名・製品名は、各社の商標または登録商標です。Fuchidori は各社とは関係のない個人の制作物です。',
    ],
    langJa: '日本語',
    langEn: 'English',
  },
  en: {
    base: '/fuchidori/en/',
    title: 'Fuchidori — A frame for your photo, with the settings that made it',
    desc: 'Pick a photo and Fuchidori reads the camera, lens, aperture, shutter speed and ISO, then sets them quietly in the margin. A free web app. No sign-up. Your photos never leave your device.',
    nav: { lang: 'Language', open: 'Open the app' },
    kicker: 'A web app that frames your photos with their shooting details',
    h1num: 'f/1.8 · 15 s · ISO 3200',
    h1: 'Frame the night,<br>settings and all.',
    lead: 'Pick a photo and Fuchidori reads the camera, lens and exposure, then sets them in small type in the margin. Choose a ratio and a colour, save, and post. It runs in your browser, so there is nothing to install and no account to make.',
    open: 'Open the app',
    free: 'Free to use · Interface in Japanese',
    heroAlt: 'A torii gate on Lake Biwa under the Milky Way, in a white frame with the date, camera and exposure in three lines below',
    heroCap: 'Sample | 4:5 · White · Didot · 3 lines',

    wallLabel: 'Samples',
    wall: [
      ['after', 'Silhouettes of a winter tree and two people, in an ivory frame'],
      ['v-bleed', 'A sunset walk on the beach, no frame, caption on the photo'],
      ['r-916', 'Two people under the Milky Way, in a black 9:16 frame'],
      ['v-black', 'A sunset walk on the beach, in a black square frame'],
      ['r-45', 'Two people under the Milky Way, in a white 4:5 frame'],
    ],
    loupeH: 'It reads what your camera recorded and sets it in three lines',
    loupeP: 'Date, camera, lens, focal length, aperture, shutter speed and ISO come straight from the file. Anything missing can be typed in on the spot.',
    loupeAlt: 'A close-up of the caption: 2025.05.24, SONY ILCE-7M4, FE 20mm F1.8 G, 20mm, F1.8 15s ISO3200',
    map: [
      ['Line 1', 'Date <span class="note">six formats, e.g. 2025.05.24</span>'],
      ['Line 2', 'Camera <span class="note">set in bold</span>'],
      ['Line 3', 'Lens, focal length, aperture, shutter speed, ISO'],
    ],
    loupeNote: 'For FUJIFILM photos it also reads the film simulation (CLASSIC CHROME and so on). Drag items between lines to rearrange them, and use one to four lines.',
    infoAlt: 'The Info screen in Fuchidori, with line count, separator, date format and an input for each item',
    infoCap: 'The Info screen. Edit any item in place.',

    baH: 'Straight out of camera, then framed',
    before: 'Straight out of camera',
    after: 'Through Fuchidori | 4:5 · Ivory · Futura',
    beforeAlt: 'Silhouettes of a bare winter tree and two people on a hill at dusk. The original photo with no frame',
    afterAlt: 'The same photo in an ivory frame, with the date and camera details in two lines below',

    worksH: 'Same photo, different frame, different mood',
    worksP: 'Eight ratios, nine background colours and fourteen type styles. Set the margin to none and the caption sits on the photo itself.',
    works: [
      ['v-bleed', 'wide', 'No margin (caption on the photo) | Original ratio · Futura', 'Silhouette of a person walking a dog on a beach at sunset, no frame, with white text along the bottom edge'],
      ['v-white', '', '4:5 · White · Helvetica', 'The same beach photo in a white frame'],
      ['v-tall', '', '9:16 · Warm White · Didot · 3 lines', 'The same photo in a tall 9:16 frame with wide margins'],
      ['v-black', '', '1:1 · Black · DIN', 'The same photo in a black square frame'],
      ['v-sakura', '', 'Original ratio · Sakura · Baskerville', 'The same photo in a thin pale pink frame'],
      ['v-wide', '', '16:9 · Gunmetal · Futura · 1 line', 'The same photo in a dark grey wide frame'],
    ],

    ratiosH: 'Export straight to the shape each platform wants',
    ratios: [
      ['r-45', '4:5', 'Instagram portrait'],
      ['r-916', '9:16', 'Stories, Reels, TikTok'],
      ['r-11', '1:1', 'Instagram and X square'],
      ['r-169', '16:9', 'X and YouTube landscape'],
    ],
    ratiosAlt: (r) => `A photo of two people looking up at the Milky Way, exported in a ${r} frame`,
    ratiosNote: 'Also: original ratio, 3:4, 2:3 and 1.91:1.',

    privH: 'Your photos go nowhere',
    privP: 'From opening to exporting, everything happens inside the browser on your phone or computer. Fuchidori’s server has no way to receive a photo.',
    facts: [
      ['No uploads', 'Photos and videos never leave your device.'],
      ['Location removed on export', 'Camera and exposure details stay; GPS is stripped.'],
      ['No analytics, ads or cookies', 'We have no way of knowing who made what.'],
    ],
    privLink: 'Privacy policy',

    howH: 'Pick, adjust, save',
    steps: [
      ['ui-home', 'Pick a photo', 'Tap the frame in the middle to choose a photo or video. On a computer, drag it in or paste it.', 'Fuchidori when first opened, with a frame to pick a photo in the middle'],
      ['ui-edit', 'Adjust', 'Switch between the tabs at the bottom to set ratio, margin, colour and caption.', 'The editor, with the result on top and ratio, margin and colour controls below'],
      ['ui-export', 'Save', 'On iPhone, save to Photos from the share sheet, or send it straight to Instagram or X.', 'The export screen with a Save to Photos / Share button'],
    ],
    homeNote: 'Add it to your home screen and it opens like an app. On iPhone, use Safari’s Share button and choose “Add to Home Screen”. On Android, use Chrome’s menu and choose “Add to Home screen”.',

    shareH: 'Know someone who takes photos?',
    shareP: 'If you like it, pass it on. Links show up with a sample image.',
    shareText: 'Fuchidori — a free web app that frames your photos with their shooting details',
    share: { native: 'Share', x: 'Post on X', line: 'Send on LINE', copy: 'Copy link', copied: 'Link copied' },

    specH: 'Requirements and output',
    specs: [
      ['Browsers', 'Safari on iPhone and iPad, Chrome on Android, and Chrome, Edge or Safari on a computer (latest versions recommended)'],
      ['Photos', 'Exported as JPEG, 4,096 px on the long edge. Shooting details are kept; location is removed'],
      ['Videos', 'Up to 60 seconds, with the same frame and caption (MP4 at 1,920 px on the long edge; MOV or WebM on some browsers)'],
      ['Language', 'The app interface is in Japanese'],
      ['Price', 'Free. No account needed'],
    ],

    foot: { privacy: 'Privacy policy', nav: 'Footer' },
    notes: [
      'Shooting details in the samples are illustrative values.',
      'Company and product names are trademarks or registered trademarks of their respective owners. Fuchidori is an independent project and is not affiliated with them.',
    ],
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
<p>Fuchidori（以下「本アプリ」）は、写真や動画に撮影情報の額をつける Web アプリです。本アプリは、利用者の写真や個人に関する情報をできるだけ扱わないように作っています。このページでは、本アプリが扱う情報と、その扱い方を説明します。</p>

<h2>1. 写真と動画</h2>
<p>写真・動画の読み込み、撮影情報（EXIF など）の読み取り、額の合成、書き出しは、利用者の端末のブラウザの中で行います。本アプリには、写真や動画を外部のサーバーへ送信する仕組みがありません。</p>
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
<p>Fuchidori (“the app”) is a web app that frames photos and videos with their shooting details. It is designed to handle as little of your information as possible. This page explains what the app handles and how.</p>

<h2>1. Photos and videos</h2>
<p>Opening photos and videos, reading shooting details (such as EXIF), framing and exporting happen inside the browser on your device. The app has no mechanism for sending photos or videos to an external server.</p>
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

function head(lang, t, alt, { ogImage = true, script = false } = {}) {
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
<meta name="theme-color" content="#f4f2ee">
<link rel="icon" href="/fuchidori/img/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/fuchidori/img/apple-touch-icon.png">
<link rel="stylesheet" href="/fuchidori/assets/site.css">
${script ? '<script src="/fuchidori/assets/share.js" defer></script>\n' : ''}<meta property="og:type" content="website">
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

function top(lang, alt, home) {
  const t = T[lang];
  const ja = lang === 'ja' ? `<span aria-current="true">${t.langJa}</span>` : `<a href="${alt.ja}" hreflang="ja" lang="ja">${t.langJa}</a>`;
  const en = lang === 'en' ? `<span aria-current="true">${t.langEn}</span>` : `<a href="${alt.en}" hreflang="en" lang="en">${t.langEn}</a>`;
  return `<header class="wrap top">
  <a class="brand" href="${home}">Fuchidori</a>
  <nav aria-label="${t.nav.lang}">${ja}${en}<a class="go" href="${APP}">${t.nav.open}</a></nav>
</header>`;
}

function foot(lang, privacyHref) {
  const t = T[lang];
  return `<footer class="wrap foot note">
  <div class="foot__row">
    <span>© 2026 Yashima Studio</span>
    <nav aria-label="${t.foot.nav}"><a href="${privacyHref}">${t.foot.privacy}</a></nav>
  </div>
${t.notes.map((n) => `  <p>${n}</p>`).join('\n')}
</footer>`;
}

function landing(lang) {
  const t = T[lang];
  const alt = { ja: T.ja.base, en: T.en.base };
  const url = SITE + t.base;
  const priv = PRIVACY[lang].base;
  return `${head(lang, t, alt, { script: true })}
<body>
${top(lang, alt, t.base)}
<main>
  <section class="wrap hero">
    <div>
      <p class="kicker">${t.kicker}</p>
      <h1><span class="num">${t.h1num}</span>${t.h1}</h1>
      <p class="lead">${t.lead}</p>
      <div class="act">
        <a class="btn" href="${APP}">${t.open}</a>
        <span class="note">${t.free}</span>
      </div>
    </div>
    <figure class="work">
      ${img('hero', t.heroAlt, '(max-width: 899px) 92vw, 540px', { eager: true })}
      <figcaption class="note">${t.heroCap}</figcaption>
    </figure>
  </section>

  <div class="wall" aria-label="${t.wallLabel}">
${t.wall.map(([n, a]) => `    <figure>${img(n, a, '(max-width: 899px) 60vw, 30vw')}</figure>`).join('\n')}
  </div>

  <section class="wrap sec" aria-labelledby="s-loupe">
    <h2 id="s-loupe">${t.loupeH}</h2>
    <p>${t.loupeP}</p>
    <div class="sec__body loupe">
      <div>
        <div class="loupe__img">${img('hero-caption', t.loupeAlt, '(max-width: 899px) 92vw, 640px')}</div>
        <table class="map">
${t.map.map(([k, v]) => `          <tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('\n')}
        </table>
        <p class="note mt2">${t.loupeNote}</p>
      </div>
      <figure class="shot">
        ${img('ui-info', t.infoAlt, '(max-width: 899px) 60vw, 280px')}
        <figcaption class="note">${t.infoCap}</figcaption>
      </figure>
    </div>
  </section>

  <section class="wrap sec" aria-labelledby="s-ba">
    <h2 id="s-ba">${t.baH}</h2>
    <div class="sec__body ba">
      <figure>${img('before', t.beforeAlt, '(max-width: 899px) 46vw, 380px')}<figcaption class="note">${t.before}</figcaption></figure>
      <figure>${img('after', t.afterAlt, '(max-width: 899px) 46vw, 480px')}<figcaption class="note">${t.after}</figcaption></figure>
    </div>
  </section>

  <section class="wrap sec" aria-labelledby="s-works">
    <div class="works-hd">
      <div>
        <h2 id="s-works">${t.worksH}</h2>
        <p class="mt2">${t.worksP}</p>
      </div>
${t.works.filter((w) => w[1]).map(([n, , cap, a]) => `      <figure>${img(n, a, '(max-width: 899px) 92vw, 760px')}<figcaption class="note">${cap}</figcaption></figure>`).join('\n')}
    </div>
    <div class="sec__body works">
${t.works.filter((w) => !w[1]).map(([n, , cap, a]) => `      <figure>${img(n, a, '(max-width: 899px) 46vw, 360px')}<figcaption class="note">${cap}</figcaption></figure>`).join('\n')}
    </div>
  </section>

  <section class="wrap sec" aria-labelledby="s-ratios">
    <h2 id="s-ratios">${t.ratiosH}</h2>
    <div class="sec__body ratios">
${t.ratios.map(([n, r, use]) => `      <figure>${img(n, t.ratiosAlt(r), '(max-width: 899px) 46vw, 380px')}<figcaption><b>${r}</b><span class="note">${use}</span></figcaption></figure>`).join('\n')}
    </div>
    <p class="note mt3">${t.ratiosNote}</p>
  </section>

  <section class="wrap sec" aria-labelledby="s-priv">
    <div class="private">
      <div>
        <h2 id="s-priv">${t.privH}</h2>
        <p class="mt2">${t.privP}</p>
        <p class="note mt2"><a href="${priv}">${t.privLink}</a></p>
      </div>
      <dl class="facts">
${t.facts.map(([k, v]) => `        <div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}
      </dl>
    </div>
  </section>

  <section class="wrap sec" aria-labelledby="s-how">
    <h2 id="s-how">${t.howH}</h2>
    <ol class="sec__body steps">
${t.steps.map(([n, h, p, a], i) => `      <li>${img(n, a, '(max-width: 899px) 30vw, 280px')}<h3><span>${i + 1}</span>${h}</h3><p>${p}</p></li>`).join('\n')}
    </ol>
    <div class="act">
      <a class="btn" href="${APP}">${t.open}</a>
    </div>
    <p class="note mt2 measure">${t.homeNote}</p>
  </section>

  <section class="wrap sec share" aria-labelledby="s-share" data-share data-url="${url}" data-text="${esc(t.shareText)}" data-copied="${esc(t.share.copied)}">
    <h2 id="s-share">${t.shareH}</h2>
    <p>${t.shareP}</p>
    <div class="act">
      <button type="button" class="btn" data-act="native" hidden>${t.share.native}</button>
      <a class="btn btn--line" href="https://x.com/intent/post?text=${enc(t.shareText)}&amp;url=${enc(url)}" target="_blank" rel="noopener">${t.share.x}</a>
      <a class="btn btn--line" href="https://social-plugins.line.me/lineit/share?url=${enc(url)}" target="_blank" rel="noopener">${t.share.line}</a>
      <button type="button" class="btn btn--line" data-act="copy">${t.share.copy}</button>
    </div>
    <p class="note share__done" role="status"></p>
  </section>

  <section class="wrap sec" aria-labelledby="s-spec">
    <h2 id="s-spec">${t.specH}</h2>
    <dl class="sec__body specs">
${t.specs.map(([k, v]) => `      <dt>${k}</dt><dd>${v}</dd>`).join('\n')}
    </dl>
  </section>
</main>
${foot(lang, priv)}
</body>
</html>
`;
}

function privacy(lang) {
  const t = { ...T[lang], ...PRIVACY[lang] };
  const alt = { ja: PRIVACY.ja.base, en: PRIVACY.en.base };
  return `${head(lang, t, alt, { ogImage: false })}
<body>
${top(lang, alt, T[lang].base)}
<main class="wrap doc">
  <h1>${t.h1}</h1>
  <p class="note">${lang === 'ja' ? `制定日：${UPDATED.ja}` : `Effective: ${UPDATED.en}`}</p>
${t.body.trim()}
</main>
${foot(lang, t.base)}
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
