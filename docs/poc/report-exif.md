# EXIF ブラウザ内処理 PoC 実測レポート

検証日: 2026-09-21 / Chromium 141.0.7390.37 / Node v22.22.2
すべてブラウザ上で実行（bundle した JS を HTML に読み込み、File/Blob を渡して実行、Playwright で結果を JSON 抽出）。
作業一式: `scratchpad/poc/exif/`

## 1. ライブラリ選定・バンドルサイズ実測（esbuild --bundle --minify --format=iife → gzip -9）

| import | raw bytes | gzip bytes | gzip KB |
|---|---:|---:|---:|
| exifr/dist/full.esm.mjs | 75,712 | 26,375 | 25.8 |
| exifr/dist/lite.esm.mjs | 45,500 | 14,977 | 14.6 |
| exifr/dist/mini.esm.mjs | 29,129 | 9,311 | 9.1 |
| exif-js | 15,563 | 5,712 | 5.6 |
| piexifjs | 31,123 | 9,172 | 9.0 |
| heic2any（wasm内包） | 1,353,210 | 338,570 | 330.6 |
| libheif-js/wasm-bundle.js | 1,989,879 | 697,924 | 681.6 |

**exifr/dist/mini.esm.mjs は Make/Model が取得できない**（ifd0 セグメントパーサーが含まれず、`{ifd0:true}` 明示指定も効かない）。よって不可。

**推奨：`exifr/dist/lite.esm.mjs`（gzip 14.6KB）**。ifd0(Make/Model)+exif+gps+interop を含み、full と同じ19キー・同じ値が取れることを実測確認済み。

```js
import { parse } from 'exifr/dist/lite.esm.mjs';
const exif = await parse(file).catch(() => undefined);
```

## 2. 4枚×項目の実測値（exifr, デフォルトオプション）

| 項目 | mirrorless_landscape | iphone_portrait | no_exif | rotated_orient6 |
|---|---|---|---|---|
| Make | "FUJIFILM" | "Apple" | undefined | "SONY" |
| Model | "X-M5" | "iPhone 16 Pro" | 同上 | "ILCE-7M4" |
| LensModel | "SIGMA 18-50mm F2.8 DC DN \| Contemporary 021" | "iPhone 16 Pro back camera 6.765mm f/1.78" | 同上 | "FE 35mm F1.8" |
| FocalLength | 23 | 6.765 | 同上 | 35 |
| FocalLengthIn35mmFilm | **キー名が `FocalLengthIn35mmFormat` に変わる**。値=35 | 24 | 同上 | 35 |
| FNumber | 2.8 | 1.78 | 同上 | 1.8 |
| ExposureTime | 0.004（=1/250 を小数化） | 0.008333333333333333 | 同上 | 0.016666666666666666 |
| ISO | 400 | 80 | 同上 | 1600 |
| DateTimeOriginal | Date オブジェクト | Date | 同上 | Date |
| GPSLatitude(10進) | 34.3853 | 34.3853 | 同上 | 34.3853 |
| GPSLongitude(10進) | 132.4552999722222 | 同左 | 同上 | 同左 |
| Orientation(翻訳後) | "Horizontal (normal)"(raw=1) | 同左 | 同上 | "Rotate 90 CW"(raw=6) |

経度の端数はテスト画像生成側の DMS 丸め（piexif が秒を 1/10000 精度で丸めた）が原因で、exifr の変換誤差ではない。

### raw 値の型
ExposureTime / FNumber / Orientation は `translateValues:false` にしても number 型のまま（分数オブジェクトにはならない）。exifr は内部で常に小数化して返す。

### 表示文字列への変換（確定ロジック）
```js
function fmtShutter(sec) {          // 0.004 -> "1/250s"
  if (sec >= 1) return `${sec}s`;
  return `1/${Math.round(1 / sec)}s`;  // 浮動小数誤差があるので Math.round 必須
}
const fmtAperture = f => `F${f}`;
const fmtIso = iso => `ISO${iso}`;
```
`1/0.008333333333333333 = 120.00000000000001` を実測確認。Math.round 必須。

