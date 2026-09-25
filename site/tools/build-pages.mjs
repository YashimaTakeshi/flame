/**
 * 紹介ページ（日本語・英語）とプライバシーポリシーを書き出す。紙面は「夜のギャラリー」。
 * 同じ組みを2言語で持つので、文面だけを言語ごとに持ち、組みは1つにする。
 *
 *   node site/tools/build-pages.mjs
 *
 * 書き出すもの
 *   public/fuchidori/index.html, en/index.html, privacy/index.html, en/privacy/index.html
 *   public/fuchidori/assets/fuchidori.css の「@generated」の区間
 *     … 作例ごとの縦横比（img/frames.json）と、展示室の高さの式。作例を書き出し直したら、これを流すだけで揃う
 *
 * 書いてよいのは、アプリが**今できること**だけ（計画中の機能は書かない）。
 * 例: オフラインでは動かない（Service Worker が無い）ので「オフライン」とは書かない。
 *
 * 言い回しの決まり（AI が書いたように見える癖を避ける）
 *   - 「〜だけ」「すべて」「〜しましょう」「シームレス」「未来」「革新」を使わない。三つ並べの決まり文句を作らない
 *   - 見出しは動詞で終える（体言止めを続けない）。見出しだけ拾い読みして全体が分かること
 *   - 撮る人の言葉（撮って出し・設定・額・プリント）と、作例のキャプションにある具体的な数字で書く。文字は少なく
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(HERE, '../public');
const SIZES = JSON.parse(readFileSync(resolve(HERE, 'image-sizes.json'), 'utf8'));
const FRAMES = JSON.parse(readFileSync(resolve(PUB, 'fuchidori/img/frames.json'), 'utf8'));
const CSS = resolve(PUB, 'fuchidori/assets/fuchidori.css');
const SITE = 'https://yashimastudio.com';
const APP = 'https://fuchidori.yashimastudio.com/';
const UPDATED = { ja: '2026年9月24日', en: 'September 24, 2026' };

// 展示室の歩き方（CSS の高さの式と fuchidori.js が同じ値を使う）
const HOLD = 0.26; // 作品が中央に来たところで止まる長さ（画面の高さに対する比）
const PACE = 0.9; // 横に 1px 進むのに要る縦のスクロール

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enc = encodeURIComponent;
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const r2 = (n) => Math.round(n * 100) / 100;

/** 作例の縦横比（幅 / 高さ）と、展示室で見せる高さ（画面の高さの %。面積がそろうように） */
const ratioOf = (key) => FRAMES[key].size[0] / FRAMES[key].size[1];
const heightOf = (key) => r2(Math.min(64, Math.max(34, 48 / Math.sqrt(ratioOf(key)))));
/** 展示室でいちばん高い作品の高さ（CSS の --u の式に使う） */
const MAXH = () => Math.max(...WORKS.map((w) => heightOf(w.key)));

/** 画像。幅の種類は image-sizes.json から。縦横は src にした幅の実寸 */
function img(name, alt, sizes, { eager = false, high = false, cls = '', ws, src, attrs = '' } = {}) {
  const all = Object.keys(SIZES).filter((k) => k.startsWith(name + '-') && /^\d+$/.test(k.slice(name.length + 1)))
    .map((k) => Number(k.slice(name.length + 1))).sort((x, y) => x - y);
  if (!all.length) throw new Error(`画像が無い: ${name}`);
  const use = ws ?? all;
  const w1 = src ?? use[0];
  const [w, h] = SIZES[`${name}-${w1}`];
  const set = use.length > 1 ? ` srcset="${use.map((x) => `/fuchidori/img/${name}-${x}.webp ${x}w`).join(', ')}" sizes="${sizes}"` : '';
  return `<img${cls ? ` class="${cls}"` : ''} src="/fuchidori/img/${name}-${w1}.webp"${set} width="${w}" height="${h}" alt="${esc(alt)}"${attrs}${high ? ' fetchpriority="high"' : ''}${eager ? '' : ' loading="lazy"'} decoding="async">`;
}

/** 地色の色見本付きの仕様（「4:5 · White · Didot」） */
const spec = (color, text) => `<i class="sw ${color ? `g-${color}` : 'sw--none'}" aria-hidden="true"></i>${text}`;
/** 見出しの改行位置。日本語は詰めて並べ、英語は語の間の空白を残す */
let LANG = 'ja';
const ib = (parts) => parts.map((p) => `<span class="ib">${p}</span>`).join(LANG === 'en' ? ' ' : '');
const kicker = ([a, b], cls = 'kicker') => `<p class="${cls}">${a}${b ? `<span class="kicker__sep"></span><span class="kicker__ja">${b}</span>` : ''}</p>`;

/*
 * 作例。すべてアプリ本体で書き出したもの（render-demos.mjs）。撮影情報は作例用の値（ページ末尾に明記）
 *   dark … 暗い額・暗い写真。炭色の壁に溶けないよう、額の縁に細い光を足す
 */
