# インプットメモ（参考アプリ: FRMM）

## 作りたいもの
自分で撮影した写真に「いい感じのフレーム」を付けるスマホアプリ。
リポジトリ: YashimaTakeshi/flame（空、コミットなし）／ブランチ: claude/mobile-photo-frame-app-2rx12i

## 参考アプリ FRMM のスクショから読み取った要素

### 1. ホーム画面
- モノクロ／ミニマル。背景 #EAEAEA 相当のライトグレー、黒のアウトライン。
- 中央にロゴ（正方形の枠 + 罫線 + "FRMM"）＝ フレームそのものがロゴ。
- 下に「現在の設定値」を等幅フォント（モノスペース）でリーダー罫（——）付きの一覧表示。
  項目: TITLE / ARTIST / DATE / SEPARATOR / EXPOSURE SETTINGS / STYLE /
  ALIGNMENT / CHARACTER SPACING / FONT SIZE / BORDER / COLOR / FONT / PURCHASE STATUS
- 丸ボタン3つ（黒丸・白アイコン）: カート（課金）／歯車（設定）／i（アプリ情報）
- 最下部に大きな黒丸の「+」FAB＝写真を選ぶ／撮る導線。

### 2. 課金画面（FRMM PRO）
- 王冠アイコン + "FRMM PRO"、説明文（フレームスタイル追加／フレームカラー追加／フォント追加）
- 買い切り ¥1,500 ／ サブスク 月額 ¥200（3日間無料トライアル付き）
- 下部に 利用規約 ｜ プライバシーポリシー ｜ 購入を復元

### 3-4. 初期値設定画面
- ヘッダー: ✕（破棄）／ タイトル「初期値設定」／ ✓（保存）
- カード型（白・角丸大）のセクション:
  - Title（テキスト入力／クリアボタン付き）
  - Artist（テキスト入力／プレースホルダ「アーティスト名を入力」）
  - Date format（yyyy.MM.dd 等をピッカー選択 + Example にプレビュー）
  - Separator（区切り文字 "," 等 + Example: CAMERA, LENS）
  - Exposure Settings（露出設定を表示 ON/OFF + Example）
  - Focal Length（焦点距離の表示: 35mm Eq. + Example: 24mm (iPhone)）
  - Style（Original - OR1 などのスタイル選択）
  - Layout（テキスト整列 Left/…、文字間隔 Normal、フォントサイズ Medium）
  - Color（ボーダー Standard + 色スウォッチ、カラー White）
  - Font（Helvetica / Helvetica Bold … をカルーセル的に選択）
- 各設定に「Example」行で実際の出力例を即時プレビューするのが特徴。

## 機能の芯（推定）
写真の EXIF（カメラ／レンズ／焦点距離／絞り・SS・ISO／撮影日）を読み取り、
白フチのフレーム下部にタイポグラフィとして焼き込んで書き出す。
＝「フレーム装飾」＋「撮影情報のキャプション化」がセット。

## ステータス
ユーザーから参考動画が追加で来る予定。届くまで着手せず待機。

---

# 参考動画（5本・計約60秒）から読み取った仕様

対象写真: 夕景。キャプション「Untitled, 2026.09.20, FUJIFILM X-M5, SIGMA 18-50mm F2.8 DC DN | Contemporary 021」

## 編集画面の共通構造
- ヘッダー: 左「<」（戻る）／右「保存」（ピル型ボタン）
- 中央: プレビュー（実際の書き出し結果そのまま。背景は薄グレー、プレビューに薄いドロップシャドウ）
- 下部: オプション行（選択中タブの内容）＋ 常時表示のタブバー
  タブ: Style / Layout / Color / Font / Info（丸角ピル、選択中はグレー背景）

## Style タブ（横スクロールのチップ列・アスペクト比でグループ分け）
- OR1 / OR2 / OR3 … 元写真のアスペクト比のまま
- SQ1〜SQ4（1:1）
- TF1（3:4）
- FF1〜FF3（4:5）
- NST1（9:16）
- STN1〜STN3（16:9）
※ 計15種。チップには比率（1:1 / 3:4 / 4:5 / 9:16 / 16:9）が表示される。

### スタイルごとのレイアウト差（確認できたもの）
- OR1: 余白ごく細、キャプション1行（カンマ区切りで全部つなぐ）
- OR2: キャプション3行（1行目 Title, Date／2行目 カメラ（ボールド）／3行目 レンズ（グレー））
- SQ1: 正方形キャンバス中央に写真、直下に1行キャプション
- SQ3: 正方形キャンバス上寄せ、下に大きな余白（ポラロイド的）
- TF1: 3:4キャンバス、写真中央やや上、下に余白
- FF2: キャプションが写真の「上」に配置される
- NST1 / STN2: 9:16 / 16:9 にキャンバスを拡張して写真を配置

## Layout タブ（3つの縦ホイールピッカー）
- 整列: Left / Center / Right
- 文字間隔: Tight / Normal / Wide / Widest
- フォントサイズ: Small / Medium / Large
（変更は即プレビュー反映）

## Color タブ（2つの縦ホイールピッカー）
- ボーダー: Standard / Bordered（Bordered は写真の外側に細いヘアライン枠が付く）
- 背景色: White / Black / Ivory / … / Warm White / Gunmetal / Onyx / … / Silver Sand / Sunny Yellow / Sakura
  → 背景を暗色にするとキャプション文字色が自動で白／グレーに反転する
  → 各色にスウォッチ（小さな四角）が左に付く

## Font タブ（縦ホイールピッカー・各行をその書体自体でプレビュー）
確認できた書体: Helvetica / Helvetica Bold / Futura / Futura Bold / DIN /
Copperplate / Copperplate Bold / Didot / Georgia Bold / TimesNewRoman /
TimesNewRoman Bold / Baskerville / Baskerville SemiBold

## Info タブ
- 下部に「Default（初期値に戻す）」「Edit（情報編集シートを開く）」の2ボタン
- Edit シート（✕／✓ ヘッダー）:
  - Artwork information: Title（Untitled）／Artist（プレースホルダ）／Date（2026.09.20）… 各行にクリア(×)
  - Technical information: Preset（ピッカー／None）／カメラ機種（FUJIFILM X-M5）／レンズ（SIGMA 18-50mm F2.8 DC DN | Contemporar…）
  - 「プリセットとして保存」… カメラ＋レンズの組み合わせをプリセット化して再利用できる

## 設計上の要点
1. プレビュー＝書き出し結果（WYSIWYG）。全操作が即時反映。
2. 「スタイル（キャンバス比＋配置テンプレ）」と「タイポ設定（整列・字間・サイズ・書体・色）」が直交する2軸構造。
3. EXIF から カメラ／レンズ／日付／露出／焦点距離 を自動取得、手動上書きも可（プリセット保存）。
4. UI はモノクロ・等幅／欧文書体中心。アプリ自体がミニマルで「作品の邪魔をしない」。
