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
| **1** | `docs/poc/*.md` の**実測値**。推測・仮説より上 |
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
| 和文 Bold | Regular 462.9KB に対し +473.1KB（**実測** `report-jp-subset.md`）。階層は濃淡とサイズで出す（§4.7） |
| 異体字置換表（髙→高） | lv1p は髙・﨑を**収録済み**（**実測** `report-jp-subset.md`）。同梱字に置換を提案するのは誤り |
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
| ビルド | Vite 5 + TypeScript 5（strict） | — | — |
| UI | React 18 | gzip 約45KB | — |
| 状態 | zustand + immer | gzip 約3KB | 案C §7.1。React 外から `store.subscribe` で canvas を駆動できる |
| 検証 | zod | gzip 約13KB | 設定スキーマの検証（§13.4） |
| EXIF 読み | `exifr/dist/lite.esm.mjs` | **gzip 14.6KB**（実測 `report-exif.md`） | mini は Make/Model 非対応で不可 |
| EXIF 書き戻し | `piexifjs` | gzip 9.0KB（実測 同上） | JPEG 専用。再注入は実測で成功（+414B） |
| ZIP | `fflate`（`zipSync`） | gzip 約8KB | 30ファイル 271〜274ms（実測 `report-geo-batch.md`） |
| HEIC 変換 | `heic2any`（**動的 import・プリキャッシュしない**） | gzip 330.6KB（実測 `report-exif.md`） | 実機検証の結果で削除しうる（§16.10） |
| テスト | Vitest / Playwright（Chromium 固定版）/ fast-check / pixelmatch | — | §14 |
| CI 構造検査 | dependency-cruiser / ESLint | — | §1.3 |
| 配信 | Cloudflare Workers（Static Assets）+ GitHub Actions | — | §15 |

**同梱アセット**: 欧文8書体 237.3KB（実測 `report-fonts.md`）／和文 lv1p Regular 462.9KB（実測
`report-jp-subset.md`・**遅延ロード**）／日本の市区町村 centroid gzip 33KB（実測 `report-geo-batch.md`）／
世界の主要都市 gzip 0.47MB（**同梱せず、要求時に自ドメインから取得**）。

### 1.2 ディレクトリ

```
flame/
├─ docs/                          本仕様・要件・PoC レポート
├─ scripts/
│  ├─ build-jp-subset.py          和文サブセット生成（§15.4）
│  ├─ build-geo.mjs               市区町村 centroid 生成（§7.2）
│  ├─ build-coverage.mjs          同梱書体の cmap → coverage.json（§11.4）
│  └─ gen-version.mjs             version.json 生成（§15.2）
├─ public/
│  ├─ _headers                    CSP ほかの HTTP ヘッダ（§15.5）
│  ├─ licenses/                   OFL 1.1 / CC BY 4.0 の本文（§16.2）
│  └─ fonts/ geo/ icons/
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

**ESLint（実物。レイヤーごとに overrides を分ける）**

```js
// eslint.config.js（抜粋）
export default [
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error',
        'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
        'fetch', 'Image', 'OffscreenCanvas', 'FontFace', 'caches', 'performance'],
      'no-restricted-syntax': ['error',
        { selector: "NewExpression[callee.name='Date']",
          message: 'core は現在時刻を知らない。時刻は SceneInput で渡す' }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/render/measure.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: "MemberExpression[property.name='measureText']",
          message: '§2.6: 測定は render/measure.ts に集約する。実行層で測り直すと原則②が壊れる' }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/render/guards.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.object.name='document'][callee.property.name='createElement'][arguments.0.value='canvas']",
          message: '§11.2: canvas の生成は createVerifiedCanvas を通す' },
        { selector: "NewExpression[callee.name='OffscreenCanvas']",
          message: '§11.2: canvas の生成は createVerifiedCanvas を通す' }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/render/resources/fonts.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: "MemberExpression[property.name='check'][object.property.name='fonts']",
          message: '§11.3: document.fonts.check() は使わない。FontRegistry の台帳で判定する' },
        { selector: "MemberExpression[property.name='fillText']",
          message: '§11.3: fillText は render/ops/text.ts の TextRenderer 経由のみ' }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/platform/decode.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.name='createImageBitmap']",
          message: '§16.5: デコードは platform/decode.ts に一本化する（Orientation 契約）' }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/platform/net.ts'],
    rules: {
      'no-restricted-globals': ['error', 'fetch'],   // §12.4: 通信は net.ts のログを必ず通す
    },
  },
];
```

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
  readonly family: string;          // 'Arimo' | 'Jost' | 'Noto Sans JP' ...
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
