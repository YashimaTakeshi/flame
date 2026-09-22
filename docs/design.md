# flame 実装仕様

版: 1.0（統合版）
確定日: 2026-09-21
統合元: `設計案A（利用者の実務ファースト）` / `設計案B（堅牢性・プライバシー）` / `設計案C（レンダリングコア）`
および審査結果 `judgement.md`
前提資料: `docs/requirements.md` / `docs/reference-frmm.md` / `docs/poc/report-{canvas,exif,fonts,geo-batch,grain,jp-subset,svg-font}.md`

---

## 0. この仕様の読み方と、破ってはいけない3原則

### 0.1 この文書の位置づけ

**この1本だけを読めば実装できる**ことを目標に書いている。3つの設計案と7つのPoCレポートの
内容のうち、**採用が確定したものだけ**がここにある。3案の原文を読む必要はない
（節ごとに「出典」を1行で示すのは、後から根拠をたどれるようにするためであって、
併読を要求するものではない）。

**数値には必ず出所が付いている。**

| 印 | 意味 |
|---|---|
| **実測** | PoC で実際に計測した値。レポート名を併記する。**変更するときは再計測が要る** |
| **観測** | 参考アプリの動画・スクショから読み取った性質（比率・配置・行構成など） |
| **推定** | 本仕様が置いた値。動画からは読み取れない。**データ1箇所の差し替えで直せる形にしてある** |
| **同梱実測** | **実際にビルドして同梱したアセットの値**（`docs/assets.md` / `public/fonts/manifest.json` / `public/geo/*.json`）。PoC の試算より新しいので、**食い違ったらこちらが正** |

### 0.2 破ってはいけない3原則（`requirements.md` §3。3案のどの提案よりも上位）

**原則① 写真は一切サーバーに送らない。**
EXIF 解析・合成・書き出しをすべてブラウザ内で完結させる。
本仕様ではこれを画面の約束ではなく **CSP の `connect-src`**（§12.2）で担保する。
外部通信が発生する機能を足す場合は、何をどこへ送るかを §12.1 の棚卸し表に追記し、
画面（S8）に明記してからでなければ実装してはならない。

**原則② プレビュー＝書き出し結果。**
画面に見えているものと保存される画像が一致しないなら、その機能は未完成とみなす。
本仕様ではこれを運用規律ではなく **`buildScene` が `k` を引数に取らない**という
型シグネチャ（§2.5）と、**L4 パリティテスト**（§14.4）で担保する。

**原則③ 描画コアは環境非依存に保つ。**
`src/core` は DOM / Canvas / React を一切 import しない。
本仕様ではこれを **dependency-cruiser と `no-restricted-globals`**（§1.3）で CI から強制する。
「気をつける」ではなく、違反したらビルドが落ちる。

### 0.3 競合したときの優先順位（審査確定。上位が常に勝つ）

| 順位 | 規則 |
|---:|---|
| **0** | `requirements.md` §3 の設計原則3つ |
| **1** | 実測値。`docs/poc/*.md` と、それより新しい**同梱アセットの実測**（`docs/assets.md`）。推測・仮説より上。両者が食い違ったら**同梱実測**を採る |
| **2** | **利用者が見る・触れるもの**（画面・遷移・文言・タブ構成・モード） |
| **3** | **データ構造・モジュール境界・描画の仕組み**（型・op・core の純粋性・テスト層） |
| **4** | **不可逆操作の直前の検査／端末外に出るもの**（Preflight の block 判定・CSP・EXIF再注入・同意） |
| **5** | 2〜4が重なったら「**出力が嘘になるか**」で切る。嘘になるなら検査を採り、ならないなら動線の軽さを採る |

規則5の具体例（本仕様での適用結果）:
- 書体未ロードで書き出しを止める → **止める**（別書体で保存されるのは嘘）
- 粒の一致度 0.97 を常時表示する → **表示しない**（出力は正しい。不安を生むだけ。自己診断の中だけ）
- 空き容量を書き出し前に確認する → **確認しない**（出力は正しい。設定画面の注記に落とす）

### 0.4 この仕様が「入れない」と決めたもの（再提案には説明を要する）

| 入れないもの | 理由 |
|---|---|
| 課金（カート）ボタン | `requirements.md` §6 でスコープ外。S0 に場所だけ空ける |
| WebP 書き出し | 45MP に 3.1秒（JPEG の12倍。**実測** `report-canvas.md`）。形式選択 UI 自体を作らない。JPEG 1択 |
| ホイールピッカー | Web の `overflow-y` エミュレートは選択値が中央に残る保証がない。全廃（§9） |
| IndexedDB | 扱う量 30KB。同期で読めないと初回フレームがちらつく（§13.3） |
| 和文 Bold | 同梱の Regular は **442.4KB**（同梱実測）。Bold を足すと倍を超える（**実測** `report-jp-subset.md`: 462.9KB + 473.1KB）。階層は濃淡とサイズで出す（§4.7）。**`verify-assets.mjs` が Bold の混入を検査して落とす** |
| 異体字置換表（髙→高） | 同梱サブセットは髙・﨑を**収録済み**（同梱実測。ビルドが cmap で確認している）。同梱字に置換を提案するのは誤り |
| グレインの論理セル索き | 細かい粒で一致率 0.29〜0.59（**実測** `report-grain.md`）。**棄却済み** |
| `BroadcastChannel` による複数タブ同期 | 主戦場は単一タブ PWA。版付きキーで最悪ケースは後勝ち上書きであって破損ではない |
| はみ出し時の4択ダイアログ | 参考素材のレンズ名（44字）で常時発火する。自動はしご＋注記に置換（§4.5） |
| 粒の一致度の常時表示 / 送信記録の独立画面 / 連鎖警告のまとめ画面 | 既存画面に畳む（§9） |
| 空き容量の Preflight 検査 | `storage.estimate()` は iOS で当てにならない。設定の注記のみ |
| `fit` の利用者切り替え | スタイル固定。トグルを足すとテスト行列が 15×2 になる（§16.7） |

### 0.5 新しく増える画面は1枚だけ

**タブは5つ固定**（スタイル／組み／地色／書体／情報）。
**新規画面として認めるのは「自己診断」1枚だけ。**
Preflight・オフライン説明・送信記録・和文取得の同意は、すべて既存画面の中に入る（§9.11）。

---

## 1. 技術スタックとディレクトリ構成

> 出典: 骨格＝案C §1.1/§1.2。状態管理は案C §7.1。ビルド・配信・CSP は案B §4/§6。CI は本仕様で新規確定（審査 §6-3 の欠落）。

### 1.1 依存ライブラリ（全部。これ以外を足すには理由の説明を要する）

| 用途 | 採用 | サイズ | 根拠 |
|---|---|---:|---|
| ビルド | Vite 8 + TypeScript 7（strict） | — | `package.json` の現物に合わせる |
| UI | React 19 | gzip 約45KB | `package.json` の現物 |
| 状態 | zustand + immer | gzip 約3KB | 案C §7.1。React 外から `store.subscribe` で canvas を駆動できる |
| 検証 | zod | gzip 約13KB | 設定スキーマの検証（§13.4） |
| EXIF 読み | `exifr/dist/lite.esm.mjs` | **gzip 14.6KB**（実測 `report-exif.md`） | mini は Make/Model 非対応で不可 |
| EXIF 書き戻し | `piexifjs` | gzip 9.0KB（実測 同上） | JPEG 専用。再注入は実測で成功（+414B） |
| ZIP | `fflate`（`zipSync`） | gzip 約8KB | 30ファイル 271〜274ms（実測 `report-geo-batch.md`） |
| HEIC 変換 | `heic2any`（**動的 import・プリキャッシュしない**） | gzip 330.6KB（実測 `report-exif.md`） | 実機検証の結果で削除しうる（§16.10） |
| テスト | Vitest / Playwright（Chromium 固定版）/ fast-check / pixelmatch | — | §14 |
| CI 構造検査 | dependency-cruiser / ESLint | — | §1.3 |
| 配信 | Cloudflare Workers（Static Assets）+ GitHub Actions | — | §15 |

**同梱アセット（すべて生成済みでリポジトリにコミット済み。同梱実測 `docs/assets.md`）**

| アセット | 実ファイル | サイズ | ロード |
|---|---|---:|---|
| 欧文8書体 × {regular, bold} | `public/fonts/<Family>-{regular,bold}.woff2` | **合計 255.3KB** | 初回プリキャッシュ |
| 和文（JIS第一水準＋異体字 **3,476字**） | `public/fonts/NotoSansJP-regular.woff2` | **442.4KB** | **和文書体を選んだときだけ遅延** |
| 書体の索引 | `public/fonts/manifest.json` | 2.3KB | 初回 |
| 日本の市区町村 1,894件 | `public/geo/jp-municipalities.json` | 91.3KB（転送は gzip 約33KB） | 初回プリキャッシュ |
| 世界の主要都市 24,323件 | `public/geo/world-cities.json` | 986.4KB（転送は gzip 約0.47MB） | **要求時のみ**（§12.1 C5） |
| ライセンス本文 9件 | `public/licenses/<Family>-OFL.txt` | 各 4.4KB | 初回プリキャッシュ（§16.2） |

**まだ入っていない依存**（段階0〜2 で入れる。`package.json` の現物には無い）:
`immer` / `zod` / `@playwright/test` / `pixelmatch` / `fast-check` / `dependency-cruiser` / `eslint`。

### 1.2 ディレクトリ

```
flame/
├─ docs/                          本仕様・要件・PoC レポート
├─ scripts/                       ★ 実在。通常のビルドでは走らない（§15.4）
│  ├─ build_fonts.py              欧文サブセット＋和文サブセット＋manifest.json
│  ├─ build-geo.mjs               市区町村 centroid ＋ 世界都市（§7.2）
│  ├─ verify-assets.mjs           同梱アセットの検査。★npm run build の先頭で必ず走る★
│  ├─ build-coverage.mjs          （要追加）和文の cmap → coverage-jp.json（§11.4）
│  └─ gen-version.mjs             （要追加）version.json 生成（§15.2）
├─ public/
│  ├─ _headers                    （要追加）CSP ほかの HTTP ヘッダ（§15.5）
│  ├─ licenses/                   OFL 1.1 の本文 9件 ＋（要追加）CC BY 4.0 の表示（§16.2）
│  ├─ fonts/                      woff2 17件 ＋ manifest.json
│  ├─ geo/                        jp-municipalities.json / world-cities.json
│  └─ icons/                      （要追加）
├─ src/
│  ├─ core/                     ★ 純 TypeScript。DOM / Canvas / React を一切 import しない
│  │  ├─ units.ts                 Lu / Px ブランド型、RectLu、ScaledLength
│  │  ├─ scene/
│  │  │  ├─ ops.ts                DrawOp の型定義（このアプリの描画語彙の全部・13種）
│  │  │  ├─ scene.ts              Scene / SceneMeta / RenderTarget 型
│  │  │  └─ builder.ts            SceneBuilder（op を積むだけの薄いビルダ）
│  │  ├─ styles/
│  │  │  ├─ types.ts              StyleDef の型
│  │  │  ├─ registry.ts         ★ 15スタイルのデータ（§3.4）
│  │  │  ├─ tokens.ts             SIZE_LU / TRACKING_EM / 背景9色
│  │  │  └─ layout.ts             StyleDef + 写真比 + キャプション高 → 矩形
│  │  ├─ caption/
│  │  │  ├─ fields.ts             ExifFacts + Overrides → FieldValues
│  │  │  ├─ format.ts             露出/焦点距離/日付/撮影地の文字列化
│  │  │  ├─ compose.ts            LineSpec × FieldValues → 行テキスト（欠損の詰め）
│  │  │  ├─ typeset.ts            行box の確定・整列・はみ出しのはしご
│  │  │  ├─ sanitize.ts           NFC / 制御文字・BiDi 除去 / 書記素カウント
│  │  │  └─ ink.ts                背景輝度 → 文字色の自動反転
│  │  ├─ texture/
│  │  │  ├─ grain.ts              GrainOp 生成
│  │  │  ├─ paper.ts              印画紙フチ（決定論的な閉多角形）
│  │  │  └─ filmstrip.ts          コマ枠（プリミティブ op への分解）
│  │  ├─ geo/
│  │  │  ├─ nearest.ts            Haversine 最近傍
│  │  │  └─ confidence.ts         classify(d1,d2) と粒度の切り上げ（§7.3）
│  │  ├─ preflight/
│  │  │  ├─ types.ts              CheckId / CheckResult / BLOCKING_ALLOWED
│  │  │  └─ run.ts                preflight() の本体（純粋部分。検査の実体はポート注入）
│  │  ├─ ports.ts                 TextMeasurer / CoverageOracle / CanvasProbe
│  │  └─ compose.ts             ★ buildScene(input): Scene  ← core の唯一の公開入口
│  ├─ render/                    Canvas 2D 実行層
│  │  ├─ target.ts                makePreviewTarget / makeExportTarget
│  │  ├─ executor.ts            ★ renderScene()  ← ctx に触れる唯一の場所
│  │  ├─ ops/                     op ごとの実行関数
│  │  ├─ resources/
│  │  │  ├─ fonts.ts              FontRegistry / LoadedFontSet（§11.3）
│  │  │  ├─ images.ts             PhotoStore（preview / withFull）
│  │  │  ├─ grainTiles.ts         グレインタイル生成＋キャッシュ（§5.2）
│  │  │  └─ verticalText.ts       SVG vertical-rl → ImageBitmap（§6）
│  │  ├─ measure.ts               TextMeasurer の Canvas 実装（measureText はここだけ）
│  │  └─ guards.ts                createVerifiedCanvas（§11.2）
│  ├─ worker/
│  │  ├─ render.worker.ts         Scene を受け取り OffscreenCanvas で実行 → Blob
│  │  ├─ protocol.ts              メイン↔Worker のメッセージ型
│  │  └─ batchQueue.ts            逐次実行・進捗・キャンセル
│  ├─ platform/
│  │  ├─ decode.ts              ★ すべての画像デコードの唯一の入口（§16.5）
│  │  ├─ save.ts                  保存・共有の分岐（§8.4）
│  │  ├─ storage.ts               safeStorage（§11.6）
│  │  ├─ net.ts                   fetch のラッパ＋通信ログ（§12.4）
│  │  ├─ sw-update.ts             version.json / SW 更新（§15.3）
│  │  └─ caps.ts                  端末能力の測定と保存（§16.10）
│  ├─ app/                       React UI
│  │  ├─ state/                   zustand ストア（§13）
│  │  ├─ preview/                 PreviewDriver（React の外で canvas を駆動）
│  │  ├─ panels/                  スタイル / 組み / 地色 / 書体 / 情報 タブ
│  │  ├─ sheets/                  S3-a / S4 / S5 / S6
│  │  └─ routes/                  S0 S1 S3 S7 S8 + 自己診断
│  └─ build-info.ts               BUILD_INFO（§15.1）
├─ tests/
│  ├─ unit/ snapshot/ golden/ parity/
│  └─ fixtures/
├─ .dependency-cruiser.cjs
├─ wrangler.toml
└─ .github/workflows/deploy.yml
```

### 1.3 依存方向と、CI での強制

```
                    ┌──────────┐
                    │   app    │  React / DOM / ブラウザAPI 何でも
                    └────┬─────┘
             ┌───────────┼───────────┬──────────────┐
             ▼           ▼           ▼              ▼
        ┌────────┐  ┌────────┐  ┌──────────┐        │
        │ render │  │ worker │  │ platform │        │
        └───┬────┘  └───┬────┘  └────┬─────┘        │
            │           │            │              │
            └───────────┴────────────┴──────────────┘
                              ▼
                     ┌──────────────────┐
                     │       core       │  依存: なし（TS 標準ライブラリのみ）
                     └──────────────────┘

許可:  app → {render, worker, platform, core}
       worker → {render, core}
       render → {core}
       platform → {core}   ※型のみ
禁止:  core → 他のどれか / core → react | dom | 任意の Web API
       render → {app, worker, platform}
```

`core` は `ImageBitmap` も `CanvasRenderingContext2D` も知らない。写真は `PhotoId` という
ただの文字列として Scene に載り、実体の解決は `render/resources/images.ts` が行う。
`core` がどうしても必要とする外部能力は**ポート**として抽象化する（§2.6）。

**`.dependency-cruiser.cjs`（実物。これを CI で `npx depcruise --config .dependency-cruiser.cjs src` として回す）**

```js
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    {
      name: 'core-is-pure',
      comment: 'requirements.md §3-3: core は他レイヤーに依存してはならない',
      severity: 'error',
      from: { path: '^src/core' },
      to:   { path: '^src/(render|worker|platform|app)' },
    },
    {
      name: 'core-no-dom-libs',
      comment: 'core は React / DOM 系ライブラリを import してはならない',
      severity: 'error',
      from: { path: '^src/core' },
      to:   { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
              pathNot: '^node_modules/(zod|immer)($|/)' },
    },
    {
      name: 'render-does-not-look-up',
      comment: 'render は app / worker / platform を知らない（バックエンド差し替えの前提）',
      severity: 'error',
      from: { path: '^src/render' },
      to:   { path: '^src/(app|worker|platform)' },
    },
    {
      name: 'worker-scope',
      severity: 'error',
      from: { path: '^src/worker' },
      to:   { path: '^src/(app|platform)' },
    },
    {
      name: 'platform-types-only-from-core',
      comment: 'platform は core の「型」しか使わない（実行時依存を持たない）',
      severity: 'error',
      from: { path: '^src/platform' },
      to:   { path: '^src/core', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'decode-single-entry',
      comment: '§16.5: 画像デコードは platform/decode.ts に一本化する',
      severity: 'error',
      from: { pathNot: '^src/platform/decode\\.ts$' },
      to:   { path: '^src/platform/decode\\.ts$', dependencyTypes: [] , via: null },
      // ※ 実体の強制は ESLint の no-restricted-syntax（下記）で行い、
      //   ここでは decode.ts 以外が createImageBitmap を再実装していないことを人がレビューする
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-orphans', severity: 'warn',
      from: { orphan: true, pathNot: '\\.d\\.ts$|^src/(main|sw)\\.ts$' }, to: {} },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    reporterOptions: { dot: { collapsePattern: '^src/[^/]+' } },
  },
};
```

**ESLint（実物。`eslint.config.js`）**

> **★フラット設定の落とし穴（実際に踏んだ）★**
> 同じルール名を複数のブロックで指定すると、**マージではなく後勝ちで上書きされる。**
> ブロックを分けて `no-restricted-syntax` を書くと、**最後のブロックの selector しか効かない。**
> （最初にこの形で書いたとき、`core` から `document` を触るコードが素通りしていた。）
> よって **selector は1つの表にまとめ、例外のあるファイルでは「その1件を除いた全部」を
> 再指定する。**

```js
// eslint.config.js
/** 素の呼び出しを禁止する API と、その唯一の入口 */
const RESTRICTED = {
  measureText: {
    selector: "MemberExpression[property.name='measureText']",
    message: '測定は render/measure.ts に集約する。実行層で測り直すと、プレビューと書き出しで別の値を使うことになる（§2.6）',
  },
  createCanvasElement: {
    selector: "CallExpression[callee.object.name='document'][callee.property.name='createElement'][arguments.0.value='canvas']",
    message: 'canvas の生成は render/guards.ts の createVerifiedCanvas を通す。面積上限を超えると例外を投げず透明な黒を返すため（§11.2）',
  },
  newOffscreenCanvas: {
    selector: "NewExpression[callee.name='OffscreenCanvas']",
    message: 'canvas の生成は createVerifiedCanvas を通す（§11.2）',
  },
  fontsCheck: {
    selector: "MemberExpression[property.name='check'][object.property.name='fonts']",
    message: 'document.fonts.check() は描画後に true を返すため検知に使えない。FontRegistry の台帳で判定する（§11.3）',
  },
  fillText: {
    selector: "MemberExpression[property.name='fillText']",
    message: 'fillText は render/ops/text.ts 経由のみ。書体の読み込み待ちを型で保証するため（§11.3）',
  },
  createImageBitmap: {
    selector: "CallExpression[callee.name='createImageBitmap']",
    message: 'デコードは platform/decode.ts に一本化する。経路が分かれると Orientation の扱いがずれ、プレビューと書き出しの一致が破れる（§16.5）',
  },
};

/** core だけに課す追加の制約。core は決定論的で、外界を知らない */
const CORE_ONLY = {
  newDate:    { selector: "NewExpression[callee.name='Date']",
                message: 'core は現在時刻を知らない。時刻は SceneInput で渡す' },
  dateNow:    { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
                message: 'core は現在時刻を知らない。時刻は SceneInput で渡す' },
  mathRandom: { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
                message: 'core は決定論的であること。ゆらぎは seed から導く' },
};

/** 指定したキーだけを外し、残り全部を禁止する */
const restrict = (table, ...exempt) => [
  'error',
  ...Object.entries(table).filter(([k]) => !exempt.includes(k)).map(([, v]) => v),
];

const CORE_GLOBALS = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage',
                      'fetch', 'Image', 'OffscreenCanvas', 'FontFace', 'caches', 'performance'];

// 適用（概念）:
//   src/**                      → restrict(RESTRICTED)                    全部禁止
//   src/render/measure.ts       → restrict(RESTRICTED, 'measureText')
//   src/render/guards.ts        → restrict(RESTRICTED, 'createCanvasElement', 'newOffscreenCanvas')
//   src/render/resources/fonts.ts → restrict(RESTRICTED, 'fontsCheck')
//   src/render/ops/text.ts      → restrict(RESTRICTED, 'fillText')
//   src/platform/decode.ts      → restrict(RESTRICTED, 'createImageBitmap')
//   src/platform/net.ts         → no-restricted-globals から 'fetch' を外す
//   src/core/**                 → restrict({...RESTRICTED, ...CORE_ONLY}) ＋ CORE_GLOBALS
```

**入れたら必ず「わざと違反を書いて落ちること」を確認する。**
禁止した8件すべてが検出されること、依存方向の違反で `depcruise` の終了コードが 1 になることを、
段階0 の完了判定にする（§17）。**効いていない lint は、無いより悪い。**

**この5本の lint 規則が、本仕様の安全装置の土台である。**
`fillText` / `createElement('canvas')` / `createImageBitmap` / `measureText` / `fetch` の
5つは、**素の呼び出しを禁止して唯一の入口に集約する**。後から適用するのは不可能なので、
§17 の段階1で入れる。

---

## 2. 描画モデル

> 出典: 全面的に案C §2。`GrainOp` の実行だけ案B の方式に差し替え（`report-grain.md` 実測）。
> `VerticalTextOp` の実行に案B の FM-07 対策を追加（`report-svg-font.md` 実測）。

### 2.1 いちばん大事な不変条件

> **`buildScene(input: SceneInput): Scene` は `k`（解像度倍率）を引数に取らない。**
> `k` は `renderScene` にしか渡らない。

これにより「プレビューだけ違う描画をするコード」を書く場所が**構文上存在しない**。
原則②は検証事項ではなく構成上の帰結になる。**この不変条件を壊す変更は許可しない。**

派生する規則:

1. `SceneInput` に `RenderTarget`・`dpr`・`cssWidth`・`longEdgePx` を含めてはならない。
2. `Scene` は構造化複製可能な plain object であること（Worker へそのまま渡せる）。
3. 解像度に依存する生成物（グレインタイル・縦書きラスタ）は `render` 層が `k` から作る。
   `core` はその**パラメータ**（論理サイズ・シード）だけを持つ。
4. 書き出し解像度の選択（4096 / 元のまま）は `RenderTarget` の作り方を変えるだけで、
   `Scene` を変えない。

### 2.2 論理単位

```ts
// core/units.ts
declare const LU: unique symbol;
declare const PX: unique symbol;

/** 論理単位。キャンバス幅を常に 1000 とする座標系上の長さ */
export type Lu = number & { readonly [LU]: true };
/** 出力先のデバイスピクセル */
export type Px = number & { readonly [PX]: true };

export const lu = (n: number): Lu => n as Lu;
export const px = (n: number): Px => n as Px;

/** キャンバス幅は常にこの値。高さはスタイルと写真比から決まる */
export const CANVAS_WIDTH_LU = lu(1000);

export interface PointLu { readonly x: Lu; readonly y: Lu }
export interface SizeLu  { readonly w: Lu; readonly h: Lu }
export interface RectLu  { readonly x: Lu; readonly y: Lu; readonly w: Lu; readonly h: Lu }
```

幅 1000 を基準にする理由:

1. PoC が幅 1000 で実測して差分 0.159% を出している（**実測** `report-canvas.md`）。土台を引き継ぐ。
2. 横組みキャプションの見かけの大きさはフレームの**幅**に対する比で決まる。
   幅基準なら「Medium = 16lu」が全スタイルで一貫した意味を持つ。
3. `k` がスカラー1個で済む（`ctx.setTransform(k,0,0,k,0,0)`）。縦横別倍率にすると線幅・字間・
   円が非等方に歪み、Canvas 2D では制御不能になる。
4. `k = 4.096`（長辺4096 の 4:5）でも `1e-6 lu = 4e-6 px` と float の桁が余る。

アスペクト比による体感差は `StyleDef.typeScale` というデータで吸収する（16:9 は 0.88）。
**コードで分岐しない。**

**`core` では絶対に丸めない。** デバイスピクセルへのスナップは `render` 層の、
しかも `ScaledLength` が明示的に許可した op でのみ行う。

### 2.3 DrawOp（13種。これ以上増やさない）

```ts
// core/scene/ops.ts
import type { Lu, Px, RectLu, PointLu } from '../units';

export interface Rgba { readonly r: number; readonly g: number; readonly b: number; readonly a: number }

export interface FontRef {
  /** manifest.json の family 名をそのまま使う。空白は入らない */
  readonly family: 'Arimo'|'Jost'|'Oswald'|'Cinzel'|'PlayfairDisplay'|'LibreBaskerville'|'PTSerif'|'Tinos'|'NotoSansJP';
  readonly weight: 400 | 700;
  readonly style: 'normal';
}

/* ── 長さのスケール規則 ─────────────────────────────────────── */
export type ScaledLength =
  /** v * k。ほとんどの長さはこれ */
  | { readonly mode: 'logical'; readonly value: Lu }
  /** 物理px固定。出力には使わない（UI専用） */
  | { readonly mode: 'device'; readonly value: Px }
  /** max(v*k, minPx)。ヘアラインが低解像度で消えるのを防ぐ */
  | { readonly mode: 'hairline'; readonly value: Lu; readonly minPx: Px };

/* ── op の分類マーカー ──────────────────────────────────────── */
/** setTransform(k,...) だけで正しくなる。実行層は k を意識しなくてよい */
export interface ScaleInvariant  { readonly resolution: 'invariant' }
/** 実行層が k を受け取り、内部の生成物を作り直す必要がある */
export interface ResolutionAware { readonly resolution: 'regenerate-at-k' }

/* ── プリミティブ ───────────────────────────────────────────── */

export interface FillRectOp extends ScaleInvariant {
  readonly op: 'fillRect';
  readonly rect: RectLu;
  readonly color: Rgba;
}

export interface FillPathOp extends ScaleInvariant {
  readonly op: 'fillPath';
  /** 閉多角形。印画紙のフチ・コマ枠の切り欠きに使う */
  readonly points: readonly PointLu[];
  readonly color: Rgba;
  readonly evenOdd?: boolean;
}

export interface StrokeRectOp {
  readonly op: 'strokeRect';
  readonly rect: RectLu;
  readonly color: Rgba;
  readonly width: ScaledLength;
  /** プレビュー(k<1.5)のときだけ半ピクセル位置に吸着させ、にじみを避ける */
  readonly snap: 'none' | 'device-pixel-when-preview';
  readonly resolution: 'invariant' | 'regenerate-at-k';
}

export interface LinearGradientOp extends ScaleInvariant {
  readonly op: 'linearGradient';
  readonly rect: RectLu;
  readonly from: PointLu;
  readonly to: PointLu;
  readonly stops: readonly { readonly at: number; readonly color: Rgba }[];
}

export interface RadialGradientOp extends ScaleInvariant {
  readonly op: 'radialGradient';   // ビネット
  readonly rect: RectLu;
  readonly center: PointLu;
  readonly innerR: Lu;
  readonly outerR: Lu;
  readonly stops: readonly { readonly at: number; readonly color: Rgba }[];
}

export interface DrawPhotoOp extends ScaleInvariant {
  readonly op: 'photo';
  readonly photo: PhotoId;
  /** 元画像側の切り出し矩形。0..1 の正規化座標（元画素数に依存させない） */
  readonly srcNorm: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly dst: RectLu;
}

export interface ClipPushOp extends ScaleInvariant {
  readonly op: 'clipPush';
  readonly shape:
    | { readonly kind: 'rect'; readonly rect: RectLu; readonly radius?: Lu }
    | { readonly kind: 'path'; readonly points: readonly PointLu[] };
}
export interface ClipPopOp extends ScaleInvariant { readonly op: 'clipPop' }

export interface BlendPushOp extends ScaleInvariant {
  readonly op: 'blendPush';
  readonly mode: 'source-over' | 'multiply' | 'overlay' | 'soft-light' | 'screen';
  readonly alpha: number;
}
export interface BlendPopOp extends ScaleInvariant { readonly op: 'blendPop' }

/* ── テキスト ───────────────────────────────────────────────── */

export interface TextOp extends ScaleInvariant {
  readonly op: 'text';
  readonly id: string;
  readonly text: string;
  readonly font: FontRef;
  readonly sizeLu: Lu;
  /** em 比ではなく絶対 lu。実行層は (value*k)+'px' を letterSpacing に入れるだけ */
  readonly letterSpacingLu: Lu;
  readonly color: Rgba;
  readonly anchor: PointLu;
  readonly align: 'left' | 'center' | 'right';
  /** core で確定済みの実測幅。★実行層は measureText を呼んではならない★ */
  readonly measuredWidthLu: Lu;
  /** ヒンティング差の免責領域として meta に集約される */
  readonly boundsLu: RectLu;
}

export interface VerticalTextOp extends ResolutionAware {
  readonly op: 'verticalText';
  readonly id: string;
  readonly text: string;
  readonly font: FontRef;
  readonly sizeLu: Lu;
  readonly lineGapLu: Lu;
  readonly letterSpacingLu: Lu;
  readonly color: Rgba;
  /** 縦組みを流し込む矩形。SVG の viewBox はこの比率で作る */
  readonly box: RectLu;
  /** 右の行から左へ送る */
  readonly raster: 'svg-vertical-rl';
}

/* ── 質感 ───────────────────────────────────────────────────── */

export interface GrainOp extends ResolutionAware {
  readonly op: 'grain';
  readonly rect: RectLu;
  /** 粒1個の論理サイズ。★物理px固定にすると書き出しで粒の89%が消える★ */
  readonly cellLu: Lu;
  readonly intensity: number;                 // 0..1
  readonly blend: 'overlay' | 'soft-light' | 'multiply';
  /** 決定論的ノイズの種。写真ごとに固定して再描画でチラつかせない */
  readonly seed: number;
  readonly chroma: 'mono' | 'rgb';
  /** パターンは変換行列を単位行列に戻し、デバイス空間で敷く */
  readonly space: 'device';
}

export type DrawOp =
  | FillRectOp | FillPathOp | StrokeRectOp
  | LinearGradientOp | RadialGradientOp
  | DrawPhotoOp
  | ClipPushOp | ClipPopOp
  | BlendPushOp | BlendPopOp
  | TextOp | VerticalTextOp
  | GrainOp;

export type PhotoId = string & { readonly __photo: true };
```

**op を増やすときの規律**: 「既存 op の組み合わせで作れないこと」の説明を PR に書くこと。
質感（§5）はグレイン以外すべてプリミティブに分解してあり、**分解できたものは自動的に
スケール不変＝ピクセル一致**になる。`ResolutionAware` は `GrainOp` と `VerticalTextOp` の
**2つだけ**に閉じ込める。

> 補足: `GrainOp` から案C にあった `cellsPerTile` を削除した。タイルの寸法決定は
> 書き出し倍率に基づく実行層の責務になったため（§5.2）、`core` が持つ意味がなくなった。
> `cellLu` / `seed` / `space:'device'` / `resolution:'regenerate-at-k'` はそのまま残る。

### 2.4 Scene と RenderTarget

```ts
// core/scene/scene.ts
export interface Scene {
  readonly schema: 1;
  readonly canvas: {
    readonly widthLu: Lu;     // 常に 1000
    readonly heightLu: Lu;    // スタイル比 or 写真比から算出
    readonly background: Rgba;
  };
  readonly ops: readonly DrawOp[];
  readonly meta: SceneMeta;
}

export interface SceneMeta {
  readonly styleId: StyleId;
  /** 厳密一致を要求しない領域（文字・縦組み・ヘアライン・グレイン）。L4 が使う */
  readonly exactnessExempt: readonly RectLu[];
  /** 実際に描画される文字の集合。和文カバレッジ検査と &text= の入力になる */
  readonly charsUsed: string;
  readonly fontsUsed: readonly FontRef[];
  readonly warnings: readonly SceneWarning[];
}

export type SceneWarning =
  | { readonly kind: 'exif-missing'; readonly fields: readonly FieldId[] }
  | { readonly kind: 'caption-shrunk'; readonly line: number; readonly factor: number }
  | { readonly kind: 'caption-degraded'; readonly line: number; readonly field: FieldId;
      readonly step: DegradeStep }
  | { readonly kind: 'caption-wrapped'; readonly line: number; readonly extraLines: number }
  | { readonly kind: 'caption-truncated'; readonly line: number; readonly field: FieldId }
  | { readonly kind: 'caption-empty' }
  | { readonly kind: 'band-expanded'; readonly fromLu: number; readonly toLu: number }
  | { readonly kind: 'low-contrast'; readonly ratio: number };

/** 解像度はここにしか存在しない */
export interface RenderTarget {
  readonly widthPx: number;
  readonly heightPx: number;
  /** k = widthPx / scene.canvas.widthLu */
  readonly k: number;
  /**
   * この描画が「立っている」書き出しの k。
   * kind==='export' なら k と同じ。kind==='preview' なら、いまの書き出し設定で
   * 書き出したときの k。★グレインタイルの寸法決定に使う（§5.2）★
   */
  readonly kExport: number;
  readonly kind: 'preview' | 'export' | 'thumbnail';
  readonly dpr: number;
}

export function makeTarget(
  scene: Scene, longEdgePx: number, kind: RenderTarget['kind'], kExport: number, dpr = 1,
): RenderTarget {
  const aspect = scene.canvas.heightLu / scene.canvas.widthLu;
  const widthPx  = aspect >= 1 ? Math.round(longEdgePx / aspect) : longEdgePx;
  const heightPx = aspect >= 1 ? longEdgePx : Math.round(longEdgePx * aspect);
  return { widthPx, heightPx, k: widthPx / scene.canvas.widthLu, kExport, kind, dpr };
}
```

**`kExport` を `RenderTarget` に置くのが、グレイン方式の変更を吸収する要である。**
`Scene` には入らないので不変条件（§2.1）は保たれる。
利用者が書き出し解像度を変えたら `kExport` が変わり、プレビューは再描画される（§13.5）。

**プレビューの解像度**（審査 §5-7(5) の裁定）:

```ts
// render/target.ts
export const PREVIEW_MAX_PX = 1400;   // 案C
export const DPR_CAP = 2;             // 案A（DPR3 でメモリが跳ねるのを防ぐ）

export function makePreviewTarget(
  scene: Scene, cssWidth: number, dpr: number, kExport: number,
): RenderTarget {
  const w = Math.min(Math.round(cssWidth * Math.min(dpr, DPR_CAP)), PREVIEW_MAX_PX);
  return makeTarget(scene, longEdgeFor(scene, w), 'preview', kExport, dpr);
}
```

実効は `min(cssWidth × min(dpr,2), 1400)`。9:16 で 1400×2489 ＝ 350万px。
6000×7500（4500万px・RSS +417MB **実測** `report-canvas.md`）の **1/13**。

### 2.5 実行層のシグネチャ

```ts
// render/executor.ts
export interface RenderResources {
  /** ★await 済みでないと生成できないトークン。型でフォント待ちを強制する★ */
  readonly fonts: LoadedFontSet;
  readonly photo: (id: PhotoId, target: RenderTarget) => CanvasImageSource;
  readonly grainTile: (op: GrainOp, t: RenderTarget) => CanvasPattern;
  readonly verticalText: (op: VerticalTextOp, t: RenderTarget) => CanvasImageSource;
}

export function renderScene(
  scene: Scene,
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  target: RenderTarget,
  res: RenderResources,
): void {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';          // ★§5.2: 両経路に同じならしを通す★
  ctx.setTransform(target.k, 0, 0, target.k, 0, 0);
  ctx.fillStyle = css(scene.canvas.background);
  ctx.fillRect(0, 0, scene.canvas.widthLu, scene.canvas.heightLu);
  for (const op of scene.ops) execOp(op, ctx, target, res);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function execOp(op: DrawOp, ctx: Ctx, t: RenderTarget, r: RenderResources): void {
  switch (op.op) {
    case 'fillRect':       return execFillRect(op, ctx);
    case 'fillPath':       return execFillPath(op, ctx);
    case 'strokeRect':     return execStrokeRect(op, ctx, t);
    case 'linearGradient': return execLinearGradient(op, ctx);
    case 'radialGradient': return execRadialGradient(op, ctx);
    case 'photo':          return execPhoto(op, ctx, t, r);
    case 'clipPush':       return execClipPush(op, ctx);
    case 'clipPop':        return void ctx.restore();
    case 'blendPush':      return execBlendPush(op, ctx);
    case 'blendPop':       return void ctx.restore();
    case 'text':           return execText(op, ctx, t, r);
    case 'verticalText':   return execVerticalText(op, ctx, t, r);   // t.k と t.kExport を使う
    case 'grain':          return execGrain(op, ctx, t, r);          // t.k と t.kExport を使う
    default: { const _never: never = op; throw new Error(`unknown op ${JSON.stringify(_never)}`); }
  }
}

/** 実行層にしかない唯一の丸め */
export function resolveLength(len: ScaledLength, t: RenderTarget): number /* 論理単位で返す */ {
  switch (len.mode) {
    case 'logical':  return len.value;
    case 'device':   return len.value / t.k;
    case 'hairline': return Math.max(len.value, len.minPx / t.k);
  }
}
```

