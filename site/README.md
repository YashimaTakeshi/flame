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
python3 site/tools/build-images.py     # WebP に縮めて public/fuchidori/img/ へ。frames.json（額の中の写真と文字の位置）と
                                       # 冒頭の撮って出し（hero-photo。書き出した hero から写真の部分を原寸で切り出す）も作る
node site/tools/build-pages.mjs        # ページを書き出す（文面と作例の並びは build-pages.mjs の中）。
                                       # あわせて assets/fuchidori.css の「@generated」の区間（作例ごとの縦横比・展示室の高さ）を
                                       # frames.json から書き直す。作例を書き出し直したら、これを流すだけで揃う
OG_SERIF=<明朝の woff2> node site/tools/build-og.mjs      # SNS で共有したときの画像（og-ja.jpg / og-en.jpg）
PREVIEW_SERIF=<明朝の woff2> node site/tools/preview.mjs /tmp/pv  # スマホ・タブレット・PC 幅で撮る。はみ出し（途中の位置も）・読み込み失敗を確かめる
```

動きの確認は、本番と同じ CSP で配ってスクロールしながら撮る。

```sh
PREVIEW_SERIF=site/tools/work/preview-serif.woff2 node site/tools/serve.mjs 8830   # / は site/public
node site/tools/shoot.mjs http://127.0.0.1:8830/fuchidori/ /tmp/shots both        # 390×844 と 1440×900。report.json にはみ出し・エラー
```

`?nosda` を付けると、CSS のスクロール連動（animation-timeline）が無いブラウザの代わりの動き（IntersectionObserver）で見られる。

明朝の woff2 は確認と共有画像の描画にだけ使う（例: `npm pack @fontsource/noto-serif-jp` の japanese-600）。ページ自体は端末の明朝体を使い、明朝は配らない。
欧文の飾り書体（Playfair Display・Jost、OFL）は `public/fuchidori/fonts/` に置いて自前で配る（ライセンスも同じ場所。フッターからリンク）。

### 冒頭の写真の解像感

冒頭の撮って出し（`hero-photo-2400.webp`）は、書き出した hero（3,277 × 4,096）から写真の部分を切り出したもの。
いまの元写真（`work/src/torii.jpg`）は長辺 1,224px しかないので、3倍の iPhone の全画面（約 3,800 device px）ではまだ引き伸ばしになる。
長辺 3,000px 以上の元写真が届いたら `work/src/torii.jpg` を差し替えて、上の手順を頭から流す（hero と hero-photo が同じ元から作られ、着地で画素が重なる）。

## 紙面の決まり（「夜のギャラリー」。これ以外を使わない）

炭色の壁に照明の当たったプリントが掛かる写真展として組む。作品の横には美術館の作品ラベル（番号・題・機材・比率 · 地色 · 書体 · 行数）。

| 項目 | 値 |
|---|---|
| 色 | 壁 `#1f1e1c`（深い所 `#171614`）／文字 `#ece7de`／弱め `#aca69b`／罫 文字色の 14%／照明 `rgb(255 238 212)`。昼の展示室（比率・使い方）は壁 `#cdc8be`／文字 `#1f1d1a`／弱め `#57534c`。印は朱 `#d2402f`（ダーマトの丸・ルーペの枠）だけ |
| 地色の見本 | アプリの9色（White `#fff`・Warm White `#f6f4f1`・Ivory `#f0eadc`・Silver Sand `#c4c9c7`・Gunmetal `#2d3436`・Onyx `#181818`・Black `#000`・Sakura `#f4d5da`・Sunny Yellow `#f5e08a`） |
| 書体 | 見出しは明朝、本文はゴシック（どちらも端末の書体）。数字と番号は Playfair Display、ラベルの欧文は Jost |
| 文字 | 見出し `clamp(26px, 4.2vw, 46px)`・本文 15px・ラベル 11〜12px |
| 余白 | 左右 20px（760px 以上 48px）。区間の上下 104px（760px 以上 168px） |
| 暗い額 | Black・Onyx・Gunmetal と余白なしの作例は、額の縁に 1px の明るい線（`--rim`）を足して壁から浮かせる |
| 押せる所 | 44px 以上。いちばんしてほしいことは「人に教える」（天・冒頭・着地・展示の出口・Share の節）。次に「アプリを開く」 |

動きの決まり

- `<head>` で同期に読む `assets/boot.js` が、描画の前に `html.m`（動かしてよい）と `html.sda`（CSS のスクロール連動が使える）を付ける。舞台の高さは CSS が先に決める（途中で再読み込みしても同じ場所に戻る）
- `assets/fuchidori.js`（defer）が冒頭・展示室・出口・帯・比率の場面を描く。動かすのは transform・opacity・clip-path だけ。読めなかった・止まったときは `m` を外して止まった紙面に戻す
- JS が無い・「視差効果を減らす」のときは、どの写真と文章も止まった紙面で見える（`m` が付かない）
- 展示室の照明は舞台の中央に固定した絵（毎フレーム描き直さない）。層の用意（will-change）は、画面の近くにある場面だけ（`is-live`）

文面には、アプリが**今できること**だけを書く（計画中の機能は書かない）。作例の撮影情報は作例用の値で、ページの末尾にそう明記している。
写真が足りずに空いている枠は置かない（届いた写真はアプリで書き出して `build-pages.mjs` の `WORKS` に足す）。
