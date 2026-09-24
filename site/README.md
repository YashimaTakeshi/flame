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
python3 site/tools/demo-photos.py      # 作例の「写真の代わり」の絵 → site/tools/work/
node site/tools/render-demos.mjs       # アプリで縁取りして書き出す・画面写真を撮る
python3 site/tools/build-images.py     # WebP に縮めて public/fuchidori/img/ へ
node site/tools/build-pages.mjs        # ページ（文面は build-pages.mjs の中）
node site/tools/build-og.mjs           # SNS で共有したときの画像
node site/tools/preview.mjs            # スマホ幅・PC 幅で撮る。横のはみ出しと読み込み失敗を確かめる
```

実写の作例が用意できたら、`site/tools/work/` の絵を差し替えて `render-demos.mjs` から流し直す。
文面には、アプリが**今できること**だけを書く（計画中の機能は書かない）。
