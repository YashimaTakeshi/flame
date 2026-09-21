# フォント技術検証（PoC）報告

検証環境: Node v22 / Python 3.11 + fonttools 4.65 / Playwright + Chromium 141。
プロキシは fonts.googleapis.com / fonts.gstatic.com / raw.githubusercontent.com に到達可。
fonts.google.com 本体・cdn.jsdelivr.net・api.github.com は到達不可だったため、ライセンス確認は
raw.githubusercontent.com 経由で google/fonts リポジトリから直接取得した。
作業一式: `scratchpad/poc/fonts/`

## 1. 欧文書体の代替候補（実測）

すべて Google Fonts 配信・OFL 1.1。ライセンス文は google/fonts の `ofl/<family>/OFL.txt` を実ダウンロードして確認。

| 参考アプリの書体 | 分類 | 代替候補 | ライセンス | 入手元 | latin分割woff2実測(regular/bold) | 可変フォントか |
|---|---|---|---|---|---|---|
| Helvetica | グロテスク・サンセリフ | **Arimo** | OFL 1.1 | ofl/arimo | 20,204 B（400と700は同一ファイル） | 可変(400–700) |
| Futura | ジオメトリック・サンセリフ | **Jost** | OFL 1.1 | ofl/jost | 26,588 B（同一ファイル） | 可変 |
| DIN | 工業系サンセリフ | **Oswald** | OFL 1.1 | ofl/oswald | 21,412 B（同一ファイル） | 可変 |
| Copperplate | 彫刻風スモールキャップス | **Cinzel** | OFL 1.1 | ofl/cinzel | 25,888 B（同一ファイル） | 可変 |
| Didot | ディドネ・セリフ | **Playfair Display** | OFL 1.1 | ofl/playfairdisplay | 38,460 B（同一ファイル） | 可変 |
| Georgia | トランジショナル・セリフ | **PT Serif** | OFL 1.1 | ofl/ptserif | 400: 13,400 B / 700: 13,540 B（別） | 静的 |
| Times New Roman | トランジショナル・セリフ | **Tinos** | OFL※ | ofl/tinos | 400: 10,904 B / 700: 11,616 B（別） | 静的 |
| Baskerville | トランジショナル・セリフ | **Libre Baskerville** | OFL 1.1 | ofl/librebaskerville | 33,852 B（同一ファイル） | 可変 |

※Tinos: METADATA.pb に `license: "OFL"` と明記されているが、ofl/tinos/ 配下に OFL.txt 本体が見当たらず本文の直接確認は**未検証**。出荷前に標準 SIL OFL 1.1 条文＋著作権表記の同梱を再確認すること。

**重要な発見**: Arimo/Jost/Oswald/Cinzel/Playfair Display/Libre Baskerville の6書体は可変フォント（fvar, wght軸400–700）として配信され、`wght@400;700` を指定しても400用・700用の @font-face が**バイト単位で同一の URL・同一サイズ**を指す。**1ファイルで regular/bold の両方を賄える**。PT Serif と Tinos は静的で別ファイル。

## 2. サブセット化の効果（実測）

google/fonts から元 TTF を実ダウンロードし、pyftsubset で Latin-1 範囲にサブセット → woff2 化して実測比較。

- 元TTF合計（Regular+Bold、全スクリプト込み、8書体）: **3,219,956 B ≈ 3.14 MiB**
- 自前サブセット後（西欧Latin-1、8書体・regular+bold）: **243,032 B = 237.3 KiB**
- 自前サブセット後（東欧含む広いLatin Extended）: **336,164 B = 328.3 KiB**
- Google の自動 "latin" 分割をそのまま使う場合: **215,864 B = 210.8 KiB**

サブセット化で約1/10（3.14MiB→237〜328KiB）。Google の自動 latin 分割は既に最適化されており、自前で東欧まで広げると Google 版より +56%。

## 3. 和文フォント（差別化機能）

- Noto Sans JP weight400、unicode-range 分割 **124ファイル** の Content-Length 合計: **5,223,320 B = 4.98 MiB**
- Shippori Mincho weight400、122ファイル分割: **3,701,112 B = 3.53 MiB**
- 単一ファイル版（可変フォント、全ウェイト全グリフ）: **9,589,900 B ≈ 9.15 MiB**

**(a) `&text=` 動的サブセット**: 実際のキャプション例で実測。CSS API が返す @font-face は実際に使われた文字のみの unicode-range、`Access-Control-Allow-Origin: *` 付き。実体 woff2 は **9,436 B (9.21 KiB)**。Chromium で `fetch → FontFace.load() → document.fonts.add() → ctx.fillText() → canvas.toBlob()` まで実行し**エラーなく成功**（フォントはクロスオリジンでも Canvas 非汚染）。出力: `output/jp-dynamic-subset-canvas.png`。
設計上の注意: `&text=` の値が変わるたびに新 URL が発行されるため、**確定時にデバウンスして1回だけ**叩く必要がある。