`execOp` の網羅 switch に `never` 到達を置くことで、**新しい op を足したときに
「k をどう扱うか決めていない」まま通過できない**。

```ts
// render/resources/fonts.ts
declare const READY: unique symbol;
export interface LoadedFontSet {
  readonly [READY]: 'fonts-awaited';
  cssFor(ref: FontRef, sizePx: number): string;
  has(ref: FontRef): boolean;
}
```

`LoadedFontSet` は `await loadFonts(...)` 以外に作れない。よって `renderScene` を呼ぶには
必ずフォント待ちが済んでいる、という不変条件がコンパイル時に立つ（§11.3 の実行時台帳と
**両方**必要。型は半分、台帳がもう半分）。

### 2.6 core の唯一の外部依存: 測定ポート

```ts
// core/ports.ts
export const REFERENCE_EM = 100;

export interface GlyphMetrics {
  /** 基準サイズ REFERENCE_EM(=100) で測った前進幅の合計 */
  readonly advanceAtRef: number;
  readonly ascentAtRef: number;
  readonly descentAtRef: number;
}

export interface TextMeasurer {
  /** letterSpacing 抜きの素の前進幅を、基準サイズ 100px で測る */
  measure(text: string, font: FontRef): GlyphMetrics;
  /** 指定書体が実際に利用可能か（FontRegistry の台帳を見る。fonts.check() は使わない） */
  isReady(font: FontRef): boolean;
}

/** 同梱書体の収録文字。カバレッジ検査（§11.4）と core のはみ出し判定が使う */
export interface CoverageOracle { has(codePoint: number): boolean }
```

規則:

- 測定は**必ず基準サイズ 100px で1回だけ**行い、実サイズへは線形換算する
  （`advanceLu = advanceAtRef * sizeLu / 100`）。Canvas の `measureText` は font-size に対して
  線形なので、プレビューと書き出しが**同一の測定値**を使う。
- `letterSpacing` は測定に含めず、`advance + spacing * (書記素数 - 1)` を core が加算する。
  `ctx.letterSpacing` はスケールに正確比例する（**実測比 7.500000**、`report-canvas.md`）。
- **実行層での `measureText` 再呼び出しは lint で禁止**（§1.3）。測り直すと原則②が壊れる。
- 測定のキャッシュは `render/measure.ts` が持つ。キーは `${family}/${weight}/${text}`、
  **LRU 2,000 件**（超えたら古い順に捨てる）。長いタイトルの毎打鍵測定に備える。
- テストでは `FakeMeasurer`（全書記素 0.52em 固定、和文 1.0em）を注入してブラウザなしで回す。

### 2.7 影は Scene に載せない（審査 §6-6 への回答）

参考アプリのプレビューには薄いドロップシャドウがある。これを **canvas の中に描いてはならない**。
描けば書き出しに焼き込まれ、原則②の意味が壊れる。

> **規則: 影は `<canvas>` 要素の外側に CSS（`box-shadow: 0 2px 12px rgba(35,33,31,0.14)`）で付ける。
> `Scene` に影の op は存在しない**（`DrawOp` に shadow 系の op を定義していないので、
> 書こうとしても型が通らない）。

同様に、プレビュー枠の角丸・背景の薄グレー（`--bg`）も CSS 側のみ。
**canvas が描くのは、保存される画像そのものだけ。**

---

## 3. StyleDef と15スタイルの定義

> 出典: 型と値は案C §3（審査の規則3により、案A §4-3 の15スタイル表は破棄してこちらで置換）。
> SQ4 / STN3 は案C の「全面ブリード＋overlay」を採る（案A の「0行」「side-right」は不採用）。
> グルーピングの UI 提示は案A §4-2（§9.4）。

### 3.1 型

```ts
// core/styles/types.ts
export type StyleId =
  | 'OR1' | 'OR2' | 'OR3'
  | 'SQ1' | 'SQ2' | 'SQ3' | 'SQ4'
  | 'TF1'
  | 'FF1' | 'FF2' | 'FF3'
  | 'NST1'
  | 'STN1' | 'STN2' | 'STN3';

export type StyleGroup = 'OR' | 'SQ' | 'TF' | 'FF' | 'NST' | 'STN';

export type CanvasSpec =
  | { readonly kind: 'derived' }                                  // 写真比から高さを算出（OR群）
  | { readonly kind: 'fixed'; readonly aspect: readonly [number, number] };

export interface InsetLu { readonly top: Lu; readonly right: Lu; readonly bottom: Lu; readonly left: Lu }

export interface PhotoSlot {
  readonly fit: 'contain' | 'cover';
  readonly crop: 'none' | 'square' | 'toCanvas';
  readonly inset: InsetLu;
  readonly anchor: 'top' | 'center' | 'bottom';
  readonly bleed: boolean;                 // true なら inset を無視して全面
}

export type CaptionPlace =
  | 'below-photo'     // 写真の直下（OR1/OR2/OR3/SQ1/SQ2/TF1/FF1/FF3/NST1/STN1）
  | 'above-photo'     // 写真の直上（FF2）
  | 'bottom-band'     // 下部に確保した固定帯の中（SQ3 ポラロイド）
  | 'right-of-photo'  // 写真の右の余白（STN2・縦組み時の全スタイル）
  | 'overlay-bottom'; // 写真の上に重ねる（SQ4/STN3）

export interface CaptionLineSpec {
  readonly id: string;
  readonly fields: readonly FieldToken[];   // 左から順に。欠損は詰める
  readonly separator: SeparatorId;
  readonly emphasis: 'normal' | 'bold' | 'muted';
  readonly relSize: number;                 // ブロック基準サイズに対する倍率
  readonly leading: number;                 // 行の高さ = sizeLu*relSize*leading
  readonly alignOverride?: 'left' | 'center' | 'right';
  readonly collapseWhenEmpty?: boolean;     // 既定 true
  readonly maxWrap?: number;                // 折り返し許容行数。既定 1（＝折り返さない）
}

export interface CaptionBlockSpec {
  readonly place: CaptionPlace;
  readonly gapLu: Lu;                       // 写真との距離
  readonly sideInsetLu: Lu;                 // キャプションの左右インセット
  readonly outerInsetLu: Lu;                // キャンバス端（下 or 上）からの距離
  readonly bandLu?: Lu;                     // bottom-band / right-of-photo の帯
  readonly bandAlign?: 'start' | 'center' | 'end';
  readonly lines: readonly CaptionLineSpec[];
  readonly scrim?: { readonly heightLu: Lu; readonly alpha: number };  // overlay-bottom のみ
}

export interface StyleDef {
  readonly id: StyleId;
  readonly group: StyleGroup;
  readonly label: string;         // aria-label と自己診断に出す（§16.8）
  readonly ratioLabel: string;    // チップに出す '1:1' 等
  readonly canvas: CanvasSpec;
  readonly photo: PhotoSlot;
  readonly caption: CaptionBlockSpec;
  readonly typeScale: number;     // アスペクト比による体感差の吸収
  readonly border: { readonly gapLu: Lu; readonly widthLu: Lu };   // Bordered のヘアライン
  readonly defaults: { readonly align: Align; readonly tracking: TrackingId; readonly size: SizeId };
  readonly visibleIn: readonly ('kodawaru' | 'otegaru')[];         // §10
  readonly confidence: 'observed' | 'partly-observed' | 'estimated';
  readonly note?: string;
}

export type FieldId = 'title' | 'artist' | 'date' | 'camera' | 'lens' | 'exposure' | 'focal' | 'place';

export type FieldToken =
  | { readonly t: 'field'; readonly id: FieldId; readonly gate?: SettingGate }
  | { readonly t: 'literal'; readonly text: string };

export type SettingGate = 'exposureEnabled' | 'focalEnabled' | 'placeEnabled' | 'artistEnabled';

export type SeparatorId = 'comma' | 'middot' | 'slash' | 'emdash' | 'pipe' | 'space' | 'none';
export const SEPARATORS: Record<SeparatorId, string> = {
  comma: ', ', middot: ' · ', slash: ' / ', emdash: ' — ', pipe: ' | ', space: ' ', none: '',
};

export type TrackingId = 'Tight' | 'Normal' | 'Wide' | 'Widest';
export type SizeId = 'Small' | 'Medium' | 'Large';
export type Align = 'left' | 'center' | 'right';
```

### 3.2 共通トークン

```ts
// core/styles/tokens.ts
/** ブロック基準の em サイズ（論理単位）。推定値（参考アプリの実寸は未計測） */
export const SIZE_LU: Record<SizeId, Lu> = { Small: lu(13), Medium: lu(16), Large: lu(20) };

/** 字間（em 比）。実行時は sizeLu * em で lu に落とす。推定値 */
export const TRACKING_EM: Record<TrackingId, number> = {
  Tight: -0.015, Normal: 0, Wide: 0.09, Widest: 0.18,
};

const F = (id: FieldId, gate?: SettingGate): FieldToken => ({ t: 'field', id, gate });
const ins = (t: number, r: number, b: number, l: number): InsetLu =>
  ({ top: lu(t), right: lu(r), bottom: lu(b), left: lu(l) });

/** よく使う行構成の断片 */
const LINE_ALL_IN_ONE: FieldToken[] =
  [F('title'), F('date'), F('camera'), F('lens'),
   F('exposure','exposureEnabled'), F('focal','focalEnabled'), F('place','placeEnabled')];
const LINE_TITLE_DATE: FieldToken[] = [F('title'), F('artist','artistEnabled'), F('date')];
const LINE_CAMERA:     FieldToken[] = [F('camera')];
const LINE_LENS_TECH:  FieldToken[] = [F('lens'), F('focal','focalEnabled'), F('exposure','exposureEnabled')];
const LINE_TECH_PLACE: FieldToken[] = [F('camera'), F('lens'), F('exposure','exposureEnabled'), F('place','placeEnabled')];
```

Medium・typeScale 1.0・relSize 1.0 のときの実寸（長辺4096px の 4:5 書き出し ＝ k=3.2768）:

| 設定 | 論理単位 | 物理px |
|---|---:|---:|
| Small | 13 lu | 42.6 px |
| Medium | 16 lu | 52.4 px |
| Large | 20 lu | 65.5 px |
| Tight (Medium) | −0.24 lu | −0.79 px |
| Wide (Medium) | 1.44 lu | 4.72 px |
| Widest (Medium) | 2.88 lu | 9.44 px |
| 行送り 1.42 (Medium) | 22.72 lu | 74.4 px |

### 3.3 観測と推定の切り分け（重要）

`docs/reference-frmm.md` から読み取れたのは **比率・写真の寄せ・キャプションの配置と行構成**
だけである。**余白・字送り・行送りの具体的な数値は、参考動画から読み取れないため、
15スタイルすべてで推定値である。**

| ID | 比 | 観測された性質（動画・スクショ由来） | 推定した部分 |
|---|---|---|---|
| OR1 | 元比 | 余白ごく細・キャプション1行にカンマ区切りで全部 | 全寸法 |
| OR2 | 元比 | 3行／1行目 Title,Date ／2行目 カメラ（ボールド）／3行目 レンズ（グレー） | 全寸法 |
| OR3 | 元比 | （観測なし） | 全体。OR群の「余白広め・タイトル主役」枠として設計 |
| SQ1 | 1:1 | 正方形キャンバス中央に写真、直下に1行キャプション | 全寸法 |
| SQ2 | 1:1 | （観測なし） | 全体。SQ の3行版 |
| SQ3 | 1:1 | 上寄せ・下に大きな余白（ポラロイド的） | 帯の高さ 196lu を含む全寸法 |
| SQ4 | 1:1 | （観測なし） | 全体。全面ブリード＋下部オーバーレイ |
| TF1 | 3:4 | 3:4 キャンバス、写真中央やや上、下に余白 | 全寸法 |
| FF1 | 4:5 | （観測なし） | 全体。4:5 の標準枠 |
| FF2 | 4:5 | **キャプションが写真の「上」に配置される** | 全寸法 |
| FF3 | 4:5 | （観測なし） | 全体。4:5 の3行版 |
| NST1 | 9:16 | 9:16 にキャンバスを拡張して写真を配置 | 全寸法 |
| STN1 | 16:9 | （観測なし） | 全体 |
| STN2 | 16:9 | 16:9 にキャンバスを拡張して写真を配置 | **右余白にキャプションを置く構成は推定**（§3.5 で要検算） |
| STN3 | 16:9 | （観測なし） | 全体。全面ブリード＋下部オーバーレイ |

**参考アプリとの見た目の完全一致は保証しない。** 実機で並べて詰める工程を §17 の後半に置く。
`confidence` フィールドがあるので、どれが未確認かはコードから引ける。

### 3.4 `registry.ts`（15スタイルの実データ）

```ts
// core/styles/registry.ts
export const STYLES: Readonly<Record<StyleId, StyleDef>> = {

  /* ── OR: 元写真の比率をそのまま使う ─────────────────────── */
  OR1: {
    id: 'OR1', group: 'OR', label: '元比・細枠・1行', ratioLabel: '元の比率',
    canvas: { kind: 'derived' },
    photo: { fit: 'contain', crop: 'none', inset: ins(10,10,10,10), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(11), sideInsetLu: lu(12), outerInsetLu: lu(13),
      lines: [{ id:'l1', fields: LINE_ALL_IN_ONE, separator:'comma',
                emphasis:'normal', relSize:1.0, leading:1.30, maxWrap:1 }],
    },
    typeScale: 0.95, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Normal', size:'Small' },
    visibleIn: ['kodawaru','otegaru'],
    confidence: 'partly-observed',
    note: '観測: 余白ごく細・1行にカンマ区切りで全部。寸法は推定。',
  },

  OR2: {
    id: 'OR2', group: 'OR', label: '元比・3行', ratioLabel: '元の比率',
    canvas: { kind: 'derived' },
    photo: { fit: 'contain', crop: 'none', inset: ins(26,26,26,26), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(19), sideInsetLu: lu(26), outerInsetLu: lu(30),
      lines: [
        { id:'l1', fields: LINE_TITLE_DATE, separator:'comma', emphasis:'normal', relSize:1.00, leading:1.42 },
        { id:'l2', fields: LINE_CAMERA,     separator:'comma', emphasis:'bold',   relSize:1.00, leading:1.42 },
        { id:'l3', fields: LINE_LENS_TECH,  separator:'comma', emphasis:'muted',  relSize:0.92, leading:1.42 },
      ],
    },
    typeScale: 1.00, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Normal', size:'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'partly-observed',
    note: '観測: 3行／2行目ボールド／3行目グレー。寸法は推定。こだわるモードの既定スタイル。',
  },

  OR3: {
    id: 'OR3', group: 'OR', label: '元比・余白広め・タイトル主役', ratioLabel: '元の比率',
    canvas: { kind: 'derived' },
    photo: { fit: 'contain', crop: 'none', inset: ins(44,44,44,44), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(24), sideInsetLu: lu(44), outerInsetLu: lu(48),
      lines: [
        { id:'l1', fields: [F('title')],    separator:'none',   emphasis:'normal', relSize:1.15, leading:1.50 },
        { id:'l2', fields: LINE_TECH_PLACE, separator:'middot', emphasis:'muted',  relSize:0.88, leading:1.50 },
      ],
    },
    typeScale: 1.05, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Wide', size:'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
  },

  /* ── SQ: 1:1 ───────────────────────────────────────────── */
  SQ1: {
    id: 'SQ1', group: 'SQ', label: '正方形・中央・1行', ratioLabel: '1:1',
    canvas: { kind: 'fixed', aspect: [1, 1] },
    photo: { fit: 'contain', crop: 'none', inset: ins(64,64,56,64), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(24), sideInsetLu: lu(64), outerInsetLu: lu(44),
      lines: [{ id:'l1', fields: LINE_ALL_IN_ONE, separator:'comma', emphasis:'normal', relSize:1.0, leading:1.32 }],
    },
    typeScale: 1.00, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Normal', size:'Medium' },
    visibleIn: ['kodawaru','otegaru'],
    confidence: 'partly-observed',
    note: '観測: 正方形キャンバス中央に写真、直下に1行。寸法は推定。',
  },

  SQ2: {
    id: 'SQ2', group: 'SQ', label: '正方形・3行', ratioLabel: '1:1',
    canvas: { kind: 'fixed', aspect: [1, 1] },
    photo: { fit: 'contain', crop: 'none', inset: ins(56,56,56,56), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(22), sideInsetLu: lu(56), outerInsetLu: lu(40),
      lines: [
        { id:'l1', fields: LINE_TITLE_DATE, separator:'comma', emphasis:'normal', relSize:1.00, leading:1.40 },
        { id:'l2', fields: LINE_CAMERA,     separator:'comma', emphasis:'bold',   relSize:1.00, leading:1.40 },
        { id:'l3', fields: LINE_LENS_TECH,  separator:'comma', emphasis:'muted',  relSize:0.92, leading:1.40 },
      ],
    },
    typeScale: 1.00, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Normal', size:'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
  },

  SQ3: {
    id: 'SQ3', group: 'SQ', label: '正方形・ポラロイド', ratioLabel: '1:1',
    canvas: { kind: 'fixed', aspect: [1, 1] },
    photo: { fit: 'contain', crop: 'none', inset: ins(52,52,196,52), anchor: 'top', bleed: false },
    caption: {
      place: 'bottom-band', gapLu: lu(0), sideInsetLu: lu(52), outerInsetLu: lu(0),
      bandLu: lu(196), bandAlign: 'center',
      lines: [
        { id:'l1', fields: [F('title'), F('artist','artistEnabled')], separator:'emdash',
          emphasis:'normal', relSize:1.10, leading:1.55 },
        { id:'l2', fields: [F('date'), F('camera'), F('lens'), F('place','placeEnabled')],
          separator:'comma', emphasis:'muted', relSize:0.86, leading:1.55 },
      ],
    },
    typeScale: 1.05, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Wide', size:'Medium' },
    visibleIn: ['kodawaru','otegaru'],
    confidence: 'partly-observed',
    note: '観測: 上寄せ・下に大きな余白。帯の高さ196luは推定。お手軽モードの既定スタイル。',
  },

  SQ4: {
    id: 'SQ4', group: 'SQ', label: '正方形・全面・重ね文字', ratioLabel: '1:1',
    canvas: { kind: 'fixed', aspect: [1, 1] },
    photo: { fit: 'cover', crop: 'toCanvas', inset: ins(0,0,0,0), anchor: 'center', bleed: true },
    caption: {
      place: 'overlay-bottom', gapLu: lu(0), sideInsetLu: lu(40), outerInsetLu: lu(40),
      scrim: { heightLu: lu(240), alpha: 0.42 },
      lines: [{ id:'l1', fields: LINE_ALL_IN_ONE, separator:'comma', emphasis:'normal', relSize:1.0, leading:1.32 }],
    },
    typeScale: 1.00, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'left', tracking:'Wide', size:'Small' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
    note: '推定: 全面ブリード＋下部オーバーレイ。文字色は scrim 後の背景輝度で判定（§4.6）。',
  },

  /* ── TF: 3:4 ───────────────────────────────────────────── */
  TF1: {
    id: 'TF1', group: 'TF', label: '3:4・中央やや上', ratioLabel: '3:4',
    canvas: { kind: 'fixed', aspect: [3, 4] },
    photo: { fit: 'contain', crop: 'none', inset: ins(66,66,132,66), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(28), sideInsetLu: lu(66), outerInsetLu: lu(54),
      lines: [
        { id:'l1', fields: LINE_TITLE_DATE, separator:'comma', emphasis:'normal', relSize:1.00, leading:1.42 },
        { id:'l2', fields: LINE_TECH_PLACE, separator:'comma', emphasis:'muted',  relSize:0.90, leading:1.42 },
      ],
    },
    typeScale: 1.00, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Normal', size:'Medium' },
    visibleIn: ['kodawaru','otegaru'],
    confidence: 'partly-observed',
    note: '観測: 写真中央やや上、下に余白。inset.bottom を大きめに取って実現。',
  },

  /* ── FF: 4:5 ───────────────────────────────────────────── */
  FF1: {
    id: 'FF1', group: 'FF', label: '4:5・標準', ratioLabel: '4:5',
    canvas: { kind: 'fixed', aspect: [4, 5] },
    photo: { fit: 'contain', crop: 'none', inset: ins(70,70,104,70), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(26), sideInsetLu: lu(70), outerInsetLu: lu(60),
      lines: [{ id:'l1', fields: LINE_ALL_IN_ONE, separator:'comma', emphasis:'normal', relSize:1.0, leading:1.32 }],
    },
    typeScale: 1.00, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Normal', size:'Medium' },
    visibleIn: ['kodawaru','otegaru'],
    confidence: 'estimated',
  },

  FF2: {
    id: 'FF2', group: 'FF', label: '4:5・文字が上', ratioLabel: '4:5',
    canvas: { kind: 'fixed', aspect: [4, 5] },
    photo: { fit: 'contain', crop: 'none', inset: ins(108,70,70,70), anchor: 'center', bleed: false },
    caption: {
      place: 'above-photo', gapLu: lu(26), sideInsetLu: lu(70), outerInsetLu: lu(62),
      lines: [
        { id:'l1', fields: [F('title'), F('artist','artistEnabled')], separator:'emdash',
          emphasis:'normal', relSize:1.05, leading:1.40 },
        { id:'l2', fields: [F('date'), F('camera'), F('lens'), F('exposure','exposureEnabled')],
          separator:'comma', emphasis:'muted', relSize:0.88, leading:1.40 },
      ],
    },
    typeScale: 1.00, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Wide', size:'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'partly-observed',
    note: '観測: キャプションが写真の「上」。place:above-photo で表現。寸法は推定。',
  },

  FF3: {
    id: 'FF3', group: 'FF', label: '4:5・3行', ratioLabel: '4:5',
    canvas: { kind: 'fixed', aspect: [4, 5] },
    photo: { fit: 'contain', crop: 'none', inset: ins(64,64,170,64), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(30), sideInsetLu: lu(64), outerInsetLu: lu(62),
      lines: [
        { id:'l1', fields: LINE_TITLE_DATE, separator:'comma', emphasis:'normal', relSize:1.05, leading:1.45 },
        { id:'l2', fields: LINE_CAMERA,     separator:'comma', emphasis:'bold',   relSize:0.95, leading:1.45 },
        { id:'l3', fields: LINE_LENS_TECH,  separator:'comma', emphasis:'muted',  relSize:0.88, leading:1.45 },
      ],
    },
    typeScale: 1.05, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Normal', size:'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
  },

  /* ── NST: 9:16 ─────────────────────────────────────────── */
  NST1: {
    id: 'NST1', group: 'NST', label: '9:16・ストーリー', ratioLabel: '9:16',
    canvas: { kind: 'fixed', aspect: [9, 16] },
    photo: { fit: 'contain', crop: 'none', inset: ins(180,56,180,56), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(44), sideInsetLu: lu(56), outerInsetLu: lu(120),
      lines: [
        { id:'l1', fields: LINE_TITLE_DATE, separator:'comma', emphasis:'normal', relSize:1.05, leading:1.48 },
        { id:'l2', fields: LINE_TECH_PLACE, separator:'comma', emphasis:'muted',  relSize:0.90, leading:1.48 },
      ],
    },
    typeScale: 1.05, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Wide', size:'Medium' },
    visibleIn: ['kodawaru','otegaru'],
    confidence: 'partly-observed',
    note: '観測: 9:16 に拡張して配置。上下に大きな余白。寸法は推定。',
  },

  /* ── STN: 16:9 ─────────────────────────────────────────── */
  STN1: {
    id: 'STN1', group: 'STN', label: '16:9・1行', ratioLabel: '16:9',
    canvas: { kind: 'fixed', aspect: [16, 9] },
    photo: { fit: 'contain', crop: 'none', inset: ins(38,38,74,38), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(20), sideInsetLu: lu(38), outerInsetLu: lu(30),
      lines: [{ id:'l1', fields: LINE_ALL_IN_ONE, separator:'comma', emphasis:'normal', relSize:1.0, leading:1.30 }],
    },
    typeScale: 0.88, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'center', tracking:'Normal', size:'Small' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
  },

  STN2: {
    id: 'STN2', group: 'STN', label: '16:9・右に文字', ratioLabel: '16:9',
    canvas: { kind: 'fixed', aspect: [16, 9] },
    photo: { fit: 'contain', crop: 'none', inset: ins(38,360,38,38), anchor: 'center', bleed: false },
    caption: {
      place: 'right-of-photo', gapLu: lu(30), sideInsetLu: lu(38), outerInsetLu: lu(38),
      bandLu: lu(300), bandAlign: 'center',
      lines: [
        { id:'l1', fields: [F('title')], separator:'none', emphasis:'normal', relSize:1.10,
          leading:1.60, alignOverride:'left', maxWrap:2 },
        { id:'l2', fields: LINE_CAMERA,  separator:'comma', emphasis:'bold', relSize:0.92,
          leading:1.60, alignOverride:'left' },
        { id:'l3', fields: [F('lens'), F('exposure','exposureEnabled'), F('date'), F('place','placeEnabled')],
          separator:'comma', emphasis:'muted', relSize:0.84, leading:1.45, alignOverride:'left', maxWrap:3 },
      ],
    },
    typeScale: 0.88, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'left', tracking:'Normal', size:'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'partly-observed',
    note: '★§3.5 の検算対象。実データで成立しなければ below-photo に倒す。',
  },

  STN3: {
    id: 'STN3', group: 'STN', label: '16:9・全面・重ね文字', ratioLabel: '16:9',
    canvas: { kind: 'fixed', aspect: [16, 9] },
    photo: { fit: 'cover', crop: 'toCanvas', inset: ins(0,0,0,0), anchor: 'center', bleed: true },
    caption: {
      place: 'overlay-bottom', gapLu: lu(0), sideInsetLu: lu(34), outerInsetLu: lu(34),
      scrim: { heightLu: lu(170), alpha: 0.40 },
      lines: [{ id:'l1', fields: LINE_ALL_IN_ONE, separator:'middot', emphasis:'normal', relSize:1.0, leading:1.30 }],
    },
    typeScale: 0.88, border: { gapLu: lu(0), widthLu: lu(1.2) },
    defaults: { align:'left', tracking:'Wide', size:'Small' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
  },
};
```

**お手軽モードで見えるのは6つ**（`visibleIn` に `'otegaru'` を含むもの）:
`OR1 / SQ1 / SQ3 / TF1 / FF1 / NST1`。残り9つは「もっと見る」から到達できる（§10）。

### 3.5 STN2 の検算（実装初週の必須タスク）

16:9 のキャンバス高は **562.5lu** しかない。右帯 300lu に
`SIGMA 18-50mm F2.8 DC DN | Contemporary 021`（44字）を `typeScale 0.88` × `relSize 0.84`
× `maxWrap 3` で流して成立するかは未検証である。

> **実装初週に、参考素材そのもの（`Untitled, 2026.09.20, FUJIFILM X-M5,
> SIGMA 18-50mm F2.8 DC DN | Contemporary 021`）を入力して検算する。
> 3行に収まらない、または `fitLines` が `ellipsis` まで落ちるなら、
> STN2 を `below-photo`（STN1 と同じ配置・3行）に倒す。**
> 倒した場合 `right-of-photo` を使うのは縦組み（§6.3）だけになるが、`layout.ts` の枝は残す。

判定はテストで固定する（`tests/unit/styles/stn2-fits.test.ts`）:
`fitLines` の戻りに `ellipsis` が含まれないこと、行数が 3 + maxWrap の合計以内であること。

### 3.6 レイアウト解決

```ts
// core/styles/layout.ts
export interface ResolvedLayout {
  readonly canvas: SizeLu;
  readonly photo: RectLu;
  readonly photoSrcNorm: { x: number; y: number; w: number; h: number };
  readonly captionBox: RectLu;
  readonly captionVAlign: 'start' | 'center' | 'end';
}

export function resolveLayout(
  def: StyleDef,
  photoAspect: number,       // ★ Orientation 適用後の w/h（§16.5 の契約）
  captionHeightLu: Lu,
  verticalJa: boolean,
): ResolvedLayout
```

手順（純粋。分岐は `canvas.kind` と `caption.place` のみ）:

1. `kind==='fixed'` → `canvasH = 1000 * aspect[1] / aspect[0]`。
   `kind==='derived'` → `pw = 1000 - inset.l - inset.r`、`ph = pw / photoAspect`、
   `canvasH = inset.top + ph + gap + captionH + outerInset`。
2. `contentBox = canvas − inset`。
3. `caption.place` に応じて `contentBox` からキャプション帯を差し引き、残りを `photoBox` とする。
   - `below-photo` / `above-photo`: 縦方向に `captionH + gap` を差し引く
   - `bottom-band`: `bandLu` を差し引く。キャプション高が `bandLu` を超えたら帯を広げ、
     `warnings: band-expanded` を積む
   - `right-of-photo`: 横方向に `bandLu` を差し引く
   - `overlay-bottom`: 差し引かない（写真の上に重なる）
4. `fit` に従って写真を `photoBox` に収め、`anchor` で寄せる。
   `crop: 'square' | 'toCanvas'` は `photoSrcNorm` を中央クロップに書き換える。
   **クロップは元画素数ではなく正規化座標で表す**ので、プレビュー縮小版と原寸で同一になる。
5. 不変条件を assert（§14.2）: 写真がキャンバスをはみ出さない／`overlay-bottom` 以外で
   キャプション矩形と写真矩形が重ならない。
6. `verticalJa === true` のときは `place` を `right-of-photo` に読み替える（§6.3）。

### 3.8 実装で仕様から変えた点（2026-09-21・15スタイル実装時）

仕様どおりに書けなかった／書くべきでなかった箇所。理由と実測値を残す。

| 箇所 | 仕様 | 実装 | 理由 |
|---|---|---|---|
| `FieldId` の焦点距離 | `focal` | `focalLength` | 画面側（`state/doc.ts`・`InfoPanel`）が先に `focalLength` で実装済み。名前を揃える意味しかない改名で、画面全体を触ることになる |
| `StyleDef.border` | 全15スタイルが `{gapLu:0, widthLu:1.2}` | 型ごと落とした | 15スタイルのどれも「枠線を描く」とは言っていない。誰も読まない値を型に残すと、次に読む人が「どこかで描かれている」と誤解する。Bordered を入れるときに戻す |
| OR1 の既定整列 | `center` | `left` | 先に公開した版が `left` で、実機で見て良いと判断された。寸法と同じく推定値なので、実機の判断を採る |
| SQ4 の暗幕 | `heightLu:240, alpha:0.42` | `heightLu:320, alpha:0.58` | **計算で落ちた。** キャプションはキャンバス下端から 40lu の位置にあり、仕様の直線勾配ではそこでの濃さが 0.33 にしかならない。真っ白な写真（空・雪）の上でコントラストが **2.0:1** となり読めない。4.5:1 を満たす最小の濃さが 0.58（→ 4.76:1）。立ち上がりを smoothstep にして下半分を平らにし、キャプションが必ず最大の濃さの上に載るようにした |
| STN3 の暗幕 | `heightLu:170, alpha:0.40` | `heightLu:230, alpha:0.58` | 同上 |

#### 追記（2026-09-21・実機フィードバック後）

`border` を型ごと落としたのは**誤りだった**。上の表で「15スタイルのどれも枠線を
描くとは言っていない」と書いたが、枠線はスタイルの属性ではなく
**Color タブの Standard / Bordered という直交軸**である
（`reference-frmm.md` の「## Color タブ」に記録されている）。
スタイル側だけを見て判断したため、軸を1本まるごと落としていた。
`SceneInput.bordered` として戻した（15スタイル × 2 = 30通り）。

同じ見落としが書体にもあった。動画には
`Helvetica / Helvetica Bold / Futura / Futura Bold / DIN / Copperplate /
Copperplate Bold / Didot / Georgia Bold / TimesNewRoman / TimesNewRoman Bold /
Baskerville / Baskerville SemiBold` の**13項目**が並んでいるのに、
同梱していた8ファミリの Regular だけを出していた。Bold は「太字にする設定」ではなく
独立した書体として並べる（和文を足して14項目）。フォントファイルは既に
Regular と Bold の両方を同梱済みだったので、増えたのは目録だけである。

| 追加した軸 | 値 | 備考 |
|---|---|---|
| 余白の広さ | `narrow 0.45 / normal 0.7 / wide 1.0` | スタイルの寸法すべてに掛ける1つの倍率。`wide` が以前の見た目。既定は `normal` |
| 枠線 | `bordered: boolean` | 写真の外周のヘアライン（1.2lu・下限1px）。全面ブリードでは線の外半分がキャンバス外に落ちるので、その分だけ内側へ寄せる |
| 書体 | 14項目（Bold 6 + Regular 7 + 和文） | 地の太さは `SceneInput.weight`。地が既に 700 なら強調しても 700 のまま |

**余白の倍率を右の帯（STN2）に掛けてはいけない。** 下の帯（ポラロイド）は余白そのものだが、
右の帯は**本文が流れる段の幅**である。実測で `narrow` にすると 300→135lu になり、
はしごが降りてレンズ名と撮影地が落ちた。余白の好みで情報が減るのは筋が違うので、
`right-of-photo` だけ倍率を掛けない。

判定は `tests/unit/styles.test.ts` の「重ね文字のコントラスト」で固定した。
Small / Medium / Large の3段すべてで、キャプションの**上端**（暗幕がいちばん薄い点）を測っている。

#### §3.5 の検算の結果: **STN2 は `right-of-photo` のまま成立する**

参考素材（`Untitled` / `FUJIFILM X-M5` / `SIGMA 18-50mm F2.8 DC DN | Contemporary 021` /
`F2.8 1/250s ISO200` / `2026.09.20`）を右帯 300lu に流した結果:

```
[15.5lu normal  74/300] Untitled
[13.0lu bold   101/300] FUJIFILM X-M5
[11.8lu muted  263/300] SIGMA 18-50mm F2.8 DC DN, F2.8 1/250s
[11.8lu muted  185/300] ISO200, 2026.09.20, 東京都渋谷区
```

縦棒以降を落とす段（`strip-after-pipe`）が1回働いて、あとは折り返しで収まった。
`ellipsis` までは降りていない。**`below-photo` に倒す必要はない。**
判定は `tests/unit/styles.test.ts` の「STN2 の右帯に参考素材が収まる」で固定してある。

---

### 3.9 プリセットをやめ、4軸の組み合わせにした（2026-09-21・実機フィードバック後）

15個の名前付きプリセット（OR1 … STN3）を画面に並べる設計を**捨てた**。
実機で「スタイルを選ぶのが難しい」と言われ、理由は明白だった。
「OR2」や「中央・1行」という札を見ても、**選ぶと何が変わるのかが分からない**。
プリセットは作り手の分類であって、選ぶ側の思考の単位ではなかった。

選ぶ側の思考の単位は次の4つで、それぞれ独立に決められる:

| 軸 | 選択肢 | 置き場所 |
|---|---|---|
| 比率 | 元比 / 1:1 / 3:4 / 4:5 / 9:16 / 16:9 | 配置タブ |
| 写真の位置 | 中央 / 上 / 下 / 左 / 右 / 全面 | 配置タブ |
| 文字の位置 | 下 / 上 / 左 / 右 / 重ね | 配置タブ |
| 行数 | 1 / 2 / 3 | 組みタブ |

寸法はこの組み合わせから `core/styles/spec.ts` の `styleFor()` がその場で生成する。
§3.4 の手書きの15定義は削除し、比率ごとの基準値（inset・typeScale）だけを引き継いだ。

**制約は1つだけ**: 「全面」と「重ね」は同じ状態の2つの入口である（写真が全面なら文字は
重ねるしかなく、文字を重ねるなら写真は全面）。`normalize()` で揃える。
UI では触った軸が"勝つ"（全面から中央へ戻せば文字は下へ、重ねから下へ戻せば写真は中央へ）。
元比では上下左右の寄せに意味が無いので押せない選択肢として見せる。

参考アプリの15スタイルは、この空間の15個の点として `FRMM_PRESETS` に残した。
画面には出さない。テストが「参考アプリの組み合わせが全部成立する」ことを確かめるのに使う。
`bottom-band`（ポラロイドの帯）という特別な配置は不要になった。
「1:1・写真上・文字下」を選べば同じ見た目が自然に出る。

空間の大きさは 6 × (5×4 + 1) × 3 = **378通り**。
`tests/unit/styles.test.ts` はこの全部 × 余白3段 × 写真比7種（7,938ケース）で
レイアウトの不変条件（はみ出し・重なり）を総当たりで確かめ、
文字の大きさ・字間の両極でも帯の幅を越えないことを確かめる。
15個のプリセットを検査していたときより、はるかに広い範囲が守られている。

---

### 3.10 実機フィードバック2巡目での見直し（2026-09-21）

§3.9 の4軸を実機で触ってもらい、7点の指摘を受けた。設計として何を変えたかを残す。