### 他ライブラリの欠陥（実測）
- **exif-js**: 値が `{numerator,denominator}` のまま。さらに **LensModel タグ(0xA434) がタグ辞書に無く、キーが文字列 `"undefined"` になって値が埋もれる**。レンズ名表示が要件の本アプリでは実質使えない。
- **piexifjs**: 戻り値のキーが数値タグID（LensModel は "42036"）。可読名への変換テーブルを自前実装する必要あり。読み取り用途には不向き。

→ **exifr 一択**。

## 3. EXIF なし画像の挙動

| ライブラリ | 挙動 |
|---|---|
| exifr.parse() | 例外を投げず `undefined` を返す |
| exif-js | 空オブジェクト `{}` |
| piexifjs | 空構造 |

落ちない書き方：`const exif = await parse(file).catch(() => undefined); const make = exif?.Make ?? null;`

## 4. Orientation 自動適用（設計影響：大）

rotated_orient6.jpg（元 4000x3000、Orientation=6）で検証：

| 描画方法 | 結果サイズ | 自動適用か |
|---|---|---|
| `<img>` の naturalWidth/Height | 3000x4000 | 適用された |
| `createImageBitmap(file)`（デフォルト） | 3000x4000 | 適用された |
| `createImageBitmap(file, {imageOrientation:'from-image'})` | 3000x4000 | 適用（デフォルトと同一） |
| canvas.drawImage 後のピクセルサンプル | 回転前下端の色が canvas 左上に、上端の色が右下に来ている | **ピクセルレベルで回転済み** |

**結論：Chromium 141 では自動適用される。自前回転は基本不要。** ただし将来・他ブラウザのため `imageOrientation:'from-image'` を明示指定しておく。canvas.toBlob で書き出した JPEG はピクセル自体が回転済みなので Orientation タグの心配は不要。

## 5. HEIC（重要な制約・未解決課題あり）

pillow-heif で EXIF を引き継いだ .heic を自作生成（116,966 bytes）。

| 項目 | 結果 |
|---|---|
| exifr.parse() で EXIF 取得 | **失敗**。`{errors:[{message:"Malformed EXIF data"}]}` のみ |
| `<img>` で canvas 描画 | **不可**。onerror 発火 |
| createImageBitmap(heicFile) | **不可**。`InvalidStateError: The source image could not be decoded.` |

「Chromium は HEIC デコード不可」を実測で確認。

**heic2any での代替（実測）**
- 変換成功。3024x4032 を約 **3214ms** で変換
- バンドル gzip 330.6KB（libheif-js は 681.6KB）
- **変換後 JPEG に EXIF は残らない**（canvas 経由の再エンコードのため）

→ HEIC から「見た目」と「キャプション用メタデータ」の両方を得るには、変換だけでは完結しない。EXIF は変換前の生バイト列から取る必要があるが、**exifr はこの自作 HEIC から EXIF を取り出せなかった**（exifr 側の制約か、pillow-heif が書くボックス構造が Apple 実機と異なるためかは未切り分け）。

## 6. 処理時間（6000x4000, 525,586 bytes JPEG）

exifr.parse() を5回連続実行：コールド 8.1ms → 以降 0.9 / 0.7 / 0.7 / 0.7 / 0.6ms。
**ウォームアップ後は 1ms 未満。** ボトルネックにならない。

## 推奨まとめ（設計判断）

1. `exifr/dist/lite.esm.mjs` を import（gzip 14.6KB）。mini は Make/Model 非対応で不可
2. 表示フォーマットは自前実装（`1/Math.round(1/exposureTime)` 等）
3. parse() の戻り値は undefined の可能性があるため必ず optional chaining
4. Orientation は自動適用。ただし `imageOrientation:'from-image'` を明示
5. HEIC は Chromium 直描画不可。heic2any 等の変換必須（重い・遅い＝動的 import ＋ローディング UI 必須）
6. **HEIC の EXIF 抽出は未解決課題**。実機再検証かフォールバック設計が必要
7. 大画像でも EXIF 読み取りは 1ms 未満

## 未検証（正直な申告）

- 実機 iPhone 撮影 HEIC での EXIF 抽出（入手できず、自作 HEIC のみ）
- iOS Safari 実機での動作（Chromium のみで検証）
- libheif-js での実デコード（サイズ計測のみ）
- AVIF・RAW 等 JPEG/HEIC 以外の形式（要件外）
- 実カメラのベンダー固有 MakerNote 領域（合成 EXIF のため対象外）