**(b) unicode-range 分割配信**: Canvas 書き出し用途とは相性が悪い（ブラウザの遅延取得は DOM テキストノード前提）。本 PoC では実装・実測は**未検証**。

**(c) フルセット同梱**: 4.98〜9.15MB、初回ロードとして非現実的。

**結論**: (a) が最も現実的。実測 9.2KB/リクエスト、CORS 問題なし、Canvas 描画も実証済み。ただしオフライン時は使えないため、軽量な和文フォールバックサブセットの同梱を検討要（文字選定は未検証）。

## 4. Canvas でのフォント描画（実測・最重要）

| ケース | measureText().width | ascent | descent |
|---|---:|---:|---:|
| `FontFace.load()` を待たずに `fillText()` | **554.625** | 34 | 10 |
| `load()`→`add()`→`document.fonts.ready` を待って `fillText()` | **608.641** | 39 | 9 |
| 素の serif フォールバック基準値 | **554.625** | 34 | 10 |

**「待たない」場合の数値はフォールバック基準値と完全一致** ——実測でフォールバック書体のまま書き出されることが確定。`document.fonts.check()` は描画後の時点では true を返すため、**`fillText()` の「前」に `load()` の Promise か `document.fonts.ready` を await することが唯一確実な方法**。
出力画像: `output/fontface-no-wait.png` / `fontface-wait.png` / `fontface-fallback-serif.png`（字形が明確に違う）。
`measureText()` の width/ascent/descent はフォント切替で実際に異なる値を返し、レイアウト計算に実用可能。

## 5. 縦書きキャプション（実測）

- **(a) 1文字ずつ fillText**: 素朴な実装では句読点が字面中央のまま・括弧やダッシュが横向きのまま残る不自然さを画像で確認（`output/vertical-naive-fillText.png`）。約物の回転・位置補正を自前実装して改善（`output/vertical-fixed-fillText.png`）したが、対応すべき約物の種類が多く工数がかさむ。
- **(b) SVG `writing-mode: vertical-rl`**: `<text>` を SVG ネイティブでレンダリングし `<img>` 経由で Canvas に drawImage したところ、**句読点位置・括弧の90度回転がブラウザ側で自動的かつ正確に処理される**（`output/vertical-svg-text-via-image.png`、(a) より明らかに正確）。`canvas.toBlob()` も**成功**（14,826 B、tainted なし）。
- **`<foreignObject>` の汚染問題は実在すると確定**: foreignObject 内に HTML div を入れて Canvas 合成したところ、実際に `SecurityError: Tainted canvases may not be exported.` が発生。toDataURL も同様に例外。

**結論**: SVG ネイティブ `<text writing-mode="vertical-rl">`（foreignObject 不使用）方式が明確に優位。約物処理をブラウザの組版エンジンに任せられる。**foreignObject は使用禁止**。

## 初回ロードの合計試算（コードで検算済み）

| シナリオ | 内容 | 実測合計 |
|---|---|---:|
| C: 最小（デフォルト書体1つ） | Arimo 1書体（可変フォント1ファイル） | **20.5 KiB** |
| A: 書体選択UIで8書体すべてプレビュー | 欧文8書体（西欧Latin-1範囲） | **237.3 KiB** |
| B: A + 縦書き和文キャプション1件 | A + Noto Sans JP `&text=` 動的サブセット | **246.6 KiB** |

東欧圏まで含む広いラテン範囲にすると A/B はそれぞれ **328.3 KiB / 337.5 KiB**。

## 設計に影響する制約

- 可変フォント6種は regular+bold を1ファイルで賄えるが、PT Serif・Tinos は静的で別ファイルが必要
- Canvas 描画前は必ず `await face.load()` → `document.fonts.add()` → `await document.fonts.ready`。待たずに描くと実際にフォールバック書体で書き出される（実測確認済み）
- `&text=` 動的サブセットは入力確定時にデバウンスして1回だけ叩く
- オフライン時は `&text=` が叩けないため、軽量な和文フォールバックサブセットの同梱が必要（文字選定は未検証）
- 縦書きは SVG ネイティブ `<text writing-mode="vertical-rl">` ＋ `<img>` 経由で Canvas 合成。**foreignObject は使わない**（tainted canvas）
- unicode-range 分割配信は Canvas 書き出し用途と相性が悪い
- Tinos のライセンス本文は本 PoC 環境から取得できなかった。出荷前に別経路で再確認要

## 未検証事項

- unicode-range 分割方式で Canvas 用途向けに特定文字を先読みできるかの実装・実測
- Noto Sans JP / Shippori Mincho 以外の和文候補の比較
- Tinos の OFL.txt 本文の直接確認
- オフライン時に同梱する和文フォールバックサブセットの具体的な文字セット設計
- 縦書き時の可変フォントでのグリフ送り幅の精密計算（今回は固定行送りで代用）