| 指摘 | 変更 | 理由 |
|---|---|---|
| 注記が升に重なって切れ、配置を変えても消えない | 配置タブの注記を**廃止**。残る注記（縦組み）は2.5秒で消え、プレビューの足元に出す | 押せない選択肢は押せないだけでよい。理由の文章は読まれる前に邪魔になる |
| 文字が左右のとき写真の左右も選べてしまう | **相互に**押せなくした（写真が左右なら文字の左右も）。`normalize()` でも揃える | 段を差し引いた残りに寄せる先は無い。片方だけ縛ると非対称で覚えにくい |
| 文字の順序が 下・上 | 上・下・左・右・重ね に統一 | 写真の行と同じ並びで読めるように |
| 升の幅が行ごとに違う | **全升 42px 固定**（`--cell`）。行は左揃えで、幅いっぱいに引き伸ばさない | 6択と3択で「左」の大きさが変わると揃って見えない。項目が増えても行が右に伸びるだけ |
| 全面のとき構図を選べない | 「全面」を写真の位置から外し、**余白「なし」**へ。全面では写真の上下左右が**切り取りの寄せ**になる | 同じ5つの言葉が「置き場所」と「寄せ」の両方で通じる。選択肢を増やさずに構図が選べる |
| 全面のとき地色が選べる | 押せなくした（枠線は効くので残す） | 地が見えない設定は無い方が迷わない |
| 文字が多い | ヘッダー・タブ・情報の操作・枠線・揃え・組み方向を印に。タブは**選んでいる1つにだけ名前**を添える | 5つ全部を印だけにすると「配置」と「組み」の区別が付かない。いま開いている場所の名前だけあれば残りは押せば分かる |

軸は5つになった（比率・写真・文字・行数・**余白**）。余白を `StyleSpec` に入れたので、
寸法の生成（`styleFor`）が余白を織り込み、`resolveLayout` は倍率を知らない。
「全面」は `margin: 'none'` であって写真の位置ではない。

制約は `normalize()` に3つ: 余白なし ⇔ 文字重ね、文字が左右の段 ⇒ 写真は中央、以上。
UI では**触った軸が勝つ**（余白を戻せば文字は下へ、文字を戻せば余白は標準へ、
写真を左右に寄せれば文字は下へ）。

空間は 6比率 × 3行 × (余白3 × 16 + 全面5) = **954通り**。
`tests/unit/styles.test.ts` は全部 × 写真比7種でレイアウトの不変条件を総当たりし、
全面の切り取りが寄せどおりに動くこと（横に余れば左/中央/右、縦に余れば上/中央/下）を固定する。

---

### 3.11 選択をボタン列から縦のホイールに変えた（2026-09-21）

実機で「ボタン選択式はデザインとしてスマートでない。参考アプリのように上下でくるくる選べる形に」
と言われた。指摘どおりで、ボタンを横に並べる方式には構造的な弱さがあった。

- 選択肢が増えるほど押す場所が増え、画面がうるさくなる
- 行ごとに升の幅が変わり、揃って見えない（§3.10 で升を固定幅にしたが、行の長さは揃わない）
- 6択の行と2択の行を同じ帯に置くと、余白の量がばらつく

縦のホイール（`ui/Wheel.tsx`）はこの3つを一度に解く。見えるのは「いま」と「その隣」だけで、
列の幅は選択肢の数に依らず、選択肢が増えても列が縦に伸びるだけで画面は変わらない。

| タブ | 列 |
|---|---|
| 配置 | 比率 / 写真 / 文字 / 余白（4列） |
| 組み | 行数 / 揃え（印）/ 字間 / 文字 / 方向（印）（5列） |
| 地色 | 地色（見本の丸＋名前、広い列）/ 枠線（印） |
| 書体 | 14書体を**その書体自身**で描いた1列 |
| 情報 | 縦のチェックリスト（選ぶのではなく切り替えるので、ホイールにしない）＋ 編集・初期値の印 |

仕組みは CSS の scroll-snap。上下に1行ぶんの余白を置いて先頭と末尾も真ん中に止まれるようにし、
`scrollend`（無いブラウザでは停止後 140ms）で止まった行を値にする。
外から値が変わったら（`normalize()` が別の軸を揃えたとき）その行へ滑らせる。
押した瞬間にも値を入れる。スクロールの終わりを待ってからプレビューが変わるのは遅い。

**押せない値は薄く残し、そこで止まったらいちばん近い押せる値へ滑り戻す。**
消してしまうと「なぜ無いのか」が分からず、押せるように見せると裏切る。

タブは印の下に名前を5つとも添える形に戻した（§3.10 で「選んでいるタブにだけ」を試したが、
配置と組みはどちらもレイアウトの印になり、押すまで区別が付かなかった）。

オプション行の高さは 168px（3行 ＋ 見出し）。§3.10 の 214px から 46px 戻り、写真が大きくなった。

---

### 3.12 帯の中の寄せ、指で決める切り取り、黒基調、Fuchidori（2026-09-22）

実機の3巡目。写真を上に寄せたときに「下の帯の真ん中に文字を置けない」、全面のときに
「写真の位置を選ぶのではなく指で動かしたい」という2つの指摘と、名前と色の指定。

**寄せ（`captionAlign`）** — 6つ目の軸。文字を**その帯の中で**上・中・下のどこに置くか。
レイアウトの手順を変えた: 以前は文字の位置を先に端へ決めてから写真の箱を引いていた。
いまは帯ぶんを差し引いて**写真を先に確定し**、写真の端＋隙間からキャンバスの端−余白までを
帯として、その中で寄せる。写真を上に寄せれば下の帯が広がり、そこで上・中・下が効く。
左右の段でも同じ。写真が中央で帯に余りが無ければ効かない（テストで固定）。
重ねでは帯が無いので `normalize()` が中央に畳み、列を止める。
既定は「中」。1:1・写真上・文字下でポラロイドの見た目が最初から出る。

**指で決める切り取り（`Focus`）** — 全面のとき、写真の列を止め、プレビューを直接動かす。
`focusCrop(src, target, focus)` は余る軸だけを focus（0..1）で動かす。
指の移動 dx（CSS px）→ 元画像上では dx / canvasW × w、中心は余り (1 − w) で割り振っているので
Δfocus = −(dx / canvasW) × w / (1 − w)。指を右に動かすと写真が右へ付いてくる。
1回のドラッグが1回の取り消しになる（押した瞬間に控えを取り、動かしている間は取らない）。
写真の位置の列は全面では止め、`normalize()` が中央に畳む。

★実装で1度壊れていた: `usePan` のリスナーを Scene に依存させていたため、
最初の1回の移動で focus が変わり Scene が作り直され、リスナーが張り直されて
「押している」状態が消えていた（120px 動かして 12px ぶんしか効かなかった）。
切り取りの幅は ref で最新を持ち、リスナーは Scene に依存させない。
検証は「余白ありではドラッグしても画素が変わらない／余白なしでは変わる／端で止まる／
戻せる」を canvas の画素で確かめる。

**黒基調** — 地を `#0f0f0f`、文字を明色に。アプリ自身は消え、唯一の色は写真という原則は変えず、
白いフチの写真が黒地でいちばん映える。選択の反転（明色の帯に暗色の字）もそのまま成立する。

**名前** — Fuchidori。ヘッダー・`<title>`・マニフェスト・保存ファイル名（`fuchidori-YYYYMMDD-HHMMSS.jpg`）。
リポジトリ名は変えない。

ヘッダーの印は丸いフチを外し 20px に。押せる範囲 44px は見えない形で残す。
フチを付けると印が「部品」に見えて画面の中で主張する。

空間は 6比率 × 3行 × (余白3 × 16 × 寄せ3 + 全面1) = **2,610通り**。全面は指で決めるので1通りに数える。

---

### 3.13 入力時の拡大、フィルムシミュレーション、右下の刻印（2026-09-22）

実機の4巡目。「情報を入力しようとすると画面が拡大されて、どこを入力しているか分からなくなる」、
「ピクチャーコントロールやフィルムシミュレーションを情報に入れたい」、
「FUJIFILM で撮った写真は、フィルムシミュレーションのロゴを右下に置きたい（オンオフできるように）」。

**入力時の拡大** — iOS Safari は文字が 16px 未満の入力欄にフォーカスすると画面を拡大する。
情報シートの入力欄は 13px（`--t2`）だった。`maximum-scale=1` で拡大そのものを禁じる手もあるが、
それは弱視の利用者のピンチ拡大まで奪う。原因の側を消し、入力欄の文字を 1rem（16px）にした。

**フィルム（`FieldId 'film'`）** — 8つ目の項目。行の型では レンズの直後に置く（落とす順は末尾からなので、
露出・焦点距離より後まで残る）。値の出どころは2つ:
- **FUJIFILM の MakerNote** から自動で読む（`app/fuji.ts`）。exifr は MakerNote を素のバイト列でしか
  返さない（各社独自形式のため）。FUJIFILM の形式は先頭 8 バイトが `FUJIFILM`、続く 4 バイトが IFD への
  オフセット（LE）。タグ 0x1401 FilmMode（カラー）と 0x1003 Saturation（ACROS / モノクロ / セピア）を見る。
  モノクロ系は Saturation が実体で、FilmMode は既定値のまま残ることがあるので Saturation を優先する。
  値の対応は ExifTool の表に従い、知らない値は null（推測で名前を出さない）。
  exifr の lite ビルドが `makerNote: true` で本当にバイト列を返すことは、画素の無い JPEG に piexifjs で
  MakerNote を書き込んだもので確かめる（`tests/unit/exif.test.ts`）。実機の写真は個人情報を含むので同梱しない。
- **手入力**。FUJIFILM 以外（ニコンのピクチャーコントロール、ソニーのクリエイティブルック等）は
  MakerNote の形式が各社で違い、対応表も公開されていないものが多いので、自動では読まない。
  情報シートの「フィルム」欄に入れる。`<datalist>` で FUJIFILM の名前を候補に出す。

**右下の刻印（`SceneInput.badge`）** — 参考アプリは富士フイルムのロゴ画像を置く。
**ロゴの絵は同梱しない。** 商標であり、配布物に含める権利がない。代わりに名前を文字で刻む:
写真の右下、半透明の暗い板（α0.6）の上に明色の太字 15lu。板は写真の中に置くので、地色にも
キャプションの色にも従わない。重ねのときはキャプションの上へ逃がす。
写真が小さすぎて収まらなければ刻まない（はみ出すより無い方がよい）。
オンオフは情報タブの一覧の末尾「右下にフィルム名を刻む」。キャプションの項目「フィルム」とは独立で、
文字列には載せず刻印だけ、またはその逆ができる。
板の縁のアンチエイリアスは文字と同じく免責領域に入れる。刻印あり・重ねありの一致は実ブラウザで確認済み。

---

### 3.7 スタイルを1つ足すとき何が要るか

`registry.ts` にオブジェクトを1つ足すだけ。以下は自動で付いてくる:

- スタイルタブのチップ（`Object.values(STYLES)` を `group` でグルーピング）
- レイアウト計算（`layout.ts` は `StyleDef` しか見ない）
- キャプション組版（`lines` の配列長に依存しない）
- L2 Scene スナップショット・L3 ゴールデン・L4 パリティ（`test.each(Object.keys(STYLES))`）

コードを触るのは、**新しい `CaptionPlace` や `PhotoSlot.crop` を導入したときだけ**。
その場合も `layout.ts` の switch に枝を足すだけで、op の種類は増えない。

---

## 4. キャプションの組版

> 出典: 組み立て・欠損の詰め・はみ出しのはしご・インク選択は案C §4。
> 入力の正規化（sanitize）と書記素カウントは案B §5。
> 日付の壁時計解釈は案B FM-22。ファイル日付の動線は案A §6-2 ＋ 審査 §5-7(2) の折衷。
> emphasis の和文解決マップは審査 §5-5。

### 4.1 段階1: 事実の収集

```ts
// core/caption/fields.ts
export interface ExifFacts {              // exifr の戻りを正規化したもの。全部 optional
  readonly make?: string; readonly model?: string; readonly lensModel?: string;
  readonly focalLength?: number; readonly focalLengthIn35mm?: number;   // exifr のキー名は
                                                                       // FocalLengthIn35mmFormat
  readonly fNumber?: number; readonly exposureTime?: number; readonly iso?: number;
  /** ★Date ではなく壁時計の素データ（§4.4）★ */
  readonly shotAt?: WallClock;
  readonly gps?: { readonly lat: number; readonly lon: number };
  readonly orientationApplied: true;      // §16.5 の契約により常に true
}

export interface WallClock {
  readonly y: number; readonly m: number; readonly d: number;
  readonly hh: number; readonly mm: number; readonly ss: number;
}

/** 値の出所。最後まで持ち回り、UI の表示（EXIF 由来はグレー、手入力は黒）に使う */
export type FieldSrc = 'exif' | 'manual' | 'preset' | 'file-date' | 'geo' | 'default';

export interface InfoOverrides {
  readonly title?: string; readonly artist?: string;
  readonly date?: string;            // 整形済み文字列で上書き
  readonly camera?: string; readonly lens?: string;
  readonly place?: string;
  /** 明示的に「出さない」。undefined（未設定）と区別する */
  readonly hidden?: Partial<Record<FieldId, true>>;
  readonly src?: Partial<Record<FieldId, FieldSrc>>;
}

export type FieldValues = Readonly<Record<FieldId, string | null>>;

export function resolveFields(
  exif: ExifFacts | undefined,
  ov: InfoOverrides,
  opts: FormatOptions,
  place: string | null,
): { values: FieldValues; missing: FieldId[]; src: Record<FieldId, FieldSrc | null> }
```

**カメラ名の合成規則**（`report-exif.md` の実測値に基づく）:

```ts
// "FUJIFILM" + "X-M5"          → "FUJIFILM X-M5"
// "Apple"    + "iPhone 16 Pro" → "iPhone 16 Pro"      （ブランド名の重複を避ける）
// "SONY"     + "ILCE-7M4"      → "SONY ILCE-7M4"
export function joinCamera(make?: string, model?: string): string | null {
  const mk = clean(make), md = clean(model);
  if (!md) return mk ?? null;
  if (!mk) return md;
  if (md.toLowerCase().startsWith(mk.toLowerCase())) return md;
  if (/^(iPhone|iPad|Pixel|GALAXY)/i.test(md)) return md;
  return `${mk} ${md}`;
}

// "iPhone 16 Pro back camera 6.765mm f/1.78" → "iPhone 16 Pro back camera"
export function normalizeLens(lens?: string): string | null {
  const s = clean(lens); if (!s) return null;
  return s.replace(/\s+\d+(\.\d+)?mm\s+f\/[\d.]+$/i, '').trim() || s;
}
```

**露出・焦点距離**（`report-exif.md` の確定ロジックをそのまま）:

```ts
export const fmtShutter  = (sec: number) => sec >= 1 ? `${round1(sec)}s` : `1/${Math.round(1 / sec)}s`;
export const fmtAperture = (f: number)   => `F${trimZero(f)}`;
export const fmtIso      = (iso: number) => `ISO${iso}`;
// 1/0.008333333333333333 = 120.00000000000001 を実測確認済み。Math.round 必須。

export function formatExposure(e: ExifFacts | undefined, o: FormatOptions): string | null {
  if (!o.exposureEnabled || !e) return null;
  const parts = [
    e.fNumber      != null ? fmtAperture(e.fNumber)      : null,
    e.exposureTime != null ? fmtShutter(e.exposureTime)  : null,
    e.iso          != null ? fmtIso(e.iso)               : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : null;        // 欠損はここでも詰める
}

export function formatFocal(e: ExifFacts | undefined, o: FormatOptions): string | null {
  if (!o.focalEnabled || !e) return null;
  const f = e.focalLength, eq = e.focalLengthIn35mm;
  if (f == null && eq == null) return null;
  if (o.focalMode === '35mmEq' && eq != null) return `${round1(eq)}mm`;
  if (f == null) return `${round1(eq!)}mm`;
  return eq != null && Math.round(eq) !== Math.round(f)
    ? `${round1(f)}mm (${round1(eq)}mm eq.)`
    : `${round1(f)}mm`;
}
```

**異常値の検査**（`report-exif.md` にない値が来る前提。UI は §9.5）:

```ts
export function saneExif(e: ExifFacts | undefined): FieldId[] {
  const bad: FieldId[] = [];
  if (e?.exposureTime === 0 || (e?.exposureTime != null && !isFinite(e.exposureTime))) bad.push('exposure');
  if (e?.fNumber === 0) bad.push('exposure');
  if (e?.iso != null && (e.iso < 1 || e.iso > 4_000_000)) bad.push('exposure');
  if (e?.shotAt && (e.shotAt.y < 1990 || e.shotAt.y > nowYear + 1)) bad.push('date');
  return [...new Set(bad)];
}
```

### 4.2 段階2: 行の組み立てと、欠損の詰め方

```ts
// core/caption/compose.ts
export interface ComposedLine {
  readonly spec: CaptionLineSpec;
  readonly text: string;
  readonly breakPoints: readonly number[];   // 折り返し候補点（区切り位置）。書記素インデックス
  readonly segments: readonly { readonly field: FieldId | null;
                               readonly from: number; readonly to: number }[];
}

export function composeLine(
  spec: CaptionLineSpec, values: FieldValues, gates: Gates,
): ComposedLine | null {
  const sep = SEPARATORS[spec.separator];
  const parts: { field: FieldId | null; text: string }[] = [];
  for (const tok of spec.fields) {
    if (tok.t === 'literal') { parts.push({ field: null, text: tok.text }); continue; }
    if (tok.gate && !gates[tok.gate]) continue;      // 設定 OFF は無かったことにする
    const s = values[tok.id];
    if (s == null || s === '') continue;             // ★欠損は詰める。空の区切りを残さない★
    parts.push({ field: tok.id, text: s });
  }
  if (parts.length === 0) return (spec.collapseWhenEmpty ?? true) ? null : EMPTY_LINE;
  // sep で連結しつつ breakPoints と segments を記録して返す
}
```

**詰め方の規則（明文化。§14.2 で 256通り総当たりテストする）**

1. **null / 空文字のフィールドは、区切り文字ごと消える。**
   `"Untitled, , FUJIFILM X-M5"` は構造的に起こらない。
2. **行の中身が全部消えたら、行ごと消える**（`collapseWhenEmpty: true` が既定）。
   後続行は上に詰まり、キャプションブロックの高さも縮む。写真が自動的に大きくなる。
3. **すべての行が消えたらキャプション高 = 0、`gapLu` も 0。** 余計な空白を残さない
   （`warnings: caption-empty`）。写真だけのフレームとして成立させる。
4. 例外: `title` は既定値 `Untitled`（こだわる）を持つので、EXIF 皆無でも最低1行は残る。
   お手軽モードでは Title の既定値が**空**なので、この例外は効かない（§10）。
5. 先頭・末尾に区切り文字が残らないこと。区切り文字は連続しないこと。

### 4.3 入力の正規化（`sanitize`）

```ts
// core/caption/sanitize.ts
export function sanitize(input: string): { text: string; notes: SanitizeNote[] } {
  const notes: SanitizeNote[] = [];
  let s = input;

  // 1) Unicode 正規化は NFC。★NFKC は使わない★
  //    （「㍿」が「株式会社」に、全角英数が半角に変わり、意図した見た目が壊れる）
  s = s.normalize('NFC');

  // 2) 改行 → 半角スペース
  if (/[\r\n  ]/.test(s)) { s = s.replace(/[\r\n  ]+/g, ' '); notes.push('newline'); }

  // 3) タブ・連続スペース → 単一スペース、前後をトリム
  s = s.replace(/[\t　]+/g, ' ').replace(/ {2,}/g, ' ').trim();

  // 4) 制御文字・ゼロ幅・双方向制御の除去
  //    U+200B-200F ゼロ幅/方向マーク、U+202A-202E 埋め込み・上書き、U+2066-2069 分離
  //    ★U+200D(ZWJ) は除去しない（結合絵文字が別の絵文字に分解されるため）★
  const before = s;
  s = s.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F​‌‎‏‪-‮⁠-⁤⁦-⁩﻿]/g, '');
  if (s !== before) notes.push('control');

  // 5) 異体字セレクタ（U+FE00-FE0F, U+E0100-E01EF）の除去。
  //    同梱書体に異体字グリフは無く、付いていても幅計算だけ狂う
  s = s.replace(/[︀-️]/g, '').replace(/[\u{E0100}-\u{E01EF}]/gu, '');

  return { text: s, notes };
}
```

**BiDi 制御文字（U+202A〜U+202E）は `fillText` でも有効で、貼り付けると文字の並びが
反転して焼き込まれる。** XSS ではないが確実に出力を壊すので、除去は必須。

**「静かに直したこと」は必ず伝える。** `notes` が空でなければ入力欄の下に1行、
**トーストではなく消えない静的テキスト**で:

> 改行を空白に置き換えました。

> 表示できない記号を取り除きました。

### 4.4 日付（タイムゾーン変換をしない）

**`exifr` が返す `Date` を使ってはならない。** EXIF の `DateTimeOriginal` はタイムゾーンを
持たないため、`Date` 化すると端末TZで解釈され、**海外で撮った写真の日付が1日ずれる。**

```ts
// platform/decode.ts 内の EXIF 正規化
// exifr の生文字列 "2026:09:20 17:42:11" を壁時計としてパースし、TZ変換を一切しない。
export function parseWallClock(raw: string): WallClock | undefined {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!m) return undefined;
  return { y:+m[1], m:+m[2], d:+m[3], hh:+m[4], mm:+m[5], ss:+m[6] };
}
```

**これは判断であって手抜きではない。** 写真に入れるべきは「撮った土地の時刻」であり、
「見ている人の時刻」ではない。

**日付書式**（S4 のピッカーで選ぶ。自由入力させない）:

| id | 例 | 備考 |
|---|---|---|
| `dots` | `2026.09.20` | こだわるモードの既定 |
| `dots-short` | `2026.9.20` | お手軽モードの既定（0埋めなし） |
| `slash` | `2026/09/20` | |
| `ja` | `2026年9月20日` | 和文書体向け |
| `iso` | `2026-09-20` | |
| `dots-time` | `2026.09.20 17:42` | |

**EXIF に日付が無いとき、自動では絶対に埋めない**（撮影日でないものを撮影日として焼くのは
事実に反する）。ただし帯のボタンから1タップで入れられる。**出所が読める文言にする**:

> ［ファイルの日付を使う（2026.9.20）］

押すと `src.date = 'file-date'` が立ち、S4 の日付行に `ファイルの日付` の小さな注記が付く。
出所は書き出しまで持ち回る。

### 4.5 はみ出しのはしご（自動実行。ダイアログは出さない）

> 審査 §5-7(3): 参考素材のレンズ名（44字）では4択ダイアログが**常時発火する**。
> 最も頻繁な入力にモーダルを出す設計は採らない。**はしごを自動実行**し、
> 何が起きたかは E1 注記（§9.6）で伝える。

```ts
// core/caption/fit.ts
export type FitStep =
  | { readonly kind: 'shrink'; readonly floor: number }
  | { readonly kind: 'degradeFields' }
  | { readonly kind: 'wrap'; readonly maxExtraLines: number }
  | { readonly kind: 'ellipsis' };

export const DEFAULT_FIT_LADDER: readonly FitStep[] = [
  { kind: 'shrink', floor: 0.88 },      // 第1段。知覚できない
  { kind: 'degradeFields' },
  { kind: 'wrap', maxExtraLines: 1 },
  { kind: 'shrink', floor: 0.78 },
  { kind: 'ellipsis' },                 // 最後の手段
];

export type DegradeStep =
  | 'strip-after-pipe'    // "SIGMA 18-50mm F2.8 DC DN | Contemporary 021" → "SIGMA 18-50mm F2.8 DC DN"
  | 'strip-parens'        // "24mm (35mm eq.)" → "24mm"
  | 'strip-trailing-code' // 末尾の製品コード "021" 等
  | 'ellipsis-middle'     // "SIGMA 18-50mm…Contemporary"
  | 'ellipsis-tail'
  | 'drop';               // フィールドごと落とす

export const FIELD_DEGRADE: Readonly<Record<FieldId, readonly DegradeStep[]>> = {
  exposure: ['drop'],
  focal:    ['strip-parens', 'drop'],
  place:    ['ellipsis-tail', 'drop'],
  lens:     ['strip-after-pipe', 'strip-trailing-code', 'strip-parens', 'ellipsis-middle'],
  camera:   ['strip-parens', 'ellipsis-middle'],
  artist:   ['ellipsis-tail'],
  title:    ['ellipsis-tail'],   // 利用者の言葉なので最後まで残す
  date:     [],                  // ★日付は絶対に削らない・縮めない★
};

/** 劣化の適用順（情報量の少ないフィールドから） */
export const DEGRADE_ORDER: readonly FieldId[] =
  ['exposure', 'focal', 'place', 'lens', 'camera', 'artist', 'title'];
```

規則:

- **折り返しは区切り文字の位置でのみ行う**（単語途中・フィールド途中で折らない）。
  `spec.maxWrap` が 1（既定）なら折り返さず次の段階へ進む。
- `ellipsis-middle` は `…` 1文字を使い、両端をできるだけ残す
  （レンズ名は先頭のブランドと末尾の型番の両方に情報がある）。
- どの段階が発動したかは `warnings` に積む。**黙って切らない。**
- `right-of-photo`（STN2・縦組み）は `maxWrap` を 2〜3 にして折り返しを前提にする。

**利用者への見せ方**（案A の E1 注記に案B の「黙って省略しない」を流し込む）。
プレビューの直下に1行:

> レンズ名を短くしました ›

タップで展開:

> **「SIGMA 18-50mm F2.8 DC DN | Contemporary 021」が1行に収まらなかったため、
> 「| Contemporary 021」を省いて「SIGMA 18-50mm F2.8 DC DN」にしました。**
>
> ［2行にする］　［文字を小さくする］　［このままでいい］

選んだ方針は**スタイルごとに記憶する**（既定＝はしご）。S7 の「くわしい設定」で既定を変えられる。

### 4.6 文字色の自動反転

**閾値は 0.5 ではない。** 白インクと黒インクのコントラスト比が入れ替わる交点、すなわち
`(L+0.05)/0.05 = 1.05/(L+0.05)` を解いた値を使う。

```ts
// core/caption/ink.ts
export const relativeLuminance = (c: Rgb): number => {
  const f = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};

/** 白インクと黒インクのコントラストが入れ替わる輝度 */
export const INK_CROSSOVER = Math.sqrt(1.05 * 0.05) - 0.05;   // = 0.1791287847

export const contrastRatio = (a: number, b: number): number => {
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

export interface InkPalette { readonly dark: Rgb; readonly light: Rgb }
export const DEFAULT_INK: InkPalette = { dark: { r:17, g:17, b:17 }, light: { r:244, g:244, b:244 } };

export function pickInk(bg: Rgb, p: InkPalette = DEFAULT_INK): Rgb {
  const L = relativeLuminance(bg);
  return contrastRatio(L, relativeLuminance(p.dark)) >= contrastRatio(L, relativeLuminance(p.light))
    ? p.dark : p.light;                       // 実質 L > INK_CROSSOVER ? dark : light
}

/** muted 行（OR2 の3行目のグレー）。背景方向へ寄せつつ最低コントラストを守る */
export function mutedInk(ink: Rgb, bg: Rgb, t = 0.42, minContrast = 3.0): Rgb {
  let lo = 0, hi = t, best = ink;
  for (let i = 0; i < 12; i++) {              // 二分探索で最大限寄せる
    const m = (lo + hi) / 2;
    const c = mix(ink, bg, m);
    if (contrastRatio(relativeLuminance(c), relativeLuminance(bg)) >= minContrast) { best = c; lo = m; }
    else hi = m;
  }
  return best;
}
```

**背景色パレット（9色。`requirements.md` §4.1 の列挙に対応）と、上式で決まるインク**

| 名前 | hex | 相対輝度 L | インク | お手軽で出すか |
|---|---|---:|---|---|
| White | `#FFFFFF` | 1.000 | dark | ○ |
| Ivory | `#FFFFF0` | 0.991 | dark | ○ |
| Warm White | `#FAF3E8` | 0.898 | dark | — |
| Sakura | `#F7D9DD` | 0.760 | dark | ○ |
| Sunny Yellow | `#FFD447` | 0.688 | dark | — |
| Silver Sand | `#BFC1C2` | 0.521 | dark | — |
| Gunmetal | `#2A3439` | 0.032 | **light** | — |
| Onyx | `#353839` | 0.042 | **light** | — |
| Black | `#000000` | 0.000 | **light** | ○ |

（L は上式での算出値。**hex は推定**——参考アプリの色名から起こした値であり、
スポイトで採った実測値ではない。`tokens.ts` の1箇所で差し替えられる。）

`pickInk` の結果が `contrastRatio < 4.0` になる背景色を足すときは `warnings: low-contrast` を
積み、地色チップの下に T1 で `文字が読みにくい組み合わせです` と出す。

**オーバーレイ配置（SQ4 / STN3）の特例**

1. `scrim`（下方向への黒グラデーション、既定 alpha 0.42）を必ず敷く。
2. インクは **scrim 合成後の最悪ケース輝度**で判定する。写真の当該領域の平均輝度を
   `L_photo`（プレビュー縮小版から 32×32 に落として算出）とし、
   `L_eff = L_photo × (1 − alpha)` で `pickInk` する。
3. `L_photo` は `SceneInput` の一部として core に渡る**ただの数値**なので、core の純粋性は
   保たれる。プレビューと書き出しで同じ値を使うため、インク色が途中で変わらない。

### 4.7 emphasis の解決マップ（和文 Bold を持たないための1箇所）

> 審査 §5-5: 和文は Regular のみ同梱（**同梱実測 442.4KB**）。Bold は入れない。
> **`StyleDef` は一切変えない**（`emphasis:'bold'` のまま）。解決マップ1つで吸収する。

```ts
// core/caption/emphasis.ts
export type Script = 'latin' | 'ja';

export interface ResolvedEmphasis {
  readonly weight: 400 | 700;
  readonly sizeFactor: number;   // relSize にさらに掛ける
  readonly inkMode: 'full' | 'muted';
}

export function resolveEmphasis(e: CaptionLineSpec['emphasis'], script: Script): ResolvedEmphasis {
  switch (e) {
    case 'bold':
      return script === 'latin'
        ? { weight: 700, sizeFactor: 1.00, inkMode: 'full' }
        // 和文は Bold を同梱しないので、サイズ +6% とインク100% で階層を出す
        : { weight: 400, sizeFactor: 1.06, inkMode: 'full' };
    case 'muted':
      return { weight: 400, sizeFactor: 1.00, inkMode: 'muted' };   // mutedInk(t=0.42, minContrast 3.0)
    case 'normal':
      return { weight: 400, sizeFactor: 1.00, inkMode: 'full' };
  }
}
```

根拠:

1. `report-jp-subset.md` 方針4 が「階層を『太さ』でなく『色の濃淡とサイズ』で表現すれば
   Regular だけで済む」と明示している。
2. **欧文では Bold は実質タダ。** Arimo / Jost / Oswald / Cinzel / Playfair Display /
   Libre Baskerville の6書体は可変フォントで 400 と 700 が**同一ファイル**（**実測**
   `report-fonts.md`）。`emphasis:'bold'` は欧文では何のコストもなく完全に効く。
3. 参考アプリは欧文専用なので、観測された OR2 の「2行目ボールド」は**欧文のボールド**であり、
   和文で同じ表現を再現する義務は無い。
4. 和文に Bold を足すと初回の遅延ロードが 463KB → 936KB と2倍を超える。

**戻し方を先に決めておく**（これが「いま入れない」ことの担保）: 実機検証で
「和文 OR2 の2行目が平板で階層が読めない」と判断されたら、`public/fonts/NotoSansJP-bold.woff2`
を1つ足し、上のマップの `ja` の分岐を `{ weight: 700, sizeFactor: 1.00, inkMode: 'full' }` に
変えるだけで戻せる（`verify-assets.mjs` の「和文 Bold が同梱されています」の検査も同時に外す）。

**濃淡は `mutedInk`（最低コントラスト3.0保証）を使う。**「55%の濃度」のような固定比は
Gunmetal / Onyx 背景で可読性を割るので使わない。

### 4.8 整列と字間の相互作用

```ts
function anchorFor(box: RectLu, align: Align, trackingLu: Lu): Lu {
  switch (align) {
    case 'left':   return box.x;
    case 'center': return lu(box.x + box.w / 2 - trackingLu / 2);   // ★補正★
    case 'right':  return lu(box.x + box.w - trackingLu);           // ★補正★
  }
}
```

`ctx.letterSpacing` は**最終文字の後ろにも空きを足す**実装が一般的で、`textAlign:'center'` だと
見た目が半字分左に寄る。補正は core 側で Scene に焼き込む（＝テストできる）。

### 4.9 入力フィールドの上限（書記素で数える）

| フィールド | 上限 | 改行 | 備考 |
|---|---:|---|---|
| Title | 60 書記素 | 不可 | 既定 `Untitled`（こだわる）／空（お手軽） |
| Artist | 40 書記素 | 不可 | |
| カメラ名 | 40 書記素 | 不可 | EXIF 由来は最長でも30字程度 |
| レンズ名 | 60 書記素 | 不可 | 実測例 44字 |
| 撮影地 | 30 書記素 | 不可 | 手入力時 |
| Separator | 3 書記素 | 不可 | |
| Date | 形式固定 | — | ピッカー選択。自由入力させない |

```ts
const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' });
export const graphemes = (s: string) => [...seg.segment(s)].map(x => x.segment);
export const countG    = (s: string) => graphemes(s).length;
export const truncateG = (s: string, n: number) => graphemes(s).slice(0, n).join('');
```

**`text.length` で数えてはならない。** UTF-16 コード単位なので `𠮷` が 2、`が`（か+結合濁点）が 2 に
なり、`slice` で文字が半分に割れる。`Intl.Segmenter` 非対応環境には `Array.from(s)`
（コードポイント単位）へのフォールバックを置く（結合文字は正しく扱えないが、
サロゲートペアの分断だけは防げる）。

貼り付けで上限を超えたときは `input` で即座に切り詰め、入力欄の下に:

> 長すぎるため、はじめの60文字だけを使います。

### 4.10 `buildScene` の全体像

```ts
// core/compose.ts
export interface SceneInput {
  readonly style: StyleDef;
  readonly photo: { readonly id: PhotoId; readonly aspect: number; readonly overlayLuma: number | null };
  readonly fields: FieldValues;
  readonly gates: Gates;
  readonly type: TypeSettings;         // align / tracking / size / font / verticalJa
  readonly bg: Rgb;
  readonly border: 'Standard' | 'Bordered';
  readonly texture: TextureSettings;
  readonly measurer: TextMeasurer;     // ポート注入
}

export function buildScene(input: SceneInput): Scene {
  // 1. 行を組む（欠損を詰める）
  const composed = input.style.caption.lines
    .map(spec => composeLine(spec, input.fields, input.gates))
    .filter((x): x is ComposedLine => x !== null);

  // 2. 素の高さ → 仮レイアウト → 収める → 高さが変わったら1回だけ解き直す
  const captionH = measureBlockHeight(composed, input.style, input.type);
  const layout   = resolveLayout(input.style, input.photo.aspect, captionH, input.type.verticalJa);
  const fitted   = fitLines(composed, layout.captionBox, input.style, input.type, input.measurer);
  const layout2  = fitted.heightChanged
    ? resolveLayout(input.style, input.photo.aspect, fitted.heightLu, input.type.verticalJa)
    : layout;

  // 3. インクを決める
  const bgForInk = input.style.caption.place === 'overlay-bottom'
    ? effectiveOverlayLuma(input.photo.overlayLuma, input.style.caption.scrim!)
    : input.bg;
  const ink = pickInk(bgForInk);

  // 4. op を積む（§5.6 の順）
  const b = new SceneBuilder(layout2.canvas, rgba(input.bg));
  emitFilmstripBase(b, input, layout2);
  emitPaperClip(b, input, layout2);       // clipPush
  emitPhoto(b, input, layout2);
  emitVignette(b, input, layout2);
  emitClipPop(b);
  emitPaperDepth(b, input, layout2);
  emitBorder(b, input, layout2);
  emitScrim(b, input, layout2);
  emitCaption(b, fitted, layout2, input, ink);   // TextOp / VerticalTextOp
  emitFrameNumber(b, input, layout2);
  emitGrain(b, input, layout2);                  // ★最後★
  return b.build();
}
```

**レイアウトは最大2回しか解かない。**「高さを知るには組版が要る／組版の幅を知るには
レイアウトが要る」という循環を、「素の高さ → 仮レイアウト → 収める → 高さが変わったら
1回だけ再解決」で断ち切る。`fitLines` は高さを増やす方向にしか動かないため2回目で必ず収束する
（§14.2 でテストする）。

---

## 5. フィルム質感（D2）

> 出典: グレインの方式は案B ＋ `report-grain.md` の実測（案C の論理セル索きは**棄却**）。
> それ以外の質感のプリミティブ分解と op 発行順は案C §5。
> UI の離散チップ化は案A §5（審査 §5-7(4)）。

### 5.1 MVP で出す質感は4つだけ

| チップ | 内容 | こだわる | お手軽 |
|---|---|---|---|
| `なし` | 何も足さない | ○ | ○ |
| `粒` | グレイン。強度 弱/中/強 を別チップで出す | ○（なし/弱/中/強） | ○（なし/粒＝強度2 のみ） |
| `印画紙` | 外周の不均一なフチ ＋ 内向きグラデーションの厚み ＋ **ビネットを固定量で畳み込む** | ○ | — |
| `コマ枠` | 35mm ネガのパーフォレーション ＋ コマ枠のヘアライン | ○ | — |