const WORKS = [
  { key: 'after', color: 'ivory',
    ja: ['冬の木と二人', '2025.02.15 ／ FUJIFILM X-T5 ／ CLASSIC Neg.', '4:5 · Ivory · Futura · 2行', '夕暮れの丘に立つ冬の木と、二人のシルエット。アイボリーの額の下に、撮影日と撮影情報の2行'],
    en: ['Winter tree, two figures', '2025.02.15 / FUJIFILM X-T5 / CLASSIC Neg.', '4:5 · Ivory · Futura · 2 lines', 'A bare winter tree and two silhouettes on a hill at dusk, in an ivory frame with the date and shooting details in two lines below'] },
  { key: 't-black', color: 'black', dark: true,
    ja: ['湖の鳥居と天の川', 'SONY ILCE-7M4 ／ F1.8 15s ISO3200', '1:1 · Black · DIN · 2行', '湖の鳥居と天の川の写真に、黒い正方形の額。下に撮影日と撮影情報の2行'],
    en: ['Torii and the Milky Way', 'SONY ILCE-7M4 / F1.8 15s ISO3200', '1:1 · Black · DIN · 2 lines', 'The torii on the lake under the Milky Way, in a black square frame with two lines of details below'] },
  { key: 's-bleed', color: '', dark: true,
    ja: ['天の川を見上げる', 'Canon EOS R6 Mark II ／ F2.8 10s ISO6400', '余白なし · Futura · 文字を写真に重ねる', '天の川を見上げて寄り添う二人。額はなく、写真の下のほうに白い文字で撮影情報が重なっている'],
    en: ['Under the Milky Way', 'Canon EOS R6 Mark II / F2.8 10s ISO6400', 'No margin · Futura · caption on the photo', 'Two people looking up at the Milky Way. No frame; the shooting details sit in white type near the bottom of the photo'] },
  { key: 't-ivory', color: 'ivory',
    ja: ['湖の鳥居と天の川', '2025.05.24 ／ FE 20mm F1.8 G', '16:9 · Ivory · Didot · 1行', '湖の鳥居と天の川を、アイボリーの横長 16:9 の額に。下に1行の撮影情報'],
    en: ['Torii and the Milky Way', '2025.05.24 / FE 20mm F1.8 G', '16:9 · Ivory · Didot · 1 line', 'The torii and the Milky Way in a wide 16:9 ivory frame, with one line of details below'] },
  { key: 'tr-black', color: 'black', dark: true,
    ja: ['冬の木と二人', 'FUJIFILM X-T5 ／ XF56mmF1.2 R WR ／ F2', '9:16 · Black · Didot · 2行', '冬の木と二人のシルエットを、縦長 9:16 の黒い額に。下に撮影日と撮影情報'],
    en: ['Winter tree, two figures', 'FUJIFILM X-T5 / XF56mmF1.2 R WR / F2', '9:16 · Black · Didot · 2 lines', 'The winter tree and two silhouettes in a tall 9:16 black frame, with the date and details below'] },
  { key: 's-ivory', color: 'ivory',
    ja: ['天の川を見上げる', '2025.07.26 ／ RF15-35mm F2.8 L IS USM', '元の比率 · Ivory · Baskerville · 2行', '天の川を見上げて寄り添う二人。細いアイボリーの額の下に、撮影日と撮影情報'],
    en: ['Under the Milky Way', '2025.07.26 / RF15-35mm F2.8 L IS USM', 'Original ratio · Ivory · Baskerville · 2 lines', 'Two people under the Milky Way in a thin ivory frame, with the date and details below'] },
  { key: 't-bleed', color: '', dark: true,
    ja: ['湖の鳥居と天の川', '2025.05.24 ／ SONY ILCE-7M4', '余白なし · Futura · 文字を写真に重ねる', '湖の鳥居と天の川。額はなく、写真の下のほうに白い文字で撮影情報が重なっている'],
    en: ['Torii and the Milky Way', '2025.05.24 / SONY ILCE-7M4', 'No margin · Futura · caption on the photo', 'The torii and the Milky Way with no frame; the details sit in white type near the bottom of the photo'] },
  { key: 'tr-white', color: 'white',
    ja: ['冬の木と二人', '2025.02.15 ／ FUJIFILM X-T5', '元の比率 · White · Helvetica · 3行', '冬の木と二人のシルエットに、白い細い額。写真の下に撮影日・カメラ・レンズと露出の3行'],
    en: ['Winter tree, two figures', '2025.02.15 / FUJIFILM X-T5', 'Original ratio · White · Helvetica · 3 lines', 'The winter tree and two silhouettes in a thin white frame, with date, camera, lens and exposure in three lines below'] },
];

/** 出口で束になる、同じ浜辺の七通りのプリント */
const PRINTS = [
  { key: 'v-bleed', color: '',
    ja: ['元の比率 · 余白なし · Futura', '文字を写真に重ねる', '夕日の浜辺で犬と散歩する人のシルエット。額はなく、写真の下端に白い文字が重なっている'],
    en: ['Original ratio · No margin · Futura', 'Caption on the photo', 'Silhouette of a person walking a dog on a beach at sunset, no frame, white type along the bottom edge'] },
  { key: 'v-white', color: 'white',
    ja: ['4:5 · White · Helvetica', '白の縦長。Instagram の形', '同じ浜辺の写真に、白い 4:5 の額'],
    en: ['4:5 · White · Helvetica', 'White portrait, the Instagram shape', 'The same beach photo in a white 4:5 frame'] },
  { key: 'v-black', color: 'black', dark: true,
    ja: ['1:1 · Black · DIN', '黒の正方形。夕日が締まる', '同じ写真に、黒い正方形の額'],
    en: ['1:1 · Black · DIN', 'Black square; the sunset gets deeper', 'The same photo in a black square frame'] },
  { key: 'v-sakura', color: 'sakura',
    ja: ['元の比率 · Sakura · Baskerville', '細い桜色のふち', '同じ写真に、淡い桜色の細い額'],
    en: ['Original ratio · Sakura · Baskerville', 'A thin pale-pink edge', 'The same photo in a thin pale pink frame'] },
  { key: 'b-silver', color: 'silver',
    ja: ['3:4 · Silver Sand · Futura', '銀灰の地に、広い余白', '同じ写真に、銀灰色の 3:4 の額'],
    en: ['3:4 · Silver Sand · Futura', 'Silver-grey with a wide margin', 'The same photo in a silver-grey 3:4 frame'] },
  { key: 'v-tall', color: 'warm',
    ja: ['9:16 · Warm White · Didot · 3行', 'ストーリーズの縦長', '同じ写真を縦長の 9:16 に。上下に広い余白と3行の文字'],
    en: ['9:16 · Warm White · Didot · 3 lines', 'Tall, for Stories', 'The same photo in a tall 9:16 frame with wide margins and three lines of text'] },
  { key: 'v-wide', color: 'gunmetal', dark: true,
    ja: ['16:9 · Gunmetal · Futura · 1行', '濃い灰の横長', '同じ写真に、濃い灰色の横長 16:9 の額'],
    en: ['16:9 · Gunmetal · Futura · 1 line', 'Dark grey, landscape', 'The same photo in a dark grey 16:9 frame'] },
];

/** Room 03 の比率（同じ星空の写真を4つの比率で書き出したもの） */
const RATIOS = [
  { key: 'r-45', r: '4:5', color: 'white', name: 'White', ja: 'Instagram の縦長', en: 'Instagram portrait' },
  { key: 'r-916', r: '9:16', color: 'black', name: 'Black', ja: 'ストーリーズ・リール・TikTok', en: 'Stories, Reels, TikTok' },
  { key: 'r-11', r: '1:1', color: 'onyx', name: 'Onyx', ja: 'Instagram・X の正方形', en: 'Instagram and X square' },
  { key: 'r-169', r: '16:9', color: 'warm', name: 'Warm White', ja: 'X・Threads の横長', en: 'X and Threads landscape' },
];

