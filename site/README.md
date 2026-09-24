# site — yashimastudio.com（Fuchidori の紹介ページ）

アプリ本体（`fuchidori.yashimastudio.com`）とは別の Worker で配る静的ページ。

| アドレス | 中身 |
|---|---|
| `yashimastudio.com/` | 構想が固まるまで `/fuchidori/` へ一時転送（`public/_redirects`） |
| `yashimastudio.com/fuchidori/` | 紹介（日本語） |
| `yashimastudio.com/fuchidori/en/` | 紹介（英語） |
| `yashimastudio.com/fuchidori/privacy/` | プライバシーポリシー（`/en/privacy/` に英語版） |

`public/` がそのまま配られる（`.github/workflows/site.yml`、`site/public/**` を変えて push すると公開）。

## 作り直し方

```sh
npm run build                          # アプリ本体（作例をアプリで書き出すため）
# 依頼者の写真を site/tools/work/src/ に置く（torii / tree / beach / stars .jpg。リポジトリには入れない）
python3 site/tools/real-photos.py      # 作例用の撮影情報を書き込む → site/tools/work/real-*.jpg
node site/tools/render-demos.mjs       # アプリで縁取りして書き出す・画面写真を撮る
python3 site/tools/build-images.py     # WebP に縮めて public/fuchidori/img/ へ（文字の拡大図も切り出す）
node site/tools/build-pages.mjs        # ページ（文面は build-pages.mjs の中）
OG_SERIF=<明朝の woff2> node site/tools/build-og.mjs      # SNS で共有したときの画像
PREVIEW_SERIF=<明朝の woff2> node site/tools/preview.mjs  # スマホ・タブレット・PC 幅で撮る。はみ出し・読み込み失敗・CSP 違反を確かめる
```

明朝の woff2 は確認と共有画像の描画にだけ使う（例: `npm pack @fontsource/noto-serif-jp` の japanese-600）。ページ自体は端末の明朝体を使い、書体ファイルは配らない。

## 紙面の決まり（editorial-design で決めた値。これ以外を使わない）

| 項目 | 値 |
|---|---|
| 色 | 紙 `#f4f2ee`／墨 `#23211f`／朱 `#b4442c`（押せる所だけ）／罫 `#dcd8d0` |
| 書体 | 見出しは明朝、本文はゴシック |
| 文字 | 見出し大・見出し中・本文 16px・注記 12px |
| 余白 | 8／16／40／120px（スマホは 72px） |

文面には、アプリが**今できること**だけを書く（計画中の機能は書かない）。作例の撮影情報は作例用の値で、ページの末尾にそう明記している。