**切り捨てたもの**（op は残すので、設定を開くだけで後から復活できる）:
`filmstrip.variant:'120'` / `showFrameNo` の利用者設定 / `paperEdge.style:'torn'` /
独立したビネット制御。理由は L4 パリティテストの組合せを増やす割に、サムネイルサイズでは
区別されないため。

**強度スライダは置かない。** 親指で微調整しづらく、連続再描画で重い。
かつタイル方式では強度ごとに別タイルをキャッシュするので、**離散値のほうが実装も安い。**

```ts
// core/texture/types.ts
export interface TextureSettings {
  readonly kind: 'none' | 'grain' | 'paper' | 'filmstrip';
  readonly grainStrength: 0 | 1 | 2 | 3;     // kind==='grain' のときのみ有効
  readonly chroma: 'mono';                    // MVP は mono 固定（rgb は型に残す）
  /** 粒・フチのゆらぎを決めるシード。写真ごとに固定し、再描画でチラつかせない */
  readonly seed: number;
}

// core/texture/grain.ts
const STRENGTH_TABLE = [
  /* 0 なし */ null,
  /* 1 弱 */ { cellLu: lu(1.10), intensity: 0.055, blend: 'overlay'    as const },
  /* 2 中 */ { cellLu: lu(1.45), intensity: 0.095, blend: 'overlay'    as const },
  /* 3 強 */ { cellLu: lu(1.90), intensity: 0.150, blend: 'soft-light' as const },
];

export function grainOp(rect: RectLu, s: TextureSettings): GrainOp | null {
  if (s.kind !== 'grain') return null;
  const t = STRENGTH_TABLE[s.grainStrength];
  if (!t) return null;
  return {
    op: 'grain', rect,
    cellLu: t.cellLu, intensity: t.intensity, blend: t.blend,
    seed: s.seed, chroma: s.chroma, space: 'device',
    resolution: 'regenerate-at-k',
  };
}
```

（`cellLu` / `intensity` の値は**推定**。粒の見え方は実機で詰める。
タイル方式自体の一致率は §5.2 の通り実測済み。）

### 5.2 グレイン ─ タイルを書き出し倍率で1度だけ作り、プレビューでは縮小して敷く

**`report-grain.md` の実測で決着済み。**

| 方式 | 一致率（プレビューの粒 vs 書き出しを縮小した粒） |
|---|---:|
| 素朴（出力ピクセル位置で索く） | 0.114 |
| 案C: 論理セル 0.5lu / 1.0lu / 1.5lu | 0.287 / 0.468 / 0.594 ← **棄却** |
| 案C: 論理セル 4.0lu | 0.954（ただし書き出し時 24 デバイスピクセル角＝モザイク） |
| **案B: タイル 256 / 512 / 1024 px** | **0.977 / 0.982 / 0.986** ← **採用** |

> 一致しない原因は「乱数の索き方」ではなく「**書き出し側だけが縮小のならしを通っていたこと**」
> だった。プレビュー側にも同じならしを通せば揃う。

**実装（`render/resources/grainTiles.ts`）**

```ts
const TILE_TARGET_PX = 512;   // 実測: 512角で十分（1024にしても0.004しか改善しない）

/** ★タイルは「書き出しの倍率」で1度だけ作る。プレビューでも kExport で作る★ */
export function buildTile(op: GrainOp, kExport: number): OffscreenCanvas {
  const cellPx = Math.max(1, Math.round(op.cellLu * kExport));
  // セル境界とタイル境界を一致させ、繰り返しの継ぎ目を作らない
  const cells  = Math.max(1, Math.round(TILE_TARGET_PX / cellPx));
  const size   = cells * cellPx;                       // ≒512、常に cellPx の整数倍
  const r = createVerifiedCanvas(size, size);          // ★§11.2 のガードを通す★
  if (!r.ok) return FLAT_TILE;                         // 粒なしで続行（§11.7 で事後告知）
  const img = r.ctx.createImageData(size, size);
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      // hash2 はタイル内のセル座標で索く。同じ seed なら毎回同じ図柄＝再描画でチラつかない
      const v = 128 + (hash2(op.seed, cx, cy) - 0.5) * 255 * op.intensity;
      fillCell(img, cx * cellPx, cy * cellPx, cellPx, v, op.chroma);
    }
  }
  r.ctx.putImageData(img, 0, 0);
  return r.canvas as OffscreenCanvas;
}

export function execGrain(op: GrainOp, ctx: Ctx, t: RenderTarget, r: RenderResources): void {
  const tile = r.grainTileCanvas(op, t.kExport);        // ★キーは kExport（t.k ではない）★
  const pattern = ctx.createPattern(tile, 'repeat')!;
  const s = t.k / t.kExport;                            // プレビューなら < 1、書き出しなら 1
  pattern.setTransform(new DOMMatrix().scale(s, s));    // ★同じタイルを縮小して敷く★
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);                   // デバイス空間で敷く
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';                   // ★両経路に同じならしを通す★
  ctx.globalCompositeOperation = op.blend;
  ctx.fillStyle = pattern;
  ctx.fillRect(op.rect.x * t.k, op.rect.y * t.k, op.rect.w * t.k, op.rect.h * t.k);
  ctx.restore();
}
```

**要点（実装者が間違えやすい順）**

1. **タイルは `t.k` ではなく `t.kExport` で作る。** プレビューでも書き出し倍率のタイルを作り、
   `setTransform(k/kExport)` で縮小する。ここを `t.k` にすると実測 0.114 の素朴実装に戻る。
2. `imageSmoothingQuality = 'high'` を**プレビューと書き出しの両方**で立てる。
3. **プレビューの粒の絶対値は下がる**（実測 18.6 → 3.0）。これは劣化ではなく、
   **縮小後の見え方を正しく再現している**ということ。
4. キャッシュのキーは `(seed, cellPx, intensity, chroma, size)`。書き出し解像度を変えると
   `kExport` が変わってキーが変わり、プレビューも自動的に作り直される。
5. タイル1枚は最大 512×512 ≒ 1MB（RGBA）。`Map` に最大4枚（強度4段）まで保持し、
   それ以上は LRU で捨てる。
6. 性能: パターン方式は 45MP に敷いて **1.7ms**（**実測** `report-canvas.md`）。
   ImageData 直接操作の 809ms に対して 476倍速い。

### 5.3 印画紙風のフチ（純粋なパス生成・スケール不変）

```ts
// core/texture/paper.ts
export function paperEdgeOps(photo: RectLu, s: TextureSettings, bg: Rgba): DrawOp[] {
  if (s.kind !== 'paper') return [];
  const ampLu  = lu(2.4);                                   // ゆらぎ振幅（推定）
  const waveLu = lu(9);                                     // 周期（推定）
  const pts = deckleOutline(photo, ampLu, waveLu, s.seed);  // 決定論的な閉多角形（頂点 ~240）
  return [{ op: 'clipPush', shape: { kind: 'path', points: pts }, resolution: 'invariant' }];
  // …この clip の中に写真 op が入り、clipPop のあとに「厚み」のグラデーションを重ねる
}

/** 矩形の周に低周波ノイズを載せた点列を返す。純粋関数・単体テスト可能 */
export function deckleOutline(r: RectLu, ampLu: Lu, waveLu: Lu, seed: number): PointLu[]
```

- `amp` / `wave` を lu で持つので、`setTransform(k)` だけで完全一致する。**差分ゼロ。**
- フチの厚み感は、写真の内側に内向き `linearGradient` を4辺（alpha 0.06〜0.10）。
- **ビネットは「印画紙」に固定量で畳み込む**（独立制御を持たない）:
  `radialGradient` 1個、中心＝写真中心、`innerR = 0.62 × min(w,h)`、
  `outerR = 0.80 × hypot(w,h)/2`、stops `[{at:0,alpha:0},{at:1,alpha:0.22}]`、
  `blendPush('multiply')` で挟む。完全にスケール不変。

### 5.4 ネガのコマ枠（プリミティブへの分解）

```ts
// core/texture/filmstrip.ts
export function filmstripOps(canvas: SizeLu, photo: RectLu, s: TextureSettings, base: Rgba): DrawOp[] {
  if (s.kind !== 'filmstrip') return [];
  const ops: DrawOp[] = [];
  const railH = lu(canvas.h * 0.085);                         // 上下のパーフォレーション帯（推定）
  const holeW = lu(railH * 0.62), holeH = lu(railH * 0.44), pitch = lu(railH * 1.10);
  ops.push({ op:'fillRect', rect:{x:lu(0),y:lu(0),w:canvas.w,h:canvas.h}, color: base, resolution:'invariant' });
  for (let x = pitch / 2; x < canvas.w; x += pitch) {
    ops.push(roundedHole(lu(x), lu(railH * 0.28), holeW, holeH));
    ops.push(roundedHole(lu(x), lu(canvas.h - railH * 0.28 - holeH), holeW, holeH));
  }
  ops.push(frameNumberText(photo, s.seed));                   // コマ番号 '23A'（等幅書体・固定で出す）
  ops.push({ op:'strokeRect', rect: photo, color: hairline,
             width: { mode:'hairline', value: lu(1.0), minPx: px(1) },
             snap: 'device-pixel-when-preview', resolution: 'regenerate-at-k' });
  return ops;
}
```

新しい op は要らない。角丸矩形の `fillPath` の反復と `strokeRect` だけで表現できる。

### 5.5 質感を足しても書き出しは遅くならない

| 要素 | 6000×7500 での見積 | 根拠 |
|---|---:|---|
| グレイン（タイル） | 約 2ms | **実測** 1.7ms（`report-canvas.md`） |
| 印画紙フチ（clip + path 240頂点） | 数ms | 単純な多角形 clip |
| コマ枠（角丸 ~60個 + 文字） | 数ms | fill の反復 |
| ビネット | 1ms 未満 | 単一グラデーション |
| 写真 drawImage | 約 325ms | **実測**（`report-geo-batch.md`） |
| JPEG q0.92 encode | 約 250ms | **実測**（`report-canvas.md`） |

**支配項は写真の drawImage とエンコードのまま。** 質感の追加で利用者が待たされることはない。

### 5.6 op の発行順（`buildScene` の組み立て順）

```
1.  背景 fillRect                                    （常に）
2.  コマ枠のベース・パーフォレーション               （kind==='filmstrip'）
3.  clipPush（印画紙のパス or 角丸 or 素の矩形）
4.  photo
5.  ビネット radialGradient（multiply）              （kind==='paper'）
6.  clipPop
7.  写真の内向きグラデーション（印画紙の厚み）       （kind==='paper'）
8.  Bordered のヘアライン strokeRect
9.  scrim                                            （overlay-bottom のみ）
10. キャプションの TextOp / VerticalTextOp
11. コマ番号 TextOp                                  （kind==='filmstrip'）
12. ★grain（最後。文字にも粒を載せる）
```

粒を最後に置くのは意図的。文字の上にも粒が乗ることで、テキストの「後から貼った」感が消える。
文字領域は `exactnessExempt` なので L4 の厳密判定には影響しない。

---

## 6. 縦書き（D1）

> 出典: SVG `writing-mode: vertical-rl` 方式は `report-fonts.md` §5（`foreignObject` は
> tainted canvas になるため**使用禁止**）。フォント埋め込みと検証は `report-svg-font.md` の実測
> （案B FM-07。3案でB だけが気づいた罠）。配置と動線は案A §5 D1。

### 6.1 実測された罠（これを知らずに実装すると必ず壊れる）

`report-svg-font.md` の実測:

| 描画 | 黒画素数 | A vs C の相違画素数 |
|---|---:|---:|
| A: 親文書に登録した FontFace を SVG から参照 | 1,388 | **0**（＝フォールバックと完全一致） |
| B: SVG 内に `data:` URI で埋め込み | 1,491 | — |
| C: 素の serif（フォールバック基準） | 1,388 | — |

> **`<img>` 化した SVG は、親文書に登録した FontFace を一切見ていない。**
> しかも同じページで Canvas の `fillText` は正しく効いている（実測幅 308.00 vs serif 315.22）。
> つまり **横組みは正しい書体、縦組みだけフォールバック書体**という、
> 1枚の画像の中で書体が食い違う壊れ方をする。例外も警告も一切出ない。

`report-fonts.md` の「待たずに描くとフォールバックになる」罠とは**別経路の、同じ種類の失敗**で、
**待っていても起きる。**

### 6.2 対処（3つセットで必須）

**(1) SVG 内にフォントを `data:` URI で埋め込む。**

```ts
// render/resources/verticalText.ts
function buildVerticalSVG(op: VerticalTextOp, k: number, fontB64: string): string {
  const w = Math.round(op.box.w * k), h = Math.round(op.box.h * k);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><style>
    @font-face{font-family:"${op.font.family}";font-weight:${op.font.weight};
               src:url(data:font/woff2;base64,${fontB64}) format("woff2");}
  </style></defs>
  <text x="${w - op.sizeLu * k}" y="0" writing-mode="vertical-rl"
        font-family="${op.font.family}" font-weight="${op.font.weight}"
        font-size="${op.sizeLu * k}" letter-spacing="${op.letterSpacingLu * k}"
        fill="${css(op.color)}" xml:space="preserve">${escapeXML(op.text)}</text>
</svg>`;
}
```

**性能（実測 `report-svg-font.md`）**

| 埋め込む書体 | SVG 文字列長 | 1回あたり |
|---|---:|---:|
| なし（serif） | 264 | 1.16 ms |
| かな・記号のみ 58KB | 78,568 | 3.88 ms |
| **第一水準込み 463KB** | **632,360** | **12.34 ms** |

12.34ms は1フレーム（16.7ms）に収まる。**実用に耐える。**
（この実測は 463KB の和文で測った値。**同梱するのは 442.4KB** なので、わずかに速くなる方向。）

**(2) base64 文字列は1度だけ作ってキャッシュする。** 632KB の文字列を毎回作らない。

```ts
let jpFontB64: string | null = null;
function fontBase64(family: string): string {
  if (family === 'NotoSansJP' && jpFontB64) return jpFontB64;
  const b64 = base64(fontBuffer(family));            // 和文は 463KB → base64 約 617KB
  if (family === 'NotoSansJP') jpFontB64 = b64;
  return b64;
}
```

**(3) ラスタライズ結果もキャッシュする。**
キーは `(text, family, weight, sizeLu, letterSpacingLu, box.w, box.h, k, color)`。
縦書きキャプションは**テキストか書体設定が変わったときだけ**再生成すればよく、
通常のプレビュー再描画では実質ゼロになる。LRU 8件。

**読み込みの待ち方**（`onload` だけでは不十分な環境がある）:

```ts
const img = new Image();
const done = new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new SvgRenderError()); });
img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
await done;
await img.decode();                 // ★decode() も待つ★
ctx.drawImage(img, x, y, w, h);
try { ctx.getImageData(0, 0, 1, 1); } catch { throw new TaintedCanvasError(); }  // 汚染確認
```

### 6.3 埋め込み忘れの検知（Preflight の `vertical-font` 検査）

`report-svg-font.md` の実装規則2 をそのまま採る。

```ts
/** font-family を指定した版と、外した版を描いて画素を比べる。一致したら埋め込みが効いていない */
export async function verifyVerticalFont(op: VerticalTextOp, k: number): Promise<boolean> {
  const probe = { ...op, text: 'あA亜', box: { ...op.box, w: lu(120), h: lu(120) } };
  const a = await svgToBitmap(buildVerticalSVG(probe, k, fontBase64(op.font.family)));
  const b = await svgToBitmap(buildVerticalSVG({ ...probe, font: { ...op.font, family: '__none__' } }, k, ''));
  const diff = pixelDiffRatio(a, b);
  a.close(); b.close();
  return diff > 0.01;               // 1%以上違えば埋め込みが効いている
}
```

- 小さなプローブ SVG（120lu 角）なので数ms。
- **(書体, セッション) ごとに1回だけ実行してキャッシュする**（審査 §5-2 の拘束力ある規定）。
- 検証に通らなければ Preflight が `font-identity` として **block** する（§11.5）。
  この検査が機能することは上表の A vs C（相違0画素）で実証済み。

### 6.4 縦書きの組版と配置

- 縦書きが有効なとき、`TextOp` ではなく `VerticalTextOp` を発行する。
- キャプションブロックは**写真の右側**に回る。`buildScene` が `caption.place` を
  `right-of-photo` に読み替え、`bandLu = 行数 × (sizeLu × leading)` で算出する。
  **スタイルデータ（`registry.ts`）は変えない。** 写像は `buildScene` の1箇所だけ。
- 行の文字数上限は `box.h / sizeLu` の近似で決まる。あふれたら §4.5 のはしごを同じく適用する
  （`wrap` は「次の行（左）へ送る」の意味になる）。
- **整列のラベルが変わる**: `[左][中][右]` → `[上][中][下]`（§9.4）。
- 約物（句読点・括弧・ダッシュ）の回転と位置補正は**ブラウザの組版エンジンに任せる**。
  1文字ずつ `fillText` する方式は、約物の種類ごとの自前補正が要り工数がかさむ（`report-fonts.md` §5）。

### 6.5 縦書きが使えないときの動線

- **欧文書体のまま縦組みを選ぼうとしたら**、セグメントは `--ink-3`（無効）で、
  タップすると下に T1 で:

  > 縦組みには和文の書体を選んでください

  モーダルは出さない。

- **`verifyVerticalFont` が落ちたとき**（Preflight の block）:

  > **縦書きの書体を正しく使えませんでした**
  >
  > 縦書きのキャプションを、選んだ書体で組めませんでした。このまま書き出すと、
  > **縦書きの部分だけ別の書体**になってしまいます。
  >
  > ［横書きに切り替える］　［別の書体で試す］　［もう一度試す］

- **SVG の画像化自体が失敗したとき**:

  > **縦書きのキャプションを作れませんでした**
  >
  > お使いのブラウザで、縦書きの文字を画像にする処理が失敗しました。
  >
  > ［横書きに切り替える］　［この端末の対応状況を見る］　［もう一度試す］

**横書きへの切替は必ず成功する**（通常の `fillText` 経路に落ちる）。
縦書きは差別化機能だが、**それが使えなくてもアプリ全体は使える**という切り分けを保つ。

### 6.6 縦書きは L4 の厳密判定から免責される

`VerticalTextOp` の `box` は `meta.exactnessExempt` に登録される。
SVG ラスタライズは k ごとに焼き直すため、縮小後の画素一致は原理的に保証できない。
**免責領域として切り分け、それ以外は厳密一致を要求する**（§14.4）。

---

## 7. 撮影地（D4）

> 出典: オフライン同梱方式と実測値は `report-geo-batch.md`。自信度の分類と粒度の切り上げは案B
> FM-10/11。配置（情報タブの1フィールド）と文言のトーンは案A §5 D4。

### 7.1 方針

**GPS 座標は一切外部に出さない。** 逆ジオコーディングは同梱データの最近傍探索だけで行う
（`requirements.md` §7 の確定方針）。オンライン API は使わない。

| 軸 | 値 | 出所 |
|---|---|---|
| 日本の全市区町村 centroid | **1,894件・91.3KB**（転送は gzip 約33KB） | **同梱実測** `public/geo/jp-municipalities.json` |
| 世界の主要都市（人口≥15,000） | **24,323件・986.4KB**（転送は gzip 約0.47MB） | **同梱実測** `public/geo/world-cities.json` |
| 最近傍探索（Haversine・ブルートフォース） | **0.0898ms/回**（1,000回平均） | **実測** `report-geo-batch.md` |
| 精度 | 検証座標 (34.3853, 132.4553) → 「広島県 広島市中区」距離 0.38km | **実測** 同上 |
| 自信度の判定（n=5 の検証） | **誤答2件を両方とも低自信度として検出し、正答3件はすべて高自信度** | **同梱実測** `docs/assets.md` |

### 7.2 データの作り方と配信

- `scripts/build-geo.mjs`（`npm run assets:geo`）が Geolonia 住所データ（CC BY 4.0・277,543件・51.8MB）
  から市区町村の代表点を算出して `public/geo/jp-municipalities.json` を生成し、
  `all-the-cities`（GeoNames 由来・CC BY 4.0）から `public/geo/world-cities.json` を生成する。
  **生成物はコミット済みで、通常のビルドでは走らない**（§15.4）。
- 形式は行の配列。**出典表示の義務があるので JSON 自身が `attribution` を持つ**:

```jsonc
{ "source":"Geolonia 住所データ", "license":"CC BY 4.0",
  "url":"https://github.com/geolonia/japanese-addresses",
  "attribution":"「Geolonia 住所データ」（Geolonia）を加工して作成",
  "builtAt":"2026-09-21", "fields":["pref","city","lat","lng"],
  "rows":[["三重県","いなべ市",35.1435,136.5238], ...] }
```

  アプリは `attribution` を S8 に**そのまま表示する**（文言をこちらで書き換えない）。
- 世界データ（986.4KB）は**自ドメインに置くが初回ロードには含めない**。
  日本の矩形（北緯20〜46 / 東経122〜154）の外の座標を検出し、利用者が［取り寄せる］を
  押したときだけ取得する（§12.1 の C5）。
- **元データには座標が空の行がある。** `Number('')` は 0 になるため、弾かずに平均すると
  代表点が海の彼方へ出る（実際に大分市が北緯30.4度・東経120.6度＝中国大陸の沖に出た）。
  生成スクリプトは行単位で空欄と範囲外を捨て、**出来上がりに対しても範囲を検査する**。
  同じ検査を `verify-assets.mjs` がビルドのたびに回す。

### 7.3 自信度の分類と、粒度の切り上げ

**「広島市中区」と画像に焼き込むのは断定である。** centroid 最近傍はポリゴン境界を見ないため、
境界付近で隣接自治体に誤帰属しうる（`report-geo-batch.md` が実測で確認）。

```ts
// core/geo/confidence.ts
export type GeoConfidence = 'high' | 'medium' | 'low' | 'out-of-range';

export interface GeoHit {
  readonly name: string;          // "広島県 広島市中区"
  readonly pref: string;          // "広島県"
  readonly city: string;          // "広島市"
  readonly ward: string | null;   // "中区"
  readonly distKm: number;
  readonly second: { readonly name: string; readonly distKm: number } | null;
  readonly confidence: GeoConfidence;
}

/**
 * ★判定は「差」ではなく「比」で行う（同梱実測 docs/assets.md の n=5 検証に基づく）。
 * ratio = 2位までの距離 ÷ 1位までの距離。1 に近いほど「どちらとも言えない」。
 */
export function classify(d1: number, d2: number): GeoConfidence {
  if (d1 > 50) return 'out-of-range';          // データに無い場所（海上・離島・国外）
  const ratio = d1 > 0 ? d2 / d1 : Infinity;
  if (ratio < 1.3) return 'low';               // ★境界付近。市区町村を名乗らない★
  if (ratio >= 2.0 && d1 < 5) return 'high';
  return 'medium';
}
export const GEO_RATIO_LOW = 1.3;              // 実装後に事例を増やして見直す（n=5 の小標本）

/** 粒度の切り上げ。誤りを避けつつ情報を残す唯一の正しい方法 */
export type GeoGranularity = 'ward' | 'city' | 'pref' | 'none';
export function render(hit: GeoHit, g: GeoGranularity): string | null {
  switch (g) {
    case 'ward': return hit.ward ? `${hit.city}${hit.ward}` : hit.city;
    case 'city': return hit.city;
    case 'pref': return hit.pref;
    case 'none': return null;
  }
}
```

**自信度ごとの既定の振る舞い**

| 自信度 | 振る舞い | 既定の粒度 |
|---|---|---|
| `high` | そのまま採用して提案 | `ward` |
| `medium` | 採用するが、S4 の撮影地行に候補リスト（2位以下）を出せるようにする | `ward` |
| `low` | **市区町村を名乗らない。既定で県に切り上げる**（誤りにならない）。そのうえで S4 で2択を聞ける | `pref` |
| `out-of-range` | **採用しない。** 空欄にして手入力を促す | `none` |

> **不確実性への誠実な対処は「曖昧に書く」ことではなく「粒度を上げる」こと。**
> 「広島市中区」に確信が持てないなら「広島市」「広島県」と上げれば**誤りではなくなる。**

**閾値 1.3 の根拠（同梱実測 `docs/assets.md`・n=5）**

| 地点 | 引けた地名 | 2位/1位 | 判定 | 正誤 |
|---|---|---:|---|---|
| 宮島（厳島神社） | 広島県 廿日市市 | 2.56 | 高 | ○ |
| 大分市役所 | 大分県 大分市 | 3.57 | 高 | ○ |
| 札幌時計台 | 北海道 札幌市中央区 | 2.43 | 高 | ○ |
| 東京駅 | 東京都 中央区 | 1.24 | **低→県に上げる** | ×（正解は千代田区） |
| 那覇空港 | 沖縄県 豊見城市 | 1.24 | **低→県に上げる** | ×（正解は那覇市） |

**誤答2件を両方とも低自信度として検出し、正答3件はすべて高自信度だった。**
ただし n=5 の小標本である。事例を増やして閾値を見直すときは、
上の5件を回帰テスト（`tests/unit/geo/confidence.test.ts`）として固定したまま行う。

### 7.4 画面に出す文面（そのまま）

**S4 の撮影地行（high / medium）**

```
 │ 撮影地        広島市中区     ✕│
 │   ⓘ 写真の位置情報から、この端末の中で調べました。
 │     座標はどこにも送っていません。
 │     ［市まで］［県まで］［入れない］
```

**low のとき（境界付近）** — S4 の該当行の下に E2 の帯:

> **撮影地が2つの候補のどちらか分かりません**
>
> 写真の位置情報は、**広島市中区**と**広島市西区**のちょうど境目あたりを指しています。
> 同梱の地名データは市区町村の代表点しか持っていないため、どちらか決められません。
>
> ［広島市中区］　［広島市西区］　［「広島市」にまとめる］　［入れない］

**out-of-range のとき**

> **近くの地名が見つかりませんでした**
>
> 写真の位置情報は、同梱の地名データにある一番近い場所から **約 320km** 離れています
> （海上や、データに含まれない場所で撮影された可能性があります）。
>
> この機能は、**地名のデータをアプリに同梱して端末の中だけで調べています**。
> 位置情報を外部に送ることは一切ありません。そのぶん、載っていない場所もあります。
>
> ［自分で地名を入力する］　［撮影地を入れない］

**日本国外の座標を検出し、世界データが未取得のとき**

> **日本の外で撮影された写真のようです**
>
> 世界の主な都市の地名データ（約 0.5MB）を、**このアプリの配信元から**追加で取り寄せると、
> 海外の撮影地も表示できるようになります。一度取り寄せれば、次からはオフラインでも使えます。
>
> **写真も位置情報も送信しません。** 取り寄せるのは地名の一覧だけです。
>
> ［取り寄せる（約0.5MB）］　［自分で入力する］　［撮影地を入れない］

**取得に失敗したとき（オフライン）** — E1 注記:

> いまは場所を調べられません。手で入力できます。

**GPS が無い写真** — 行は空欄。プレースホルダ `場所を入力`。手入力は自由テキスト
（候補補完はしない。30 書記素上限）。

**精度の限界について、S4 の注記で必ずこう書く**（「正確です」と言わない）:

> おおよその市区町村です。違っていたら直せます。

### 7.5 一括処理での扱い

同じ場所で撮った複数枚には、S4 に `［この地名を全部の写真に使う］` を出す。
押さなければ写真ごとに個別（§13.2 のスコープ表）。

---

## 8. 一括処理（D3）

> 出典: Worker + 逐次処理は `report-geo-batch.md` の実測と案C §7.5。
> フィルムストリップ・進捗・保存動線の端末別分岐は案A §5 D3 / §7-2（審査の規則2により
> 案B の「ZIP一択」より優先）。Wake Lock は案A §6-4。

### 8.1 「モード」にしない

**一括処理は「写真を複数選んだ結果」であって、専用画面もモードも作らない。**
写真を複数選んだ瞬間に、エディタ上部に 48px のフィルムストリップが生える。

理由: 「1枚編集して気に入ったから残り29枚も」という順序が実際の使われ方であり、
先にモードを選ばせると設定を詰める前にバッチに入ってしまう。

```
FAB → OS のピッカーで 30枚選択
   ↓ エディタが開く。フィルムストリップに30個のサムネ。1枚目が選択状態
   ↓ 利用者は1枚目を見ながら設定を詰める
   ↓ ★設定はストリップの全員に即座に効く（1枚目だけの設定ではない）★
   ↓   他の写真をタップすると、その写真で同じ設定のプレビューが見られる
   ↓ ヘッダー右 ［30枚を書き出す］
   ↓ S5 書き出しシート → 進捗 → S6
```

### 8.2 メモリの所有権（iOS でのクラッシュを避ける唯一の設計）

**実測**: 6000×4000 の画像1枚で RSS 約100MB 増、6000×7500 キャンバス1枚で +417MB。
`performance.memory` は終始 0.8MB 前後で**まったく動かない**（`report-geo-batch.md` B-1）。
逐次処理（load→draw→encode→即破棄）なら 100枚でも 1.4GB で横ばい。

```ts
// render/resources/images.ts
export interface PhotoStore {
  /** サムネ: 長辺 80px。30枚で 0.8MB 程度。ストリップが持つ */
  thumb(id: PhotoId): Promise<ImageBitmap>;
  /** プレビュー用: 長辺 ≤ 2048 の ImageBitmap。★同時に1枚だけ★ */
  preview(id: PhotoId): Promise<ImageBitmap>;
  /** 書き出し用: 原寸デコード。★呼ぶたびに作り、スコープを抜けたら必ず close()★ */
  withFull<T>(id: PhotoId, fn: (bmp: ImageBitmap) => Promise<T>): Promise<T>;
}
```

**守る規則（§14.5 でテストする）**

1. `preview` は**現在編集中の1枚だけ**保持する。切り替え時に前のを `close()`。
2. `withFull` のスコープを抜けたら必ず `close()`。`finally` で保証する。
3. 使い終わったキャンバスは `c.width = 0; c.height = 0;` にしてから捨てる（GC を待たない）。
4. **同時実行数は 1 固定。** 並列化すればメモリが線形に増えるだけ。メインスレッドは
   Worker 化で既に 60fps 相当を維持できている（**実測** rAF 251回/4,185ms）ので、
   並列化する動機がない。
5. `PhotoStore` の live handle 数は常に **≤ 2**（preview 1 + full 1）。

### 8.3 Worker のデータフロー

```
メインスレッド                              Worker
─────────────                              ──────
for (const p of photos) {
  scene = buildScene(toSceneInput(doc, p))  ─┐
}                                           │ postMessage({scene, fileRef, target, pref})
                                            └─▶ decode(fileRef)          ← §16.5 の契約
                                                 createVerifiedCanvas(target)  ← §11.2
                                                 renderScene(scene, ctx, target, res)
                                                 convertToBlob({type:'image/jpeg', quality:0.92})
                                                 piexif で元EXIF再注入      ← §11.8
                                                 bitmap.close(); release(canvas)
                                     ┌──◀ postMessage({photoId, blob, name, warnings})
  results.push(...)  ←───────────────┘  （1枚ずつ）
```

- **Scene はメインスレッドで作る。** Worker にスタイル定義・組版ロジックを二重実装しない
  （二重実装による不一致が起きない）。写真ごとに EXIF が違う一括処理を素直に扱える。
- Worker 内では `FontFace` コンストラクタ ＋ `self.fonts.add()` を使う
  （`document` が無いので DOM の `@font-face` は使えない。**実測で動作確認済み**
  `report-geo-batch.md` B-3）。
- 進捗の真実は Worker 側が持つ。`visibilitychange` で離脱しても処理は続き、
  戻ってきたときに正しく復帰する。
- 中止は `postMessage({type:'abort'})`。**現在の1枚が終わった時点で停止**し、
  ここまでの分を持って S6 へ進む。

### 8.4 保存動線の端末別分岐（ZIP を主動線にしない）

**ZIP は「30枚を1回でダウンロードする」問題は解くが、「写真アプリに入れる」問題を解いていない。**
iOS で ZIP はファイルアプリに入り、展開しても写真アプリには入らない。

| 環境 | 主動線 | 到達点 | 所要 |
|---|---|---|---|
| `canShare({files:[30個]})` が true | **共有シートに30枚を一度に渡す** | 「画像を保存」で30枚がまとめて写真アプリに入る | 1タップ |
| `canShare` が true だが30枚が拒否される | **10枚ずつ3回に分けて共有** | 3タップで全部入る | 3タップ |
| `canShare` が false（PC / 一部 Android） | **ZIP を1回ダウンロード** | ダウンロードフォルダ | 1タップ |
| どれも不可 | **1枚ずつ確認して保存** | §8.5 | N タップ |

**連続 `<a download>` は実装しない。** 30個を間隔なしで click して**30個中10個しか
発火しなかった**（**実測** `report-geo-batch.md` B-4）。

**ZIP を選んだ人への事前告知**（S6 に T1 で。**展開してから気づかせない**）:

> ZIP は「ファイル」アプリに入ります。写真アプリに入れたいときは ［1枚ずつ保存］ を使ってください。

**ZIP の性能**: `zipSync`(level6) で30ファイル **271〜274ms**（実測）。
ただし**実写真では ZIP 化してもサイズはほぼ変わらない**（テスト画像は合成グラデーションで
DEFLATE が効いただけ。level0 で入力と同じ 7.60MB になることを確認済み）。
ボタンの文言には**圧縮後ではなく元の合計サイズ**を出す: `30枚をまとめてダウンロード (7.6MB)`。

### 8.5 「1枚ずつ確認して保存」モード

```
 ┌───────────────────────────────┐
 │ ✕      保存する          3 / 30│
 ├───────────────────────────────┤
 │          ┌─────────┐          │  <img> で1枚を全画面表示
 │          │         │          │  左右スワイプで前後に移動
 │          │  結果   │          │  保存済みの枚はサムネ列で塗られる
 │          └─────────┘          │
 │    長押し、または下のボタンで   │
 │                               │
 │ [       この1枚を保存        ] │  押すと自動で次の1枚へ進む
 │  ▣▣▣▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢…      │
 │ [ まとめて ZIP でダウンロード ] │  ← 逃げ道は常に残す
 └───────────────────────────────┘
```

30回タップは多いが、**迷いはゼロ**で、途中でやめても保存済みの分は残る。

### 8.6 進捗（S5 ステップ2）

```
 │ 中止          書き出し中        │
 ├───────────────────────────────┤
 │            12 / 30             │ T4 の大きな数字、中央
 │  ━━━━━━━━━━━━━━░░░░░░░░░░░░░░  │ 進捗バー 高さ2px
 │       あと 8 秒くらい           │ T2 ink-2
 │                               │
 │  ▣▣▣▣▣▣▣▣▣▣▣▣▢▢▢▢▢▢▢▢▢…      │ 1枚 = 8x8 の四角。失敗は斜線
 │                               │
 │  ⓘ この画面を開いたままにして    │ ← Wake Lock が取れなかった端末のみ
 │    ください。                   │
 ├───────────────────────────────┤
 │ [        中止する          ]   │
```

- 「あと N 秒くらい」は **直近3枚の実測平均 × 残枚数**。
  **最初の1枚が終わるまでは出さない**（嘘をつかない）。
- 1枚モードでは `1 / 1` を出さず、`書き出し中…` ＋ 不定形バー。
  **200ms 未満なら何も出さない**（1枚の書き出しは実測 249ms なので多くは1フレームで通過）。
- 所要の根拠（**実測** `report-geo-batch.md`）: 24MP 607.5ms/枚 → 30枚で約18.2秒。
  12MP 220.9ms/枚 → 30枚で約6.6秒。実地の30枚連続処理で 9.6〜12.5秒。
- **Wake Lock**: `navigator.wakeLock.request('screen')` を書き出し開始時に取得し、終了で解放。
  取れなかった端末では上の注記を出す。
- **完了しても自動で次に進まない。** `30 / 30` になったら 400ms 待って S6 へ。
- 中止したとき:

  > **ここまでの 12 枚を保存できます**
  >
  > ［12枚を保存する］　［全部捨てる］

  **捨てさせない設計**（成果物の保全）。

### 8.7 一括処理中の失敗（1枚の失敗で全体を止めない）

```ts
for (const item of queue) {
  item.status = 'processing';
  try { item.blob = await renderOne(item); item.status = 'done'; }
  catch (e) { item.error = toFlameError(e); item.status = 'failed'; }
  finally { release(scratch); }
  persistProgress(queue);        // 進捗だけ localStorage に（強制終了からの復帰用）
}
```

完了後の S6:

> **30枚のうち 27枚を書き出しました**
>
> 3枚は書き出せませんでした。
>
> - `IMG_0412.HEIC` — 変換に失敗しました
> - `DSC_8821.jpg` — この端末のメモリが足りませんでした
> - `photo.png` — 透明な部分の扱いが未設定でした
>
> ［27枚を保存する］　［失敗した3枚をもう一度試す］　［1枚ずつ確認する］

**成功分の保存が最優先の選択肢として一番左にある。**

### 8.8 フィルムストリップの細部

- サムネは `decode(file, { resizeWidth: 80 })` で作る（§16.5 の一本化を通る）。元画像を保持しない。
- ✕ でその写真を外せる。外した直後にオプション行の上へ 4秒だけ:

  > 1枚外しました ［元に戻す］

  トーストだが影は使わず 1px 枠（§9.1 のトークン）。
- **EXIF が取れなかった写真はサムネの右下に小さな `!`。** ヘッダーに行を出す:

  > 撮影情報が無い写真が 3枚あります ›

  タップでその1枚目に飛ぶ。
- 読み込めなかった写真はサムネに斜線:

  > 3枚が読み込めませんでした ›

---

## 9. 画面仕様

> 出典: 画面・遷移・文言はすべて案A（§1〜§7）。ただし `--line` の使い方（§9.1）、
> FAB 長押し・S0 の行数・書体の遅延ロードは審査の裁定で修正。
> エラー文面の中身は案B から流し込む。自己診断は案B §6.3。

### 9.1 デザイントークン（全画面共通・実装値）

```css
:root {
  --bg:          #EDEAE6;   /* 地色。微かに温かいグレー */
  --surface:     #F6F4F1;   /* カード・シートの面 */
  --ink:         #23211F;   /* 文字。純黒ではなく墨寄りの濃灰 */
  --ink-2:       #6E6A65;   /* 副次情報・単位・プレースホルダ */
  --ink-3:       #A4A09A;   /* 無効状態 */
  --line:        #D4CFC8;   /* ★装飾のリーダー罫だけ★（--bg とのコントラスト 1.3:1） */
  --line-strong: #8E8880;   /* ★操作可能な要素の枠は必ずこちら★（約 3.3:1） */
  --shadow: 0 2px 12px rgba(35,33,31,0.14);  /* 唯一の影。プレビューの <canvas> の外側にのみ */
}
```

- **アクセント色を持たない。** 選択状態は「`--ink` 地に `--bg` 文字の反転」か
  「`--line-strong` の1px枠」で表す。
- **破壊的操作（削除・中止）も赤にしない。** 文言で強度を出す（「中止する」「この写真を外す」）。
- **エラーも赤にしない。**「`--ink` の1px枠 ＋ 左に2px の `--ink` 縦罫」で注意の帯を作る。
- **`--line` を操作可能要素の枠線に使ってはならない**（弱視の人にほぼ見えない）。
  操作可能な要素の枠は `--line-strong` に統一する。

```css
/* ★UI の書体。ここで参照する "Noto Sans JP"（空白あり）は OS にある書体であって、
   同梱サブセット NotoSansJP（空白なし・§1.1）ではない。混同しないこと。
   同梱書体はキャプションの描画にだけ使い、UI には使わない（UI に 442KB を待たせない）★ */
