# Fuchidori（縁取り）— 作業メモ

写真・動画に額（フレーム）と撮影情報の文字を付ける PWA。React + Zustand + Vite、Cloudflare Workers で配信。
新しいセッションは、まずこのファイルだけで状況をつかむ（リポジトリ全体の読み直しはしない）。

## 公開先
- アプリ: https://fuchidori.yashimastudio.com（ほか fuchidori.my-sakura.workers.dev・GitHub Pages）
- 紹介ページ: https://yashimastudio.com/fuchidori/（英語 /fuchidori/en/）。ソースは `site/`（別 worker `yashimastudio-site`）
- push で `verify`・`cloudflare`・`pages`（`site/` は `site`）が走り公開される。公開したくないコミットは件名に `[skip ci]`

## どこに何があるか（必要な所だけ開く）
- 設計の経緯: `docs/design.md`（6000行超。**頭から読まない**。`grep -n "^### 3\.3"` などで節を探す。スマホの編集画面は §3.30〜3.31）
- スマホの設定欄: `src/app/editor/OptionRow.tsx`（左右の払い）・`src/app/ui/tools.tsx`（組・Line・Cells）・`src/app/panels/*Panel.tsx`
- 道具の帯: `src/app/editor/TabBar.tsx`／写真のピンチ・長押し: `src/app/useStageZoom.ts`／UI 状態: `src/app/state/ui.ts`
- 見た目: `src/app/editor.css`・`src/app/theme.css`

## 検収（この順。出力は grep で要点だけ見る）
1. `npm run verify`（lint・typecheck ほか）
2. `npx vitest run`（単体 209 件）
3. `npm run test:browser`（実ブラウザ 30 件）
4. `npm run build && node scripts/shot.mjs`（スマホ実寸の配置・ピンチ・払い・長押し）
   - `node scripts/shot.mjs 2>&1 | grep -E "^(ピンチ|左右に払う|長押し|ページ内のエラー)|はみ出す"`

## 決まりごと
- 依頼者への報告は日本語・結論から・簡潔に。数値はコードで確かめてから出す。曖昧な指示は推測せず確認する
- コミットの末尾: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` と `Claude-Session: <セッションURL>`。モデル名を本文に書かない
- PR は頼まれたときだけ。作業ブランチ `claude/mobile-photo-frame-app-2rx12i`
- コードのコメントは日本語・理由を書く（周りに合わせる）
- 紹介ページは CSP で inline の style/script 不可。依頼者の写真の元データは `site/tools/work/src`（git 管理外）

## 環境のはまりどころ
- Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`。指の操作は CDP `Input.dispatchTouchEvent`（`synthesizeScrollGesture` は効かない）
- `pkill -f` は自分のシェルまで落とすことがある。PID を特定して止める
- この環境から公開サイト（*.yashimastudio.com）には接続できない。公開の確認は GitHub Actions の結果で行う

## 消費を抑える進め方（クラウドセッションのクレジットを使うため）
- 1つの依頼が終わったら、次の依頼は**新しいセッション**で始める（会話が長いほど毎回の読み込みが重くなる）
- 画面の確認は必要な所だけ切り出した1枚にまとめる。全部の組・全比率の撮影は検収（shot.mjs）に任せる
- 広い調査は Explore に出して結論だけ受け取る。同じファイルを二度開かない。大きなファイルは範囲を絞って読む
- 複数エージェントの Workflow は、依頼者が明示したときだけ使う
- 報告は「触ったファイル・やったこと・検収結果・積み残し」の4点