const T = {
  ja: {
    base: '/fuchidori/',
    title: 'Fuchidori（ふちどり）— 撮影情報ごと、写真を額に入れる',
    desc: '写真を選ぶと、カメラ・レンズ・F値・シャッター速度・ISO を読み取り、余白に組んで書き出す Web アプリ。無料・登録なし。写真は端末の外に出ません。',
    skip: '作品へ移動',
    nav: { label: 'ページの操作', tell: '人に教える', open: 'アプリを開く', lang: 'English' },
    hero: {
      kicker: ['Fuchidori', '写真に額をつける無料の Web アプリ'],
      h1: ['撮影情報ごと、', '写真を額に入れる。'],
      lead: '写真を選ぶと、カメラ・レンズ・F値・シャッター速度・ISO を読み取って、余白に小さく組みます。登録もインストールもいりません。',
      open: 'アプリを開く',
      tell: '人に教える',
      tag: ['撮って出し', '2025.05.24 · SONY ILCE-7M4 · F1.8 15s ISO3200'],
      cue: ['Scroll', '額に入れる'],
      photoAlt: '夜の琵琶湖に立つ朱色の鳥居と、その上に広がる天の川。額に入れる前の、撮って出しの写真',
      printAlt: '同じ鳥居と天の川の写真に白い額がつき、写真の下に 2025.05.24、SONY ILCE-7M4、FE 20mm F1.8 G, 20mm, F1.8 15s ISO3200 の3行が入っている',
      numsLabel: 'この写真の撮影情報',
      nums: [['F値', 'F1.8'], ['シャッター速度', '15s'], ['ISO感度', 'ISO3200']],
      sayK: 'Exported with Fuchidori',
      say: '書き出すと、この一枚になる。',
      no: '01',
      title: '湖の鳥居と天の川',
      meta: '2025.05.24<span class="sep"> ／ </span>SONY ILCE-7M4',
      spec: '4:5 · White · Didot · 3行',
      size: 'JPEG 3,277 × 4,096 px',
      tell2: 'この展示を写真仲間に教える',
    },
    r1: {
      kicker: ['Room 01', '展示室'],
      h2: ['額に入れると、', '撮って出しが', '作品になる。'],
      lead: 'アプリで書き出した画像を、手を加えずに掛けています。どの比率・地色・書体で書き出したかは、作品ラベルに書いてあります。',
      list: ['List of works', '出品目録'],
      listLabel: '出品目録（押すと、その作品の前へ移動します）',
      walkLabel: '展示室の作品',
    },
    stack: {
      kicker: ['Room 01', '出口'],
      h2: ['同じ一枚を、', '七通りに刷る。'],
      lead: '比率は8種類、地色は9色、書体は14種類。余白を「なし」にすると、文字を写真の上に重ねます。',
      exif: '2025.04.06 · FUJIFILM X-S20 · XF70-300mm · PRO Neg. Std · F5.6 1/1000s ISO200',
      label: '同じ浜辺の写真を、七通りの額で書き出したプリント',
    },
    exit: { kicker: 'Next', title: ['次は、', 'あなたの写真を掛ける。'], open: 'アプリを開く', tell: 'この展示を人に教える' },
    r2: {
      band: [['F値', 'F1.8'], ['シャッター速度', '15s'], ['ISO感度', 'ISO3200'], ['焦点距離', '20mm'], ['撮影日', '2025.05.24'], ['カメラ', 'ILCE-7M4']],
      kicker: ['Room 02', '撮影情報'],
      h2: ['カメラが残した記録を、', '余白に3行で組む。'],
      lead: 'F値やシャッター速度は、写真のファイルの中に記録（EXIF）として残っています。Fuchidori はそれを読み取って、行ごとに並べます。',
      loupeAlt: 'No. 01 の額の文字の部分を、ルーペで大きくしたところ。2025.05.24、SONY ILCE-7M4、FE 20mm F1.8 G, 20mm, F1.8 15s ISO3200 の3行',
      loupeCap: 'No. 01 の額の下の余白を、ルーペで見たところ',
      lines: [
        ['1行目', '撮影日', ['DateTimeOriginal'], '2025.05.24', '書き方は6通り'],
        ['2行目', 'カメラ', ['Make', 'Model'], 'SONY ILCE-7M4'],
        ['3行目', 'レンズと露出', ['LensModel', 'FocalLength', 'FNumber', 'ExposureTime', 'ISOSpeedRatings'], 'FE 20mm F1.8 G, 20mm, F1.8 15s ISO3200'],
      ],
      linesLabel: '3行の中身と、読み取る記録の名前',
      more: [
        '富士フイルムの写真は、フィルムシミュレーション名（CLASSIC Neg. など）も読み取ります。記録の無い項目や、タイトル・作者の名前は、その場で打ち込めます。',
        '行数は1〜4行。どの項目を何行目に置くかは、ドラッグで入れ替えます。区切り文字と日付の書き方は6種類ずつ、字の大きさと字間は4段階ずつ。',
      ],
      uiAlt: 'Fuchidori の「情報」の画面。行数・区切り文字・日付の書き方と、項目ごとの入力欄が並ぶ',
      uiCap: '「情報」タブ。項目ごとに書き換えられる',
    },
    r3: {
      kicker: ['Room 03', '比率'],
      h2: ['投稿先の形に、', '額ごと合わせる。'],
      more: '同じ写真を4つの比率で書き出した作例です。ほかに、元の比率・3:4・2:3・1.91:1。',
      alt: (r, name) => `天の川を見上げる二人の写真を、${name} の ${r} の額で書き出したもの`,
    },
    priv: {
      kicker: ['Notice', '写真の扱い'],
      h2: ['写真は、', '端末の外に出ない。'],
      text: '読み込みから書き出しまで、お使いのスマホやパソコンのブラウザの中で処理します。Fuchidori のサーバーには、写真を受け取る仕組みがありません。',
      facts: [
        ['写真のアップロード', '0', '読み込みも書き出しも、端末の中で済ませます'],
        ['アクセス解析・広告・Cookie', '0', '誰が何を作ったか、こちらでは知りようがありません'],
        ['位置情報（GPS）', 'GPS', '書き出すときに消します。カメラと露出の記録は残します'],
      ],
      link: 'プライバシーポリシー',
    },
    how: {
      kicker: ['How to', '使い方'],
      h2: ['開いて、', '3手で書き出す。'],
      steps: [
        ['ui-home', '写真を選ぶ', 'まん中の枠を押して、写真か動画を選びます。撮影情報は、この時点で読み取ります。', 'Fuchidori を開いたところ。まん中に写真を選ぶ枠があり、赤い丸で囲んである'],
        ['ui-edit', '額を整える', '比率・余白・地色・文字を、下のタブで切り替えながら決めます。', '編集の画面。上に仕上がり、下に比率・余白・地色の操作が並ぶ'],
        ['ui-export', '保存する', 'iPhone は共有シートから写真に保存。Instagram や X へも、そのまま送れます。パソコンは画像として保存します。', '書き出しの画面。「写真に保存 / 共有」のボタンがある'],
      ],
      open: 'アプリを開く',
      note: 'インストールはいりません。ホーム画面に追加すると、アプリのように開けます。',
    },
    share: {
      kicker: ['Share', '人に教える'],
      h2: ['この展示を、', '写真仲間に', '教えてください。'],
      text: 'リンクを送ると、作例の画像つきで表示されます。',
      post: 'Fuchidori — 撮影情報ごと、写真を額に入れる無料の Web アプリ',
      btn: { native: '共有する', x: 'X でポスト', line: 'LINE で送る', copy: 'リンクをコピー', copied: 'リンクをコピーしました' },
      next: '自分でも試す — アプリを開く',
      msg: 'これ、額の付け方がいい',
      cardAlt: 'リンクを送ったときに出る画像。暗い展示室の壁に、白い額に入った鳥居と天の川の作例が掛かり、「撮影情報ごと、写真を額に入れる。」の文字',
      cap: '送った相手には、このように届きます（見本）。',
    },
    spec: {
      kicker: ['Catalogue', '図録'],
      h2: '動作環境と書き出し',
      rows: [
        ['動くところ', 'ブラウザで開く Web アプリ。インストールはいりません（ホーム画面に追加もできます）'],
        ['額', '比率8種（元の比率・4:5・3:4・2:3・1:1・9:16・16:9・1.91:1）・余白5段・写真の枠線5段・地色9色（White・Warm White・Ivory・Silver Sand・Gunmetal・Onyx・Black・Sakura・Sunny Yellow）'],
        ['文字', '書体14種（Helvetica・Futura・DIN・Didot 風などの欧文と日本語）・1〜4行・区切り文字6種・日付の書き方6種・字の大きさ4段・字間4段'],
        ['写真', 'JPEG・長辺 4,096px。カメラと露出の記録は残し、GPS の位置情報は消します'],
        ['動画', '60秒まで。写真と同じ額と文字で書き出します（ブラウザが対応している場合）'],
        ['保存', 'iPhone は共有シートから写真に保存、そのまま SNS へも。パソコンは画像として保存'],
        ['料金', '無料。登録はいりません'],
        ['画面の言葉', '日本語'],
      ],
    },
    foot: {
      nav: 'フッター',
      privacy: 'プライバシーポリシー',
      fonts: ['欧文書体（SIL Open Font License）', 'Playfair Display', 'Jost'],
    },
    notes: [
      '作例の撮影情報は、説明のために入れた値です。',
      '記載の会社名・製品名は、各社の商標または登録商標です。Fuchidori は各社とは関係のない個人の制作物です。',
    ],
  },
  en: {
    base: '/fuchidori/en/',
    title: 'Fuchidori — Frame your photo, shooting details and all',
    desc: 'Pick a photo and Fuchidori reads the camera, lens, aperture, shutter speed and ISO, then sets them in the margin of a frame. A free web app. No sign-up. Your photos never leave your device.',
    skip: 'Skip to the gallery',
    nav: { label: 'Page actions', tell: 'Share', open: 'Open the app', lang: '日本語' },
    hero: {
      kicker: ['Fuchidori', 'Free web app'],
      h1: ['Frame your photo,', 'shooting details and all.'],
      lead: 'Pick a photo and Fuchidori reads the camera, lens, aperture, shutter speed and ISO, then sets them in small type in the margin. No account, nothing to install. The app itself is in Japanese.',
      open: 'Open the app',
      tell: 'Tell a friend',
      tag: ['Straight out of camera', '2025.05.24 · SONY ILCE-7M4 · F1.8 15s ISO3200'],
      cue: ['Scroll', 'into the frame'],
      photoAlt: 'A vermilion torii standing in Lake Biwa at night under the Milky Way. The photo straight out of camera, before framing',
      printAlt: 'The same photo of the torii and the Milky Way in a white frame, with 2025.05.24, SONY ILCE-7M4 and FE 20mm F1.8 G, 20mm, F1.8 15s ISO3200 in three lines below',
      numsLabel: 'Shooting details of this photo',
      nums: [['Aperture', 'F1.8'], ['Shutter', '15s'], ['ISO', 'ISO3200']],
      sayK: 'Exported with Fuchidori',
      say: 'Export it, and this is the print.',
      no: '01',
      title: 'Torii and the Milky Way',
      meta: '2025.05.24<span class="sep"> / </span>SONY ILCE-7M4',
      spec: '4:5 · White · Didot · 3 lines',
      size: 'JPEG 3,277 × 4,096 px',
      tell2: 'Show this to a photographer friend',
    },
    r1: {
      kicker: ['Room 01', 'Gallery'],
      h2: ['Put it in a frame,', 'and a snapshot', 'becomes a print.'],
      lead: 'Every image here was exported from the app and hung as it came out. The label under each one gives the ratio, colour and typeface.',
      list: ['List of works', ''],
      listLabel: 'List of works (select one to walk to it)',
      walkLabel: 'Works in the gallery',
    },
    stack: {
      kicker: ['Room 01', 'Exit'],
      h2: ['One photo,', 'printed seven ways.'],
      lead: 'Eight ratios, nine background colours, fourteen typefaces. Set the margin to none and the caption sits on the photo itself.',
      exif: '2025.04.06 · FUJIFILM X-S20 · XF70-300mm · PRO Neg. Std · F5.6 1/1000s ISO200',
      label: 'The same beach photo exported in seven different frames',
    },
    exit: { kicker: 'Next', title: ['Next on the wall:', 'your photo.'], open: 'Open the app', tell: 'Share this exhibition' },
    r2: {
      band: [['Aperture', 'F1.8'], ['Shutter', '15s'], ['ISO', 'ISO3200'], ['Focal length', '20mm'], ['Date', '2025.05.24'], ['Camera', 'ILCE-7M4']],
      kicker: ['Room 02', 'Shooting details'],
      h2: ['What your camera recorded,', 'set in three lines.'],
      lead: 'Aperture, shutter speed and the rest are already in your photo file, recorded as EXIF. Fuchidori reads them and arranges them line by line.',
      loupeAlt: 'The caption of No. 01 seen through a loupe: 2025.05.24, SONY ILCE-7M4, FE 20mm F1.8 G, 20mm, F1.8 15s ISO3200 in three lines',
      loupeCap: 'The margin of No. 01, under a loupe',
      lines: [
        ['Line 1', 'Date', ['DateTimeOriginal'], '2025.05.24', 'six date formats'],
        ['Line 2', 'Camera', ['Make', 'Model'], 'SONY ILCE-7M4'],
        ['Line 3', 'Lens and exposure', ['LensModel', 'FocalLength', 'FNumber', 'ExposureTime', 'ISOSpeedRatings'], 'FE 20mm F1.8 G, 20mm, F1.8 15s ISO3200'],
      ],
      linesLabel: 'What goes on each line, and the EXIF fields it comes from',
      more: [
        'For FUJIFILM photos it also reads the film simulation (CLASSIC Neg. and so on). Anything missing, plus a title or your name, can be typed in on the spot.',
        'Use one to four lines and drag items between them. Six separators, six date formats, four text sizes and four letter-spacing steps.',
      ],
      uiAlt: 'The Info tab in Fuchidori, with line count, separator, date format and an input for each item',
      uiCap: 'The Info tab. Edit any item in place.',
    },
    r3: {
      kicker: ['Room 03', 'Ratios'],
      h2: ['Fit the frame', 'to where you post.'],
      more: 'The same photo exported in four ratios. Also available: original, 3:4, 2:3 and 1.91:1.',
      alt: (r, name) => `Two people under the Milky Way, exported in a ${name} ${r} frame`,
    },
    priv: {
      kicker: ['Notice', 'Your photos'],
      h2: ['Your photos', 'never leave your device.'],
      text: 'Everything from opening to exporting happens in the browser on your phone or computer. Fuchidori’s server has no way to receive a photo.',
      facts: [
        ['Photo uploads', '0', 'Opening and exporting both happen on your device'],
        ['Analytics, ads, cookies', '0', 'We have no way of knowing who made what'],
        ['Location (GPS)', 'GPS', 'Removed on export. Camera and exposure details stay'],
      ],
      link: 'Privacy policy',
    },
    how: {
      kicker: ['How to', ''],
      h2: ['Open it and export', 'in three steps.'],
      steps: [
        ['ui-home', 'Pick a photo', 'Tap the frame in the middle and choose a photo or video. The shooting details are read right away.', 'Fuchidori when first opened, with the frame for picking a photo circled in red'],
        ['ui-edit', 'Set the frame', 'Switch between the tabs at the bottom to choose ratio, margin, colour and caption.', 'The editor, with the result on top and ratio, margin and colour controls below'],
        ['ui-export', 'Save', 'On iPhone, save to Photos from the share sheet, or send it straight to Instagram or X. On a computer, it saves as an image file.', 'The export screen with a Save to Photos / Share button'],
      ],
      open: 'Open the app',
      note: 'Nothing to install. Add it to your home screen and it opens like an app. The interface is in Japanese.',
    },
    share: {
      kicker: ['Share', ''],
      h2: ['Know someone', 'who takes photos?'],
      text: 'Send them this page. The link shows up with a sample image.',
      post: 'Fuchidori — a free web app that frames your photos, shooting details and all',
      btn: { native: 'Share', x: 'Post on X', line: 'Send on LINE', copy: 'Copy link', copied: 'Link copied' },
      next: 'Try it yourself — Open the app',
      msg: 'Love how this frames photos',
      cardAlt: 'The image shown when the link is shared: a torii and Milky Way sample in a white frame on a dark gallery wall, with the words “Frame your photo, shooting details and all.”',
      cap: 'What your friend will see (sample).',
    },
    spec: {
      kicker: ['Catalogue', ''],
      h2: 'Requirements and output',
      rows: [
        ['Runs in', 'Your browser. Nothing to install (you can add it to your home screen)'],
        ['Frame', '8 ratios (original, 4:5, 3:4, 2:3, 1:1, 9:16, 16:9, 1.91:1), 5 margin widths, 5 photo border widths, 9 background colours (White, Warm White, Ivory, Silver Sand, Gunmetal, Onyx, Black, Sakura, Sunny Yellow)'],
        ['Caption', '14 typefaces (Helvetica, Futura, DIN and Didot-style Latin faces, plus Japanese), 1–4 lines, 6 separators, 6 date formats, 4 sizes, 4 letter-spacing steps'],
        ['Photos', 'JPEG, 4,096 px on the long edge. Camera and exposure details are kept; GPS location is removed'],
        ['Videos', 'Up to 60 seconds, with the same frame and caption (if your browser supports it)'],
        ['Saving', 'On iPhone, save to Photos from the share sheet or post straight to social apps. On a computer, save as an image file'],
        ['Price', 'Free. No account needed'],
        ['Language', 'The app interface is in Japanese'],
      ],
    },
    foot: {
      nav: 'Footer',
      privacy: 'Privacy policy',
      fonts: ['Typefaces (SIL Open Font License)', 'Playfair Display', 'Jost'],
    },
    notes: [
      'Shooting details in the samples are illustrative values.',
      'Company and product names are trademarks or registered trademarks of their respective owners. Fuchidori is an independent project and is not affiliated with them.',
    ],
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

function head(lang, t, alt, { ogImage = true, motion = false } = {}) {
  const url = SITE + t.base;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ja" href="${SITE}${alt.ja}">
<link rel="alternate" hreflang="en" href="${SITE}${alt.en}">
<link rel="alternate" hreflang="x-default" href="${SITE}${alt.ja}">
<meta name="theme-color" content="#1f1e1c">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/fuchidori/img/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/fuchidori/img/apple-touch-icon.png">
${motion ? '<link rel="preload" href="/fuchidori/fonts/PlayfairDisplay-regular.woff2" as="font" type="font/woff2" crossorigin>\n' : ''}<link rel="stylesheet" href="/fuchidori/assets/fuchidori.css">
${motion ? '<script src="/fuchidori/assets/boot.js"></script>\n<script src="/fuchidori/assets/fuchidori.js" defer></script>\n' : ''}<meta property="og:type" content="website">
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

/** 天。紹介ページでは「人に教える」と「アプリを開く」。文書のページでは言語の切り替えも */
function top(lang, alt, home, { doc = false } = {}) {
  const t = T[lang];
  const other = lang === 'ja' ? 'en' : 'ja';
  return `<header class="top${doc ? ' top--doc' : ''}">
  <a class="brand" href="${home}">Fuchidori</a>
  <nav class="top__nav" aria-label="${t.nav.label}">
    <a class="top__lang" href="${alt[other]}" hreflang="${other}" lang="${other}">${t.nav.lang}</a>
    ${doc ? '' : `<a href="#share" data-tell>${t.nav.tell}</a>\n    `}<a class="top__go" href="${APP}">${t.nav.open}</a>
  </nav>
</header>`;
}

function foot(lang, alt, privacyHref) {
  const t = T[lang];
  const other = lang === 'ja' ? 'en' : 'ja';
  const [fk, f1, f2] = t.foot.fonts;
  return `<footer class="foot">
  <div class="wrap">
    <div class="foot__row">
      <a class="brand brand--foot" href="${T[lang].base}">Fuchidori</a>
      <nav class="foot__nav" aria-label="${t.foot.nav}">
        <a href="${APP}">${t.nav.open}</a>
        <a href="${privacyHref}">${t.foot.privacy}</a>
        <a href="${alt[other]}" hreflang="${other}" lang="${other}">${t.nav.lang}</a>
      </nav>
    </div>
${t.notes.map((n) => `    <p>${n}</p>`).join('\n')}
    <p class="foot__fonts"><span>${fk}</span><a href="/fuchidori/fonts/PlayfairDisplay-OFL.txt">${f1}</a><a href="/fuchidori/fonts/Jost-OFL.txt">${f2}</a></p>
    <p class="foot__c">© 2026 Yashima Studio</p>
  </div>
</footer>`;
}

/** ルーペの印: プリントの上のキャプションを細い枠で囲む（位置は frames.json の caption から。ルーペの箱は 100 × 92） */
function loupeMark() {
  const [x, y, w, h] = FRAMES.hero.caption;
  const PW = 56, PH = 56 / ratioOf('hero'); // プリントは箱の幅の 56%
  const pad = 1.2;
  const X = r2(x * PW - pad), Y = r2(y * PH - pad), W = r2(w * PW + pad * 2), H = r2(h * PH + pad * 2);
  return `<svg class="loupe__lead" viewBox="0 0 100 92" preserveAspectRatio="none" aria-hidden="true"><rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="none" stroke="#d2402f" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}

/* ── 紹介ページ ── */
function landing(lang) {
  LANG = lang;
  const t = T[lang];
  const h = t.hero;
  const alt = { ja: T.ja.base, en: T.en.base };
  const url = SITE + t.base;
  const priv = PRIVACY[lang].base;
  const hf = FRAMES.hero;
  const crop = hf.crop;
  const heroA = r5((crop[2] * hf.size[0]) / (crop[3] * hf.size[1]));
  const N = WORKS.length;
  const total = String(N + 1).padStart(2, '0');

  const work = (w, i) => {
    const [title, meta, sp, a] = w[lang];
    const no = String(i + 2).padStart(2, '0');
    const H = heightOf(w.key);
    const r = ratioOf(w.key);
    return `        <figure class="work f-${w.key}${w.color ? ` g-${w.color}` : ' g-night'}${w.dark ? ' is-dark' : ''}" id="w-${no}" tabindex="-1">
          <div class="work__frame"><span class="glow" aria-hidden="true"></span>
            ${img(w.key, a, `(max-width: 760px) 78vw, ${Math.round(H * r * 9)}px`)}
          </div>
          <figcaption class="label">
            <span class="label__no">${no}</span>
            <span class="label__title">${title}</span>
            <span class="label__meta">${meta}</span>
            <span class="label__spec">${spec(w.color, sp)}</span>
          </figcaption>
        </figure>`;
  };

  const tellHref = '#share';

  return `${head(lang, t, alt, { motion: true })}
<body>
<a class="skip" href="#works">${t.skip}</a>
${top(lang, alt, t.base)}

<main>
  <!-- 1–2. 冒頭と、撮って出しが額に入るまで（JS があれば画面に留めてスクロールで進める） -->
  <section class="hero" id="top" data-scene="hero" aria-labelledby="h-hero">
    <div class="hero__stage">
      <div class="hero__view">
        <div class="hero__photo" data-crop="${crop.join(' ')}">
          ${img('hero-photo', h.photoAlt, `(max-aspect-ratio: ${Math.round(heroA * 1000)}/1000) ${Math.round(heroA * 100)}vh, 100vw`, { eager: true, high: true })}
        </div>
        <div class="hero__scrim" aria-hidden="true"></div>
        <div class="hero__intro">
          ${kicker(h.kicker)}
          <h1 id="h-hero">${ib(h.h1)}</h1>
          <p class="hero__lead">${h.lead}</p>
          <div class="acts">
            <a class="btn" href="${APP}">${h.open}</a>
            <a class="btn btn--line" href="${tellHref}" data-tell>${h.tell}</a>
          </div>
        </div>
        <p class="hero__tag"><b>${h.tag[0]}</b><span>${h.tag[1]}</span></p>
        <p class="hero__cue" aria-hidden="true"><span class="hero__cue-line"></span>${h.cue[0]}<span class="hero__cue-jp">${h.cue[1]}</span></p>
      </div>
      <div class="hero__final">
        <figure class="hero__work">
          <div class="hero__frame">
            <span class="glow" aria-hidden="true"></span>
            <span class="mat" aria-hidden="true"></span>
            ${img('hero', h.printAlt, '(min-width: 1100px) 61vh, (orientation: landscape) 61vh, 86vw', { eager: true, cls: 'hero__print', attrs: ` data-cap="${hf.caption[0]} ${hf.caption[2]}"` })}
          </div>
          <dl class="hero__nums" aria-label="${h.numsLabel}">
${h.nums.map(([k, v]) => `            <div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}
          </dl>
          <figcaption class="label hero__label">
            <span class="label__say"><small>${h.sayK}</small>${h.say}</span>
            <span class="label__head"><span class="label__no">${h.no}</span><span class="label__title">${h.title}</span></span>
            <span class="label__col"><span class="label__meta">${h.meta}</span></span>
            <span class="label__col"><span class="label__spec">${spec('white', h.spec)}</span><span class="label__size">${h.size}</span></span>
            <a class="tell" href="${tellHref}" data-tell>${h.tell2}</a>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>

  <!-- 3. Room 01 の入口（出品目録） -->
  <section class="r1" id="works" aria-labelledby="h-r1">
    <div class="wrap r1__grid">
      <div class="rv">
        ${kicker(t.r1.kicker)}
        <h2 id="h-r1">${ib(t.r1.h2)}</h2>
        <p class="lead">${t.r1.lead}</p>
      </div>
      <nav class="rv" aria-label="${t.r1.listLabel}">
        ${kicker(t.r1.list, 'kicker list__hd')}
        <ol class="list">
${WORKS.map((w, i) => { const no = String(i + 2).padStart(2, '0'); return `          <li><a href="#w-${no}" data-go="${i}"><span class="list__no">${no}</span><span class="list__t">${w[lang][0]}</span><span class="list__s">${spec(w.color, w[lang][2])}</span></a></li>`; }).join('\n')}
        </ol>
      </nav>
    </div>
  </section>

  <!-- 3. 展示室（縦のスクロールで横へ歩く。作品が中央に来たところで少し止まる） -->
  <section class="walk" data-scene="walk" data-hold="${HOLD}" data-pace="${PACE}" aria-label="${t.r1.walkLabel}">
    <div class="walk__stage">
      <div class="walk__track">
${WORKS.map(work).join('\n')}
      </div>
      <div class="walk__meter" aria-hidden="true"><span class="walk__count"><b>02</b> / ${total}</span><span class="walk__bar"><i></i></span></div>
    </div>
  </section>

  <!-- 3'. 出口: 同じ一枚を七通りに刷る -->
  <section class="stack" data-scene="stack" aria-labelledby="h-stack">
    <div class="wrap stack__stage">
      <div class="stack__text">
        ${kicker(t.stack.kicker)}
        <h2 id="h-stack">${ib(t.stack.h2)}</h2>
        <p class="lead">${t.stack.lead}</p>
      </div>
      <ol class="pile" aria-label="${t.stack.label}">
${PRINTS.map((p, i) => `        <li class="pr f-${p.key}${p.color ? ` g-${p.color}` : ' g-night'}${p.dark ? ' is-dark' : ''}">${img(p.key, p[lang][2], '(min-width: 960px) 30vw, 60vw', { ws: [480, 960] })}<p class="pr__cap"><b>${String(i + 1).padStart(2, '0')}</b>${spec(p.color, p[lang][0])}</p></li>`).join('\n')}
      </ol>
      <div class="now" aria-hidden="true">
${PRINTS.map((p, i) => `        <p class="now__i"><span class="now__no">${String(i + 1).padStart(2, '0')}<small>/${String(PRINTS.length).padStart(2, '0')}</small></span><span class="now__s">${spec(p.color, p[lang][0])}<span>${p[lang][1]}</span></span></p>`).join('\n')}
      </div>
      <p class="stack__exif">${t.stack.exif}</p>
    </div>
  </section>

  <div class="exit wrap rv">
    <p class="kicker">${t.exit.kicker}</p>
    <p class="exit__title">${ib(t.exit.title)}</p>
    <div class="acts">
      <a class="btn" href="${APP}">${t.exit.open}</a>
      <a class="btn btn--line" href="${tellHref}" data-tell>${t.exit.tell}</a>
    </div>
  </div>

  <!-- 4. Room 02 撮影情報 -->
  <section class="r2" id="caption" aria-labelledby="h-r2">
    <div class="band" aria-hidden="true">
      <dl class="band__row">
${t.r2.band.map(([k, v]) => `        <div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}
      </dl>
    </div>
    <div class="wrap r2__grid">
      <div class="r2__head rv">
        ${kicker(t.r2.kicker)}
        <h2 id="h-r2">${ib(t.r2.h2)}</h2>
        <p class="lead">${t.r2.lead}</p>
      </div>
      <figure class="loupe">
        ${img('hero', '', '(min-width: 960px) 26vw, 56vw', { cls: 'loupe__print', ws: [640, 1280] })}
        ${loupeMark()}
        <div class="loupe__lens">
          <div class="loupe__cap">
            ${img('hero-caption', t.r2.loupeAlt, '(min-width: 960px) 34vw, 70vw')}
            <span class="loupe__cover loupe__cover--1" aria-hidden="true"></span>
            <span class="loupe__cover loupe__cover--2" aria-hidden="true"></span>
            <span class="loupe__cover loupe__cover--3" aria-hidden="true"></span>
          </div>
        </div>
        <figcaption class="note">${t.r2.loupeCap}</figcaption>
      </figure>
      <ol class="lines rv" aria-label="${t.r2.linesLabel}">
${t.r2.lines.map(([n, name, fields, v, extra], i) => `        <li><span class="lines__n" aria-hidden="true">${i + 1}</span><span class="lines__t"><small>${n}</small>${name}</span><span class="lines__v">${v}${extra ? `<span class="note">　${extra}</span>` : ''}</span><span class="lines__f">${fields.map((f) => `<code>${f}</code>`).join('')}</span></li>`).join('\n')}
      </ol>
      <div class="r2__more rv">
${t.r2.more.map((p) => `        <p>${p}</p>`).join('\n')}
      </div>
      <figure class="r2__ui rv">
        <div class="phone">${img('ui-info', t.r2.uiAlt, '(min-width: 960px) 220px, 44vw')}</div>
        <figcaption class="label">${t.r2.uiCap}</figcaption>
      </figure>
    </div>
  </section>

  <!-- 5. Room 03 比率（昼の展示室。写真はそのままで、額の形が変わる） -->
  <section class="ratio day" data-scene="ratio" aria-labelledby="h-r3">
    <div class="ratio__stage">
      <div class="ratio__head">
        ${kicker(t.r3.kicker)}
        <h2 id="h-r3">${ib(t.r3.h2)}</h2>
        <p class="ratio__more">${t.r3.more}</p>
      </div>
      <ol class="ratio__list" aria-hidden="true">
${RATIOS.map((x, i) => `        <li${i === 0 ? ' class="is-on"' : ''}><b>${x.r}</b><span>${x[lang]}</span></li>`).join('\n')}
      </ol>
      <div class="ratio__box">
        <span class="ratio__glow" aria-hidden="true"></span>
${RATIOS.map((x) => `        <span class="ratio__mat g-${x.color}" aria-hidden="true"></span>`).join('\n')}
        ${img('raw-stars', '', '(min-width: 960px) 420px, 62vw', { cls: 'ratio__photo', attrs: ' aria-hidden="true"' })}
${RATIOS.map((x) => `        <figure class="ratio__item f-${x.key} g-${x.color}" data-photo="${FRAMES[x.key].photo.join(' ')}">
          ${img(x.key, t.r3.alt(x.r, x.name), '(min-width: 960px) 44vw, 80vw', { ws: [480, 960, 1600] })}
          <figcaption><b>${x.r}</b>${x[lang]} · ${spec(x.color, x.name)}</figcaption>
        </figure>`).join('\n')}
      </div>
    </div>
  </section>

  <!-- 6. 写真は端末の外に出ない -->
  <section class="priv" aria-labelledby="h-priv">
    <div class="wrap rv">
      ${kicker(t.priv.kicker)}
      <h2 id="h-priv">${ib(t.priv.h2)}</h2>
      <p class="priv__text">${t.priv.text}</p>
      <dl class="priv__facts">
${t.priv.facts.map(([k, big, d]) => `        <div><dt>${k}</dt><dd><span class="priv__big">${big}</span><span class="priv__d">${d}</span></dd></div>`).join('\n')}
      </dl>
      <p class="priv__link"><a href="${priv}">${t.priv.link}</a></p>
    </div>
  </section>

  <!-- 7. 使い方3手（昼の展示室） -->
  <section class="how day" id="how" aria-labelledby="h-how">
    <div class="wrap">
      <div class="rv">
        ${kicker(t.how.kicker)}
        <h2 id="h-how">${ib(t.how.h2)}</h2>
      </div>
      <ol class="how__steps">
${t.how.steps.map(([n, h3, p, a], i) => `        <li class="how__step rv">
          <figure class="how__shot"><div class="phone">${img(n, a, '(min-width: 760px) 240px, 38vw')}</div>${i === 0 ? '<svg class="grease" viewBox="0 0 120 84" preserveAspectRatio="none" aria-hidden="true"><path d="M10 12 C 38 5, 84 6, 112 10 C 116 30, 117 56, 110 75 C 80 81, 40 80, 8 74 C 3 52, 4 30, 8 8 L 22 6" fill="none" stroke="#d2402f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>' : ''}</figure>
          <div class="how__txt"><span class="how__no">${String(i + 1).padStart(2, '0')}</span><h3>${h3}</h3><p>${p}</p></div>
        </li>`).join('\n')}
      </ol>
      <div class="how__act rv">
        <a class="btn" href="${APP}">${t.how.open}</a>
        <p class="note">${t.how.note}</p>
      </div>
    </div>
  </section>

  <!-- 8. 人に教える（いちばんしてほしいこと） -->
  <section class="share" id="share" aria-labelledby="h-share" data-share data-url="${url}" data-text="${esc(t.share.post)}" data-copied="${esc(t.share.btn.copied)}">
    <div class="wrap share__grid">
      <div class="rv">
        ${kicker(t.share.kicker)}
        <h2 id="h-share">${ib(t.share.h2)}</h2>
        <p class="lead">${t.share.text}</p>
        <div class="share__btns">
          <button type="button" class="btn" data-act="native" hidden>${t.share.btn.native}</button>
          <a class="btn btn--line" href="https://x.com/intent/post?text=${enc(t.share.post)}&amp;url=${enc(url)}" target="_blank" rel="noopener">${t.share.btn.x}</a>
          <a class="btn btn--line" href="https://social-plugins.line.me/lineit/share?url=${enc(url)}" target="_blank" rel="noopener">${t.share.btn.line}</a>
          <button type="button" class="btn btn--line" data-act="copy" hidden>${t.share.btn.copy}</button>
        </div>
        <p class="share__done" role="status"></p>
        <p class="share__next"><a class="tell" href="${APP}">${t.share.next}</a></p>
      </div>
      <figure class="card rv">
        <div class="card__bubble">
          <p class="card__msg">${t.share.msg}</p>
          <div class="card__link">
            <img src="/fuchidori/img/og-${lang}.jpg" width="1200" height="630" alt="${esc(t.share.cardAlt)}" loading="lazy" decoding="async">
            <p><b>${esc(t.title)}</b><span>yashimastudio.com</span></p>
          </div>
        </div>
        <figcaption class="note">${t.share.cap}</figcaption>
      </figure>
    </div>
  </section>

  <!-- 9. 図録（動作環境と書き出し） -->
  <section class="spec" aria-labelledby="h-spec">
    <div class="wrap spec__in">
      <div>
        ${kicker(t.spec.kicker)}
        <h2 id="h-spec">${t.spec.h2}</h2>
      </div>
      <dl class="spec__t">
${t.spec.rows.map(([k, v]) => `        <div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}
      </dl>
    </div>
  </section>
</main>

${foot(lang, alt, priv)}
</body>
</html>
`;
}

function privacy(lang) {
  const t = { ...T[lang], ...PRIVACY[lang] };
  const alt = { ja: PRIVACY.ja.base, en: PRIVACY.en.base };
  return `${head(lang, t, alt, { ogImage: false })}
<body>
${top(lang, alt, T[lang].base, { doc: true })}
<main class="doc">
  <h1>${t.h1}</h1>
  <p class="note">${lang === 'ja' ? `制定日：${UPDATED.ja}` : `Effective: ${UPDATED.en}`}</p>
${t.body.trim()}
</main>
${foot(lang, alt, t.base)}
</body>
</html>
`;
}

/* ── CSS の「書き出し」の区間（frames.json から） ── */
function generatedCss() {
  const out = [];
  const hf = FRAMES.hero;
  const [, , cw, ch] = hf.crop;
  const A = r5((cw * hf.size[0]) / (ch * hf.size[1]));
  const W = `max(100%, calc(${r2(A * 100)} * var(--svh)))`;
  out.push(`/* 冒頭の撮って出し: 写真の部分（${A}:1）が画面を覆う大きさ。まん中に置く */
.hero__photo {
  width: ${W};
  aspect-ratio: ${A};
  margin-left: calc(${W} / -2);
  margin-top: calc(${W} / ${-r5(2 * A)});
}`);
  // 作例ごとの縦横比（--r）。展示室の高さ（--h: 画面の高さの %、--hb: 動かないときの px）、束の大きさ（--k）
  const keys = [...new Set([...WORKS.map((w) => w.key), ...PRINTS.map((p) => p.key), ...RATIOS.map((x) => x.key)])];
  for (const k of keys) {
    const r = ratioOf(k);
    const extra = WORKS.some((w) => w.key === k) ? ` --h: ${heightOf(k)}; --hb: ${Math.round(heightOf(k) * 7.5)}px;` : '';
    const kk = PRINTS.some((p) => p.key === k) ? ` --k: ${r5(Math.sqrt(r))};` : '';
    out.push(`.f-${k} { --r: ${r5(r)};${extra}${kk} }`);
  }
  // 展示室の高さ = 舞台 100svh + 作品ごとの止まり（hold）+ 横に進む距離 × PACE。
  // 横に進む距離 = 最初と最後の作品の半分 + 間の作品の幅 + 間隔。作品の幅は .m .work と同じ式
  // 作品の高さの単位 --u は 1svh。ただし背の低い画面（iPhone SE の Safari など）では、いちばん高い作品と
  // 下のラベル・メーター（--walk-room）が舞台に収まるところまで縮める
  const maxH = MAXH();
  const w = WORKS.map((x) => `min(78vw, calc(${r2(heightOf(x.key) * ratioOf(x.key))} * var(--u)))`);
  const n = WORKS.length;
  const travel = [`${w[0]} / 2`, `${w[n - 1]} / 2`, ...w.slice(1, -1), `${n - 1} * var(--gap)`].join(' + ');
  out.push(`/* 展示室: ${n} 点。止まる長さ ${HOLD * 100}svh・横 1px に縦 ${PACE}px（fuchidori.js も同じ値を data-* から読む） */
.m .walk {
  --u: min(var(--svh), calc((100 * var(--svh) - var(--walk-room)) / ${maxH}));
  height: calc(100 * var(--svh) + ${n} * ${HOLD * 100} * var(--svh) + ${PACE} * (${travel}));
}
.m .walk__track {
  padding-left: calc(50% - ${w[0]} / 2);
  padding-right: calc(50% - ${w[n - 1]} / 2);
}`);
  return out.join('\n');
}

const css = readFileSync(CSS, 'utf8');
const start = '/* @generated:start */';
const end = '/* @generated:end */';
const a = css.indexOf(start);
const b = css.indexOf(end);
if (a < 0 || b < a) throw new Error('fuchidori.css に @generated の印が無い');
writeFileSync(CSS, css.slice(0, a + start.length) + '\n' + generatedCss() + '\n' + css.slice(b));
console.log(CSS, '(@generated)');

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