font-family: "Roboto Mono", ui-monospace, SFMono-Regular, "Hiragino Sans", "Noto Sans JP", sans-serif;
font-feature-settings: "tnum" 1;   /* 設定値一覧の桁揃え */
```

| 段 | px / line-height / tracking | 用途 |
|---|---|---|
| T1 | 11 / 16 / 0.08em | ラベル、タブ、設定値一覧のキー、単位、注記 |
| T2 | 13 / 20 / 0.02em | 設定値一覧の値、本文、説明文 |
| T3 | 16 / 24 / 0 | ボタン、シート見出し、入力欄 |
| T4 | 22 / 28 / 0.04em | 画面タイトル、ロゴ周り、進捗の数字 |

余白は 8 の倍数のみ（4 は罫との相殺にのみ使用可）。画面左右ガター **16px**。
ヘッダー **48px**、タブバー **56px**（+ `env(safe-area-inset-bottom)`）、
オプション行 **96px**（スタイルタブのみ 176px）。**タップ領域は最低 44px**（§16.8）。

### 9.2 画面一覧と遷移

| ID | 画面 | 種別 | 履歴 |
|---|---|---|---|
| S0 | ホーム | ルート | `/` |
| S1 | モード選択 | 初回のみ全画面 | `/welcome` |
| S2 | 写真の受け取り | 画面ではなく OS ピッカー＋受け皿 | — |
| S3 | エディタ | 中核画面 | `/edit` |
| S3-a | スタイル一覧（全15種グリッド） | S3 の上に全画面 | `/edit#styles` |
| S4 | 情報編集シート | S3 の上にボトムシート | `/edit#info` |
| S5 | 書き出しシート | S3 の上にボトムシート | `/edit#export` |
| S6 | 保存結果 | S5 の続き（同一シート内の別ステップ） | `/edit#saved` |
| S7 | 初期値設定 | S0 から全画面 | `/defaults` |
| S8 | このアプリについて | S0 から全画面 | `/about` |
| **SD** | **自己診断** | **全画面シート（新規1枚）** | `/diagnostics` |

```
  初回のみ ──▶ S1 モード選択 ──▶ S0
                                 │
  ┌──────────────────────────────┴───────────────────────┐
  │ S0 ホーム                                             │
  │   ロゴ / 現在の設定値一覧 / 丸ボタン[⚙→S7][i→S8] / FAB │
  └───┬──────────────┬──────────────┬────────────────────┘
      │ FAB/ドロップ  │ 歯車          │ i
      ▼              ▼              ▼
   S2 受け取り     S7 初期値      S8 について ──▶ SD 自己診断
      │              │ ✓保存         │ ＜             │ ＜（開いた場所へ戻る）
      ▼              └──▶ S0 ◀───────┘                │
  ┌────────────────────────────────────────────────┐   │
  │ S3 エディタ                                     │◀──┘
  │  [＜] flame [書き出す]                          │
  │  [複数枚のみ] フィルムストリップ                 │
  │  プレビュー（影は CSS）                          │
  │  オプション行 / タブバー5つ                      │
  └──┬──────────┬─────────────┬────────────────────┘
     │ 全部見る  │ 情報の[編集] │ [書き出す]
     ▼          ▼             ▼
   S3-a       S4 情報編集    S5 書き出し（設定→進捗）
     └──▶ S3 ◀──┘                │
                                 ▼
                               S6 保存結果 ──▶ S3 / S0 / 写真アプリ
```

**履歴の扱い（Web ならではの必須対応）**
`S3-a / S4 / S5 / SD` は `history.pushState` で履歴に積む。Android の戻るジェスチャ・
ブラウザの戻るで**シートが閉じるだけ**（アプリを離脱しない）。
S3 で戻る操作をしたときだけ「編集を破棄しますか」を確認する。
**これをやらないと、Android ユーザーは書き出しシートで戻るを押した瞬間にアプリごと消える。**

すべてのモーダル／シートは型で脱出口を強制する:

```ts
type Dismissible = { onDismiss: () => void; dismissLabel: string };
function Sheet(props: Dismissible & { children: ReactNode }) { /* … */ }
```

### 9.3 S0 ホーム

```
 ┌───────────────────────────────┐  ← --bg
 │            ┌─────┐            │  ロゴ 112x112 の1px枠 + 横罫 + "flame"(T4)
 │            │ ▭   │            │  ※影なし（影はプレビューだけ）
 │            │flame│            │  上マージン 48
 │            └─────┘            │
 │  MODE ············· こだわる   │  T1キー / T2値 / 行高 28
 │  TITLE ············ Untitled  │  リーダー罫は flex + border-bottom-dotted
 │  DATE ············· 2026.09.20│  （--line。装飾なので可）
 │  PLACE ············ 表示する   │
 │  STYLE ············ OR2       │  ★一覧はスクロール可。既定の可視行は
 │  ALIGNMENT ········ Left      │    こだわる12行 / お手軽8行★
 │  SPACING ·········· Normal    │
 │  SIZE ············· Medium    │
 │  BORDER ··········· Standard  │
 │  COLOR ············ White     │
 │  FINISH ··········· なし      │
 │  FONT ············· Arimo     │
 │        ( ⚙ )      ( i )       │  丸ボタン 44φ、ink地に bg アイコン
 │            ╭─────╮            │  ※カート（課金）は置かない。場所だけ空ける
 │            │  ＋  │            │  FAB 64φ、下から 24 + safe-area
 │            ╰─────╯            │
 └───────────────────────────────┘
```

- **設定値一覧は飾りではなく機能。** ここに出ている値が、次に写真を選んだときの初期値そのもの。
  行をタップすると S7 の該当セクションへ直接スクロールして開く。
- 全16項目は `MODE / TITLE / ARTIST / DATE / PLACE / SEPARATOR / EXPOSURE / STYLE /
  ALIGNMENT / SPACING / SIZE / BORDER / COLOR / FINISH / FONT / ORIENTATION`。
  **こだわるは上位12行、お手軽は8行**（`MODE / TITLE / DATE / PLACE / STYLE / SIZE /
  COLOR / FONT`）を既定で見せ、残りはスクロールで見える。
  393×852 の画面で溢れないための上限である（上余白48＋ロゴ112＋16行×28＝448＋丸ボタン44＋
  FAB64＋safe-area ≈ 790px で iPhone SE 級では溢れる）。
- FAB は `<label for="file">` に `<input type="file" accept="image/*" multiple>`。
  **`capture` 属性は付けない**（カメラ直行になりライブラリから選べなくなる端末がある）。
  `<input accept="image/*">` を押せば OS のシートに既にカメラが出るので、
  **FAB の長押しメニューは作らない**（発見されず、iOS では OS のコンテキストメニューと競合する）。
- PC（`pointer:fine`）では一覧の下に T1 で:

  > 写真をここにドラッグ、または ⌘V で貼り付けできます

  `paste` イベントで画像を受け取る（スクリーンショットを直接貼れる。ただし EXIF が無いので
  §9.6 の帯に着地する。**ここが繋がっていることが大事**）。

**S0 の3状態**

| 状態 | 見せるもの |
|---|---|
| 空（初回・設定が無い） | 一覧の全行が `—`。FAB の上に T2 で `写真を選ぶと、ここに設定が並びます` |
| 処理中 | **なし。** 設定は localStorage から同期で読む（§13.3）。書体未ロード中はロゴだけ system font |
| エラー（localStorage 不可） | E2 の帯: `設定を覚えられない設定になっています。編集はできます。` |
| エラー（強制終了からの復帰） | E2 の帯（§9.6 の最後） |

### 9.4 S3 エディタ（中核）

```
 ┌───────────────────────────────┐
 │ ＜        flame      [書き出す] │ 48px ヘッダー。右はピル型(高さ32)
 ├───────────────────────────────┤
 │ ▣ ▢ ▢ ▢ ▢ ▢ …      1 / 30 ✕ │ ［複数枚時のみ］48px フィルムストリップ
 ├───────────────────────────────┤
 │          ┌─────────┐          │ プレビュー領域:
 │          │  写真   │          │  上下 padding 24、左右 32
 │          │─────────│          │  長辺を領域に contain
 │          │ caption │          │  影は CSS の --shadow のみ（§2.7）
 │          └─────────┘          │
 ├───────────────────────────────┤
 │ [元比][1:1][3:4][4:5][9:16][16:9]│ スタイルタブのみ 176px
 │  ▭  ▤  ▥                      │  上段: 比率セグメント(48px)
 │  OR1 OR2 OR3   [全部見る]      │  下段: 型チップ(96px)+右端ボタン
 ├───────────────────────────────┤
 │ スタイル 組み 地色 書体 情報    │ 56px タブバー
 └───────────────────────────────┘
```

**ヘッダー右の文言はモードと枚数で変わる**: 1枚/こだわる `書き出す` ／ 1枚/お手軽 `保存する` ／
複数枚 `30枚を書き出す`。

**タブ5つ（参考アプリの Style/Layout/Color/Font/Info に対応。増やさない）**

| タブ | 中身 |
|---|---|
| **スタイル** | 比率セグメント6個 → 型チップ最大4個 → ［全部見る］（§9.5） |
| **組み** | **組み方向**(横組み/縦組み) / 整列 / 字間 / 文字サイズ |
| **地色** | ボーダー(2択) / **質感**(なし/粒/印画紙/コマ枠) / 背景色(9色チップ) |
| **書体** | 欧文8書体 ＋ 和文書体（横スクロールカード。各カードはその書体で組んだ見本） |
| **情報** | 表示するフィールドのトグル列 ＋ ［初期値に戻す］［編集…］ |

**「組み」タブのオプション行（96px）** — 2行×2列のグリッド（各セル 44px 高、行間 8）:

```
 組み方向  [横組み][縦組み]     整列  [左][中][右]
 字間     [狭][標][広][最広]    文字  [小][中][大]
```
縦組みを選ぶと整列のラベルが `[上][中][下]` に変わる。
和文書体を選ぶまで「縦組み」は `--ink-3`（無効）。タップすると下に T1 で
`縦組みには和文の書体を選んでください`（モーダルは出さない）。
和文書体を選ぶと「組み」タブのラベルに `・` のバッジが付く（新しい選択肢が出た唯一の合図）。

**「地色」タブのオプション行（96px）**

```
 ボーダー [なし][細枠]          質感 [なし][弱][中][強][印画紙][コマ枠]（横スクロール）
 背景色   ⬜⬛🟫… 9個の 32φ 円チップ（横スクロール。下に T1 で色名）
```
色チップは円形 32φ、選択中は外側に 2px の `--line-strong` リング。
**白と Warm White と Ivory は並べると見分けがつかない**ので、チップの下に T1 で名前を出す
（32+4+16=52px）。上段 36px + gap 8 + 下段 52px = 96px ちょうど。

**「書体」タブのオプション行（96px）**
横スクロールカード（各 120×80）。カードには「Aa 書体名」をその書体自身でレンダリング。
**欧文8書体は初回にプリキャッシュ済み**（**同梱実測 255.3KB**。§12.1 C2）なので、遅延ロードも
スケルトンも要らない（審査 §5-7(1)）。**和文だけは遅延**で、選んだ瞬間にカード内に `…` を出して
**442.4KB** を取得する。

**プレビューの駆動**

```ts
// app/preview/PreviewDriver.ts
export class PreviewDriver {
  private raf = 0;
  private lastScene: Scene | null = null;
  constructor(private canvas: HTMLCanvasElement, private res: RenderResources) {
    useDoc.subscribe(selectSceneInput, (input) => this.request(input), { equalityFn: shallowDeep });
  }
  private request(input: SceneInput) {
    const scene = buildSceneMemo(input);
    if (this.lastScene && sceneEqual(scene, this.lastScene)) return;   // ★no-op を弾く★
    this.lastScene = scene;
    if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.flush(); });
  }
  private flush() {
    const t = makePreviewTarget(this.lastScene!, this.canvas.clientWidth, devicePixelRatio, currentKExport());
    resizeIfNeeded(this.canvas, t);
    renderScene(this.lastScene!, this.canvas.getContext('2d')!, t, this.res);
  }
}
```

- ドラッグ・連打でも 1フレーム 1回しか描かない（rAF 合流）。
- React コンポーネントは `useDoc(s => s.styleId)` のような細いセレクタしか購読しない。
- **世代トークンで古い結果を捨てる**（非同期レースの防止）:

```ts
let generation = 0;
async function renderAsync(scene: Scene) {
  const my = ++generation;
  const bmp = await heavyPart(scene);
  if (my !== generation) { bmp.close(); return; }   // ★古い結果は捨てる★
  present(bmp);
  lastPresented = { generation: my, sceneHash: hashScene(scene) };
}
```
書き出し直前に `hashScene(buildScene(currentInput)) === lastPresented.sceneHash` を照合し、
食い違っていたら**描き直してから**書き出す（§11.5 の `stale-preview`）。
通常は何も出さない。1秒以上かかるときだけ `表示を更新しています…`。

**S3 の3状態**

| 状態 | 見せるもの |
|---|---|
| 空 | 写真が無い状態では**開かない**（S0 から必ず写真を伴って来る）。リロード復帰時は §9.6 |
| 処理中 | プレビュー再描画中は**前のフレームを出したまま**。白抜きにしない。100ms を超えたら右上に 8φ の ink 点が呼吸する |
| エラー | 描画中の例外 → E3 でプレビュー領域を差し替え: `この設定では描けませんでした ［1つ前に戻す］`（設定履歴を1段だけ持つ） |

### 9.5 S3-a スタイル一覧（全画面グリッド）

```
 ┌───────────────────────────────┐
 │ スタイル                 [閉じる]│
 ├───────────────────────────────┤
 │ 元の比率                       │ T1 のグループ見出し
 │ ┌────┐ ┌────┐ ┌────┐          │ 3列グリッド、セル 104x136、gap 12
 │ │実物 │ │実物 │ │実物 │          │ セル内: 今の写真で実際に描いた縮小版
 │ └────┘ └────┘ └────┘          │ 下に T1 で "OR1" と比率
 │  OR1    OR2    OR3            │
 │ 1:1                           │
 │ ...                           │
 └───────────────────────────────┘
```

- 15枚のサムネは **幅 240 の使い回しキャンバス1枚**で順に描き、`convertToBlob` → `<img>` 化して
  差し込む。**同時保持しない。** プレビュー描画は実測 15.9ms 級なので 15枚で 300ms 前後。
- 未生成セルは 1px 枠のスケルトン。生成済みから順に差し替え。
- 個別セルの失敗 → そのセルだけ線画ミニ図にフォールバック。全体は止めない。

**なぜ横一列 15個にしないのか**: 横一列の平均探索 7.5ステップに対し、2段構成は
比率1タップ + 型 平均2.5 = **3.5ステップ**。比率は利用者が先に決めている（Instagram なら
1:1 か 4:5、ストーリーなら 9:16）ので思考の順序と一致する。加えて横スクロール領域は
iOS Safari の edge swipe（戻る）と競合する。

第2段の型チップのミニ図は SVG の静的アセット（1個 200B 程度）。写真を読み込む前から出せる。

### 9.6 エラー表示の3段階（案B の全文面を描画する契約）

| 段 | 形 | 使う場面 |
|---|---|---|
| **E1 インライン注記** | 該当行の下に T1 ink-2 | 入力の軽い不整合、はみ出しの事後報告 |
| **E2 注意の帯** | 幅いっぱい、左に2px の ink 縦罫、T2 ＋ 右端にアクション | EXIF 欠落、和文取得の確認、オフライン |
| **E3 差し替え** | 画面（またはシート）の中身を置き換える | 画像が読めない、書き出し不能 |

**共通ルール**

- **空状態は「何も無い」ではなく「次にすることが1つだけ書いてある」状態にする。**
- **処理中は 200ms 未満なら何も出さない。** 200ms〜1s は不定形バー、1s 超は数値付き。
- **エラーは必ず「次にできること」を伴う。`［閉じる］` だけのエラーは1つも作らない。**

**EXIF が取れなかった写真（★必ず起きる）** — S3 に入った直後、プレビューの下・オプション行の上に E2:

```
 ┃ 撮影情報が読み取れませんでした。
 ┃ スクリーンショットや加工済みの写真ではよくあることです。
 ┃
 ┃ ［ファイルの日付を使う（2026.9.20）］ ［手で入力］ ［入れない］
```

- **主ボタンはモードで入れ替える。** お手軽は左（1タップで解決）、こだわるは `［手で入力］`。
- 過去に「FUJIFILM X-M5 + SIGMA 18-50mm」をプリセット保存していれば
  `［前回のプリセットを使う］` が増える。**RAW 現像後の JPEG は EXIF が落ちがちなので、
  この導線が最も効く。**
- `［入れない］` → 情報タブのトグルを全部 OFF にして帯を閉じる。**この写真だけの設定**。
- **帯は自動で消さない。** どれかを押すまで残る。ただし「書き出す」は押せる（強制しない）。

**EXIF の一部だけ欠落（最も多い）** — 入力欄の直下に E1:

> レンズ名は写真に記録されていませんでした。手で入力できます。

編集シートの該当欄のプレースホルダは `レンズ名（写真に記録なし）`。
**空欄のままなら行ごと出力から省く。「（不明）」のような文字列を勝手に焼き込むことは絶対にしない。**

**EXIF の値が異常なとき**

> 撮影日が **1970.01.01** になっています。カメラの日付設定が正しくなかった可能性があります。
>
> ［この日付を使う］　［今日の日付にする］　［日付を入れない］　［自分で入力する］

**HEIC のとき** — E3 でプレビュー領域ごと差し替え:

> **この形式（HEIC）はブラウザで開けません**
>
> ［変換して使う］
> 約0.3MB の変換プログラムを追加で読み込みます。変換は端末の中で行い、
> 写真は送信しません。1枚あたり3秒ほどかかります。
> **変換すると撮影情報（カメラ名・レンズ名・絞り・日付など）が失われます。**
>
> ［別の写真を選ぶ］
>
> ▾ そもそも HEIC を作らないようにするには
>   iPhone の 設定 › カメラ › フォーマット を「互換性優先」にすると JPEG で撮れます。

`heic2any`（gzip 330.6KB）は**既定では積まない。** ［変換して使う］を押したときだけ `import()`。
変換後は EXIF が落ちる（**実測**）ので、変換直後に必ず上の EXIF 欠落の帯を出す。
**この E3 画面は「不要と判明したら丸ごと消せる」独立コンポーネントとして作る**（§16.10）。

**非対応形式**

| 形式 | 文面 | 出口 |
|---|---|---|
| RAW（CR2/NEF/ARW/DNG） | `DSC01234.ARW はカメラの RAW ファイルです。ブラウザはこの形式を開けません。現像ソフトや、カメラ本体の「RAW現像」機能で JPEG に書き出してからもう一度選んでください。` | ［別の写真を選ぶ］ |
| 動画 | `このアプリは写真にフレームを付けるためのものです。` | ［別の写真を選ぶ］ |
| PNG（透過あり） | `この写真には透明な部分があります。JPEG で書き出すと、透明だったところは白になります。` | ［白にして続ける］［黒にして続ける］［別の写真を選ぶ］ |
| GIF アニメ | `1コマ目（最初の画像）を使います。` | ［続ける］［別の写真を選ぶ］ |

複数枚のうち一部が使えないとき:

> 30枚のうち **3枚**は使えない形式でした（RAW 2枚、動画 1枚）。
>
> ［使える27枚で続ける］　［どれが除外されたか見る］　［選び直す］

**書体のロードに失敗**（E1・書体カードの下）:
その書体を選択不可にし、直前の書体に戻す。**黙ってフォールバックしない。**

> **書体「Playfair Display」を読み込めませんでした**
>
> インターネットに接続できていないか、通信が途中で切れたようです。
> この書体のまま書き出すと、画面で見ているものとは**別の書体**で保存されてしまいます。
>
> ［もう一度読み込む］　［同梱の書体（Arimo）に変える］

**オフライン検出**（E2 の帯。詳細は S8 の1セクションへ）:

> **オフラインです**
>
> インターネットに接続していませんが、**このアプリはほとんどの機能がそのまま使えます。**
>
> ［そのまま使う］　［くわしく見る］

**リロード／タブ破棄からの復帰**（S0 の E2）:

> **写真をもう一度選んでください**
>
> しばらく別のアプリを使っている間に、ブラウザがこのページを解放したようです。
> **フレームの設定（スタイル・文字・色・書体）はすべて残っています。**
> 写真を選び直せば、すぐに続きから始められます。
>
> ［写真を選ぶ］　［設定を確認する］　［最初の画面に戻る］

（出口が1つだと行き止まりになるため、3つ置く。写真を保存しないのは意図的な判断であり、
**設定だけ残す**。§13.3）

**強制終了からの復帰**（S0 の E2。`sessionStorage` の重処理フラグが残っていたとき）:

> **前回、アプリが強制終了したようです**
>
> 前回は 6000×4000 の写真を 30枚、長辺 4096px で処理している途中でした。
> 端末のメモリが足りなくなった可能性があります。
>
> **フレームの設定は保存されています。** 写真を選び直せば、前回と同じ設定で続きから始められます。
>
> ［前回の設定で写真を選ぶ］　［書き出しの大きさを 2560px に下げる］　［設定を確認する］

### 9.7 S4 情報編集シート（ボトムシート、高さ 88vh）

```
 ┌───────────────────────────────┐
 │ ✕          情報を編集         ✓ │ 48px。✕=破棄、✓=確定
 ├───────────────────────────────┤
 │ 作品の情報                     │ T1 セクション見出し
 │ ┌───────────────────────────┐ │ surface のカード、角丸12、padding 16、行高48
 │ │ タイトル      Untitled   ✕│ │ 右端に 24φ のクリアボタン
 │ │ 作者          —          ✕│ │
 │ │ 日付          2026.09.20  ✕│ │
 │ │ 撮影地        広島市中区  ✕│ │
 │ └───────────────────────────┘ │
 │   ⓘ 撮影地は端末の中のデータで    │ T1 ink-2
 │     調べています。座標はどこにも  │
 │     送っていません。             │
 │     おおよその市区町村です。      │
 │     違っていたら直せます。        │
 │                               │
 │ 撮影の情報                     │
 │ ┌───────────────────────────┐ │
 │ │ プリセット    なし        ›│ │
 │ │ カメラ        FUJIFILM X-M5│ │
 │ │ レンズ        SIGMA 18-50…│ │
 │ │ 焦点距離      23mm (35mm…)│ │
 │ │ 露出          F2.8 1/250s │ │
 │ │               ISO400      │ │
 │ └───────────────────────────┘ │
 │ [ この組み合わせをプリセットに保存 ]│ 48px の枠線ボタン
 │                               │
 │ 書き方                         │
 │ ┌───────────────────────────┐ │
 │ │ 日付の形式   2026.09.20  ›│ │ タップで選択肢リストのシート
 │ │ 区切り文字   ,           ›│ │ （ホイール禁止）
 │ └───────────────────────────┘ │
 │   例: FUJIFILM X-M5, SIGMA…   │ 各行の直下に「例」を T1 ink-2 で
 └───────────────────────────────┘
```

- **各行の直下に「例」を出す**のは参考アプリの最良の発明。そのまま継承する。
- EXIF 由来の値は `--ink-2`、手入力は `--ink`、プリセット由来は `--ink` ＋ 行末に T1 で `プリセット`、
  ファイル日付は行末に T1 で `ファイルの日付`（出所を最後まで持ち回る。§4.1 の `FieldSrc`）。
- 入力欄にフォーカスするとソフトキーボードがシートを押し上げる。`visualViewport` の resize を拾い、
  **`✓` を含むヘッダーを常に画面内に固定する**（Web では放置すると確定ボタンがキーボードの下に隠れる）。
- お手軽モードでは「撮影の情報」カードごと畳み、`［カメラの情報も入れる］` の枠線ボタン1個にする。
- プリセットは最大50件（§13.3）。

### 9.8 S5 書き出しシート

**ステップ1: 設定（Preflight の結果はこの中に描く。別画面を作らない）**

```
 ┌───────────────────────────────┐
 │ ✕          書き出す            │
 ├───────────────────────────────┤
 │ 解像度                         │
 │ [ ふつう 4096px ][ 元のまま 6000px ]│
 │   ふつう: だいたい 0.6MB。      │ T1 ink-2。選択に応じて差し替え
 │   SNS ならこれで十分です。      │
 │                               │
 │ 形式                           │
 │ [ JPEG ]                       │ 1択。形式選択 UI は作らない
 │   撮影情報（EXIF）を引き継ぎます │
 │                               │
 │ ☐ 撮影情報を消して書き出す      │
 │   （GPS を含みます）            │
 │                               │
 │ 出来上がり: 約 0.6MB / 1枚      │ T2
 │                               │
 │ ─ Preflight の結果があればここ ─ │ §11.5
 ├───────────────────────────────┤
 │ [        書き出す          ]   │ 56px、ink 地、下に safe-area
 └───────────────────────────────┘
```

- 解像度は「MB」で見せる。PoC の実測値（638KB @ 6000×7500 q0.92）から係数を出して概算し、
  **書き出し後に実測値で置き換える。**
- `outW * outH > 268435456` または `max(outW,outH) >= 65535` を設定変更のたびに評価し、
  超えるなら「元のまま」を `--ink-3`（無効）にして下に T1 で:

  > この写真の大きさ（6000×4000）では、このスタイルだと大きすぎます

  **押させてから失敗させない。**
- `☐ 撮影情報を消して書き出す` にチェックすると EXIF 再注入を丸ごとスキップする。
  チェックしない場合も **GPS は既定で戻さない**（§11.8）。

**ステップ2: 処理中** — §8.6。
**ステップ3（S6）: 保存結果** — 次節。

### 9.9 S6 保存結果

```
 ┌───────────────────────────────┐
 │ ✕         書き出しました        │
 ├───────────────────────────────┤
 │          ┌─────────┐          │ ★結果は必ず <img src=blobURL> で表示する★
 │          │ 出来上がり│          │  canvas のままだと iOS で長押し保存が
 │          └─────────┘          │  出ない（調査ベース・PoC Part4）
 │      ↑ 長押しでも保存できます   │ T1 ink-2（iOS判定時のみ）
 │                               │
 │ [      写真に保存 / 共有     ] │ 56px、ink 地
 │ [      続けて編集する        ] │ 48px、枠線
 │ [      ホームに戻る          ] │ 48px、文字のみ
 │                               │
 │ ▾ ほかの方法で保存             │ 折りたたみ
 │   ・ダウンロード                │
 │   ・1枚ずつ順番に保存           │
 │   ・この設定を初期値にする       │
 └───────────────────────────────┘
```

**主動線は端末の能力で1つだけ出す**（§8.4）。残りは折りたたみ。

| 判定 | 主動線の文言 |
|---|---|
| `navigator.canShare({files})` が true | `［写真に保存 / 共有］` |
| false かつ 1枚 | `［ダウンロード］` |
| false かつ 複数枚 | `［30枚をまとめてダウンロード (7.6MB)］` |

- **`share()` は `click` ハンドラ内で `await` を一切挟まず同期的に呼ぶ。**
  書き出しは S5 で完了させ、S6 のボタンは **Blob が既に手元にある状態**で押される。
  iOS の「ユーザー操作に同期的に紐づく必要がある」制約（調査ベース）への確実な回避であり、
  同時に「結果を見てから保存する」という自然な動線でもある。**実装時のチェック項目にする。**
- `share()` が `NotAllowedError` で reject したら自動で `<a download>` にフォールバックし、
  E2 で `ダウンロードしました`。加えて:

  > **写真アプリに保存する（iPhone / iPad）**
  >
  > 下に表示されている画像を **長押し** して、表示されるメニューから
  > **［“写真”に追加］** を選んでください。

- **「続けて編集する」が重要。** 保存して満足しなかった人がホームまで戻って写真を選び直すのは苦行。
  ここから S3 に戻ると、同じ写真・同じ設定のまま再開できる。
- 初回のみ T1 で1回だけ: `この設定は次回も使われます`（§13.6 の1段目を伝える）。
- お手軽モードのまま「もっと見る」で隠し項目を使った場合、**書き出し後に1回だけ**
  T2 のテキストリンクで（バナーやモーダルにしない。`localStorage` のフラグで二度と出さない）:

  > くわしい設定を使いましたね。こだわるモードに変えますか？

### 9.10 S7 初期値設定 ／ S8 このアプリについて

**S7** は参考アプリの構成（✕/✓ ヘッダー ＋ カード型セクション ＋ 各行に Example）を踏襲し、
**先頭に「モード」セクションを置く**。

```
 │ ✕          初期値設定         ✓ │
 │ モード                         │
 │ [  こだわる  ][   お手軽   ]    │ セグメント
 │   レンズ名や露出も入ります       │ 切替時に「初期値を標準に戻しますか」は
 │   [ このモードの標準に戻す ]     │ ★聞かない★（勝手に設定を消さない）
 │                               │
 │ 作品の情報 / 撮影の情報 / 書き方 /│ ← S4/S3 と同じ部品を再利用
 │ スタイル / 組み / 地色 / 書体    │
 │                               │
 │ 保存とプライバシー              │
 │ ┌───────────────────────────┐ │
 │ │ 前回の設定を覚える    [ON] │ │
 │ │ 日本語の珍しい文字の取り寄せ›│ │ ← §12.5 の3段階同意
 │ │ 撮影情報の GPS を残す [OFF]│ │ ← §11.8
 │ │ 設定をこの端末から消す     ›│ │
 │ └───────────────────────────┘ │
 │                               │
 │ くわしい設定                    │
 │ ┌───────────────────────────┐ │
 │ │ はみ出しの既定の対処   はしご›│ │ ← §4.5
 │ │ 全角の英数字を半角にする[OFF]│ │ ← §4.3
 │ │ 設定を書き出す / 読み込む   ›│ │ ← §13.7 レシピURL
 │ └───────────────────────────┘ │
 │   ⓘ 端末の空き容量が少ないと、   │ ← 空き容量は Preflight で検査しない
 │     保存できないことがあります。  │
```

**S8** は1画面目に **「写真はこの端末から出ません」** を T4 で置き、
その下に §12.6 の全文を載せる。さらに以下のセクションを持つ:

| セクション | 中身 |
|---|---|
| このアプリが通信すること | §12.6 の全文（初回起動時に1回だけ自動表示） |
| 送ったものの記録 | §12.4 の表（独立画面にはしない） |
| オフラインでできること・できないこと | §12.7 の表 |
| 出典とライセンス | §16.2（OFL 1.1 / CC BY 4.0 の本文へのリンク） |
| 不具合の報告 | §16.9 |
| この端末での動作状況 | ［自己診断を開く］ → SD |
| 版番号 | `v1.3.0`（更新があれば `v1.3.0 ●`） |

### 9.11 SD 自己診断（新規に増える唯一の画面）

**到達経路は S8 と、各エラー帯の［この端末の対応状況を見る］だけ。**
全画面シートとして開き、**［←］は必ず「開いた場所」に戻す**（ナビゲーションスタックを持つ）。

```ts
openDiagnostics({ returnTo: { screen: 'editor', state: currentDocState } });
```

```
 ┌────────────────────────────────────────────────┐
 │ ←  この端末での動作状況                          │
 ├────────────────────────────────────────────────┤
 │ ■ アプリ                                        │
 │   版番号        v1.3.0                          │
 │   ビルド        2026-09-21 09:14 (a4f2c9e)      │
 │   配信元の版    v1.4.0  ⚠ 更新があります        │
 │   Service Worker  有効／待機中の版あり           │
 │   書体データ    fontset-2026.09                 │
 │   地名データ    geo-2026.08（日本＋世界）        │
 │                                                 │
 │ ■ ブラウザと端末                                │
 │   ブラウザ      Safari 18.2                     │
 │   OS            iOS 18.2                        │
 │   画面          393 × 852（拡大率 3.0）         │
 │   メモリ        （この端末では取得できません）   │
 │   CPU コア数    6                               │
 │                                                 │
 │ ■ できること・できないこと                      │
 │   ✓ 画像の読み込み（createImageBitmap）          │
 │   ✓ バックグラウンド処理（Web Worker）           │
 │   ✓ 画面外での描画（OffscreenCanvas）            │
 │   ✓ 共有シートへの保存（複数ファイル対応）       │
 │   ✗ ファイル保存先の選択（File System Access）   │
 │   ✓ 設定の保存（localStorage）                   │
 │   ✗ HEIC を直接読む → 変換して使います           │
 │                                                 │
 │ ■ 画像の大きさの上限                            │
 │   測定結果      未測定                          │
 │   想定値        約 268,000,000 画素             │
 │                    ［いま測る（数秒かかります）］│
 │                                                 │
 │ ■ 保存されているもの                            │
 │   設定・プリセット   3.2 KB（12件のプリセット）  │
 │   アプリの部品       1.1 MB                      │
 │   取り寄せた書体     38 KB（4文字）              │
 │                                                 │
 │ ■ 品質の確認                                    │
 │   粒（グレイン）の一致度   ［いま測る］          │
 │   書体の確認             すべて読み込み済み(9)   │
 │   縦書きの書体埋め込み    ✓ 効いています         │
 │                                                 │
 │ ■ 最近の問題（この端末の中だけに記録）           │
 │   9/21 14:41  書き出しの大きさを 4096→2560 に    │
 │               下げました（領域を確保できず）      │
 │                                    ［すべて見る］│
 │                                                 │
 │ ■ 通信                                          │
 │   直近の送信     9/21 14:32  Google（文字「髙」）│
 │                                   ［記録を見る］ │
 ├────────────────────────────────────────────────┤
 │  ［この内容をコピーする］                        │
 │  ［アプリを入れ直す］                            │
 └────────────────────────────────────────────────┘
```

**［いま測る］（キャンバス上限の二分探索）と［粒の一致度］は、この画面の中だけにある。**
プレビュー中や書き出しのたびには測らない（開発用計器であって、利用者向けではない）。
測定結果は `flame:v1:caps` に保存され、次回以降 `KNOWN` より優先して使われる（§11.2）。

**［この内容をコピーする］** はクリップボードに §16.9 のテキストを入れる。**自動送信は一切しない。**

**［アプリを入れ直す］** は実行前に必ず確認する:

> **アプリを入れ直します**
>
> 保存されている部品をすべて削除して、取り直します（約1MB の通信があります）。
>
> - **設定とプリセットは消えません**
> - **いま編集中の写真は選び直しになります**（設定はそのまま残ります）
>
> ☐ 設定とプリセットも消して、完全に初期状態に戻す
>
> ［入れ直す］　［やめる］

### 9.12 S1 モード選択（初回のみ）

```
 │  はじめに、どちらで使いますか    │ T4、上から 64
 │ ┌───────────────────────────┐ │
 │ │  ┌──────┐                 │ │ カード 高さ200、surface、角丸12
 │ │  │サンプル│  こだわる        │ │ 左に ★実レンダリング★ 120x150
 │ │  │(OR2) │  レンズ名や露出も │ │ （同梱のサンプル写真を実際に
 │ │  └──────┘  入れます。       │ │  描いたもの。モックではない）
 │ │             ミラーレス向け。  │ │
 │ └───────────────────────────┘ │
 │ ┌───────────────────────────┐ │
 │ │  ┌──────┐  お手軽          │ │
 │ │  │(SQ3) │  日付と場所だけ、  │ │
 │ │  └──────┘  すっきり。       │ │
 │ │             iPhone 向け。    │ │
 │ └───────────────────────────┘ │
 │  あとからいつでも変えられます。  │ T1 ink-2
```

- **スキップボタンは置かない。** 2択しかなく、どちらを選んでも先に進める。
  選ばせないと「どちらでもない中庸な初期値」という一番よくない状態になる。
- 判定材料として**実際にレンダリングした結果**を見せる。文章では伝わらない。
- サンプル生成中（〜300ms）はカード内の画像位置に 1px 枠のスケルトン。
  デコード失敗時は線画ミニ図にフォールバックし、選択は続行できる。
- 選んだ瞬間に `localStorage` に書いて S0 へ。ローディングを挟まない。

### 9.13 行き止まりがないことの確認

| 画面 | 出口 | 必ず成功する出口 | 成果物の保全 |
|---|---|---|---|
| S3 EXIF 欠落の帯 | 3つ（日付／手入力／入れない） | 全部（どれを押しても「書き出す」に到達） | 写真・設定保持 |
| S3 描画失敗 | ［1つ前に戻す］＋ タブ操作 | ［1つ前に戻す］ | 設定履歴1段 |
| S5 上限超過 | ［下げて書き出す］［設定に戻る］［自己診断］ | 自動降格（§11.7） | 写真・設定保持 |
| S5 Preflight block | 各 block の解決ボタン ＋ ［キャンセル］ | 解決ボタン（必ず代替がある。§11.5） | 設定保持 |
| S5 中止 | ［ここまでの12枚を保存］［全部捨てる］ | 前者 | 成功分は保持 |
| S6 共有失敗 | ［ダウンロード］［長押しの方法］ | `<img>` 長押し（OS 側の最終手段） | Blob は画面に残る |
| S6 ZIP 失敗 | ［1枚ずつ保存する］ | 同左 | Blob は残る |
| SD | ［←］で開いた場所へ | 同左 | 編集状態を `returnTo` で保持 |

**終端はアプリの外（写真アプリ／ダウンロードフォルダ）だけ。** それ以外のすべての画面が
2つ以上の出口を持つ。

---

## 10. 2モード（こだわる／お手軽）

> 出典: 対照表は案A §3-1（審査 §5-6 でそのまま仕様化）。3つの上限は審査 §5-6。

### 10.1 完全対照表

| 項目 | こだわる | お手軽 | 実装 |
|---|---|---|---|
| **既定スタイル** | `OR2`（元比・3行） | `SQ3`（1:1 ポラロイド） | `defaults.styleId` |
| **既定キャプション構成** | 1行目 `Title, Date`／2行目 `Camera`／3行目 `Lens`(muted) | 1行目 `Place, Date` のみ | `StyleDef.caption.lines` は変えず、`gates` と Title 既定で制御 |
| **Title の既定値** | `Untitled` | **空**（何も出さない） | お手軽に `Untitled` は意味の無い文字列 |
| **Artist の既定値** | 空（S7 で1度入れたら以後固定） | 非表示 | `artistEnabled` |
| **Date の既定形式** | `2026.09.20`（`dots`） | `2026.9.20`（`dots-short`） | |
| **撮影地(D4)** | 既定 **OFF**（レンズ名と競合して行が長くなる） | 既定 **ON**（お手軽の主役） | `placeEnabled` |
| **露出設定** | 既定 ON（F値/SS/ISO） | **非表示**（トグルごと出さない） | `exposureEnabled` |
| **焦点距離** | 既定 ON（35mm換算） | **非表示** | `focalEnabled` |
| **区切り文字** | 設定可（`,` `·` `/` `—` ` `） | `,` 固定・UI に出さない | |
| **スタイルタブの選択肢** | 15種すべて（比率6グループ） | **6種**（OR1/SQ1/SQ3/TF1/FF1/NST1）＋「もっと見る」 | `StyleDef.visibleIn` |
| **組みタブ** | 組み方向／整列／字間／文字サイズ の4つ | **文字サイズ**（`ひかえめ/ふつう/大きめ`）＋ **組み方向** | 整列・字間は S7 の「くわしい設定」にのみ存在 |
| **地色タブ** | 背景色9種 ＋ ボーダー2種 ＋ 質感6チップ | **背景色4種**（White/Ivory/Black/Sakura）＋ 質感2チップ（なし/粒＝強度2） | |
| **書体タブ** | 欧文8 ＋ 和文2 | **4種**（Arimo / Jost / PT Serif / 和文1）＋「もっと見る」 | |
| **情報タブ** | フィールド8個のトグル ＋ 編集 | フィールド3個（日付／撮影地／タイトル）のトグル ＋ 編集 | |
| **書き出し解像度** | 選択肢を出す（4096 / 元のまま） | **4096 固定**、「詳しく」を開いたときだけ選択肢 | 既定はどちらも 4096 |
| **EXIF を消すチェック** | 出す | **出す**（お手軽のほうが GPS の危険を知らないので、むしろ出すべき） | |
| **ホームの設定値一覧** | 12行 | 8行 | §9.3 |
| **EXIF が無い写真の帯の主ボタン** | ［手で入力］ | ［ファイルの日付を使う（…）］ | §9.6 |
| **はみ出しの注記（E1）** | 出す | 出す | 両方 |
| **一手で解決できない warn** | 出す | **出さない**（下記 上限①） | §10.2 |

### 10.2 モードにかける3つの上限（これが無いと「確認を増やす」方向に倒れる）

| 上限 | 内容 |
|---|---|
| **①** | **お手軽では「一手で解決できない warn」を出さない。**［実寸で確かめる］しか行動が無い警告は、お手軽では表示しない |
| **②** | **モードは安全挙動を一切ゲートしない。** block 判定4種・CSP・EXIF 再注入の GPS 既定 OFF・和文取得の同意は**両モードで同一**。モードが変えるのは*饒舌さと選択肢の数*だけ |
| **③** | **和文取得の3段階同意（送らない／そのつど／確認せず）は両モードに置き、既定はどちらも「そのつど」。** 唯一「利用者の入力が端末外に出る」経路であり、`requirements.md` §3-1 にお手軽の例外規定は無い |

**上限②を破る実装を見つけたら、それはバグである。**
`if (mode === 'otegaru') { skipPreflight() }` のようなコードは書いてはならない。
モードが参照してよいのは「表示する・しない」「選択肢の数」「既定値」だけ。

### 10.3 切り替えの3経路（モードの切替は破壊的にしない）

1. **S7 先頭のモードセグメント** — 恒久的な切替。切り替えても現在の各設定値は保持され、
   「隠れる／現れる」だけが変わる。標準値に戻したい人には `［このモードの標準に戻す］` を別途置く。
2. **S3 のタブ内「もっと見る」** — その場限りの拡張。お手軽のまま全選択肢が見える。
   ここで隠し項目を使ったら S6 に1回だけ提案（§9.9）。
3. **S0 の設定値一覧の `MODE` 行タップ** — S7 のモードセクションへ直行。

### 10.4 この2分法の限界（記録として残す）

iPhone で撮るがレンズ名を出したい人、ミラーレスで撮るがシンプルにしたい人は、
どちらのモードでも「もっと見る」を開き続けることになる。
§10.3 の経路2で緩和しているが、**2モードという構造自体が正しいかは検証していない**
（`requirements.md` §2 で決まっているため所与とした）。実機検証で「もっと見る」の利用率が
高ければ、モード廃止＋「詳細を常に出す」への移行を検討する。

---

## 11. 安全装置

> 出典: すべて案B（§1 FM-01/02/04/08/09/15/24、§3.4、付録A）。
> 自動降格の段数は審査 §5-7(6)、Preflight の提示方法は審査 §5-2。

### 11.1 なぜこれが「後から入らない」のか

このアプリの失敗は **例外を投げない**。

- 面積上限を超えたキャンバスは `getContext` も `fillRect` も成功を返し、透明な黒を返す
- フォントを待たずに描くと、警告なくフォールバック書体で書き出される
- `<img>` 化した SVG は親文書の FontFace を見ず、縦書きだけ別書体になる
- 同梱外の文字は例外を投げず豆腐（□）を描く
- 画像1枚 100MB の消費は `performance.memory` に一切現れない

**`try/catch` を書くだけでは何も守れない。** よって「失敗していないこと」を待つのではなく、
**「成功していること」を毎回コードで確かめる**。この確認は唯一の入口に集約しなければ
成立しないので、§1.3 の lint 規則とセットで**最初に**入れる（§17）。

### 11.2 `createVerifiedCanvas`（面積上限の「黙って失敗」への対処）

**実測**（`report-canvas.md` Part2）: 面積上限 **2^28 = 268,435,456px**、辺長上限 **65,535px 未満**。
1px でも超えると `width` 代入も `getContext('2d')` も `fillRect` も例外を投げず、
`getImageData` が `[0,0,0,0]` を返す。

```ts
// render/guards.ts  — 例外を投げる代わりに Result を返す
export type CanvasResult =
  | { ok: true;  canvas: HTMLCanvasElement | OffscreenCanvas; ctx: Ctx }
  | { ok: false; reason: 'area' | 'side' | 'context' | 'verify'; w: number; h: number };

const DEFAULT_LIMITS = { area: 268_435_456, side: 65_535 };   // Chromium/Linux の実測値

export function createVerifiedCanvas(w: number, h: number): CanvasResult {
  w = Math.floor(w); h = Math.floor(h);
  const limits = measuredLimits() ?? DEFAULT_LIMITS;          // ★端末の実測値があればそちら★
  // 1) 既知の上限との事前照合（無駄な確保を避ける）
  if (w > limits.side || h > limits.side) return { ok:false, reason:'side', w, h };
  if (w * h > limits.area)               return { ok:false, reason:'area', w, h };

  const canvas = makeCanvas(w, h);                            // OffscreenCanvas があればそちら
  const ctx = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb' });
  if (!ctx) return { ok:false, reason:'context', w, h };

  // 2) 読み戻し検証。★左上だけでは不十分。右下も見る★
  //    （部分的にしか確保されていない病的なケースを拾うため）
  const probe = (x: number, y: number) => {
    ctx.fillStyle = 'rgb(1,2,3)';
    ctx.fillRect(x, y, 1, 1);
    const d = ctx.getImageData(x, y, 1, 1).data;
    return d[0] === 1 && d[1] === 2 && d[2] === 3 && d[3] === 255;
  };
  if (!probe(0, 0) || !probe(w - 1, h - 1)) {
    release(canvas);
    return { ok:false, reason:'verify', w, h };
  }
  ctx.clearRect(0, 0, w, h);
  return { ok:true, canvas, ctx };
}

/** 使い終わったら 0x0 にしてから捨てる。GC を待たない */
export function release(c: HTMLCanvasElement | OffscreenCanvas) { c.width = 0; c.height = 0; }
```

**検証の頻度**（案B の自己申告 §8.2 への回答）: `getImageData` は GPU→CPU の読み戻しを
強制するため、毎フレーム走らせてはならない。

> **規則: 検証するのは「キャンバスを新しく確保したとき」だけ。**
> プレビューキャンバスは**使い回し**（`resizeIfNeeded` でサイズが変わったときだけ再確保＋再検証）。
> 書き出しキャンバスは1回だけ確保するので、1枚につき検証1回。
> 一括処理では Worker が**同じキャンバスを使い回し**、サイズが変わる写真でだけ再確保する。

`measuredLimits()` は自己診断の［いま測る］（二分探索）が `flame:v1:caps` に保存した実測値。
**iOS Safari では Chromium より小さい可能性が高い**（`report-canvas.md` の未検証事項）。

### 11.3 FontRegistry（フォールバック書き出しへの対処）

**実測**（`report-fonts.md` §4）: 待たずに `fillText` すると `measureText().width` が
フォールバック基準値（554.625）と**完全一致**した。`document.fonts.check()` は描画後には
true を返すため検知に使えない。

```ts
// render/resources/fonts.ts
type Entry = { face: FontFace; ref: FontRef; coverage: Set<number> };
const loaded = new Map<string, Entry>();     // key = `${family}/${weight}`

export async function ensureFont(ref: FontRef): Promise<Entry> {
  const key = `${ref.family}/${ref.weight}`;
  const hit = loaded.get(key);
  if (hit) return hit;
  // urlFor は public/fonts/manifest.json を引く。ファイル名をコードに直書きしない
  //   欧文: manifest.latin[key].{regular,bold}.file    和文: manifest.jp.regular.file
  const face = new FontFace(ref.family, `url(${urlFor(ref)}) format('woff2')`,
                            { weight: String(ref.weight) });
  await face.load();                                   // ← 唯一の真実
  if (face.status !== 'loaded') throw new FontLoadError(key);
  (self as any).fonts ? (self as any).fonts.add(face) : document.fonts.add(face);
  const entry = { face, ref, coverage: await coverageOf(ref) };
  loaded.set(key, entry);
  return entry;
}

// render/ops/text.ts — ★fillText を呼ぶ唯一の場所★
export function drawText(ctx: Ctx, op: TextOp, t: RenderTarget, res: RenderResources) {
  const key = `${op.font.family}/${op.font.weight}`;
  if (!loaded.has(key)) throw new FontNotReadyError(key);  // ★フォールバックで描かない★
  ctx.font = `${op.font.weight} ${op.sizeLu * t.k}px "${op.font.family}"`;
  ctx.letterSpacing = `${op.letterSpacingLu * t.k}px`;
  ctx.textAlign = op.align;
  ctx.fillStyle = css(op.color);
  ctx.fillText(op.text, op.anchor.x * t.k, op.anchor.y * t.k);
}
```

**`document.fonts.check()` は一切使わない**（lint で禁止。§1.3）。判定は
「自分が `await face.load()` を resolve させて Map に入れたか」という**自分の記録**だけで行う。

**書体の別人確認（Preflight の `font-identity`）** — 確実な判定だけを採る:

```ts
export function verifyFontIdentity(ctx: Ctx, ref: FontRef): 'ok' | 'fallback-suspected' {
  ctx.font = `${ref.weight} 100px "${ref.family}"`;
  const w  = ctx.measureText(PROBE).width;             // PROBE = 'HAMBURGEFONTSIV 0123'
  ctx.font = `${ref.weight} 100px sans-serif`;
  const fb = ctx.measureText(PROBE).width;
  return Math.abs(w - fb) < 0.01 ? 'fallback-suspected' : 'ok';
}
```

> **ビルド時実測幅との ±2% 照合は Preflight から外す**（OS 差で 2% 程度ぶれる、と案B 自身が
> 申告している）。**曖昧な判定で書き出しを止めてはならない。**
> ビルド時幅は自己診断のレポートにだけ記録する。

**欧文8書体（同梱実測 255.3KB）は初回にまとめてプリキャッシュする**（審査 §5-7(1)）。
遅延ロードにすると、オフラインや低速回線で書体を切り替えた瞬間にこの罠が生じ、
**趣味の選択に過ぎない操作のためにブロッキングの確認を出す**羽目になる。
遅延ロードするのは **和文（442.4KB）・`heic2any`（330KB）・世界地名（986.4KB）だけ。**

### 11.4 カバレッジ検査（豆腐の焼き込みへの対処）

同梱外の文字（第二水準の稀字・簡体字・ハングル・絵文字）が入力されると、
`fillText` は例外を投げずに豆腐（□）を描き、そのまま保存される。

```ts
// ビルド時: scripts/build-coverage.mjs（★要追加★）が和文サブセットの cmap を抽出して
// public/fonts/coverage-jp.json を生成する。形式はコードポイントの昇順の [start, end] 区間列
// （3,476字を裸の配列で持つと 25KB になるが、区間列なら数KB に収まる）
// { "family": "NotoSansJP", "ranges": [[32,126],[12353,12435], ...], "count": 3476 }
//
// ※ 現物の public/fonts/manifest.json は charCount(3476) と glyphs(3475) しか持たないので、
//    実行時の照合には足りない。build_fonts.py が既に cmap を読んでいる（NAME_VARIANTS の
//    収録確認をしている）ので、そこから区間列を書き出すのが最も安い。

// 実行時（core/caption/coverage.ts。CoverageOracle ポート経由）
export function uncovered(text: string, cov: CoverageOracle): string[] {
  const missing: string[] = [];
  for (const g of new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(text)) {
    const cps = [...g.segment].map(c => c.codePointAt(0)!);
    if (cps.some(cp => !cov.has(cp))) missing.push(g.segment);
  }
  return [...new Set(missing)];
}
```

**重要: 異体字置換表（髙→高、﨑→崎）は作らない。**
**実測で同梱サブセットは 髙(U+9AD9)・﨑(U+FA11)・德・濵・齋・邊 を明示的に収録している**
（`report-jp-subset.md`。姓として頻出するため実害が大きい。
`build_fonts.py` はビルドの最後に cmap を見てこれらの収録を確認している）。
**同梱している字に「高に置き換えますか」と聞くのは端的に誤りで、
しかも人の名前の字を変える提案は最も失礼な誤りになる。**

同梱外の字に対する選択肢は**3つ**（置換の提案はしない）:

> この文字は、同梱の書体に入っていません: **彅**
>
> ［取り寄せる（通信します・約10KB）］　［その字を消す］　［別の字を入力する］

絵文字・ハングル・簡体字など取り寄せても実用的でない場合:

> **この文字は使えません: 🌸**
>
> 絵文字は、写真に焼き込む書体では表示できません。書き出すと □ になってしまいます。
>
> ［絵文字を消す］　［入力欄に戻って直す］

「そのままにする」という選択肢は**置かない**（Preflight で必ず止まるため、
置くと利用者を二度手間にするだけ）。

### 11.5 Export Preflight

**実行場所は S5 書き出しシート ステップ1 の中。独立した画面を作らない。**

```ts
// core/preflight/types.ts
export type CheckId =
  | 'stale-preview' | 'coverage' | 'font-loaded' | 'font-identity' | 'vertical-font'
  | 'text-fit' | 'memory' | 'exif' | 'save-target' | 'canvas';

export type CheckResult =
  | { id: CheckId; level: 'pass' }
  | { id: CheckId; level: 'warn';  blocking: false; ui: WarnUI }
  | { id: CheckId; level: 'block'; blocking: true;  ui: BlockUI };

/** ★block を返してよいのはこの4つだけ。増やすには「出力が嘘になる」ことの説明を要求する★ */
export const BLOCKING_ALLOWED: readonly CheckId[] =
  ['canvas', 'font-loaded', 'font-identity', 'coverage'];
```

```ts
// core/preflight/run.ts  — 順序は「安いもの・確実に落ちるものから」。高価な canvas 確保は最後
export async function preflight(ctx: PreflightPorts, doc: DocState, target: ExportTarget) {
  const r: CheckResult[] = [];
  r.push(await ctx.checkStalePreview(doc));     // 自動修復。§9.4
  r.push(await ctx.checkCoverage(doc));         // cmap 照合。数ms
  r.push(ctx.checkFontsLoaded(doc));            // 台帳参照。0ms
  r.push(ctx.checkFontIdentity(doc));           // measureText 照合。数ms
  r.push(await ctx.checkVerticalFont(doc));     // 小プローブSVG。(書体,セッション)ごとに1回
  r.push(ctx.checkTextFit(doc, target));        // 数ms
  r.push(ctx.checkMemoryBudget(doc, target));   // 計算のみ。0ms
  r.push(ctx.checkExifPlan(doc));               // 判定のみ
  r.push(ctx.checkSaveTarget());                // 能力判定
  r.push(await ctx.checkCanvasAlloc(target));   // 実際に確保して検証。数十ms
  return r;
}
```

**Preflight から外した検査**（審査 §5-2）

| 外すもの | 行き先 | 理由 |
|---|---|---|
| `checkGrain`（128角パッチの毎回実測） | **自己診断の［いま測る］** | 方式は `report-grain.md` で決着し 0.98 が実測済み。毎回測り直すのは開発用計器 |
| `checkDisk`（`storage.estimate()`） | **S7 の注記** | iOS で当てにならず、警告を1段増やすだけで出力は正しい |
| ビルド時幅との ±2% 照合 | **自己診断のレポート** | OS 差でぶれる。曖昧な判定で止めない |

**UI の出し分け**

| 状況 | 表示 |
|---|---|
| 全部 pass、所要 300ms 未満 | **何も出さない。** そのまま書き出しへ |
| 全部 pass、所要 300ms 以上 | `書き出しを準備しています…` の進捗のみ |
| warn のみ | S5 ステップ1 の中に行として並べる。**［書き出す］が最も目立つ位置のまま** |
| block あり | シート内のボタンが**解決ボタン群に差し替わる**。⛔ を全部解決すると［書き出す］に戻る |

**block 時の表示（S5 の中。別画面に飛ばさない）**

> **書き出す前に確認してください**
>
> ⛔ **「彅」を表示できる書体がありません**
> 　　［取り寄せる］［その字を消す］［別の字を入力する］
>
> ⚠️ **この端末のメモリでは 4096px が重すぎます**
> 　　［2560px に下げる］
>
> ───────────────────────────
> ⛔ が残っているため、まだ書き出せません。
>
> ［キャンセル］

**block を許す4つと、それぞれの代替手段**

| block | なぜ止めるか | 必ずある代替 |
|---|---|---|
| `canvas` | 透明な黒が保存される（物理的に不可能） | 解像度を下げる（§11.7 の自動降格） |
| `font-loaded` | 別の書体で書き出される＝嘘 | 同梱書体（Arimo）に変える |
| `font-identity` | 同上（縦書きの埋め込み失敗を含む） | 横書きに切り替える／別の書体 |
| `coverage` | □ が焼き込まれる＝嘘 | 取り寄せる／消す／別の字 |

**それ以外はすべて `［このまま書き出す］` を許す。**
メモリ予算超過・はみ出し・EXIF 再注入不可・撮影地の自信度 low・粒の一致度は warn である。

> **「資源が揃うまで保存ボタンを押させない」という設計は採らない。**
> 理由を言わずに主ボタンを無効化するのは「`［閉じる］` だけのエラーは作らない」の精神に反する。
> **ボタンは常に押せる。押すと解決可能な一覧が出る。**

### 11.6 `safeStorage`

Safari プライベートは「localStorage は**存在するが** `setItem` が throw する」。
存在確認では検知できない。

```ts
// platform/storage.ts
type Mode = 'persistent' | 'memory';
let mode: Mode = 'persistent';
const mem = new Map<string, string>();

function probe(): Mode {
  try {
    const k = '__flame_probe__';
    localStorage.setItem(k, '1');
    const ok = localStorage.getItem(k) === '1';
    localStorage.removeItem(k);
    return ok ? 'persistent' : 'memory';
  } catch { return 'memory'; }
}

export const safeStorage = {
  init() { mode = probe(); if (mode === 'memory') notifyStorageUnavailable(); },

  get(key: string): string | null {
    if (mode === 'memory') return mem.get(key) ?? null;
    try { return localStorage.getItem(key); }
    catch { degrade('read'); return mem.get(key) ?? null; }
  },

  set(key: string, val: string): boolean {
    mem.set(key, val);                        // ★メモリには必ず入れる★
    if (mode === 'memory') return false;
    try { localStorage.setItem(key, val); return true; }
    catch (e) {
      if (isQuotaError(e)) { evictOldLogs(); try { localStorage.setItem(key, val); return true; } catch {} }
      degrade('write');                       // 以降はメモリのみ。毎回 throw させない
      return false;
    }
  },
};

/** quota 超過時に最初に捨てるもの（優先度の低い順）。利用者が作ったものは最後まで守る */
function evictOldLogs() {
  trimRing('flame:v1:netlog', 20);            // 通信ログ 100 → 20件
  trimRing('flame:v1:errlog', 5);             // エラーログ 20 → 5件
  safeRemove('flame:v1:caps');                // 能力測定結果（測り直せる）
}
```

- **`set` は必ずメモリにも書く。** ストレージが死んでいてもセッション中は完全に動く。
- `degrade()` は一度だけ呼ばれ、以降は試さない。
- 失敗は起動をブロックしない。

画面上部に細いバッジを常設（閉じられるが、次回起動でまた出る）:

```
 ⓘ 設定は保存されません（プライベートモード）
```

押すと:

> **この端末では設定を保存できません**
>
> ブラウザのプライベートモードを使っているか、サイトのデータ保存が無効になっているようです。
> **アプリはこのまま普通に使えます** が、**ブラウザを閉じると設定とプリセットが消えます。**
>
> ［このまま使う］　［保存できるようにする方法を見る］

**スキーマ不一致への対処（起動不能を絶対に作らない）**

```ts
export function loadSettings(): Settings {
  try {
    const raw = safeStorage.get('flame:v1:settings');      // ★キーに版を含める★
    if (!raw) return DEFAULTS;
    const result = SettingsSchema.safeParse(migrate(JSON.parse(raw)));
    if (!result.success) { quarantine(raw); return DEFAULTS; }   // .broken に退避
    return result.data;
  } catch { return DEFAULTS; }
}
```

> **設定を読み込めなかったため、初期状態に戻しました**
>
> 保存されていた設定が壊れていたようです。アプリは初期状態で動いています。
>
> ［初期状態で使う］　［壊れた設定の中身を見る（不具合報告用）］

### 11.7 自動降格（4096 → 2560 → 1600）と、必ず告げること

審査 §5-7(6) / §4-A-x3: **自動降格を採る。ただし降格したことを必ず告げる。**
段数は **3段に圧縮**（4段は刻みすぎ）。

```ts
const DOWNGRADE_LADDER = [4096, 2560, 1600] as const;
```

理由: 事前計算（§9.8）が予測可能なケースを既に潰しているので、実際に降格が走るのは
**端末固有の低い上限を踏んだときだけ**で、そのとき利用者は既に10〜20秒待っている。
そこで「失敗しました。設定に戻ってください」は成果物を捨てさせる。

**降格して成功したとき（事後報告。行き止まりではない）**

> **この端末では、この大きさの画像を作れませんでした**
>
> 長辺 4096px で作ろうとしましたが、お使いのブラウザが扱える画像の大きさを超えていました。
> **長辺 2560px に下げて書き出しました。**
>
> 見た目（構図・文字の大きさ・フチの太さ）は変わりません。画像そのものが少し小さくなります。
> SNS への投稿なら、この大きさで十分きれいに表示されます。
>
> ［このまま保存する］　［もう一度 4096px で試す］　［書き出しの大きさを設定で変える］

**全段階で失敗したとき**

> **画像を作れませんでした**
>
> お使いのブラウザが、いま画像を作るための領域を確保できませんでした。
> 他のタブやアプリがメモリを使い切っている可能性があります。
>
> 次のどれかをお試しください。
> 1. 他のタブを閉じて、もう一度［書き出す］を押す
> 2. ブラウザを一度終了して、開き直す
> 3. 書き出しの大きさを「長辺 1600px」に変える（設定 → 書き出し）
>
> ［もう一度試す］　［設定を開く］　［この端末の対応状況を見る］

降格したことは `flame:v1:errlog` に `CANVAS_DOWNGRADE requested=4096 used=2560 reason=verify-failed`
として記録し、自己診断に出す。**黙って下げると「プレビュー＝書き出し」の信頼が壊れる。**

**グレインタイルの確保に失敗したとき**（粒なしで続行）:

> **粒（グレイン）を付けられませんでした**
>
> この端末で粒を作るための領域を確保できなかったため、**粒なしで書き出します。**
> 写真・フチ・文字はすべて設定どおりに書き出されます。
>
> ［粒なしで書き出す］　［書き出しの大きさを下げてもう一度試す］　［キャンセル］

### 11.8 EXIF 再注入の方針（プライバシーの粒度）

**実測**（`report-canvas.md` Part3）: `toBlob('image/jpeg')` で EXIF は完全に消える。
`piexifjs` での書き戻しは成功し、増加は **+414byte**。

```ts
export async function reinjectExif(jpeg: Blob, src: any): Promise<{ blob: Blob; exif: 'ok'|'skipped'|'failed' }> {
  try {
    const dict = structuredClone(src);
    delete dict.thumbnail;                    // サムネイルは落とす
    delete dict['Exif']?.[37500];             // MakerNote: ベンダー固有で壊れやすい。落とす
    if (!keepGps) delete dict['GPS'];         // ★既定で GPS は戻さない★
    dict['0th'][piexif.ImageIFD.Software] = `flame ${BUILD_INFO.version}`;
    const out = piexif.insert(piexif.dump(dict), await blobToBinaryString(jpeg));
    const blob = binaryStringToBlob(out, 'image/jpeg');
    // ★読み戻して確認する。挿入が成功した「つもり」で終わらせない★
    const back = piexif.load(await blobToBinaryString(blob.slice(0, 128 * 1024)));
    const ok = back['0th']?.[piexif.ImageIFD.Model] === dict['0th']?.[piexif.ImageIFD.Model];
    return ok ? { blob, exif: 'ok' } : { blob: jpeg, exif: 'failed' };
  } catch {
    return { blob: jpeg, exif: 'failed' };    // ★書き出し全体は成功させる★
  }
}
```

| 項目 | 既定 | 理由 |
|---|---|---|
| カメラ・レンズ・露出・日時 | **戻す** | キャプションと整合し、作品情報として価値がある |
| **GPS 座標** | **戻さない** | SNS 投稿での位置特定リスク。撮影地はキャプションに市区町村名で入っている |
| MakerNote | 戻さない | ベンダー固有で壊れやすく、シリアル番号等が入ることがある |
| Software | `flame <版番号>` に書き換え | 加工済みであることを正直に示す＋不具合報告で版が分かる |

**EXIF 注入は「おまけ」であり、失敗しても写真は保存される。**
ここで throw させて書き出し全体を落とすのは優先順位の誤り。
失敗したら書き出し完了後に控えめに:

> 写真は保存できましたが、**元の撮影情報（EXIF）を書き戻せませんでした。**
> 画像に焼き込まれたキャプションはそのまま残っています。
>
> ［詳しく見る］

S7 の設定（常設）:

> **書き出した写真に残す撮影情報**
>
> ☑ カメラ・レンズ・露出・撮影日を残す
> ☐ **GPS（撮影場所の座標）を残す**
> 　　※ SNS に投稿すると、撮影場所が他人に分かる可能性があります。初期設定では残しません。
> ☑ 加工したアプリ名（flame）を記録する

### 11.9 メモリ予算（予防）

```ts
// core/memory-budget.ts（純粋。判定値は platform から渡す）
const BYTES_PER_PX = 4;
const OVERHEAD = 2.5;              // 実測 417MB / 生180MB ≒ 2.3 に安全側マージン

export function estimateBytes(src: {w:number;h:number}, dst: {w:number;h:number}) {
  return (src.w * src.h + dst.w * dst.h) * BYTES_PER_PX * OVERHEAD;
}

// platform/caps.ts
export function budgetBytes(): number {
  const dm = (navigator as any).deviceMemory;   // Chromium 系のみ
  if (dm) return dm * 1024 ** 3 * 0.20;
  if (isIOS()) return 1.0 * 1024 ** 3 * 0.35;   // ★推定★ iOS 上限1.5〜2GB説に対し保守的に
  return 1.5 * 1024 ** 3 * 0.25;                // ★推定★
}
```

超過するなら Preflight が **warn** を出す（block ではない）:

> **この端末のメモリでは重すぎます**
>
> 6000×4000 の写真を長辺 4096px で書き出すには、およそ **1.2GB** の作業領域が必要ですが、
> この端末で安全に使えるのは **約 0.5GB** です。このまま進めると、
> ブラウザのタブが強制終了して、作業内容が失われる可能性があります。
>
> **長辺 2560px に下げれば、約 0.4GB で書き出せます。**
>
> ［2560px で書き出す（おすすめ）］　［このまま 4096px で試す］

「このまま試す」を押したときだけ、もう1段:

> このまま進めると、タブが強制終了して写真の選び直しが必要になる可能性があります。
> 書き出しが終わるまで、他のアプリに切り替えないでください。
>
> ［承知のうえで実行する］　［やめる］

**強制終了の事後検知**: 重い処理の直前に `sessionStorage` にフラグを立て、正常終了で消す。
起動時に残っていたら §9.6 の「前回、アプリが強制終了したようです」を出す。

### 11.10 エラーログ（個人情報を記録しない）

```ts
// platform/error-log.ts
type LogEntry = { at: string; code: string; detail: Record<string, string | number | boolean> };

export function logError(code: string, detail: Record<string, any> = {}) {
  ring('flame:v1:errlog', { at: new Date().toISOString(), code, detail: scrub(detail) }, 20);
}

/** ★入力文字列そのものは記録しない。長さと種別だけ★ */
function scrub(d: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(d)) {
    if (k === 'text' || k === 'chars') { out[k + 'Len'] = String(v).length; continue; }
    if (typeof v === 'object') { out[k] = '[object]'; continue; }
    out[k] = v;
  }
  return out;
}
```

**エラーコードは定数として一覧化する**（利用者が「CANVAS_DOWNGRADE って何ですか」と
聞いてきたら答えられる状態にする）:
`CANVAS_DOWNGRADE` / `CANVAS_ALLOC_FAILED` / `FONT_NOT_READY` / `FONT_LOAD_FAILED` /
`VERTICAL_FONT_EMBED_FAILED` / `COVERAGE_MISSING` / `HEIC_EXIF_MISSING` / `HEIC_CONVERT_FAILED` /
`EXIF_REINJECT_FAILED` / `GEO_OUT_OF_RANGE` / `STORAGE_DEGRADED` / `SCHEMA_QUARANTINED` /
`CHUNK_LOAD_FAILED` / `BATCH_ITEM_FAILED` / `SHARE_NOT_ALLOWED`。

---

## 12. 通信とプライバシー

> 出典: 全面的に案B（§2）。着地先（独立画面を作らず S8 に畳む）は審査 §5-1。

### 12.1 全通信の棚卸し（設計として発生しうるものすべて）

凡例 — 同意: 「不要」= アプリを開く行為そのものに含まれる／「事前同意」= 実行前に必ず聞く。

| # | 何が | どこへ | いつ | 写真・位置情報を含むか | 同意 |
|---|---|---|---|---|---|
| **C1** | アプリ本体（HTML/JS/CSS）約 250KB | 自ドメイン（Cloudflare） | 初回アクセス時・更新時のみ | 含まない | 不要 |
| **C2** | 欧文書体 8種 × {regular,bold}（woff2 計 **255.3KB** 同梱実測） | 自ドメイン（同梱） | C1 と同時（プリキャッシュ） | 含まない | 不要 |
| **C3** | **和文 Regular 3,476字（woff2 442.4KB 同梱実測）** | 自ドメイン（同梱） | **和文書体を選んだときだけ（遅延）** | 含まない | 不要 |
| **C4** | 日本の市区町村データ（91.3KB／転送 gzip 約33KB） | 自ドメイン（同梱） | C1 と同時 | 含まない | 不要 |
| **C5** | 世界の主要都市データ（986.4KB／転送 gzip 約0.47MB） | 自ドメイン | 日本国外の GPS を検出し、利用者が［取り寄せる］を押したときだけ | 含まない（座標は送らない。データを受け取るだけ） | **事前同意** |
| **C6** | PWA マニフェスト・アイコン | 自ドメイン | 初回・ホーム画面追加時 | 含まない | 不要 |
| **C7** | `version.json`（版番号の確認・数百バイト） | 自ドメイン | 起動時＋6時間ごと（開いている間のみ） | 含まない | 不要 |
| **C8** | `sw.js` の更新確認 | 自ドメイン | ブラウザが自動で＋C7 を受けて明示的に | 含まない | 不要 |
| **C9** | **和文の不足文字の取り寄せ（CSS）**<br>`fonts.googleapis.com/css2?family=Noto+Sans+JP&text=彅` | **Google** | 同梱外の文字を入力し、利用者が［取り寄せる］を押したとき | **利用者が入力した文字が URL に含まれる**。写真・位置情報は含まない | **事前同意**（設定で変更可） |
| **C10** | 上の CSS が指す woff2（実測 **9.2KB**） | **Google（fonts.gstatic.com）** | C9 の直後 | 含まない | C9 の同意に含まれる |
| **C11** | ホスティングのアクセス記録 | Cloudflare | C1〜C8 に付随 | IP・ブラウザ種別・取得ファイル名。**写真・位置情報・入力文字は含まれない** | 不要（技術的に避けられない） |
| **C12** | `heic2any`（gzip 330.6KB 実測） | 自ドメイン | HEIC を選び［変換して使う］を押したときだけ（動的 import） | 含まない | 不要 |

**C9 で送られるのは「同梱サブセットに無い文字だけ」である。**
`localCoverage`（同梱 ＋ 既に取り寄せた分）で除外するので、URL に載るのは `彅` のような
欠落文字のみであり、**タイトルや撮影地の本文は載らない。**

### 12.2 「発生しない」ことの担保（CSP）

| 発生しないもの | 担保の方法 |
|---|---|
| 写真データの送信 | 画像は `File` → `decode()` → Canvas のみ。`fetch` の body に Blob を載せるコードが存在しない。**CSP の `connect-src` で技術的に不能にする** |
| GPS 座標の送信 | 逆ジオコーディングは同梱データのみ。座標を引数に取る `fetch` が存在しない。同上 |
| アクセス解析（Google Analytics 等） | **導入しない** |
| エラー報告サービス（Sentry 等） | **導入しない**。不具合の情報は端末内に留め、利用者が自分でコピーして送る（§16.9） |
| 広告・トラッキングピクセル | 導入しない |
| 外部 CDN からのライブラリ読み込み | すべて自ドメインにバンドル。`unpkg` / `jsdelivr` への参照ゼロ |
| Cookie | 使わない。設定は localStorage（端末内） |

```
Content-Security-Policy:
  default-src 'self';
  img-src 'self' blob: data:;
  font-src 'self' https://fonts.gstatic.com data:;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  script-src 'self';
  connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'none';
  form-action 'none';
  frame-ancestors 'none';
```

**`connect-src` に写真を送れる宛先が存在しない。**
これは「送らない約束」ではなく **「送れない状態」** である。
万一の実装ミスやサプライチェーン攻撃でも、ブラウザが送信をブロックする。

- `font-src` に `data:` が要るのは、**縦書き SVG にフォントを埋め込む**ため（§6.2）。
- `style-src` の `'unsafe-inline'` は SVG 内の `<style>` に要る。`script-src` には付けない。
- 配信方法は §15.5（`public/_headers`）。**この CSP の実物を S8 の［技術的な詳細を見る］から
  見られるようにする。**

### 12.3 CSP が効いていることを CI で確かめる

CSP は「書いたつもり」で効いていないことが最も多い。§15.6 のデプロイ後スモークテストで、
`curl -sI https://<本番URL>/ | grep -i content-security-policy` が
`connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com` を含むことを
assert する。**含まなければデプロイを失敗扱いにする。**

### 12.4 通信ログ（同意を形骸化させないため）

```ts
// platform/net.ts — ★fetch を呼ぶ唯一の場所★（§1.3 の lint で強制）
export async function netFetch(url: string, init: RequestInit, meta: NetMeta): Promise<Response> {
  const res = await fetch(url, init);
  logNetwork({ at: new Date().toISOString(), host: new URL(url).host,
               kind: meta.kind, chars: meta.chars ?? null, bytes: +res.headers.get('content-length')! || 0 });
  return res;
}
```

記録は直近100件のリングバッファ。localStorage（約8KB）。**外部への送信機能はこの画面にも存在しない。**
**S8 の1セクション**として表示する（独立画面にはしない）:

> ## 送ったものの記録
>
> この端末から外部に送られたものの記録です。**この記録自体も、この端末の中だけにあります。**
>
> | 日時 | 送り先 | 送った内容 | 受け取ったもの |
> |---|---|---|---|
> | 9/21 14:32 | Google（fonts.googleapis.com） | 文字: **彅** | 書体 9.4KB |
> | 9/21 14:32 | Google（fonts.gstatic.com） | （なし） | 書体 9.4KB |
> | 9/20 18:05 | このアプリの配信元 | （なし） | 世界の地名データ 0.47MB |
> | 9/20 17:58 | このアプリの配信元 | （なし） | アプリ本体・書体・地名データ |
>
> ［記録を消す］　［取り寄せた書体を端末から消す］

### 12.5 和文取得の同意（唯一、利用者の入力が端末外に出る経路）

> 毎回聞くのは煩わしく、黙って送るのは裏切りである。
> **答えは「聞く回数を減らす」ことではなく「聞くコストを下げる」こと。**

**(1) 同意は3段階。既定は真ん中。両モード共通（§10.2 上限③）。**

| 段階 | 振る舞い |
|---|---|
| **送らない** | 取り寄せを一切しない。同梱外の文字は削除か別の字を促す。完全にオフライン動作 |
| **そのつど確認する（既定）** | 同梱外の文字を検出したら、**入力欄の直下に**確認バーを出す |
| **確認せずに取り寄せる** | 自動で取り寄せる。ただし**送信のたびにトーストで事後通知**し、記録に残る |

**(2) 確認はモーダルにしない。入力欄の直下に出す**（作業の流れの中で読まれる）。

```
│ Artist                               │
│ ┌─────────────────────────────────┐ │
│ │ 彅 優                            │ │
│ └─────────────────────────────────┘ │
│ ⓘ 「彅」は同梱の書体にありません。   │
│    取り寄せると、この1文字だけが      │
│    Google に送られます（約10KB）。    │
│    ［取り寄せる］［その字を消す］     │
│    ［くわしく］                       │
```

**(3) 送るものを、送る前に実物で見せる。**［くわしく］:

> **実際に送られる内容**
>
> ```
> GET https://fonts.googleapis.com/css2?family=Noto+Sans+JP&text=%E5%BD%85
> ```
>
> `%E5%BD%85` は「彅」という1文字を表したものです。
> **この1文字以外は何も送られません。** 写真も、名前の残りの部分（「 優」）も送られません。
>
> あわせて、インターネットの仕組み上、あなたの IP アドレスとブラウザの種類が Google に伝わります。
>
> ［取り寄せる］　［やめる］

**「送りません」と言い続けるなら、送るものは一字一句見せられなければならない。**

**(4) 「確認せずに取り寄せる」への昇格は、2回目の確認の場で提案する。**
3回目以降も、選ばない限り聞き続ける。**こちらから「聞かないようにしませんか」と誘導しない。**

**(5) 自動に昇格しても事後通知は必ず出す**（画面右下に3秒）:

> 「彅」を取り寄せました（Google・9.4KB）　［記録を見る］

**(6) デバウンスと重複排除**（`report-fonts.md` の「確定時に1回だけ叩く」に従う）:

```ts
// 入力中は送らない。blur / 600ms 停止 / 書き出し操作 でのみ判定する。
const localCoverage = new Set<number>(bundledCoverage);   // 取り寄せた分を足していく
function needFetch(text: string) { return uncovered(text, localCoverage); }
// 複数文字が不足していれば1回にまとめて送る（"彅髴" のように連結）
// 8秒でタイムアウト（AbortController）。オフラインは navigator.onLine で早期分岐するが、
// 判断は実際の fetch 結果で行う（onLine === true でも繋がらないことが多い）
```

**(7) 取り消しの動線**（S7 の「保存とプライバシー」に常設）:

> **日本語の珍しい文字の取り寄せ**
>
> ○ 送らない
> ● そのつど確認する
> ○ 確認せずに取り寄せる
>
> これまでに取り寄せた文字: **彅 髴**（2文字・合計 19KB）
>
> ［取り寄せた書体を端末から消す］　［送った記録を見る］

**取り消せることが同意を本物にする。**

**オフラインのとき**:

> ⓘ 「彅」は同梱の書体にありません。
>    **いまはオフラインのため取り寄せられません。**
>    ［その字を消す］　［別の字を入力する］　［接続できたら取り寄せる］

［接続できたら取り寄せる］は保留キューに入り、`online` イベントで再確認（同意設定に従う）。
保留中は入力欄に `⏳ 「彅」は接続できたら取り寄せます（いまは仮の表示です）`。
書き出し時は Preflight が `coverage` で block する。

### 12.6 利用者向け説明の文面（S8。初回起動時に1回だけ自動表示）

> # このアプリが通信すること
>
> ## 写真は、どこにも送っていません
>
> あなたが選んだ写真は、**あなたの端末の中だけ**で処理されます。
> フレームを付ける計算も、撮影情報の読み取りも、書き出しも、すべてこのブラウザの中で行われます。
> 写真がインターネットに出ていくことは **一度もありません**。
>
> でも、「写真を送らない」と言うだけでは不十分だと考えています。
> **では何が通信しているのか**を、ここに全部書きます。
>
> ---
>
> ## 1. アプリを開いたとき（自動）
>
> アプリの本体・書体・地名データを、このアプリの配信元から受け取ります。
> **受け取るだけで、こちらから何かを送ることはありません。**
>
> | 受け取るもの | 大きさ |
> |---|---|
> | アプリ本体 | 約 250KB |
> | 欧文の書体 8種類 | 約 255KB |
> | 日本の市区町村の位置データ | 約 33KB（圧縮した状態） |
>
> 日本語の書体（約 442KB）は、**日本語の書体を選んだときにだけ**受け取ります。
> 欧文だけで使う方には 1KB も転送しません。
>
> 一度受け取れば端末に保存されるので、**2回目からは通信なしで開けます**（飛行機の中でも使えます）。
>
> ---
>
> ## 2. アプリが新しくなっていないか確かめるとき（自動）
>
> アプリを開いたときと、開いたまま6時間ごとに、**「新しい版が出ていないか」を配信元に
> 問い合わせます**（数百バイト）。新しい版があれば画面の下にお知らせを出します。
> 勝手に更新することはありません。
>
> ---
>
> ## 3. 日本語の珍しい文字を使うとき（**確認してから**）
>
> **ここだけは、あなたが入力した文字が外部に送られます。** 正直に書きます。
>
> このアプリには、よく使う日本語の文字（ひらがな・カタカナ・第一水準の漢字・記号・
> 人名でよく使う異体字）を 3,476字 あらかじめ入れてあります。
> でも、それに入りきらない珍しい字もあります（全部入れると 5MB になり、開くのが
> 遅くなってしまいます）。
>
> そういう文字を入力したとき、その字を表示できる書体を **Google のサーバーから
> 取り寄せる**ことができます。このとき、
>
> - **送られるもの**: その文字だけ（例: `彅`）
> - **送られないもの**: 写真、撮影場所、その他の入力内容、あなたが誰か
> - **送り先**: Google（fonts.googleapis.com）
>
> ただし、Google 側には **あなたの IP アドレスとブラウザの種類** が伝わります。
> これはインターネットの仕組み上、避けられません。
>
> **取り寄せるかどうかは、そのつど確認します。** 確認なしに送ることはありません。
> 「もう聞かなくていい」を選ぶこともできますが、その場合も **［送ったものの記録］** で
> いつ何を送ったか確認できますし、いつでも取り消せます。
>
> ---
>
> ## 4. 海外で撮った写真の地名を出すとき（**確認してから**）
>
> 日本国内の地名データは最初から入っています。海外の地名データ（約 0.5MB）は、
> 必要になったときに**このアプリの配信元から**取り寄せます。
>
> このときも **写真や撮影場所の座標は送りません。** 地名の一覧を受け取るだけです。
> 撮影場所を調べる計算は、受け取ったデータを使って端末の中で行います。
>
> ---
>
> ## 5. どうしても残ってしまう記録について
>
> このアプリは Cloudflare というサービスで配信されています。
> インターネットの仕組み上、**アプリを開いたときに以下が配信元に記録されます。**
>
> - あなたの IP アドレス ／ ブラウザの種類とバージョン ／ どのファイルを受け取ったか ／ 受け取った日時
>
> これは、どんなウェブサイトを開いても記録されるものと同じです。
> **写真も、撮影場所も、入力した文字も、ここには含まれません。**
>
> このアプリは、アクセス解析ツール（Google Analytics など）も、エラー報告ツールも入れていません。
>
> ---
>
> ## 6. 保存した設定について
>
> フレームの設定・プリセット・モードの選択は、**あなたの端末の中だけ**に保存されます。
> サーバーには送られません。アカウントもありません。
> ブラウザの履歴を消すと、これらも一緒に消えます。
>
> **写真そのものは保存していません。** アプリを閉じると、選んだ写真は端末から消えます
> （もとの写真アプリの中には、もちろん残ります）。
>
> ---
>
> ［送ったものの記録を見る］　［技術的な詳細を見る］　［設定を変える］

### 12.7 オフラインで何ができて、何ができないか（S8 の1セクション）

| 機能 | オフライン |
|---|---|
| アプリの起動（2回目以降） | **できる** |
| 写真の選択・EXIF 読み取り | **できる** |
| 15種すべてのスタイル / 組み / 地色 | **できる** |
| 欧文8書体 | **できる**（同梱・プリキャッシュ） |
| 和文（同梱サブセット 3,476字 内の文字） | **できる**（一度ロードしていれば） |
| 和文（同梱外の文字） | できない |
| 縦書き | **できる**（同梱サブセット内の文字なら） |
| グレイン・質感 | **できる** |
| 撮影地（日本） | **できる**（33KB 同梱） |
| 撮影地（海外） | 取得済みならできる |
| 書き出し・EXIF 再注入・ZIP 保存 | **できる** |
| アプリの更新 | できない（オンライン復帰時に自動確認） |

---

## 13. 状態管理と保存

> 出典: zustand と4ストア分割・メモリ分離は案C §7。スコープ境界は審査 §5-3 が新たに確定。
> 保存先（localStorage ＋ Cache Storage、IndexedDB 不採用）は審査 §5-4。
> レシピ URL と設定の3段記憶は案A §7-3。

### 13.1 zustand（+ immer）で4ストア

```ts
export interface DocState {                 // 編集中の「文書」（＝Scene の元）。全写真に共通
  readonly styleId: StyleId;
  readonly layout: { align: Align; tracking: TrackingId; size: SizeId };
  readonly color: { border: 'Standard' | 'Bordered'; bg: BgColorId };
  readonly font: { family: FontFamilyId; verticalJa: boolean };
  readonly texture: TextureSettings;
  readonly format: FormatOptions;           // 日付書式・区切り・露出/焦点/撮影地の ON/OFF
  readonly infoDefaults: { title: string; artist: string };    // 全写真共通の既定
  readonly overrides: Map<PhotoId, InfoOverrides>;             // 写真ごとの上書き
}

export interface PhotoEntry {               // 写真1枚ぶんの「事実」
  readonly id: PhotoId;
  readonly fileRef: FileRef;                // 原本への参照（Blob は保持しない）
  readonly naturalSize: { w: number; h: number };   // ★Orientation 適用後★（§16.5）
  readonly exif: ExifFacts | undefined;
  readonly geo: GeoHit | null;
  readonly place: string | null;            // 粒度を適用した表示文字列
  readonly overlayLuma: number | null;      // §4.6 の L_photo
}

export interface LibraryState {             // アプリ横断・永続化対象
  readonly mode: 'kodawaru' | 'otegaru';
  readonly defaults: Partial<DocState>;
  readonly lastUsed: Partial<DocState> | null;
  readonly presets: readonly { id: string; name: string; camera: string; lens: string }[];  // ≤50
  readonly exportPref: { longEdge: 4096 | 'original'; quality: 0.92; keepExif: boolean; keepGps: false };
  readonly consent: { jpFont: 'never' | 'ask' | 'always' };
  readonly caps: CapabilityReport | null;
}

export interface BatchState {
  readonly queue: readonly { photoId: PhotoId; status: 'queued'|'running'|'done'|'failed'; name: string }[];
  readonly progress: { done: number; total: number; msPerItem: number[] };
}

export interface UiState {
  readonly activeTab: 'style' | 'layout' | 'color' | 'font' | 'info';
  readonly sheet: SheetId | null;
  readonly currentPhoto: PhotoId | null;
}
```

ストアは `useDoc` / `usePhotos` / `useLibrary` / `useBatch` + `useUi` の4本。
**`useLibrary` だけが永続化される。**

**なぜ zustand か**: React の外から `store.subscribe` で canvas を駆動でき、
ドラッグ中に**ツリーの再レンダーを一切起こさずに 60fps でプレビューを更新できる**（§9.4）。
Context だとツリー全体が再レンダーされる。gzip 約1KB でバンドル予算にも収まる。

### 13.2 設定のスコープ境界（審査が確定させたもの）

| データ | スコープ | 根拠 |
|---|---|---|
| `styleId` / `layout` / `color` / `font` / `texture` / `format` | **DocState（全写真に共通）** | 「設定はストリップの全員に即座に効く」。1枚目で詰めた設定を30枚に当てるのが実際の使われ方 |
| `exif` / `geo` / `naturalSize` / `overlayLuma` | **PhotoEntry（写真ごとの事実）** | 共有しようがない |
| `title` / `artist` | **DocState の既定 ＋ 写真ごとの上書き** | 「30枚に同じタイトル」が既定で得られる |
| `camera` / `lens` / `date` / `place` の上書き | **写真ごと**（プリセット適用時のみ「全部に適用」を明示的に選べる） | カメラが違う写真が混ざるため |
| EXIF欠落の帯を閉じた・情報トグルを全 OFF にした | **写真ごと**（`overrides: Map<PhotoId, InfoOverrides>`） | 「この写真だけの設定にする（他の写真に波及させない）」 |

### 13.3 保存先

| データ | 場所 | 量 |
|---|---|---|
| モード / 既定値 / lastUsed / プリセット(≤50) / 能力測定結果 / 同意設定 / 通信ログ(100件) / エラーログ(20件) | **localStorage**（`safeStorage` 経由） | 合計約 30KB |
| アプリ本体・欧文8書体・日本の地名データ・アイコン | **Cache Storage**（SW でプリキャッシュ） | 約 1MB |
| 和文 Regular / 世界地名データ / 取り寄せた和文サブセット / heic2any | **Cache Storage**（ランタイム） | 442.4KB / 986.4KB / 約10KB ずつ / 330KB |
| **写真そのもの・書き出した画像** | **保存しない** | — |

**IndexedDB は使わない。** 決定打は**同期性**である。localStorage は起動時に同期で読めるので
**最初の1フレームが確定した設定で描かれる**。IndexedDB は非同期なので「設定が読めるまでの一瞬」を
既定値で描いてから差し替えることになり、**S0 の設定値一覧が必ずちらつく。**
加えて扱う量が 30KB で 5MB 枠に余裕があり、バイナリは Cache Storage が適任。
**使う仕組みを減らすことが、壊れる経路を減らすこと。**

**写真を保存しない理由**:

1. **プライバシー。** 端末を共有する人が同じブラウザで開けば見えてしまう。
   「あの人の端末で開いたら前の写真が出てきた」は起きてはならない。
2. **容量。** 6000×4000 のデコード後は 100MB。Cache Storage の quota を押し上げ、
   **アプリ本体のキャッシュが evict される**リスクがある。オフライン動作と正面衝突する。
3. 保存する以上「削除」機能が要り、「本当に消えたのか」という不安を背負わせる。
4. **写真は既に写真アプリの中にある。**

代償の埋め方は §9.6 の復帰文面（「設定はすべて残っています」を最初に伝える）。

### 13.4 キーとスキーマ

```
flame:v1:settings   { mode, defaults, lastUsed, exportPref, consent }
flame:v1:presets    [{ id, name, camera, lens }]         最大50件
flame:v1:caps       CapabilityReport                      §16.10
flame:v1:netlog     LogEntry[]                            リング100件
flame:v1:errlog     LogEntry[]                            リング20件
flame:v1:flags      { modeSuggestShown, privacyShown, ... }
```

- **キーに版を含める**（`flame:v1:`）。読み込みは必ず zod 検証（§11.6）。
- 壊れていたら `flame:v1:settings.broken` に退避して既定値で起動。**起動不能を絶対に作らない。**
- `sessionStorage` は `flame:heavy`（強制終了の検知）と `flame:chunkReload`（§15.3）のみ。

### 13.5 書き出しがストアの購読につながっていないこと

```ts
/** 書き出しの唯一の入口。UI の「書き出す」ボタンと一括処理からしか呼ばれない */
export async function exportImage(doc: DocState, photo: PhotoEntry, pref: ExportPref): Promise<Blob> {
  const scene = buildScene(toSceneInput(doc, photo));     // ★プレビューと同じ関数・同じ引数★
  const target = makeExportTarget(scene, pref.longEdge, photo.naturalSize);
  return renderInWorker(scene, target, photo.fileRef, pref);
}
```

`exportImage` はストアの購読に一切つながっていない。**設定変更で走りようがない。**
設定変更で動くのはプレビュー（最大 350万px）だけ。

`pref.longEdge` を変えると `kExport` が変わるので、`PreviewDriver` は
**グレインタイルのキーが変わったことを検知して再描画する**（§5.2）。

### 13.6 設定の記憶3段（何もしなくても最良の結果になる）

**1段目（既定・無操作）: 自動で覚える。**
書き出しが成功した瞬間、そのときの設定一式を `lastUsed` として保存する。
次回 S3 を開いたときの初期値になり、**S0 の設定値一覧が常にその中身を映している。**
S6 で初回のみ1回だけ `この設定は次回も使われます` と伝える。

**2段目（明示）: 初期値として固定する。**
S6 の折りたたみに `［この設定を初期値にする］`。`defaults` に書き込まれ、
S7 の `［このモードの標準に戻す］` を押すまで上書きされない。

**3段目（持ち出し）: レシピ URL。**
S7 の最下部に `［設定を書き出す］` / `［設定を読み込む］`。
設定一式を JSON → Base64URL にして **URL のフラグメント**に載せる（`/#r=eyJzdHlsZ...`）。

- **写真は一切含まない。フラグメントはサーバーに届かない**（HTTP リクエストラインに載らない）ので
  原則①を犯さない。**Web にしかない機能。**
- 機種変更、PC とスマホの併用、「この設定で撮ってきて」の指示に効く。
- 読み込み時は必ず確認を出し、**現在の設定との差分を行単位で見せる**
  （`スタイル OR2 → SQ3` のように変わる行だけ列挙）。他人の URL で黙って設定が変わるのを防ぐ。

### 13.7 PWA（`manifest.webmanifest`）

```json
{
  "name": "flame", "short_name": "flame", "start_url": "/", "display": "standalone",
  "background_color": "#EDEAE6", "theme_color": "#EDEAE6",
  "share_target": {
    "action": "/edit", "method": "POST", "enctype": "multipart/form-data",
    "params": { "files": [{ "name": "photo", "accept": ["image/jpeg", "image/png"] }] }
  },
  "file_handlers": [{ "action": "/edit", "accept": { "image/jpeg": [".jpg", ".jpeg"] } }]
}
```

Android では**写真アプリの共有シートに flame が出る**。
`写真アプリ → 共有 → flame → 編集 → 共有 → 写真アプリ` の往復が閉じる。
iOS は未対応だが、対応した時点で自動的に効く（マニフェストに数行）。

---

## 14. テスト戦略

> 出典: 4層構成・パリティテスト・プロパティテスト・免責マスクは案C §6。
> グレイン強度比の閾値は審査 §4-C-x2 で 0.90〜1.10 に引き上げ。
> 罠の回帰テストは案B §6.5 ＋ 新しい3つの実測レポート。

### 14.1 4層構成

| 層 | 何を守るか | 実行環境 | 速度 | CI |
|---|---|---|---|---|
| **L1** 純粋ロジックの単体テスト | 組版・欠損処理・色・幾何・整形 | Vitest (node) | 数ms/件 | 毎push |
| **L2** Scene スナップショット | レイアウトの回帰 | Vitest (node) | 数ms/件 | 毎push |
| **L3** ゴールデン画像 | 描画そのものの回帰 | Playwright + Chromium固定版 | 数百ms/件 | 毎push |
| **L4** プレビュー／書き出し一致 | **原則②** | Playwright + pixelmatch | 1〜2s/件 | 毎push（15件）＋夜間（全数） |

加えて**構造テスト**（§1.3 の dependency-cruiser と ESLint）を毎 push で回す。
**構造テストが落ちたらマージできない。**

### 14.2 L1 / L2（ブラウザなしで回る）

`buildScene` が純粋関数なので、以下はブラウザも canvas も無しで回る。

- **キャプション組み立ての総当たり**: 8フィールド × {有り, 無し} の **256通り**を回し、
  (a) 区切り文字が連続しない (b) 先頭・末尾に区切りが残らない (c) 全欠損時に行が消える、
  を検証。**EXIF が取れない画像が必ず来るという前提を、網羅テストで潰す。**
- **プロパティテスト（fast-check）**: 任意の `FieldValues` × 15スタイル × 3サイズ × 4字間 ×
  3整列 に対して4つの不変条件を主張する。
  1. 写真矩形がキャンバス内に完全に収まる
  2. `overlay-bottom` 以外でキャプション矩形と写真矩形が交差しない
  3. キャプションの各行が `captionBox.w` を超えない（§4.5 のはしご適用後）
  4. `canvas.heightLu` が有限かつ正
- **`fitLines` の収束**: 任意の入力で `buildScene` が `resolveLayout` を**2回以下**しか
  呼ばないこと（スパイで数える）。
- **スケール不変性の代数的検証**: `scaleScene(scene, k)` を core に置き、すべての
  `ScaleInvariant` op の座標が正確に `k` 倍になることを許容 1e-9 で検証。
  **実行層のバグではなくモデルの整合性を守る。**
- **インク選択**: 9色 ＋ 境界 `L = INK_CROSSOVER ± 1e-6` のテーブルテスト。
  `mutedInk` がランダム 10,000 色で常に `contrastRatio ≥ 3.0` を満たすこと。
- **整形**: `report-exif.md` の実測値を期待値として固定
  （`0.008333333333333333 → "1/120s"`、`0.004 → "1/250s"`、
  `"FUJIFILM"+"X-M5" → "FUJIFILM X-M5"`、`"Apple"+"iPhone 16 Pro" → "iPhone 16 Pro"`）。
- **日付の壁時計**: `"2026:09:20 17:42:11"` を TZ を変えて（UTC / Asia/Tokyo / America/New_York）
  パースし、**常に 2026.09.20 になる**こと。
- **`sanitize`**: BiDi 制御 `‮` が除去されること、ZWJ `‍` が**除去されない**こと、
  `𠮷` が 1 書記素、`が`（結合）が 1 書記素と数えられること。
- **Scene スナップショット**: 15スタイル × 3入力（フルEXIF / EXIF皆無 / 極端に長いレンズ名）
  ＝ **45本の JSON ゴールデン**。差分が `ops[7].anchor.y: 912 → 934` と読める形で出る。

### 14.3 L3 ゴールデン画像

- 15スタイル × 代表1設定を**幅 512px** で描き、PNG を `tests/golden/` に commit（約1.2MB）。
- 閾値は**差分率 ≤ 0.02%**（ほぼ厳密）。Chromium のバージョンを `package.json` で固定し、
  更新時は意図的に再生成して差分を人がレビューする。
- 役割は「色・合成モード・質感の有無」といった **JSON では見えない部分の番人**。
  レイアウトの回帰は L2 のほうが早く正確に出る。

### 14.4 L4 パリティテスト（本丸）

```ts
// tests/parity/parity.spec.ts
for (const styleId of ALL_STYLE_IDS) {
  test(`parity: ${styleId}`, async ({ page }) => {
    const scene = buildScene(fixtureInput(styleId));                    // 1つの Scene
    const kExport = 4096 / scene.canvas.widthLu * aspectFactor(scene);
    const prev = await renderInPage(page, scene, target(scene,  800, 'preview', kExport));
    const exp  = await renderInPage(page, scene, target(scene, 4096, 'export',  kExport));
    const down = await downscaleTo(page, exp, prev.width, prev.height); // ★1箇所に固定★
    const mask = maskFrom(scene.meta.exactnessExempt, scene, prev.width);
    const r = compare(prev, down, mask);                                // pixelmatch threshold 0.1
    expect(r.strictDiffRatio).toBeLessThanOrEqual(0.0002);
    expect(r.overallDiffRatio).toBeLessThanOrEqual(0.0040);
    expect(r.meanChannelDiff).toBeLessThanOrEqual(0.60);
    expect(r.maxChannelDiffOutsideMask).toBeLessThanOrEqual(8);
  });
}
```

**基準画像は「別解像度で描いた自分自身」であって、commit された画像ではない。**
これが L3 との決定的な違いで、ブラウザ更新やフォント更新に影響されずに
「一致しているか」だけを問える。

**合格ライン**

| 指標 | 閾値 | 根拠 |
|---|---:|---|
| 免責領域（文字・縦組み・ヘアライン・グレイン）を除いた差分率 | **≤ 0.02%** | **実測**で写真・背景・罫線は差分ゼロだった。ほぼゼロを要求する |
| 全体の差分率（pixelmatch threshold 0.1） | **≤ 0.40%** | **実測** 0.159%。約2.5倍の余裕。超えたら文字以外が壊れている |
| 平均チャンネル差 | **≤ 0.60 / 255** | **実測** 0.28。2倍強 |
| 免責領域外の最大チャンネル差 | **≤ 8 / 255** | **実測**の最大差 141 はすべて文字の輪郭だった |
| 文字領域だけの差分率 | **記録のみ**（失格にしない） | **実測** 1.24%。トレンドとして CI に記録し、急増したら人が見る |
| **グレイン強度比** `avgLag1Diff(down) / avgLag1Diff(prev)` | **0.90 〜 1.10** | **実測** 0.977〜0.986（`report-grain.md`）。0.55 を通す閾値では方式の退行を検出できない |

**免責マスクを Scene から作れることが、この設計の最大の実利。**
「文字の輪郭は一致しない」という物理的事実を、**テストの甘い閾値でごまかすのではなく、
領域として切り分けて、それ以外は厳密一致を要求する。** 曖昧さが1箇所に閉じる。

**縮小の再現性**: `down` の作り方は1箇所に固定する
（`ctx.imageSmoothingQuality='high'` の**1段縮小**。多段縮小やブラウザの `<img>` 縮小は使わない）。
比較の前提条件が揺れると閾値の意味がなくなるので、ヘルパーを1本だけ用意し、
**それ以外の縮小をテストコードに書くことを lint で禁止する。**

**マトリクス**

| いつ | ケース数 | 内容 | 所要 |
|---|---:|---|---|
| 毎 push | 15 | 15スタイル × 既定設定 × 4096 | 約25秒 |
| 夜間 | 240 | 15 × {Small/Large} × {Left/Right} × {White/Onyx} × {質感 on/off} | 約8分 |
| 夜間 | +2 | 1ケースを 6000px 原寸で（面積ガードとメモリの実地確認）／縦組み1ケース | |

**毎 push の15件は、デプロイの門とする**（§15.6）。夜間の全数は門にしない（落ちたら Issue）。

### 14.5 PoC で見つかった罠の回帰テスト（1つでも欠けたら退行する）

| 罠 | 出典 | テスト |
|---|---|---|
| キャンバス面積上限の「黙って失敗」 | `report-canvas.md` Part2 | `createVerifiedCanvas(16385, 16384)` が `{ok:false, reason:'area'}` を返し、`(16384,16384)` は `ok:true` を返すこと |
| 右下だけ確保されないケース | 同上 | `probe(w-1,h-1)` を無効化したモックで `reason:'verify'` になること |
| フォント待ちの取りこぼし | `report-fonts.md` §4 | `renderScene` が `LoadedFontSet` なしで呼べないこと（`@ts-expect-error` の型テスト）＋ `loadFonts` 前後で `measureText` の幅が変わることを実測して記録 |
| **縦書き SVG のフォント欠落** | `report-svg-font.md` | `font-family` を外した版と画素が**一致しない**こと（`diff > 0.01`）。一致したら失敗。**これが `report-svg-font.md` の A vs C（相違0画素）の裏返し** |
| **和文サブセットのサイズ膨張** | `report-jp-subset.md` | `verify-assets.mjs` が和文 Regular **≤ 700KB**（実測 442.4KB）で落とすこと。`wght` 固定を忘れると 1,043KB になる（§15.4） |
| **グレインの解像度依存** | `report-grain.md` | L4 の強度比 0.90〜1.10。加えて `GrainOp` に `cellPx` のような物理px フィールドが存在しないことを型で保証 |
| `buildScene` が k を取らない | 本仕様 §2.1 | `buildScene` の引数型に `RenderTarget` / `k` / `dpr` が現れないことの型テスト |
| フル解像度の同時保持 | `report-geo-batch.md` B-1 | 一括処理10枚を回し、`PhotoStore` の live handle 数が常に **≤ 2** であること |
| 連続 `<a download>` のブロック | 同 B-4 | 一括保存が `<a download>` を**11回以上呼ばない**こと（`platform/save.ts` のモック） |
| letterSpacing の比例 | `report-canvas.md` | k=0.8 と k=6 で `measuredWidthLu` が同一であること（core が測り直さないので自明だが、退行検知として置く） |
| Orientation の一致 | `report-exif.md` §4 | `decode(file, {resizeWidth:800})` と `decode(file)` の**アスペクト比が一致**すること（Orientation=6 の画像で） |
| 豆腐の焼き込み | `report-jp-subset.md` ／ 同梱実測 | `uncovered('彅', bundledCoverage)` が `['彅']`、`uncovered('髙﨑德濵齋邊', ...)` が **`[]`** であること（同梱済みの確認） |
| EXIF 再注入の読み戻し | `report-canvas.md` Part3 | 注入後に `piexif.load` で Model が一致すること。GPS が**含まれない**こと |

### 14.6 テスト用フィクスチャ

`tests/fixtures/` に PoC と同じ4枚を置く（生成スクリプトも含める）:
`mirrorless_landscape.jpg`（6000×4000・FUJIFILM X-M5・GPS あり）／
`iphone_portrait.jpg`（3024×4032・Orientation=1）／`no_exif.jpg`／
`rotated_orient6.jpg`（4000×3000・Orientation=6）。
キャプションの基準文字列は参考素材そのもの:
`Untitled, 2026.09.20, FUJIFILM X-M5, SIGMA 18-50mm F2.8 DC DN | Contemporary 021`。

---

## 15. ビルドと公開

> 出典: `BUILD_INFO` / `version.json` / SW 更新戦略は案B §4.3/§6.1。
> CI/CD・CSP の配信方法・和文サブセットのビルドは本仕様で新規確定（審査 §6-3/§6-4 の欠落）。

### 15.1 版番号の埋め込み

```ts
// vite.config.ts
import { execSync } from 'node:child_process';

const commit    = execSync('git rev-parse --short HEAD').toString().trim();
const dirty     = execSync('git status --porcelain').toString().trim().length > 0;
const buildTime = new Date().toISOString();
const version   = process.env.npm_package_version;

export default defineConfig({
  define: {
    __BUILD__: JSON.stringify({
      version, commit, dirty, buildTime,
      fontSetVersion: FONT_SET_VER,     // 同梱書体の版（例 'fontset-2026.09'）
      geoDataVersion: GEO_DATA_VER,     // 地名データの版（例 'geo-2026.08'）
    }),
  },
});
```

```ts
// src/build-info.ts
export const BUILD_INFO = __BUILD__ as {
  version: string; commit: string; dirty: boolean; buildTime: string;
  fontSetVersion: string; geoDataVersion: string;
};
```

**同梱データの版を別管理する理由**: 地名データや書体だけを差し替えたとき、
アプリの version が変わらないと「なぜ地名が変わったのか」が追えなくなる。

**出口は3つ**: ①画面右下の小さな `v1.3.0`（タップで自己診断へ。更新があれば `v1.3.0 ●`）
②書き出した画像の EXIF `Software = flame 1.3.0 (a4f2c9e)`
③自己診断のレポート。**②のおかげで、送られてきた画像1枚から版が分かる。**

### 15.2 `version.json`

```js
// scripts/gen-version.mjs — vite.config.ts と同じ値から生成する（これが重要）
import { writeFileSync } from 'node:fs';
writeFileSync('dist/version.json', JSON.stringify({
  version: process.env.npm_package_version,
  commit: process.env.GITHUB_SHA?.slice(0, 7),
  buildTime: new Date().toISOString(),
}));
```

**同じソースから出ることが重要で、「走っているコードの版」と「配信されている版」を
確実に比較できる。**

### 15.3 Service Worker の更新戦略（3つの経路を全部塞ぐ）

**`skipWaiting` を自動で呼ばない。** 書き出し中にコードが差し替わると壊れた画像が出る。

```ts
// platform/sw-update.ts
const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

reg.addEventListener('updatefound', () => {
  const sw = reg.installing;
  sw?.addEventListener('statechange', () => {
    if (sw.state === 'installed' && navigator.serviceWorker.controller) {
      showUpdateBanner(async () => {
        if (isBusy()) { toast('書き出しが終わってから更新します'); await waitIdle(); }
        sw.postMessage({ type: 'SKIP_WAITING' });
      });
    }
  });
});

let reloading = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (reloading) return; reloading = true;
  location.reload();
});
```

| 経路 | 対処 |
|---|---|
| 新しい SW が waiting のまま | 利用者の操作でのみ切り替える。ただし「操作できること」を必ず見せる（バナーは消えない） |
| ブラウザが `sw.js` の更新確認をしない | ①`updateViaCache:'none'` ②配信側で `sw.js` に `Cache-Control: no-cache, max-age=0` ③**起動時と6時間ごとに `reg.update()` を明示的に呼ぶ**（24時間周期に任せない） |
| SW の仕組みそのものが壊れている | **SW に依存しない検知経路**: `version.json` を `cache:'no-store'` で起動時＋6時間ごと＋`visibilitychange` で取得し、`BUILD_INFO.version` と比較 |
| 版の混在によるチャンク404 | `safeImport` で**1回限りの自動リロード**（下記） |

```ts
export async function safeImport<T>(loader: () => Promise<T>, label: string): Promise<T> {
  try { return await loader(); }
  catch (e) {
    if (!sessionStorage.getItem('flame:chunkReload')) {     // ★ループ防止★
      sessionStorage.setItem('flame:chunkReload', label);
      await reinstallCachesOnly();
      location.reload();
      return new Promise(() => {});
    }
    throw new ChunkLoadError(label);
  }
}
```

**キャッシュ戦略**

| 区分 | 内容 | 戦略 |
|---|---|---|
| プリキャッシュ（install 時） | `index.html` / JS・CSS チャンク（版付きURL）/ 欧文8書体 255.3KB / `fonts/manifest.json` / `coverage-jp.json` / 日本の地名データ 91.3KB / `licenses/*.txt` / アイコン / manifest（計 約1MB） | Cache First |
| ランタイムキャッシュ | 和文 Regular / 世界の地名データ / 取り寄せた和文サブセット / `heic2any` | Cache First（取得時に明示的に put） |
| ナビゲーション要求 | `index.html` | Network First（3秒タイムアウト → Cache） |
| キャッシュしない | `version.json` | Network Only（`Cache-Control: no-store`） |
| SW が触らない | `fonts.googleapis.com` / `fonts.gstatic.com` | fetch ハンドラで素通し。取得結果はアプリ側が明示的に put（SW が握ると同意の記録と実際の通信がずれる） |

**更新の文面**

```
┌──────────────────────────────────────────────┐
│ 新しい版があります（v1.4.0）  ［今すぐ更新］ ［あとで］ │
└──────────────────────────────────────────────┘
```

［あとで］を押しても**版番号バッジが `v1.3.0 ●` と点灯したまま残る。消えない。**

SW が壊れている疑い（`version.json` だけが新しい）:

> **アプリが古いままになっています**
>
> 配信元には **v1.4.0** がありますが、この端末では **v1.3.0** が動いています。
> 通常の更新がうまくいっていないようです。
>
> ［アプリを入れ直す］　［あとで］
>
> ※［アプリを入れ直す］を押すと、保存された部品をすべて削除して取り直します。
> 　**設定とプリセットは消えません。** 少し通信します（約1MB）。

### 15.4 同梱アセットのビルドと検査（審査 §6-4 の欠落への回答）

**決定: 生成物（woff2 と JSON）をリポジトリにコミットする。CI では生成しない。
ただし「サイズが正しいこと」は `npm run build` の先頭で必ず検査する。**

理由: フォント生成には Python 3 + fonttools + brotli が要り、地名生成には 52MB の取得が要る。
CI にこれを足すとビルド時間と失敗経路が増える。生成物は合計約1.8MB で、変更頻度は
年に1回あるかどうか。**現物は既にコミット済みである**（`public/fonts` / `public/geo` /
`public/licenses`、および `docs/assets.md`）。

```bash
npm run assets:fonts    # scripts/build_fonts.py   Python 3 ＋ pip install fonttools brotli
npm run assets:geo      # scripts/build-geo.mjs    Node のみ（52MB を取得する）
npm run assets:verify   # scripts/verify-assets.mjs ★npm run build の先頭で必ず走る★
```

**フォント生成が機械的に潰している2つの罠**（`docs/assets.md`）

1. **可変フォントのまま `pyftsubset` にかけると全ウェイトのデータが残る。**
   和文で 442KB → 1,043KB（**2.3倍**。実測 `report-jp-subset.md`）。動作はするので気づけない。
   `fontTools.varLib.instancer` で `wght` を固定してからサブセットする。
2. **「山﨑」「髙橋」の 﨑・髙 は JIS X 0208 の外**にあり、素直にサブセットすると欠落する。
   姓として頻出するので異体字を明示的に足し、**ビルドの最後に cmap を見て収録を確認する。**

縦書き（§6）に要る OpenType feature（`vert` / `vrt2` / `vkrn`）を落とさないこと。

**検査（`scripts/verify-assets.mjs`。現物の実装に合わせる）**

| 検査 | 上限・条件 | 何を防ぐか |
|---|---|---|
| 1書体1ウェイト | ≤ 60KB | サブセットが効いていない |
| 欧文8書体 合計 | ≤ 400KB（実測 255.3KB） | 同上 |
| 和文 Regular | ≤ 700KB（実測 442.4KB） | **`wght` 固定忘れ（1,043KB になる）** |
| 和文の収録文字数 | ≥ 3,400字（実測 3,476字） | 第一水準が入っていない |
| **和文 Bold の不在** | `manifest.jp.bold` が無いこと | §4.7 の決定が静かに覆るのを防ぐ |
| manifest とファイルサイズの一致 | 完全一致 | 生成と manifest のずれ |
| 地名（日本 / 世界） | ≤ 120KB / ≤ 2,400KB（実測 91.3KB / 986.4KB） | 桁の取り違え |
| ライセンス本文 9件 | 存在し ≥ 1,000 バイト | OFL の再配布条件（§16.2） |

**この検査に追加するもの（実装時）**

```ts
// ① 和文のカバレッジ区間列（§11.4 が実行時に使う。現物の manifest には無い）
//    build_fonts.py の cmap 読み出しから public/fonts/coverage-jp.json を書き出し、
//    verify-assets.mjs で「manifest.jp.charCount と ranges の総数が一致すること」を検査する。
// ② 収録の回帰テスト（tests/unit/build/jp-coverage.test.ts）
test('同梱サブセットの収録文字', () => {
  const cov = loadCoverage('public/fonts/coverage-jp.json');
  const has = (t: string) => [...t].every(c => cov.has(c.codePointAt(0)!));
  expect(has('夕焼けの街並みにて撮影')).toBe(true);
  expect(has('富士フイルム')).toBe(true);
  expect(has('広島県廿日市市')).toBe(true);
  expect(has('2026年9月20日')).toBe(true);
  expect(has('髙﨑德濵齋邊')).toBe(true);       // ★人名の異体字★
  expect(has('々〆〇')).toBe(true);
  expect(cov.count).toBeGreaterThanOrEqual(3400);
});
```

**再現性の担保**: 文字集合は **JIS X 0208 の区点を ISO-2022-JP でデコードして**起こす
（外部の漢字リストもネットワークも不要）。同じスクリプトを回せば必ず同じ 3,476字が出る。
原本フォントの取得元と版は `fontSetVersion`（例 `fontset-2026.09`）に反映する。

**既知の不整合（実装初日に直すこと）**: `package.json` の `assets:fonts` は
`node scripts/build-fonts.mjs` を指しているが、実体は `scripts/build_fonts.py` である。
`python3 scripts/build_fonts.py` に直す。**`npm run assets:verify` は正しく動く**ので、
検査そのものは機能している。

### 15.5 CSP の配信方法（審査 §6-3 の未決事項への回答）

**決定: Cloudflare Workers の Static Assets ＋ `public/_headers` で付ける。Worker のコードは書かない。**

```
# public/_headers
/*
  Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:; font-src 'self' https://fonts.gstatic.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Permissions-Policy: geolocation=(), camera=(), microphone=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin

/sw.js
  Cache-Control: no-cache, max-age=0

/version.json
  Cache-Control: no-store

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

理由: Worker のコードを書くと、**CSP を付ける責任がアプリのコードに移る**。
`_headers` は静的ファイルなので、アプリのバグで CSP が外れることがない。
`Referrer-Policy: no-referrer` は、Google Fonts へのリクエストにこのアプリの URL を
載せないため（§12 の「送るものを最小にする」の一部）。

**効いていることの検証は §12.3（デプロイ後のスモークテスト）。**

### 15.6 GitHub Actions（push で自動デプロイ。手動デプロイで終わらせない）

```yaml
# .github/workflows/deploy.yml
name: build-test-deploy
on:
  push: { branches: [main] }
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: 構造検査（原則③をここで守る）
        run: |
          npx depcruise --config .dependency-cruiser.cjs src
          npx eslint src
          npx tsc --noEmit
      - name: L1 / L2（純粋層・ブラウザ不要）
        run: npx vitest run --reporter=dot
      - name: ビルド
        run: npm run build && node scripts/gen-version.mjs
      - name: L3 / L4（固定版 Chromium）
        run: |
          npx playwright install --with-deps chromium
          npx playwright test tests/golden tests/parity
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: diff-images, path: tests/**/__diff__/ }

  deploy:
    needs: verify
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci && npm run build && node scripts/gen-version.mjs
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
      - name: 配信後のスモークテスト（CSP が効いているか）
        run: |
          set -euo pipefail
          H=$(curl -sI https://flame.example.workers.dev/)
          echo "$H" | grep -qi "content-security-policy" || { echo "CSP ヘッダが無い"; exit 1; }
          echo "$H" | grep -qi "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com" \
            || { echo "connect-src が想定と違う"; exit 1; }
          V=$(curl -s https://flame.example.workers.dev/version.json | jq -r .commit)
          [ "$V" = "$(git rev-parse --short HEAD)" ] || { echo "配信された版が違う"; exit 1; }
```

```toml
# wrangler.toml
name = "flame"
compatibility_date = "2026-09-01"
assets = { directory = "./dist" }
```

**デプロイの門にするもの**

| 検査 | 門にするか | 理由 |
|---|---|---|
| 構造検査（dependency-cruiser / ESLint / tsc） | **する** | 原則③そのもの |
| L1 / L2 | **する** | 速い（数秒） |
| L3 ゴールデン | **する** | 15件・数秒 |
| **L4 パリティ（毎push の15件）** | **する** | **原則②そのもの。ここを門にしないと仕様が形骸化する** |
| L4 夜間の240件 | しない | 8分かかる。落ちたら Issue を立てる（別ワークフロー `nightly.yml`） |
| 和文サブセットのサイズ assert | **する**（L1 に含まれる） | 静かに2.3倍になるのを止める唯一の手段 |
| 配信後の CSP スモーク | **する**（失敗したらワークフローが赤くなる） | CSP は「書いたつもり」で効かないことが最も多い |

---

## 16. 審査が指摘した「3案とも答えていない欠落」への回答

> 審査 §6 の10件すべてに答える。ここは3案のどれにも記述が無く、**本仕様で新たに決めた部分**である。

### 16.1 書き出しファイル名の規則（欠落1）

**規則**

```
flame-<YYYYMMDD>-<HHmmss>.jpg
```

| 場面 | 使う時刻 |
|---|---|
| EXIF に `DateTimeOriginal` がある | **その壁時計時刻**（TZ変換なし。§4.4） |
| 無い（スクショ等） | 書き出し実行時のローカル時刻 |

**衝突の解決（ZIP エントリを含む）**

```ts
// platform/filename.ts
export function exportFileName(shot: WallClock | null, used: Set<string>): string {
  const t = shot ?? nowWallClock();
  const base = `flame-${pad4(t.y)}${pad2(t.m)}${pad2(t.d)}-${pad2(t.hh)}${pad2(t.mm)}${pad2(t.ss)}`;
  let name = `${base}.jpg`;
  for (let i = 2; used.has(name); i++) name = `${base}-${i}.jpg`;   // -2, -3, ...
  used.add(name);
  return name;
}
```

- **`used` は1回の書き出しバッチ（＝1つの ZIP／1回の共有）でひとつ。**
  同一秒に撮った連写は珍しくないので、これが無いと **30枚が29枚になる。**
- 元のファイル名は使わない（`IMG_0412.jpg` が2枚あることは普通にあり、
  かつ利用者のファイル名に日本語・絵文字・スラッシュが入りうる）。
- 再書き出し（S6 →「続けて編集する」→ もう一度書き出す）は**別バッチ**なので、
  同じ名前が出る。ブラウザのダウンロードが `(1)` を付けるのに任せる。
- 共有シートに渡す `File` の名前も同じ規則。**ZIP と共有で名前が違うと混乱する。**
- ZIP 自体の名前は `flame-<YYYYMMDD>-<HHmmss>-<枚数>枚.zip`（例 `flame-20260921-145203-30枚.zip`）。
  **ASCII 外を含むので、`Content-Disposition` は使わず `<a download>` の属性で渡す**
  （Blob URL なのでヘッダは関与しない）。

**テスト**: 同一秒の30枚を書き出して**ZIP のエントリ名が30個すべて異なる**こと（§14.5）。

### 16.2 ライセンス本文の配置と配信形態、Tinos の扱い（欠落2）

**配置**: `public/licenses/` に**本文そのもの**を置き、ビルド成果物に含める（オフラインでも読める）。
**フォント9件は既にコミット済み**（各 4.4KB。`verify-assets.mjs` が存在と長さを検査している）。

```
public/licenses/
├─ Arimo-OFL.txt  Jost-OFL.txt  Oswald-OFL.txt  Cinzel-OFL.txt        ← 実在
│  PlayfairDisplay-OFL.txt  LibreBaskerville-OFL.txt  PTSerif-OFL.txt
│  Tinos-OFL.txt  NotoSansJP-OFL.txt
├─ index.html              ★要追加★ S8 の［出典とライセンス］から開く目次
├─ geo.txt                 ★要追加★ Geolonia / GeoNames の CC BY 4.0 表示。
│                                   本文は各 JSON の attribution をそのまま引く
└─ libs.txt                ★要追加★ exifr / piexifjs / fflate / zustand / React ほかの MIT 表記
```

- **OFL 1.1 はフォントファイルとライセンス本文を一緒に配布することを要求する。**
  サブセット化した woff2 も「改変した Font Software」なので、この義務は続く。
  `public/fonts/` と同じデプロイに `public/licenses/` が含まれることで満たす。
- **CC BY 4.0（Geolonia / GeoNames）は出典表示の義務**があるので、S8 の本文にも
  1行で出す（リンクだけにしない）。
- Service Worker のプリキャッシュに `licenses/` を含める（**オフラインで読めること**が要件）。

**Tinos の扱い — 解決済み（`report-fonts.md` の警告への回答）**

> `report-fonts.md`: Tinos は METADATA.pb に `license: "OFL"` と明記されているが、
> `ofl/tinos/` 配下に OFL.txt 本体が見当たらず**本文の直接確認は未検証**。

**アセットのビルドで決着した（同梱実測 `docs/assets.md`）。**
`google/fonts` の `ofl/tinos/OFL.txt` は **404 を実測**で確認し、
**本家 `googlefonts/tinos` から本文を取得して `public/licenses/Tinos-OFL.txt` に同梱した**（4.4KB）。
よって **Tinos は出荷する。欧文は8書体のまま。**（外して7書体にする案は不要になった。）

**「ライセンス本文が無い書体は出荷しない」は `verify-assets.mjs` が機械で守っている**:

```js
// scripts/verify-assets.mjs（現物。npm run build の先頭で走る）
const licenses = ['Arimo', 'Jost', 'Oswald', 'Cinzel', 'PlayfairDisplay',
                  'LibreBaskerville', 'PTSerif', 'Tinos', 'NotoSansJP'];
for (const f of licenses) {
  const p = resolve(root, `public/licenses/${f}-OFL.txt`);
  if (!existsSync(p) || statSync(p).size < 1000) {
    errors.push(`public/licenses/${f}-OFL.txt がないか、短すぎます`);
  }
}
```

書体を足すときは、この配列と `public/licenses/` の両方に足さなければビルドが落ちる。

### 16.3 CI/CD の具体（欠落3）

§15.5（CSP は `public/_headers`）と §15.6（GitHub Actions のワークフロー全文、
デプロイの門の表、配信後スモークテスト）で回答済み。要点の再掲:

- **CSP は `_headers`。Worker のコードは書かない**（アプリのバグで CSP が外れない）。
- `version.json` は `scripts/gen-version.mjs` がビルド直後に生成（`vite.config.ts` と同じ値）。
- Playwright は `npx playwright install --with-deps chromium` で固定版を入れる。
  Chromium のバージョンは `package.json` の `@playwright/test` で固定する。
- **L4 パリティ（毎push の15件）はデプロイの門にする。** 夜間240件は門にしない。

### 16.4 和文サブセットのビルド再現性（欠落4）

§15.4 で回答済み。要点:

- **生成物（woff2・JSON）をコミットする。CI では生成しない。現物は既にコミット済み。**
- ただし **`npm run assets:verify` を `npm run build` の先頭で必ず走らせる。**
  和文 Regular ≤ 700KB（実測 442.4KB）が `wght` 固定忘れ（1,043KB・**実測2.3倍**）の防波堤。
- 収録文字の assert（`髙﨑德濵齋邊` を含む 3,400字以上）も併せて回す。
- 文字集合は JIS X 0208 の区点から**ネットワーク無しで**起こすので、
  誰が何度回しても同じ 3,476字になる。
- **実行時のカバレッジ照合（§11.4）に要る `coverage-jp.json` はまだ無い。
  `build_fonts.py` の cmap 読み出しから書き出すのが最も安い**（§15.4 の追加分）。

### 16.5 Orientation とクロップの相互作用（欠落5。最重要）

**問題**: `report-exif.md` §4 は Chromium が Orientation を自動適用すると実測した。
しかし**プレビュー用（`createImageBitmap(file, {resizeWidth})`）と原寸用が別経路でデコードされると、
Orientation の適用が食い違い、プレビューと書き出しでトリミング位置がずれる**
（＝原則②の破れ）。

**契約（1行）**

> **すべての画像デコードは `platform/decode.ts` を通し、常に
> `{ imageOrientation: 'from-image', colorSpaceConversion: 'default' }` を渡し、
> Orientation 適用後の寸法を返す。他所から `createImageBitmap` を呼ぶことは lint で禁止する。**

```ts
// platform/decode.ts  — ★アプリ内で createImageBitmap を呼ぶ唯一の場所★（§1.3 の lint で強制）
export interface DecodedPhoto {
  readonly bitmap: ImageBitmap;
  /** ★Orientation 適用後★ の寸法。以後アプリはこの値しか見ない */
  readonly size: { readonly w: number; readonly h: number };
  /** 原寸（Orientation 適用後）。縮小デコードでも必ず返す */
  readonly natural: { readonly w: number; readonly h: number };
  readonly orientationApplied: true;
}

const OPTS = { imageOrientation: 'from-image', colorSpaceConversion: 'default' } as const;

export async function decode(file: Blob, opt?: { resizeWidth?: number }): Promise<DecodedPhoto> {
  // 1) 原寸（Orientation 適用後）を先に確定させる。★縮小デコードの前に★
  const probe = await createImageBitmap(file, OPTS);
  const natural = { w: probe.width, h: probe.height };
  if (!opt?.resizeWidth || opt.resizeWidth >= natural.w) {
    return { bitmap: probe, size: natural, natural, orientationApplied: true };
  }
  probe.close();
  // 2) 縮小デコードにも同じ OPTS を渡す
  const bmp = await createImageBitmap(file, {
    ...OPTS, resizeWidth: opt.resizeWidth,
    resizeHeight: Math.round(opt.resizeWidth * natural.h / natural.w),
    resizeQuality: 'high',
  });
  return { bitmap: bmp, size: { w: bmp.width, h: bmp.height }, natural, orientationApplied: true };
}
```

**この契約が守るもの**

1. `PhotoEntry.naturalSize` は**常に Orientation 適用後**。`resolveLayout` に渡る
   `photoAspect` はプレビューでも書き出しでも同じ値になる。
2. `DrawPhotoOp.srcNorm` は**正規化座標（0..1）**なので、元画素数に依存しない。
   プレビュー（長辺2048）でも原寸（6000）でも**同じクロップ矩形**を指す。
3. `natural` を縮小デコードでも返すので、「縮小版しか無いときに原寸を推測する」
   コードが要らない（推測が入ると必ずずれる）。
4. `canvas.toBlob` で書き出した JPEG は**ピクセル自体が回転済み**なので、
   Orientation タグの再注入は不要（`report-exif.md` §4）。EXIF 再注入時は
   **Orientation を 1 に書き換える**（回転済みのピクセルに回転タグを付けると二重に回る）。

```ts
dict['0th'][piexif.ImageIFD.Orientation] = 1;   // ★必須★
```

**テスト**（§14.5）: `rotated_orient6.jpg`（元 4000×3000・Orientation=6）で
`decode(file)` と `decode(file, {resizeWidth: 800})` の**アスペクト比が一致**すること、
どちらも `natural = {w:3000, h:4000}` を返すこと。
さらに L4 を Orientation=6 の画像で1ケース回し、クロップ位置が一致することを確認する。

### 16.6 プレビューのドロップシャドウ（欠落6）

§2.7 で回答済み。**影は `<canvas>` の外側に CSS で付ける。`Scene` に影の op は存在しない**
（`DrawOp` に shadow 系の op を定義していないので、書こうとしても型が通らない）。
プレビュー枠の角丸・背景の薄グレーも CSS 側のみ。

### 16.7 `fit` を利用者が選べるかどうか（欠落7）

**決定: MVP では選べない。`fit` / `crop` はスタイル固定で、利用者は変更できない。**

- 理由: トグルを足すと 15スタイル × 2 でテスト行列が倍になり、L4 の夜間マトリクスが
  240 → 480 ケースになる。かつ「このスタイルでは切り抜かれる／切り抜かれない」は
  **スタイルの個性であって設定ではない**（SQ4 / STN3 は全面ブリードであることがスタイルの中身）。
- **明記しないと実装者がトグルを足してしまう**ので、ここに書く。
  `PhotoSlot.fit` を `DocState` に持ち上げる変更は、この仕様の改訂なしには行わない。
- 利用者が「切り抜きたくない」ときの答えは**別のスタイルを選ぶこと**。
  S3-a の全画面グリッドは**実際の写真でレンダリングした結果**を見せるので、
  どれが切り抜かれるかは一目で分かる（§9.5）。

### 16.8 アクセシビリティの最低線（欠落8。構造に関わるので今決める）

| 項目 | 決定 |
|---|---|
| **タップ領域** | 最低 **44×44px**。チップの見た目が 32φ でも、当たり判定は 44px を確保する（`::before` で拡張） |
| **`focus-visible`** | 無彩色 UI なので、選択状態（反転）と区別できる形が要る。**2px の破線リング（`outline: 2px dashed var(--ink); outline-offset: 2px`）** を使う。選択状態は「塗りの反転」、フォーカスは「破線」で直交させる |
| **枠線のコントラスト** | 操作可能な要素の枠は必ず `--line-strong`（3.3:1）。`--line`（1.3:1）は装飾のリーダー罫だけ（§9.1） |
| **`prefers-reduced-motion`** | トースト・シートのスライド・進捗の不定形バーのアニメーションを止め、即時表示に切り替える。プレビューの再描画は元々アニメーションしない |
| **スクリーンリーダー** | 15スタイルのチップに `StyleDef.label` から `aria-label` を与える（例 `aria-label="元比・3行"`）。**`label` フィールドは既に型にあるので配線するだけ** |
| **プレビューの代替テキスト** | `<canvas role="img" aria-label="プレビュー: OR2、白地、キャプション3行">` を設定変更のたびに更新する |
| **フォームのラベル** | S4 の各行は `<label>` と入力欄を `for`/`id` で結ぶ |
| **色だけに依存しない** | 選択状態は反転＋枠、エラーは縦罫＋文言。**もともと色を使っていない**ので自動的に満たす |
| **文字サイズ** | ブラウザの文字サイズ設定に追従させるため、UI の px は `rem` 換算で持つ（T1=0.6875rem 等） |

**L1 に a11y のテストを1本置く**: 15スタイルすべてに空でない `label` があること。

### 16.9 不具合報告の宛先（欠落9）

**決定: 宛先は未定として扱う。仕様が定めるのは「自己診断画面でレポートをコピーできる」までとする。**

- **自動送信は一切しない**（エラー報告サービスを入れないという §12.2 の決定と一貫する）。
- 自己診断の ［この内容をコピーする］ がクリップボードに入れるテキスト（実物）:

```
flame 動作状況レポート
生成日時: 2026-09-21T14:52:03+09:00

[アプリ]
version      : 1.3.0
build        : 2026-09-21T09:14:22Z (a4f2c9e)
remoteVersion: 1.4.0  (mismatch)
sw           : active, waiting=true, scope=/
fontSet      : fontset-2026.09
geoData      : geo-2026.08 (jp+world)

[環境]
userAgent    : Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) ...
platform     : iOS 18.2 / Safari 18.2
viewport     : 393x852 @3
deviceMemory : (unavailable)
cores        : 6
online       : true
storage      : persistent (localStorage ok)

[capabilities]
createImageBitmap : true
OffscreenCanvas   : true
Worker            : true
share(files)      : true
showSaveFilePicker: false
heicDecode        : false
Intl.Segmenter    : true
ctx.letterSpacing : true
wakeLock          : true

[canvas]
measuredMaxArea : 134217728
assumedMaxArea  : 268435456
assumedMaxSide  : 65535

[quality]
grainConsistency: 0.97
fontsLoaded     : 9 (Arimo/400, Arimo/700, Jost/400, ... , NotoSansJP/400)
fontIdentity    : all ok
verticalEmbed   : ok
buildTimeWidths : Arimo/400 +0.4%, Jost/400 -1.1%  (参考値)

[最近の問題]
2026-09-21T14:41:10  CANVAS_DOWNGRADE  requested=4096 used=2560 reason=verify-failed
2026-09-20T18:12:44  HEIC_EXIF_MISSING  fileSize=2841022
2026-09-20T18:12:41  HEIC_CONVERT_OK    ms=3180

[通信]
2026-09-21T14:32:08  fonts.googleapis.com  chars=1  bytes=9436
2026-09-20T18:05:33  self                  world-geo  bytes=477230

※ このレポートに写真・撮影場所・入力した文字は含まれません。
※ 送信は自動で行われません。あなたが貼り付けた先にのみ渡ります。
```

- **最後の2行を必ず入れる。** コピーした人が「これを貼って大丈夫か」を判断できる。
- **入力した文字そのものは含めない**（通信ログには文字数だけ。字そのものは §12.4 の画面でのみ表示）。
- ファイル名も含めない（`fileSize` だけ）。**個人の写真のファイル名は個人情報になりうる。**

**S8 の［不具合の報告］セクションの文面**:

> **うまく動かないとき**
>
> ［この端末での動作状況を見る］ を開いて、一番下の ［この内容をコピーする］ を押すと、
> 原因を調べるための情報がコピーされます。**写真・撮影場所・入力した文字は含まれません。**
>
> コピーした内容の送り先は、このアプリの配布ページでご案内します。

**宛先（GitHub Issue の URL 等）が決まったら、この最後の1行を差し替える。**
差し替え先は `src/app/routes/About.tsx` の1箇所だけ。

### 16.10 iOS 実機検証の合否基準（欠落10。工程8を「測定」にするための事前コミット）

**閾値を先に決めておけば工程8は測定になる。決めなければ再設計になる。**
以下は **実機検証の前に確定した分岐**であり、検証時に基準を動かしてはならない。

| # | 測るもの | 測り方（自己診断の計器） | 合否基準 | **不合格のときに自動で起きること** |
|---|---|---|---|---|
| **1** | **HEIC がどう届くか** | 写真ピッカーから10枚選び、`file.type` と `sniff()` の先頭バイトを記録 | **10枚中8枚以上が `image/jpeg` で届く** | 合格 → **`heic2any` を依存ごと削除**（330KB の節約）。§9.6 の HEIC 用 E3 画面も削除<br>不合格 → 現行の HEIC 動線を維持 |
| **2** | **キャンバス面積上限** | ［いま測る］の二分探索。面積と辺長を別々に | **4:5 の 4096×5120 = 20,971,520px が確保・読み戻し成功** | 合格 → 既定 longEdge = 4096 を維持<br>不合格 → **その端末の既定を 2560 に下げて `flame:v1:caps` に保存**。§11.7 の降格は保険として残す |
| **3** | **`navigator.share({files})`（1枚）** | ボタンの `click` 内で同期的に呼ぶ。3回試す | **3回中3回とも共有シートが開く** | 合格 → `［写真に保存 / 共有］` を主動線に維持<br>不合格 → **`<a download>` ＋ `<img>` 長押しを主動線に格下げ**し、共有は折りたたみへ |
| **4** | **`share({files})`（30枚）** | `canShare({files:[30個]})` → 実行 | **30枚が1回で渡る** | 合格 → 1タップ動線<br>不合格 → **10枚×3回**（§8.4）。これも失敗 → **ZIP** |
| **5** | **メモリ上限（書き出し）** | 6000×4000 を 4096 で書き出す。タブが生きているか（`sessionStorage` の `flame:heavy` フラグ） | **3回連続で完走し、`flame:heavy` が残らない** | 合格 → 既定 4096 を維持<br>不合格 → **既定 2560**、かつ `budgetBytes()` の iOS 係数を実測値で置き換える |
| **6** | **一括30枚の完走** | 24MP 30枚を逐次処理 | **30枚完走し、所要 ≤ 40秒**（Chromium 実測 10〜20秒の2倍を上限とする） | 不合格 → **一括の上限枚数を 15枚に下げ**、超える場合は分割を案内 |
| **7** | **`<img>` の長押し保存** | 書き出し結果を長押しし、［“写真”に追加］が出るか（目視。自己診断にチェックボックスを置いて記録） | **メニューが出る** | 不合格 → S6 の `↑ 長押しでも保存できます` を消す（**嘘を表示しない**）。最後の砦が無くなるので、#3 の合否がより重い |
| **8** | **縦書き SVG の埋め込み** | `verifyVerticalFont` を実機で実行 | **`diff > 0.01`（埋め込みが効いている）** | 不合格 → **縦書き（D1）を iOS で無効化**し、「この端末では縦書きを使えません」を出す。横書きは通常どおり |
| **9** | **Wake Lock** | `navigator.wakeLock.request('screen')` | 取れる | 不合格 → §8.6 の注記を出す（既に分岐済み） |
| **10** | **localStorage（通常モード）** | `safeStorage.init()` の `probe()` | `persistent` | 不合格 → メモリ降格（既に分岐済み） |

**記録のしかた**: 自己診断の測定結果は `flame:v1:caps` に保存され、レポート（§16.9）に出る。
**検証は「開発者が使い捨てコードを書く」のではなく「利用者の iPhone で自己診断を開く」で済む。**
これが §17 で自己診断を実機検証の**前**に作る理由である。

**#1 が合格した場合の削除リスト**（先に書いておく。あとで迷わないため）:
`heic2any` の依存 ／ `safeImport` の HEIC 分岐 ／ §9.6 の HEIC 用 E3 画面 ／
`sniff()` の `heic` 分岐（`avif` と `tiff-raw` は残す）／ §12.1 の C12。

---

## 17. 実装順序

> 出典: 骨格の週次は案C 付録B、安全装置の段階は案B 付録B。両者を1本に噛み合わせた。
> **安全装置は後から入らないので、骨格として最初に入れる。**

### 17.1 順序の原則

1. **`fillText` / `createElement('canvas')` / `createImageBitmap` / `measureText` / `fetch` の
   5つを唯一の入口に集約する lint を、コードを書き始める前に入れる。**
   素の API を使う癖がつくと戻せない。
2. **L4 パリティテストが CI で回っている状態を、1スタイルでもいいから最初の週に作る。**
   そこから先はスタイルもテストもデータを足すだけで増える。
3. **自己診断は実機検証の「前」に作る。** これが無いと iOS の実測値が取れない。

### 17.2 段階

| 段階 | 入れるもの | 完了判定 |
|---|---|---|
| **0** | リポジトリの骨組み: Vite + TS strict、`src/{core,render,worker,platform,app}` の空ディレクトリ、`.dependency-cruiser.cjs`、**§1.3 の ESLint 5規則**、GitHub Actions の verify ジョブ。**`package.json` の `assets:fonts` のパス誤りを直す**（§15.4） | **空のコードで構造検査が緑になり、`npm run build` が `assets:verify` を通る。** 意図的に `src/core` から `document` を触るコミットを作り、**CI が赤くなることを確認する** |
| **1** | `platform/storage.ts`（safeStorage）／`build-info.ts`／`platform/error-log.ts`／`platform/net.ts` | プライベートモードのエミュレーションで起動できる |
| **2** | `render/guards.ts`（createVerifiedCanvas）／`render/resources/fonts.ts`（FontRegistry + LoadedFontSet）／`release()`／`platform/decode.ts`（Orientation 契約） | §14.5 の罠テスト（面積上限・フォント待ち・Orientation）が通る |
| **3** | `core/units` / `core/scene/ops` / `core/scene/builder` / `render/executor` / `render/measure`。**写真＋背景＋1行テキストだけ** | **L4 パリティテストが1スタイル（SQ1）で通る。ここが最重要マイルストーン** |
| **4** | **グレインのタイル方式**（§5.2）と L4 の強度比テスト | 強度比 **0.90〜1.10** を実測で確認する。`report-grain.md` の再現になっているか確かめる |
| **5** | `core/styles/{types,tokens,registry,layout}` に15スタイル。L2 スナップショット45本 | 15スタイルの Scene ゴールデンが揃う。**§3.5 の STN2 検算をここで実施し、駄目なら倒す** |
| **6** | `core/caption/` 一式（fields / format / compose / typeset / sanitize / ink / fit） | L1 の256通り総当たり・プロパティテスト・インク表テストが全部通る |
| **7** | `core/preflight/` の骨格（全 check が pass を返す状態）＋ 呼び出し口だけ | S5 のステップ1 に空の Preflight が挟まる |
| **8** | `app/` の骨格: zustand 4ストア、`PreviewDriver`、S0 / S3 / タブ5つ / S3-a | **1枚の写真を選んで15スタイルを切り替えられる**。設定が localStorage で往復する |
| **9** | S4 情報編集 ／ S5 書き出し ／ S6 保存結果 ／ `platform/save.ts`（端末別分岐） | **1枚を書き出して写真アプリに入る動線が閉じる** |
| **10** | Worker ／ `batchQueue` ／ ZIP ／ EXIF 再注入（GPS 既定 OFF） | 30枚の一括保存が通しで動く。`PhotoStore` の live handle ≤ 2 |
| **11** | Preflight の各 check を埋める（coverage / font-loaded / font-identity / canvas / memory / text-fit） | **block 4種が実際に止める。それ以外は［このまま書き出す］が出る** |
| **12** | CSP（`_headers`）／`version.json`／SW（skipWaiting なし）／Cloudflare 自動デプロイ | **push で本番が更新され、配信後スモークテストが CSP を確認する** |
| **13** | 質感 D2（印画紙フチ・コマ枠・ビネット）／ 質感 on/off で L4 | 質感 on/off の両方で L4 が通る |
| **14** | 和文サブセットの同梱＋遅延ロード／カバレッジ検査／`&text=` 取得と3段階同意／通信ログ | オフラインで和文が出る。同梱外の字で Preflight が block する |
| **15** | **縦書き D1**（SVG + data: URI 埋め込み + `verifyVerticalFont`） | `report-svg-font.md` の再現テストが通る（font-family を外した版と一致しないこと） |
| **16** | 撮影地 D4（centroid・自信度・粒度の切り上げ） | 境界付近で2択が出る。範囲外で採用しない |
| **17** | 2モード（S1 / 対照表 / 上限3つ）／S7 初期値設定／レシピ URL | お手軽で6スタイル・4色・2質感になる。**block 4種は両モードで同一**であることをテストで固定 |
| **18** | **自己診断（SD）** ＋ `platform/caps.ts`（二分探索・grain 一致度の計測） | **利用者の iPhone で §16.10 の10項目が測れる** |
| **19** | S8（通信の説明・送信記録・オフライン・ライセンス・不具合報告）／`licenses/index.html` と `geo.txt` / `libs.txt` の追加 | S8 から OFL 本文と CC BY 表示に到達でき、オフラインでも読めること（Tinos は §16.2 で解決済み） |
| **20** | **iOS 実機検証**（§16.10 の10項目）→ 事前に決めた分岐を適用 | HEIC 不要なら削除。上限が低ければ既定を下げる。**再設計にはならない** |
| **21** | 参考アプリと並べた15スタイルの寸法詰め（`confidence: estimated` の解消） | `registry.ts` のデータ差し替えのみで完結すること（コードを触らない） |

### 17.3 各段階で「やってはいけないこと」

| 段階 | 禁止 |
|---|---|
| 0〜2 | UI を先に書き始めること。**安全装置より先に画面を作ると、素の API を使う箇所が散る** |
| 3 | `buildScene` に `k` を渡したくなること。渡したくなったら、それは `RenderTarget` に置く値である |
| 4 | グレインタイルを `t.k` で作ること（§5.2 の要点1） |
| 5 | `registry.ts` の値を「見た目がいいから」でコードから上書きすること。データだけを直す |
| 8〜9 | Preflight を飛ばす近道を作ること。段階7 で空の呼び出し口を作ってあるのは、これを防ぐため |
| 11 | block を4種より増やすこと。増やすには「出力が嘘になる」ことの説明を PR に書く |
| 13〜16 | 差別化機能のために op を増やすこと。まずプリミティブへの分解を試す |
| 17 | `if (mode === 'otegaru')` で安全挙動を分岐すること（§10.2 上限②） |
| 20 | 事前に決めた合否基準を、測定結果を見てから動かすこと |

---

## 付録: どこから採ったか（節ごとの追跡）

| 節 | 骨格（C） | 画面・文言（A） | 安全・配信（B） | 実測レポート |
|---|---|---|---|---|
| §1 構成 | ディレクトリ・依存方向・CI 強制 | — | 配信・CSP 配置 | — |
| §2 描画モデル | 全面（op 13種・buildScene の不変条件・測定ポート） | — | — | canvas（letterSpacing 比例） |
| §3 StyleDef | 全面（型・15スタイルの値） | 2段グルーピングの提示 | — | — |
| §4 キャプション | 組み立て・欠損・はしご・インク | 帯の動線・E1 注記 | sanitize・書記素・壁時計 | exif（整形ロジック） |
| §5 質感 | プリミティブ分解・op 発行順 | 離散チップ・4種に絞る | **タイル方式** | **grain**（0.98） |
| §6 縦書き | VerticalTextOp・免責 | 動線・無効時の文言 | **FM-07 の検知** | **svg-font**（相違0画素・12.34ms） |
| §7 撮影地 | — | 情報タブの1フィールド | 自信度・粒度の切り上げ | geo-batch（33KB・0.0898ms） |
| §8 一括 | Worker・メモリ所有権 | **保存動線の端末別分岐**・進捗 | 逐次処理・途中失敗 | geo-batch（100MB/枚・10件ブロック） |
| §9 画面 | — | **全面** | エラー文面の中身 | canvas（`<img>` 化） |
| §10 2モード | — | **対照表** | 上限②で安全挙動を守る | — |
| §11 安全装置 | 型による保証（LoadedFontSet） | 提示のしかた（E1/E2/E3） | **全面** | canvas / fonts |
| §12 通信 | — | S8 への統合 | **全面**（CSP・同意・棚卸し） | fonts（9.2KB）/ jp-subset |
| §13 状態 | zustand 4ストア・メモリ分離 | レシピ URL・記憶3段 | safeStorage・スキーマ版 | — |
| §14 テスト | **全面**（L1〜L4・免責マスク） | — | 罠の回帰 | 全レポート |
| §15 ビルド | — | — | BUILD_INFO・SW 更新 | jp-subset（サイズ assert） |
| §16 欠落 | — | — | — | 本仕様で新規確定 |
| §17 順序 | 週次の骨格 | — | 安全装置を先に | — |

**審査で「採用しない」と裁定されたものは、この仕様に一切入っていない。**
再提案するときは §0.4 の表に照らし、「なぜ裁定を覆すのか」を書くこと。
