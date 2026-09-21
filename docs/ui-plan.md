`/home/user/flame` を読んだ上での統合実装計画です。以下すべて実測値（App.tsx / App.css / theme.css / usePreview.ts / compose.ts / save.ts / manifest.json）に基づいています。

---

# flame S3 エディタ タブ化 実装計画

## 0. 先に確定させること（仕様に記載が無い箇所の決定）

診断が挙げた gaps のうち、着手前に値を決めないと手戻りになるものだけを確定する。**★は仕様に無い新規決定**。

| 項目 | 決定値 | 根拠 |
|---|---|---|
| ★スタイルタブ 176px の内訳 | `padding-top 8 + 比率48 + gap 8 + 型チップ96 + padding-bottom 16 = 176` | 8の倍数のみ（§9.1）。48+96=144 の残り32をこう割る |
| ★タブの選択表現 | 56px の中央に**高さ32のピル**、選択中は `--ink` 地 `--bg` 文字の反転 | §9.1 の「反転 or 1px枠」の前者。タップ領域は 78×56 |
| ★角丸 | カード・シート 12（§9.7）／ピル・セグメント・チップ 9999（完全な丸） | §9.7 の12以外は未定義なので、丸めるものは全部ピルに倒す |
| ★シート背後の暗幕 | `rgba(35,33,31,.32)` | 影は禁止（§9.1）なので浮き上がりは暗幕で表す |
| ★全画面/シート高さ | S4 `88dvh`／SD `100dvh`／書き出し `auto`（内容高、上限 `88dvh`） | §9.7 の 88vh を dvh に読み替え（iOS の URL バー対策） |
| ★ヘッダー左 | `＜` ではなく**写真の入口**（`写真を選ぶ` / `写真を変える`） | S0 が無いので `＜` の戻り先が存在しない。S0 を作る段で `＜` に差し替える |
| 100ms vs 200ms の食い違い | **プレビュー再描画のみ 100ms（§9.4）、それ以外は 200ms（§9.6）** | §9.4 はプレビュー固有の例外と読む |
| z-index | 帯 1 / タブバー 2 / 暗幕 20 / シート 21 / トースト 30 | 未定義のため |
| ルーティング | `history.pushState` + `popstate` の**単一 listener**。URL は `#info` `#export` `#diagnostics` | §9.2（ライブラリ依存なし） |
| 情報タブのフィールド日本語ラベル | S4 の行ラベルを流用（`タイトル` `作者` `日付` `撮影地` `カメラ` `レンズ` `焦点距離` `露出`） | §9.4 の gap。同じ語を2箇所で使う |

---

## 1. コンポーネント構成

```
src/app/
├─ App.tsx                 ← 40行まで削る。route 分岐とシートの取り付けだけ
├─ state/
│  ├─ doc.ts               useDoc（zustand）DocState + 1段だけの undo
│  ├─ ui.ts                useUi（zustand）activeTab / sheet / band / busy
│  └─ history.ts           pushState / popstate の単一 listener（★これが無いと Android で離脱する）
├─ editor/
│  ├─ Editor.tsx           S3 の grid シェル（5行）
│  ├─ Header.tsx           48px。左=写真 / 中央=flame / 右=書き出すピル(32)
│  ├─ Stage.tsx            canvas + 8φドット + E3 差し替え
│  ├─ Band.tsx             E2 の帯（EXIF 欠落）
│  ├─ OptionRow.tsx        activeTab で panels を差し替える器
│  └─ TabBar.tsx           56px + safe-area、5タブ固定
├─ panels/
│  ├─ StylePanel.tsx       176px
│  ├─ LayoutPanel.tsx      96px（2行×2列）
│  ├─ ColorPanel.tsx       96px
│  ├─ FontPanel.tsx        96px
│  └─ InfoPanel.tsx        96px
├─ ui/
│  ├─ Sheet.tsx            Dismissible を型で強制する器 + visualViewport 追従
│  ├─ Segmented.tsx        role="radiogroup" / role="radio" の共通部品
│  ├─ Toggle.tsx           aria-pressed のトグル
│  └─ Note.tsx             E1（T1 ink-2）と E2（左2pxの ink 縦罫）の2形
├─ sheets/
│  ├─ InfoSheet.tsx        S4 情報編集（88dvh）
│  └─ ExportSheet.tsx      S5 step2（処理中）→ S6（保存結果）の1枚2ステップ
├─ Diagnostics.tsx         中身は据え置き。Sheet に載せ替えるだけ
├─ usePreview.ts           ★作り直し（ResizeObserver + rAF + 暗黙クリア回避）
├─ caption.ts              ★フィールド取捨・手入力の上書きを受け取れるようにする
├─ fonts-catalog.ts        ★和文（NotoSansJP）を1枚足す
├─ exif.ts                 変更なし
├─ theme.css               ★§9.1 のトークンに合わせて書き直し
└─ editor.css              ★新規（骨格・パネル・シート）
```

`App.css` は `editor.css` へ吸収して削除。`.diag` 系のみ `editor.css` 末尾に残す。

---

## 2. CSS の骨格

### 2.1 `theme.css`（全面差し替え）

```css
:root {
  /* §9.1 の色。これ以外の色を足さない。アクセント色は持たない */
  --bg:          #EDEAE6;
  --surface:     #F6F4F1;
  --ink:         #23211F;
  --ink-2:       #6E6A65;   /* 副次情報・単位・プレースホルダ */
  --ink-3:       #A4A09A;   /* 無効状態 */
  --line:        #D4CFC8;   /* ★装飾のリーダー罫だけ★ */
  --line-strong: #8E8880;   /* ★操作可能な要素の枠は必ずこちら★ */
  --shadow: 0 2px 12px rgba(35,33,31,0.14);  /* プレビューの canvas の外側にのみ */

  /* 旧名。Diagnostics.tsx:160 のインライン style が参照しているので当面残す */
  --ink-muted: var(--ink-2);

  /* §9.1 のタイポ。px は rem で持つ（§16.8）。1rem = 16px */
  --t1: 0.6875rem; --t1-lh: 1rem;     --t1-ls: 0.08em;
  --t2: 0.8125rem; --t2-lh: 1.25rem;  --t2-ls: 0.02em;
  --t3: 1rem;      --t3-lh: 1.5rem;   --t3-ls: 0;
  --t4: 1.375rem;  --t4-lh: 1.75rem;  --t4-ls: 0.04em;
  --t-xs: var(--t1); --t-sm: var(--t2); --t-md: var(--t3); --t-lg: var(--t4); /* 旧名 */

  /* 余白は8の倍数のみ。4 は罫との相殺にのみ使う */
  --s1: 8px; --s2: 16px; --s3: 24px; --s4: 32px;
  --gutter: 16px;

  /* 骨格の固定寸法 */
  --header-h: 48px;
  --tabbar-h: 56px;
  --optionrow-h: 96px;      /* スタイルタブだけ 176px に上書きする */
  --tap: 44px;

  --radius: 12px;           /* §9.7 カード・シートの角丸12 */
  --radius-pill: 9999px;

  --ui-font: "Roboto Mono", ui-monospace, SFMono-Regular, "Hiragino Sans", "Noto Sans JP", sans-serif;
  --mono-font: var(--ui-font);

  --scrim: rgba(35, 33, 31, 0.32);   /* ★仕様に記載なし */
  --motion: 160ms;
}

@media (prefers-reduced-motion: reduce) { :root { --motion: 0ms; } }

* { box-sizing: border-box; }

html, body {
  height: 100%;
  margin: 0; padding: 0;
  overflow: hidden;                /* ★ページ自体はスクロールさせない */
  overscroll-behavior: none;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--ui-font);
  font-size: var(--t3);
  line-height: var(--t3-lh);       /* ★1.6 の一律指定はやめる（96px の内訳が合わなくなる） */
  font-feature-settings: "tnum" 1; /* 設定値の桁揃え */
  -webkit-text-size-adjust: 100%;
}

button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }

/* 選択＝塗りの反転、フォーカス＝破線。直交させる（§16.8） */
:where(button, a, input, textarea, [role='radio'], [role='tab'], label.tapable):focus-visible {
  outline: 2px dashed var(--ink);
  outline-offset: 2px;
}

/* 見た目が44px未満の孤立した的は、当たり判定だけ広げる（§16.8） */
.tap44 { position: relative; }
.tap44::before {
  content: ''; position: absolute; left: 50%; top: 50%;
  translate: -50% -50%;
  width: max(100%, var(--tap)); height: max(100%, var(--tap));
}

.t1 { font-size: var(--t1); line-height: var(--t1-lh); letter-spacing: var(--t1-ls); }
.t2 { font-size: var(--t2); line-height: var(--t2-lh); letter-spacing: var(--t2-ls); }
.t3 { font-size: var(--t3); line-height: var(--t3-lh); letter-spacing: var(--t3-ls); }
.t4 { font-size: var(--t4); line-height: var(--t4-lh); letter-spacing: var(--t4-ls); }
```

### 2.2 骨格（`editor.css`）

```css
/* 5行。上から ヘッダー / プレビュー / E2の帯 / オプション行 / タブバー。
   ★スクロールするのはシートの中だけ。画面本体は絶対にスクロールさせない★ */
.app {
  height: 100dvh;
  display: grid;
  grid-template-rows:
    calc(var(--header-h) + env(safe-area-inset-top))  /* ヘッダー */
    minmax(0, 1fr)                                    /* プレビュー（可変） */
    auto                                              /* E2 の帯（無ければ0） */
    var(--optionrow-h)                                /* オプション行 */
    calc(var(--tabbar-h) + env(safe-area-inset-bottom)); /* タブバー */
  overflow: hidden;
}
@supports not (height: 100dvh) { .app { height: 100vh; } }

/* スタイルタブのときだけオプション行が伸びる。プレビューが自動で縮む */
.app[data-tab='style'] { --optionrow-h: 176px; }

/* ───────── ヘッダー 48px ───────── */
.hdr {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--s1);
  padding-top: env(safe-area-inset-top);
  padding-inline: var(--gutter);
}
.hdr__title {
  text-align: center;
  font-size: var(--t1); line-height: var(--t1-lh); letter-spacing: var(--t1-ls);
  color: var(--ink-2);
}
.pill {                                   /* ヘッダー右（高さ32・当たり判定44） */
  height: 32px; padding: 0 var(--s2);
  border: 1px solid var(--ink); border-radius: var(--radius-pill);
  background: var(--ink); color: var(--bg);
  font-size: var(--t1); letter-spacing: var(--t1-ls); white-space: nowrap;
}
.pill--ghost { background: transparent; color: var(--ink); border-color: var(--line-strong); }
.pill:disabled { background: transparent; color: var(--ink-3); border-color: var(--line-strong); }

/* ───────── プレビュー（可変） ───────── */
.stage {
  position: relative;
  min-height: 0;                          /* ★これが無いと grid 行が内容に押し広げられる */
  overflow: hidden;                       /* ★canvas が下のパネルに重なるのを止める */
  display: grid; place-items: center;
  padding: var(--s3) var(--s4);           /* §9.4 上下24 / 左右32 */
}
/* ★width:100% / height:auto のインライン指定を usePreview から必ず外すこと。
   縦位置の写真が 60dvh で潰れていた原因はそこ */
.stage__canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;                       /* 置換要素なので比率を保ったまま収まる */
  box-shadow: var(--shadow);              /* 唯一の影 */
}
.stage__dot {                             /* 100ms を超えたら呼吸する 8φ の ink 点 */
  position: absolute; top: var(--s1); right: var(--s1);
  width: 8px; height: 8px; border-radius: 50%; background: var(--ink);
  animation: breath 1200ms ease-in-out infinite;
}
@keyframes breath { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .stage__dot { animation: none; opacity: .6 } }

.stage__e3 {                              /* E3 = プレビュー領域だけを置き換える */
  display: grid; gap: var(--s2); justify-items: center; text-align: center;
  max-width: 28ch;
}

/* ───────── E2 の帯 ───────── */
.band {
  margin: 0 var(--gutter) var(--s1);
  padding: var(--s1) var(--s2);
  border: 1px solid var(--ink);
  border-left-width: 2px;                 /* 左に2pxの ink 縦罫 */
  background: var(--bg);
  font-size: var(--t2); line-height: var(--t2-lh); letter-spacing: var(--t2-ls);
  max-height: 40dvh; overflow: auto;      /* ★帯が伸びてもタブバーを押し出さない */
}
.band__acts { display: flex; flex-wrap: wrap; gap: var(--s1); margin-top: var(--s1); }

/* ───────── オプション行 ───────── */
.optrow { border-top: 1px solid var(--line); overflow: hidden; }

/* ───────── タブバー 56px ───────── */
.tabbar {
  display: grid; grid-template-columns: repeat(5, 1fr);
  border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--bg);
}
.tab {
  height: var(--tabbar-h);                /* 78×56 = 44px 要件を満たす */
  display: grid; place-items: center;
  border: 0; background: none; color: var(--ink-2);
  font-size: var(--t1); line-height: var(--t1-lh); letter-spacing: var(--t1-ls);
}
.tab > span {
  display: inline-grid; place-items: center;
  height: 32px; padding: 0 var(--s1); border-radius: var(--radius-pill);
}
.tab[aria-selected='true'] { color: var(--bg); }
.tab[aria-selected='true'] > span { background: var(--ink); }
```

### 2.3 共通部品

```css
/* セグメント（整列・字間・文字・比率）。高さ44を必ず満たす。
   横は隣接させて隙間を作らない＝指が外れても必ずどれかに当たる */
.seg { display: flex; min-height: var(--tap);
       border: 1px solid var(--line-strong); border-radius: var(--radius-pill); overflow: hidden; }
.seg__b { flex: 1 1 0; min-width: 0; min-height: var(--tap);
          border: 0; background: transparent; color: var(--ink-2);
          font-size: var(--t1); letter-spacing: var(--t1-ls); white-space: nowrap; padding: 0; }
.seg__b + .seg__b { border-left: 1px solid var(--line-strong); }
.seg__b[aria-checked='true'] { background: var(--ink); color: var(--bg); }
.seg__b[aria-disabled='true'] { color: var(--ink-3); }

/* 横スクロール行。★iOS の edge swipe（戻る）と取り合わないよう端から16px離す */
.hscroll {
  display: flex; gap: var(--s1);
  overflow-x: auto; overscroll-behavior-x: contain;
  padding-inline: var(--gutter); scroll-padding-inline: var(--gutter);
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
          mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
}
.hscroll::-webkit-scrollbar { display: none; }

/* トグル（情報タブ） */
.tg { flex: 0 0 auto; min-height: var(--tap); padding: 0 var(--s2);
      border: 1px solid var(--line-strong); border-radius: var(--radius-pill);
      background: transparent; color: var(--ink-2);
      font-size: var(--t1); letter-spacing: var(--t1-ls); white-space: nowrap; }
.tg[aria-pressed='true'] { background: var(--ink); border-color: var(--ink); color: var(--bg); }

/* ボタン */
.btn      { width: 100%; min-height: 56px; border: 1px solid var(--ink);
            border-radius: var(--radius-pill); background: var(--ink); color: var(--bg);
            font-size: var(--t3); }
.btn--sec { min-height: 48px; background: transparent; color: var(--ink);
            border-color: var(--line-strong); }
.btn--txt { min-height: 48px; background: none; border: 0; color: var(--ink); text-decoration: underline; }
.btn--s   { min-height: var(--tap); padding: 0 var(--s2); border: 1px solid var(--line-strong);
            border-radius: var(--radius-pill); background: transparent;
            font-size: var(--t1); letter-spacing: var(--t1-ls); }

/* E1 / E2 の2形 */
.e1 { font-size: var(--t1); line-height: var(--t1-lh); letter-spacing: var(--t1-ls); color: var(--ink-2); margin: 0; }
```

### 2.4 シート

```css
.scrim { position: fixed; inset: 0; z-index: 20; background: var(--scrim); border: 0; }

.sheet {
  position: fixed; left: 0; right: 0; z-index: 21;
  bottom: var(--kb, 0px);                        /* ★ソフトキーボードぶん押し上げる */
  background: var(--bg);
  border-top: 1px solid var(--line-strong);
  border-radius: var(--radius) var(--radius) 0 0;
  display: grid; grid-template-rows: var(--header-h) minmax(0, 1fr);
  animation: rise var(--motion) ease-out;
}
.sheet[data-size='tall'] { height: min(88dvh, var(--vvh, 88dvh)); }  /* S4 */
.sheet[data-size='auto'] { max-height: min(88dvh, var(--vvh, 88dvh)); }/* 書き出し */
.sheet[data-size='full'] {                                            /* SD */
  top: 0; height: 100dvh; border-radius: 0; padding-top: env(safe-area-inset-top);
}
.sheet__hdr {
  display: grid; grid-template-columns: var(--tap) 1fr var(--tap);
  align-items: center; padding-inline: var(--s1);
  border-bottom: 1px solid var(--line);
}
.sheet__hdr button { min-height: var(--tap); background: none; border: 0; }
.sheet__body {
  overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
  padding: var(--s2) var(--gutter) calc(var(--s3) + env(safe-area-inset-bottom));
}
@keyframes rise { from { transform: translateY(6%); opacity: .5 } to { transform: none; opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .sheet { animation: none } }

/* S4 のカード（§9.7） */
.card { background: var(--surface); border-radius: var(--radius); padding: var(--s2); }
.card__row { display: grid; grid-template-columns: 6.5rem 1fr var(--tap);
             align-items: center; min-height: 48px; }
.card__row + .card__row { border-top: 1px solid var(--line); }
.card__row input { width: 100%; min-height: var(--tap); background: transparent;
                   border: 0; text-align: right; }
```

### 2.5 プレビューの駆動（`usePreview.ts` 作り直しの要点）

```ts
// ★変更点は3つ。(1) 親幅を1回読むのをやめ ResizeObserver にする
//                (2) width/height は「変わったときだけ」代入する（暗黙クリア＝白抜きを避ける）
//                (3) rAF に合流させ、1フレーム1回しか描かない
export function usePreview(
  hostRef: React.RefObject<HTMLElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  scene: Scene | null, photo: CanvasImageSource | null,
  exportLongEdge: number, onFail: (f: PreviewFailure | null) => void,
): void {
  const raf = useRef(0);
  useEffect(() => {
    const host = hostRef.current, el = canvasRef.current;
    if (!host || !el || !scene) return;

    const draw = (): void => {
      raf.current = 0;
      const cs = getComputedStyle(host);
      const availW = host.clientWidth  - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const availH = host.clientHeight - parseFloat(cs.paddingTop)  - parseFloat(cs.paddingBottom);
      if (availW <= 0 || availH <= 0) return;
      const aspect = scene.canvas.widthLu / scene.canvas.heightLu;      // w / h
      const cssW = Math.min(availW, availH * aspect);                   // ★箱に収める
      const t = makePreviewTarget(scene, cssW, window.devicePixelRatio || 1, exportLongEdge);
      if (el.width !== t.widthPx || el.height !== t.heightPx) {         // ★変わったときだけ
        el.width = t.widthPx; el.height = t.heightPx;
      }
      const ctx = el.getContext('2d');
      if (!ctx) { onFail({ reason: 'canvas', message: 'この端末では画像を描けませんでした' }); return; }
      try { renderScene(scene, ctx, t, resources); onFail(null); }
      catch (e) { onFail({ reason: 'unknown', message: e instanceof Error ? e.message : String(e) }); }
    };
    const req = (): void => { if (!raf.current) raf.current = requestAnimationFrame(draw); };
    const ro = new ResizeObserver(req); ro.observe(host); req();
    return () => { ro.disconnect(); if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [hostRef, canvasRef, scene, photo, exportLongEdge, onFail]);
}
```

canvas 側に `role="img"` と、設定変更のたびに更新する `aria-label` を付ける（§16.8）。

```tsx
<canvas ref={canvasRef} className="stage__canvas" role="img"
        aria-label={`プレビュー: ${doc.styleId}、${colorLabel}、キャプション1行`} />
```

---

## 3. タブ5つの中身（寸法つき）

タブ文言は `スタイル` `組み` `地色` `書体` `情報` の5つ固定。増やさない。

### 3.1 スタイル（176px）

```
┌─ 8 ─────────────────────────────────────┐
│ [元比][1:1][3:4][4:5][9:16][16:9]        │ 48px・6等分・各 54.8×48
├─ 8 ─────────────────────────────────────┤
│  ▭                                      │ 96px（チップ 72×88 を上下中央）
│  OR1            いまは「元比」だけ使えます │ 右に T1 ink-2 の注記
└─ 16 ────────────────────────────────────┘
```

```tsx
// panels/StylePanel.tsx
const RATIOS = [
  { id: 'OR',  label: '元比',  enabled: true  },   // ← registry.ts が入るまで true はここだけ
  { id: 'SQ',  label: '1:1',   enabled: false },
  { id: 'TF',  label: '3:4',   enabled: false },
  { id: 'FF',  label: '4:5',   enabled: false },
  { id: 'NST', label: '9:16',  enabled: false },
  { id: 'STN', label: '16:9',  enabled: false },
] as const;
```

```css
.p-style { display: grid; grid-template-rows: 48px 96px; gap: var(--s1);
           padding: var(--s1) var(--gutter) var(--s2); }
.p-style__types { display: flex; align-items: center; gap: var(--s1); }
.stylechip { flex: 0 0 72px; height: 88px; display: grid; gap: 4px; justify-items: center;
             align-content: center; border: 1px solid var(--line-strong);
             border-radius: var(--radius); background: transparent; }
.stylechip[aria-checked='true'] { background: var(--ink); border-color: var(--ink); color: var(--bg); }
.stylechip svg { width: 56px; height: 64px; }      /* SVG の静的ミニ図（1個200B程度） */
```

- 型チップの `aria-label` は `StyleDef.label` を入れる（いまは `元比・細枠・1行`）。
- ［全部見る］は S3-a が無いので**置かない**（押しても行き先が無いボタンを作らない）。段階5 で S3-a と同時に足す。そのときチップ幅を 64 に詰め、右端にピル（高さ32・幅72）を置く。

### 3.2 組み（96px・2行×2列）

```
 組み方向 [横組み][縦組み]   整列 [左][中][右]      ← セル44
                                                   ← 行間8
 字間   [狭][標][広][最広]   文字 [小][中][大]      ← セル44
```

```css
.p-layout { display: grid; grid-template-columns: 1fr 1fr;
            grid-auto-rows: var(--tap); gap: var(--s1);
            padding: 0 var(--gutter); align-content: center; height: var(--optionrow-h); }
.p-layout__cell { display: grid; grid-template-columns: auto 1fr;
                  align-items: center; gap: var(--s1); min-width: 0; }
.p-layout__lbl  { font-size: var(--t1); letter-spacing: var(--t1-ls);
                  color: var(--ink-2); white-space: nowrap; }
```

| セル | ラベル | 選択肢 | ストア |
|---|---|---|---|
| 1-1 | `組み方向` | `横組み` / `縦組み` | `layout.verticalJa` |
| 1-2 | `整列` | `左` / `中` / `右`（縦組み時 `上` `中` `下`） | `layout.align` |
| 2-1 | `字間` | `狭` `標` `広` `最広` | `layout.tracking` |
| 2-2 | `文字` | `小` `中` `大` | `layout.size` |

縦組みは常に `aria-disabled` かつ `--ink-3`。タップすると**モーダルを出さず**、オプション行の下端に T1 で1行:

```ts
// 和文書体を選んでいない → 仕様の文面そのまま
'縦組みには和文の書体を選んでください'
// 和文書体を選んでいる    → ★新規（縦書きの描画が未実装のため）
'縦組みはまだ使えません'
```

### 3.3 地色（96px）

今回は背景色の段だけを出す（下段52px を 96px の中で上下中央）。ボーダー・質感は**軸ごと出さない**（後述 §5 の判定規則）。

```css
.p-color { height: var(--optionrow-h); display: grid; align-content: center; }
.sw      { flex: 0 0 72px; min-height: 52px; display: grid; justify-items: center;
           gap: 4px; border: 0; background: none; }
.sw__dot { position: relative; width: 32px; height: 32px; border-radius: 50%;
           border: 1px solid var(--line-strong); }
.sw[aria-checked='true'] .sw__dot::after {          /* 外側 2px の --line-strong リング */
  content: ''; position: absolute; inset: -4px; border: 2px solid var(--line-strong);
  border-radius: 50%;
}
.sw__name { font-size: var(--t1); line-height: var(--t1-lh); letter-spacing: var(--t1-ls);
            color: var(--ink-2); white-space: nowrap; }
```

- チップ 32φ ＋ 4 ＋ 色名 T1 16 = 52。当たり判定は 72×52（44px 要件を満たす）。
- 色名は必須（`White` / `Warm White` / `Ivory` は見分けがつかない）。既存の `COLORS`（App.tsx:22-32）の `value` をそのまま `.sw__dot` の `background` に流す。
- マウント時と写真差し替え時に、選択中を `scrollIntoView({ inline: 'center', block: 'nearest' })`。

### 3.4 書体（96px）

```css
.p-font { height: var(--optionrow-h); display: grid; align-content: center; }
.fcard  { flex: 0 0 120px; height: 80px; display: grid; place-content: center; gap: 4px;
          border: 1px solid var(--line-strong); border-radius: var(--radius);
          background: var(--surface); color: var(--ink); }
.fcard[aria-checked='true'] { background: var(--ink); border-color: var(--ink); color: var(--bg); }
.fcard__aa   { font-size: var(--t4); line-height: 1; }
.fcard__name { font-size: var(--t1); letter-spacing: var(--t1-ls); }
```

```tsx
// ★「Aa 書体名」をその書体自身で描く。preloadLatinFonts() 済みなので待ちもスケルトンも要らない
<button className="fcard" role="radio" aria-checked={sel === f.key}
        style={{ fontFamily: `"${f.family}", sans-serif` }}>
  <span className="fcard__aa">Aa</span>
  <span className="fcard__name">{f.label}</span>
</button>
```

- 欧文8枚 + **和文1枚**（`NotoSansJP`）。`public/fonts/manifest.json` の `jp` エントリ（453,096 bytes）があるので `ensureFont` で今すぐ読める。
- 和文カードは押した瞬間に `…` を出して取得。取得中は `aria-busy="true"`、失敗したらカードの下に E1 を出し、**黙ってフォールバックせず直前の書体に戻す**。

```
書体「Noto Sans JP」を読み込めませんでした
［もう一度読み込む］［同梱の書体（Arimo）に変える］
```

### 3.5 情報（96px・2行×44 + 行間8）

```
[日付][カメラ][レンズ][焦点距離][露出][タイトル][作者]   ← 44px・横スクロール
[初期値に戻す]  [編集…]                                  ← 44px
```

```css
.p-info { height: var(--optionrow-h); display: grid; grid-template-rows: var(--tap) var(--tap);
          gap: var(--s1); align-content: center; }
.p-info__acts { display: flex; gap: var(--s1); padding-inline: var(--gutter); }
.p-info__acts > * { flex: 1; }
```

- トグルは `FieldId` の7個（`title` `artist` `date` `camera` `lens` `exposure` `focal`）。`place` は撮影地が未実装なので**出さない**。
- `［編集…］` → S4。`［初期値に戻す］` → トグル全 ON・タイトル `Untitled`・作者空・手入力の上書きを破棄。
- `caption.ts` を拡張して、このトグルが実際にキャプションに効くようにする:

```ts
export interface CaptionParts {
  readonly title: string;
  readonly artist: string;
  readonly fields: Readonly<Record<FieldId, boolean>>;   // ★取捨はここ1本に集約
  readonly override: { camera: string | null; lens: string | null; date: Date | null };
}
// composeCaption は fields[x] が false の項目を push しない。
// ★空欄は行ごと省く。「（不明）」のような文字列を焼き込むことは絶対にしない。
```

---

## 4. 状態

`zustand` は既に `package.json` にある（未使用）。§1.2 と §13.1 に合わせて `src/app/state/` に置く。**写真（ImageBitmap）はストアに入れない。**

```ts
// state/doc.ts
export type TabId = 'style' | 'layout' | 'color' | 'font' | 'info';
export type FontKey = LatinFontKey | 'jp';

export interface DocState {
  readonly styleId: StyleId;                       // 'OR1' 固定（段階5まで）
  readonly ratio: 'OR' | 'SQ' | 'TF' | 'FF' | 'NST' | 'STN';
  readonly layout: {
    readonly align: 'left' | 'center' | 'right';
    readonly tracking: 'tight' | 'normal' | 'wide' | 'widest';
    readonly size: 'S' | 'M' | 'L';
    readonly verticalJa: boolean;                  // 常に false（描画が未実装）
  };
  readonly color: { readonly bg: string };
  readonly font:  { readonly key: FontKey };
  readonly info: {
    readonly fields: Record<FieldId, boolean>;
    readonly title: string;
    readonly artist: string;
    readonly override: { camera: string | null; lens: string | null; date: Date | null };
  };
}

interface DocStore {
  readonly doc: DocState;
  readonly prev: DocState | null;                  // ★E3 の ［1つ前に戻す］ 用。1段だけ
  patch(fn: (d: Draft<DocState>) => void): void;   // immer
  undo(): void;
  reset(): void;
}
export const useDoc = create<DocStore>()(...);     // patch は必ず prev = 現在の doc を保存してから
```

```ts
// state/ui.ts
export type SheetId = 'info' | 'export' | 'diagnostics';
interface UiStore {
  readonly activeTab: TabId;                       // 既定 'style'
  readonly sheet: SheetId | null;
  readonly hint: string | null;                    // 縦組みなど、T1 で1行出す注記
  readonly band: 'exif' | null;                    // E2。★押されるまで消さない
  readonly busy: string | null;                    // 写真の読み込み等（200ms 未満は出さない）
  readonly exportStep: 'working' | 'done' | null;
  readonly jp: 'idle' | 'loading' | 'error';
}
```

```ts
// state/history.ts ★これを入れないと Android の戻るでアプリごと消える（§9.2）
const HASH: Record<SheetId, string> = { info: '#info', export: '#export', diagnostics: '#diagnostics' };

export function installHistory(): void {
  history.replaceState({}, '', location.pathname);        // 直リンクで開かれた # を消す
  window.addEventListener('popstate', () => {             // ★listener は1つだけ
    const s = (history.state as { flameSheet?: SheetId } | null)?.flameSheet ?? null;
    useUi.setState({ sheet: s });
  });
}
export function openSheet(id: SheetId): void {
  useUi.setState({ sheet: id });
  history.pushState({ flameSheet: id }, '', HASH[id]);
}
export function closeSheet(): void { history.back(); }    // popstate 側で畳む＝経路を1本にする
```

`ui/Sheet.tsx` は §9.2 のとおり脱出口を型で強制する:

```tsx
type Dismissible = { onDismiss: () => void; dismissLabel: string };
export function Sheet(p: Dismissible & {
  title: string; size: 'tall' | 'auto' | 'full'; confirm?: { label: string; onConfirm: () => void };
  children: React.ReactNode;
}): React.ReactElement
```

`Sheet` の中で visualViewport を購読し、`✓` を含むヘッダーがキーボードに隠れないようにする（§9.7）:

```ts
useEffect(() => {
  const vv = window.visualViewport; if (!vv) return;
  const el = ref.current; if (!el) return;
  const apply = (): void => {
    el.style.setProperty('--kb',  `${Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))}px`);
    el.style.setProperty('--vvh', `${vv.height}px`);
  };
  apply(); vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply);
  return () => { vv.removeEventListener('resize', apply); vv.removeEventListener('scroll', apply); };
}, []);
```

---

## 5. 今回作る範囲と、作らない範囲

### 5.1 未実装の機能をどう見せるかの判定規則（これを先に決める）

> **軸のうち一部だけが使えない → 全部出し、使えないものを `--ink-3` にして T1 で理由を1行（モーダルは出さない）。**
> **軸そのものが1つも使えない → その軸を出さない。器（96px）だけ確保する。**
> **押しても行き先が無いボタンは置かない。**

根拠: §9.4 の「縦組みは和文書体を選ぶまで無効、タップすると下に T1」がそのまま前者の先例。後者は §9.6 の「`［閉じる］` だけのエラーは1つも作らない」の裏返し。

### 5.2 今回作る

| 範囲 | 内容 |
|---|---|
| S3 骨格 | 5行 grid、ヘッダー48、タブバー56+safe-area、オプション行96/176 |
| タブ5つ | 上記 §3 のとおり全部。中身が無い軸は判定規則で処理 |
| プレビュー | ResizeObserver + rAF、`object-fit` 相当の収め方、縦位置写真の潰れ修正、8φドット |
| E1 / E2 / E3 の器 | `Note.tsx` と `Band.tsx` と `stage__e3` |
| EXIF 欠落の帯 | 3つの出口を実際に動かす（`［ファイルの日付を使う（…）］` = `file.lastModified` / `［手で入力］` = S4 へ / `［入れない］` = 情報トグル全 OFF） |
| S4 情報編集シート | 88dvh、✕=破棄 / ✓=確定、タイトル・作者・カメラ・レンズ・日付の手入力、visualViewport 追従 |
| 書き出しシート | 1枚のシートで「処理中 → 保存結果」。`<img src=blobURL>` は現状の挙動をそのまま移設 |
| ★`share()` の同期呼び出し修正 | 書き出しはシートを開いた時点で完了させ、`［写真に保存 / 共有］` の click ハンドラでは **await を1つも挟まずに** `saveImage` を呼ぶ（現状 App.tsx:185-215 は `await decode` → `await convertToBlob` → `saveImage` で、save.ts:66-70 が自ら書いた契約を破っている） |
| SD 自己診断 | `Sheet size="full"` に載せ替え、`pushState` で履歴に積む。中身（表14行・計測・HEIC 確認）は据え置き |
| a11y | 44px、`focus-visible` 破線、`--line-strong`、`role="radiogroup"`/`radio`、canvas の `role="img"`+`aria-label`、`<label for>`、`prefers-reduced-motion`、rem |

### 5.3 今回作らない（器も作らない）

| 作らないもの | 理由 | いつ入るか |
|---|---|---|
| S0 ホーム / S1 モード選択 / S7 初期値 / S8 について | 画面が丸ごと無い。今回はエディタ1枚に集中する | 段階16-17 |
| 2モード（こだわる／お手軽） | `mode` の置き場（`useLibrary`）ごと無い。**モード分岐を今から `src/app` に撒かない** | 段階17 |
| 15スタイル / S3-a | `src/core/styles/registry.ts` が存在せず、`buildScene` は OR1 相当を直書きしている（compose.ts:46-49） | 段階5 |
| 質感（粒・印画紙・コマ枠） | `grainTiles.ts` は完成しているが `buildScene` が `grain` op を出さない | 段階6 |
| ボーダー（細枠） | 同上（`strokeRect` op を出していない） | 段階5 |
| 縦組みの描画 | `vertical-text.ts` は `r.verticalText()` が null なら何も描かない実装（＝選ばせると無言で消える） | 段階15 |
| 撮影地 | `public/geo/*.json` はあるが `src` に逆引きが無い | 段階13 |
| 複数枚 / フィルムストリップ / 進捗マス | 1枚しか持てない構造 | 段階14 |
| S5 ステップ1（解像度・形式・EXIF チェック）と Preflight | 書き出しは 4096 固定。Preflight の10 check が未実装 | 段階11-12 |
| HEIC 変換 / 非対応形式の E3 文面 | `heic2any` は既定では積まない（§9.6）。SD の HEIC 確認で実測が取れてから | 段階16 |
| 設定の永続化 | 置き場（S7 / `useLibrary`）が無い段で `localStorage` に書くとスキーマを二度作ることになる | 段階17 |
| トースト | `［元に戻す］` の対象（写真を外す）が複数枚前提 | 段階14 |

### 5.4 未実装だが「出す」もの（無効表示）

| 場所 | 見せ方 | 出す文字 |
|---|---|---|
| スタイルタブの比率5つ | `--ink-3` の無効セグメント + オプション行右に常設の T1 | ★`いまは「元比」だけ使えます` |
| 組みタブの `縦組み` | `--ink-3` + タップで T1 を1行（モーダルは出さない） | `縦組みには和文の書体を選んでください` ／ 和文選択後は ★`縦組みはまだ使えません` |

---

## 6. 実装の順番

手戻りが少ない順。各段の**完了判定**を満たしてから次へ進む。

**段階1 — トークンと骨格（最初にここを直さないと以降の寸法が全部ずれる）**
- `theme.css` を §2.1 で置き換え（`--line-strong` / `--ink-3` / T1〜T4 の rem / `tnum` / `focus-visible` / `--motion`）。
- `editor.css` を新規作成し §2.2 の `.app` grid を入れる。`App.css` の `.preview{max-height:60dvh}` を削除。
- `usePreview.ts` を §2.5 で作り直し、`el.style.width='100%'` / `height='auto'` を削除。`Stage` を `hostRef` で渡す。
- 完了判定: **393×852 と 2:3 の縦位置写真で、(a) タブバー相当の最下行が常に見えている (b) canvas が下のパネルに重ならない (c) 写真の比率が歪まない**。画面本体が1pxもスクロールしない。

**段階2 — state と分割**
- `state/doc.ts` / `state/ui.ts` を作り、App.tsx の7つの `useState`（title/artist/fontKey/colorKey/sizeKey/trackKey/alignKey）を `useDoc` に移す。写真（`loaded`）は `App` の `useState` のまま。
- `Editor.tsx` / `Header.tsx` / `Stage.tsx` にファイルを割る。**この段では見た目を変えない**（既存の縦積みパネルを `OptionRow` の中に仮置き）。
- 完了判定: `npm run verify` が通る。挙動は段階1と同じ。

**段階3 — タブバーと5パネル**
- `TabBar.tsx` + `OptionRow.tsx` + `panels/*`。実装済みの機能が移るものから: **地色 → 書体 → 組み → 情報 → スタイル**。
- `caption.ts` に `fields` / `override` を足す（情報タブが実際に効くようにする）。
- `fonts-catalog.ts` に和文を足す（`manifest.jp` を使う。`ensureFont({family:'NotoSansJP',weight:400},{kind:'url',url:m.jp.regular.file})`）。
- 完了判定: **1画面に同時に出る操作軸が1つだけになる。横スクロールが残るのは地色・書体・情報の3行で、いずれも `padding-inline:16px` が効いている。** チップの当たり判定が全部44px以上（DevTools で実測）。

**段階4 — シート基盤と履歴**
- `ui/Sheet.tsx` + `state/history.ts`。`Diagnostics` を `Sheet size="full"` に載せ替え、`route` state を廃止。
- 完了判定: **Android の戻るジェスチャ / iOS の左端スワイプで、自己診断が閉じるだけでアプリを離脱しない。** 写真と設定が残る。

**段階5 — S4 情報編集シート**
- タイトル・作者の入力欄をオプション行から S4 へ移す。カメラ・レンズ・日付の手入力行を足す（`info.override`）。
- 完了判定: **入力欄にフォーカスしても `✓` がキーボードに隠れない**（iOS Safari 実機 or DevTools の visualViewport エミュレート）。

**段階6 — E1 / E2 / E3**
- `Band.tsx`（EXIF 欠落の3出口）、`Note.tsx`、`stage__e3` + `useDoc.undo()`。
- App.tsx:266-275 の3つの `.note` をパネル先頭から外す（帯はプレビューの下・オプション行の上へ、保存結果は段階7 のシートへ）。
- 完了判定: **`［閉じる］` だけのエラーが1つも無い。** 帯が出入りしてもオプション行とタブバーの y 座標が動かない（縮むのは stage だけ）。

**段階7 — 書き出しシート（S5 step2 → S6）**
- ヘッダー右ピル → シートを開く → その中で書き出し → `<img src=blobURL>` + 主動線。
- **`saveImage` を click ハンドラから同期的に呼ぶ**（`await` を挟まない）。`saveCapabilities()` で主動線の文言を1つだけ出し、残りは `▾ ほかの方法で保存` に畳む。
- 完了判定: **`書き出す` を押してから結果が見えるまで、利用者が一度もスクロールしない。** `save.ts:66-70` の契約（同期呼び出し）を満たす。

**段階8 — 仕上げ**
- canvas の `role="img"` + `aria-label` 更新、`<label for>`/`id`、`role="radiogroup"`/`radio`（`aria-pressed` → `aria-checked`。トグルだけ `aria-pressed` のまま）、`prefers-reduced-motion`。
- `tests/unit/caption.test.ts`（フィールド取捨）と、`.chip` 相当の最小高が44px であることを確かめる簡易テストを足す。
- 完了判定: `npm run verify && npm test` が通り、キーボード Tab で全操作要素に破線リングが出る。

---

## 付録 — 画面に出す日本語（そのまま出す文面の一覧）

| 場所 | 文面 | 出典 |
|---|---|---|
| タブバー | `スタイル` `組み` `地色` `書体` `情報` | §9.4 |
| ヘッダー中央 | `flame` | §9.4 |
| ヘッダー右 | `書き出す` | §9.4（1枚・こだわる） |
| ヘッダー左 | `写真を選ぶ` / `写真を変える` | ★新規（S0 が無いため） |
| 組み | `組み方向` `横組み` `縦組み` `整列` `左` `中` `右` `字間` `狭` `標` `広` `最広` `文字` `小` `中` `大` | §9.4 |
| 縦組み無効（和文未選択） | `縦組みには和文の書体を選んでください` | §9.4 / §6.5 |
| 縦組み無効（和文選択後） | `縦組みはまだ使えません` | ★新規 |
| スタイル | `元比` `1:1` `3:4` `4:5` `9:16` `16:9` | §9.4 |
| スタイル注記 | `いまは「元比」だけ使えます` | ★新規 |
| 情報 | `初期値に戻す` `編集…` / トグル `タイトル` `作者` `日付` `カメラ` `レンズ` `焦点距離` `露出` | §9.4 / §9.7 |
| EXIF 欠落の帯 | `撮影情報が読み取れませんでした。` / `スクリーンショットや加工済みの写真ではよくあることです。` / `［ファイルの日付を使う（2026.9.20）］［手で入力］［入れない］` | §9.6 |
| EXIF 一部欠落（S4 の行の下） | `レンズ名は写真に記録されていませんでした。手で入力できます。` / プレースホルダ `レンズ名（写真に記録なし）` | §9.6 |
| プレビュー描画失敗（E3） | `この設定では描けませんでした ［1つ前に戻す］` | §9.4 |
| 書体ロード失敗（E1） | `書体「Noto Sans JP」を読み込めませんでした` / `［もう一度読み込む］［同梱の書体（Arimo）に変える］` | §9.6 |
| S4 ヘッダー・見出し | `情報を編集` / `作品の情報` / `撮影の情報` / `書き方` | §9.7 |
| 書き出し中 | `書き出し中…` | §8.6（1枚モード） |
| S6 | `書き出しました` / `写真に保存 / 共有` / `ダウンロード` / `続けて編集する` / `▾ ほかの方法で保存` / `↑ 長押しでも保存できます` | §9.9 |
| 空状態 | `写真に、撮影情報を添えた枠を` / `写真はこの端末から出ません。読み取りも合成も書き出しも、すべてブラウザの中で終わります。` | 現行 App.tsx:255-259（そのまま残す） |

**保持すること（今回の作り直しで壊さない）**: 無彩色に徹する方針と `theme.css` 冒頭のコメント、影を `.preview` と `.result-img` だけに掛ける扱い、結果を必ず `<img src=blobURL>` で出し `-webkit-touch-callout: default` / `user-select: auto` を付ける扱い、`inFrame()` の言い分け、`preloadLatinFonts()` の一括プリロード、プレビュー＝縮小版／書き出し＝原寸の所有権の分け方、`resultUrl` の `revokeObjectURL`。

---

## 仕様に記載が無く、実装時に決めた点

- CSS変数名が定義されているのは色と影だけ（--bg / --surface / --ink / --ink-2 / --ink-3 / --line / --line-strong / --shadow）。余白・寸法・タイポには変数名が仕様に無い。--space-8 / --header-h: 48px / --tabbar-h: 56px / --optionrow-h: 96px / --gutter: 16px / --text-t1 などの命名は実装時に決める必要がある。
- 角丸の値がカードとシートの『角丸12』（§9.7 / §9.12）しか書かれていない。ボタン（56px / 48px）、ピル型ヘッダーボタン（高さ32）、セグメント、チップ、タブ、プレビュー枠の角丸半径は仕様に記載なし。
- T1〜T4 の rem 換算は T1=0.6875rem の例示のみ（§16.8）。T2 / T3 / T4 の rem 値、line-height を px で持つか倍率で持つか、rem 換算したときに line-height と tracking をどう追従させるかは仕様に記載なし。
- UI の font-weight（regular / bold の使い分け）が仕様に記載なし。UI 書体は "Roboto Mono" 系のスタックのみ指定。
- スタイルタブのオプション行 176px の内訳が合わない。§9.1 と §9.4 は『上段 比率セグメント 48px ＋ 下段 型チップ 96px』としか書いておらず 48+96=144。残り 32px（gap / padding / 右端ボタン用）の配分は仕様に記載なし。
- タブバー（56px）の各タブの見た目が仕様に記載なし。ラベルのみかアイコン付きか、選択中の表現（反転か 1px 枠か）、タブ幅（5等分か）、タップ領域 44px をどう 56px の中で確保するかが未定。参考アプリ（reference-frmm.md）は『丸角ピル、選択中はグレー背景』だが flame は無彩色・反転/枠の規則（§9.1）なので、そのまま流用できない。バッジは『組み』タブの `・` のみ記載。
- ヘッダー側の `env(safe-area-inset-top)` の扱いが仕様に記載なし（タブバーの bottom は明記されている）。全画面シート（S3-a / SD）の上端が status bar とどう重なるかも未定。
- シートの高さは S4 の 88vh のみ明記。S5 書き出しシート / S6 保存結果の高さ、S3-a と SD の『全画面』が 100vh か 100dvh か、dvh を使うかは仕様に記載なし。
- ルーティングの実装方式が未定。依存表（§1.1）にルーターライブラリが無く、pushState を自前で扱う前提。(a) URL が `/edit#styles` のハッシュなのか pathname + hash なのか、(b) pushState で積むと明記されているのは S3-a / S4 / S5 / SD の4つだけで、S0↔S3↔S7↔S8↔S1 の全画面遷移も履歴に積むのか置換するのか、(c) popstate をどこで単一の listener として受けるか、が仕様に記載なし。
- S3 の戻る操作で出す『編集を破棄しますか』の確認ダイアログの具体的な文面とボタン文言が仕様に記載なし（§9.2 に『確認する』とあるだけ）。§9.6 の『エラーは必ず次にできることを伴う』規則に合わせた文面を決める必要がある。
- シート・トーストの遷移アニメーションの時間・イージングが仕様に記載なし（prefers-reduced-motion で『止める』とだけ §16.8）。止める前の既定値が未定。
- z-index の層構成（ヘッダー / タブバー / ボトムシート / 全画面シート / トースト / E2 帯）が仕様に記載なし。
- ダークモード（prefers-color-scheme: dark）の扱いが仕様に記載なし。トークンは1組だけ定義されている。
- ブレークポイント・PC/タブレット時のレイアウトが仕様に記載なし。PC 向けの記述は S0 の `pointer:fine` 時のドラッグ&ペースト注記のみ。最大幅を切るかどうかも未定。
- 横画面（landscape）でのレイアウト、および S0 の縦バジェット計算（上余白48＋ロゴ112＋16行×28＋44＋64）が横画面で破綻する場合の扱いが仕様に記載なし。
- シートの背後のオーバーレイ（暗幕）の有無と色が仕様に記載なし。影は『プレビューの canvas の外側にのみ』と制限されているため、シートの浮き上がりをどう表現するかが未定。
- フィルムストリップ（48px）内のサムネの1枚あたりの表示サイズと間隔が仕様に記載なし（生成は resizeWidth: 80 と明記、`!` バッジ・斜線の表現も明記されているが寸法は無い）。
- スクロールバーの表示・オーバースクロール（overscroll-behavior）・iOS のラバーバンド抑止の方針が仕様に記載なし。
- スタイルタブ176pxの内訳が合わない: 上段48 + 下段96 = 144 で、残り32px（段間gap・上下padding）の配分が仕様に記載なし。実装時に決める必要がある。
- 比率セグメントの各セグメント幅（6等分か、横スクロールか）、セグメント間の区切り、選択状態の描き方（反転か1px枠か）が仕様に記載なし。
- 比率セグメントの表示文言が『元比』（§9.4 の図）と『元の比率』（StyleDef.ratioLabel / S3-a のグループ見出し）で揺れている。どちらを出すか未確定。
- 型チップの寸法（幅×高さ）・チップ間隔・96px 行内での上下配置・4個を超えない前提での横スクロール要否が仕様に記載なし。SVG ミニ図のサイズも『1個200B程度』というファイルサイズのみで描画寸法は未記載。
- ［全部見る］ボタンの寸法・形（ピル型か枠線か）・文字段（T1/T3）・右マージンが仕様に記載なし。
- お手軽モード（6スタイル）で比率セグメント6個をどう出すか未記載。6スタイルは OR/SQ/TF/FF/NST の5グループに散り、SQ だけ2個・NST/TF は1個になるため、セグメントを出すのか1段に畳むのかを決める必要がある。
- 組みタブ2行×2列の列幅配分（左右等分か、ラベル幅固定か）、ラベルと選択肢セグメントの左右位置関係、各セグメントボタンの幅・高さ（セル44px 内での配置）が仕様に記載なし。
- お手軽モードで組みタブが2項目になったときのグリッド（空セルのままか1行に畳むか、オプション行の高さを96pxに保つか）が仕様に記載なし。
- 地色タブ上段が36px なのに対し、最低タップ領域44px（§16.8）との矛盾の解き方が明記されていない。背景色チップは『::before で拡張』と書かれているが、上段のボーダー／質感チップについては未記載。
- 背景色チップの相互間隔、色名テキスト（T1）の最大幅・省略規則（『Warm White』『Sunny Yellow』『Silver Sand』は32φ より明らかに広い）が仕様に記載なし。
- 質感チップの表示文言が不明。§9.4 のタブ一覧表は『なし/粒/印画紙/コマ枠』、同節のオプション行の図と §10.1 は6チップ『なし/弱/中/強/印画紙/コマ枠』。チップが『弱』単独なのか『粒 弱』なのかを決める必要がある。
- 書体カード120×80 の相互間隔、96px 行内での上下位置（余り16pxの配分）、選択中カードの表現（反転かリングか）が仕様に記載なし。
- 和文書体の数が不整合。§10.1 は『欧文8 ＋ 和文2』『和文1』と書くが、§1.1 / §2.3 の FontRef.family / §16.2 のライセンス9件では和文は NotoSansJP の1書体のみ。実装前に確定が必要。
- 情報タブのトグル列の具体レイアウトが一切未記載（1行あたり何個か、行高、トグル部品の寸法・形、8個を96px にどう収めるか、横スクロールか折返しか）。
- 情報タブの各フィールドの画面上の日本語ラベルが未記載。S4 側の行ラベル（タイトル/作者/日付/撮影地/カメラ/レンズ/焦点距離/露出）を流用してよいかが未確定。
- ［初期値に戻す］［編集…］ボタンの寸法・段（T1/T3）・配置（オプション行内の右端か下段か）が仕様に記載なし。
- 複数枚 × お手軽のときのヘッダー右文言が未記載。1枚お手軽は『保存する』、複数枚は『30枚を書き出す』としか書かれておらず、複数枚お手軽が『30枚を保存する』になるかは未確定。
- タブバー（56px）の1タブあたりの幅・選択状態の表現が未記載。参考アプリは『丸角ピル・選択中はグレー背景』だが、§9.1 は無彩色ルール（反転 or --line-strong 1px枠）を課しており、どちらを採るか未確定。
- 「組み」タブに付く `・` バッジの位置・寸法・消えるタイミング（一度見たら消えるのか常時か）が仕様に記載なし。
- タブ切替でオプション行の高さが 96px ↔ 176px と変化するときの挙動（アニメーションの有無、プレビュー領域のリサイズと再描画をどう繋ぐか、prefers-reduced-motion 時の扱い）が仕様に記載なし。
- E2 の帯（EXIF欠落など）がプレビューの下・オプション行の上に入るときの、プレビュー領域とオプション行の高さ配分・帯自体の高さが仕様に記載なし。
- オプション行の左右ガター（画面ガター16px を適用するか、横スクロール領域は端まで伸ばすか）が仕様に記載なし。
- 横スクロール領域（質感・背景色・書体カード）と iOS Safari の edge swipe（戻る）の競合対策が、スタイルタブについてのみ言及され（だから2段構成にした）、他タブについては未記載。
- 縦組みを選んだときに整列ラベルが [上][中][下] に変わるが、そのときストアの値（Align の 'left'|'center'|'right'）をどうマップするかが仕様に記載なし。
- S3-a のヘッダー高さ。§9.1 の共通トークンは「ヘッダー 48px」だが、§9.5 は S3-a のヘッダー高さを明示していない（48px と仮定するか要決定）。
- セル下ラベルの正確な文面フォーマット。§9.5 は「下に T1 で "OR1" と比率」としか書かず、`OR1 1:1` / `OR1 / 1:1` / 2行表示 のどれかは仕様に記載なし。OR 群の比率表記が `元の比率` なのか `元比` なのかも未確定（グループ見出しは `元の比率`、S3 タブのセグメントは `元比`）。
- S3-a におけるセルの選択状態の表現。§9.1 の全画面ルール（反転 or --line-strong 1px 枠）はあるが、S3-a のセルに具体的にどちらを使うかは仕様に記載なし。
- セルをタップしたときの挙動。スタイルを適用して S3-a を閉じるのか、適用して開いたままなのかは仕様に記載なし。
- S3-a を開いたときのスクロール位置（現在選択中のスタイルを表示領域に入れるか）は仕様に記載なし。
- お手軽モードで S3-a を開いたとき 15 種すべてを出すのか 6 種なのか。§10.1 は「スタイルタブの選択肢」についてのみ規定し、S3-a 側の扱いは仕様に記載なし（入口ボタンの文言も こだわる=`全部見る` / お手軽=`もっと見る` と食い違う）。
- 幅 240 で描いたサムネを 104x136 のセルにどう収めるか（contain か、比率ごとに高さ可変か、セル内の垂直位置）は仕様に記載なし。
- セル失敗時の「線画ミニ図」の実体。第2段の型チップ用 SVG（200B 程度）と同一アセットを流用するのかは仕様に記載なし。
- グループ見出しとグリッドの間、グループ間の縦方向の余白値は仕様に記載なし（§9.1 の「8 の倍数」制約のみ）。
- 3列固定の前提となる画面幅。104x136 × 3 + gap 12 × 2 + ガター 16 × 2 = 368px 必要だが、狭い端末での列数変更やセル縮小の規定は仕様に記載なし。
- サムネ生成の起動タイミングとキャンセル。S3-a を開いた時点で 15 枚を走らせるのか、閉じたときに進行中の生成を止めるのかは仕様に記載なし（§9.4 の世代トークンは S3 プレビュー用の記述）。
- 写真を切り替えた（フィルムストリップで別の1枚を選んだ）ときに S3-a のサムネを再生成するかは仕様に記載なし。
- 比率セグメントの選択が S3-a のスクロール位置と連動するか（比率タップでその見出しへジャンプするか）は仕様に記載なし。
- 15スタイルの `label` は `aria-label` に使うと §16.8 にあるが、S3-a のセル下に見えるラベル（`OR1` + 比率）と `label`（例 `元比・3行`）のどちらを視覚表示するかは、§9.5 が ID+比率としているのみで、`label` を画面に出す場所は S3-a には規定なし。
- E2 の帯の内側 padding・上下 margin・角丸半径が仕様にない。決まっているのは「幅いっぱい」「左に 2px の ink 縦罫」「--ink の 1px 枠」「T2」「右端にアクション」「余白は 8 の倍数のみ」「画面左右ガター 16px」だけ。実寸（例: padding 12px 16px、上下 margin 8px、角丸 0 か 12）を決める必要がある。
- E1 注記と直前の行との間隔（gap）が仕様にない。「該当行の下に T1 ink-2」としか書かれていない。
- E2 の帯の中のボタンの形状・高さ・間隔が仕様にない。§9.1 の「タップ領域は最低 44px」「操作可能な要素の枠は --line-strong」だけが制約。ボタンが 3〜4 個並ぶとき（例: ［この日付を使う］［今日の日付にする］［日付を入れない］［自分で入力する］）に 393px 幅でどう折り返すかも記載なし。スマホでの主要な破綻箇所になる。
- E3 の差し替え領域の背景色・枠線が仕様にない。プレビュー領域を差し替えるとだけ書かれている（--bg のままか --surface のカードにするか未定）。
- S3 の「処理中」の 8φ の ink 点が「呼吸する」アニメーションの周期・イージング・透明度の振れ幅が仕様にない。また「右上」がプレビュー領域の右上かヘッダーの右上か明示されていない。
- §9.6 の「処理中は 200ms 未満なら何も出さない」と §9.4 の「100ms を超えたら 8φ の ink 点」が食い違って読める。S3 プレビューだけ 100ms の例外なのか、200ms が優先なのかが明示されていない。どちらを採るか決める必要がある。
- 「EXIF の値が異常なとき」（撮影日が 1970.01.01）の文面が E1/E2/E3 のどの段で、どこに出るのか記載なし。
- 非対応形式の表（RAW / 動画 / PNG透過 / GIFアニメ）が E1/E2/E3 のどの段か明記されていない。E3 の「使う場面＝画像が読めない」から E3 と推測できるが、GIF アニメ（`1コマ目（最初の画像）を使います。` ＋［続ける］）は画像が読めるため E2 相当かもしれない。
- 「複数枚のうち一部が使えないとき」の文面をどの画面のどの段で出すか記載なし（S0 の受け取り直後か S3 か）。
- 「撮影地 out-of-range」「日本国外の座標」の文面の段（E2 か E3 か）と出す場所が記載なし。low だけ「S4 の該当行の下に E2」と明記されている。
- 「撮影地の取得に失敗（オフライン）」の E1 をどこに出すか記載なし（S4 の撮影地行の下と推測できるが明示なし）。
- オフライン検出の E2 をどの画面のどこに出すか記載なし（S3 のプレビュー下か、全画面共通の上部か）。
- EXIF 欠落の E2 と、オフラインの E2 と、localStorage 不可のバッジが同時に成立しうるが、複数の E2 が同時に出たときの積み上げ順・最大表示数・優先順位が仕様にない。プレビュー領域が潰れるので、スマホでは特に決めておく必要がある。
- E2 の帯が「プレビューの下・オプション行の上」に入ることでオプション行（96px、スタイルタブは 176px）とタブバー（56px + safe-area）が押し下げられるのか、プレビュー領域が縮むのかが記載なし。スマホ（393x852）でタブバーが画面外に出ないための配分ルールが必要。
- E2 の帯の出現・消滅のアニメーション（有無、時間）が仕様にない。
- E1/E2/E3 のアクセシビリティ属性（role="alert" / aria-live / フォーカス移動）が仕様にない。§16.8「アクセシビリティの最低線」の該当範囲は未確認。
- ［ファイルの日付を使う（2026.9.20）］の括弧内の日付書式が、利用者が選んだ日付形式（dots / dots-short / slash / ja / iso / dots-time）に追従するのか固定なのかが記載なし。仕様の実例は dots-short（お手軽の既定）で書かれている。
- EXIF 欠落の帯に［前回のプリセットを使う］が増えたとき、ボタンが 4 個になる。その並び順（増えたボタンをどこに入れるか）が記載なし。
- 「書体のロードに失敗」が E1（T1 ink-2、該当行の下）と規定されているが、文面が見出し＋本文 3 行＋ボタン 2 個あり、T1 ink-2 のインライン注記としては情報量が大きい。E1 の形のまま出すのか、実質 E2 相当のブロックにするのかの判断が必要。
- S5 の Preflight block 表示に出てくる ⛔ / ⚠️ の絵文字が、仕様書上の記号なのか実際に画面に出す文字なのかが不明。§11.4 では「絵文字は写真に焼き込む書体では表示できません」と書かれているが、これはキャプション側の話で UI 側の絵文字使用の可否は記載なし。
- E1 の展開（はみ出し注記の `レンズ名を短くしました ›` → 詳細）の開閉 UI（アコーディオンかシートか）が記載なし。HEIC の `▾ そもそも HEIC を作らないようにするには` も同様。
- E3（プレビュー描画失敗）の「設定履歴を1段だけ持つ」の具体的なスナップショット対象（DocState 全体か SceneInput だけか）と、［1つ前に戻す］を押した後に履歴が空になったときの挙動が記載なし。
- 同じ設定に戻して再び E3 になる無限往復を避ける規定がない（［1つ前に戻す］で戻った状態がまた落ちる場合の扱い）。
- エラーの文面の中の可変値（枚数、ファイル名、px、MB、km）のフォーマット関数が仕様にない。桁区切りの有無、小数点以下の桁数が未定。
- S4 の ✕（破棄）を押したときの確認の有無と文面。S3 の戻る操作には「編集を破棄しますか」があるが、S4 の ✕ については仕様に記載なし。
- S5 の ✕、S6 の ✕、§8.5 の ✕ を押したときの戻り先（S3 か S0 か）が仕様に記載なし。S6 は「▶ S3 / S0 / 写真アプリ」と遷移図にあるが、どのボタンがどれに対応するかは ［続けて編集する］→S3・［ホームに戻る］→S0 以外は未規定。
- S5 / S6 のシート高さが仕様に記載なし（S4 のみ 88vh と明記）。S5→S6 が同一シート内のステップ遷移である以上、高さの扱い（固定か内容高か）を決める必要がある。
- シートの角丸半径、背後のオーバーレイの有無・色、ドラッグハンドルの有無、背景タップで閉じるか、Dismissible の dismissLabel に入れる実文言が仕様に記載なし（影はプレビュー canvas 外側のみという制約だけがある）。
- S4 のセクション見出しとカードの間、カード同士の間、注記との間の具体的な余白値が仕様に記載なし（「8の倍数のみ」という原則のみ）。
- S4 の「プリセット ›」を押して開く選択肢シートの中身・文言、および ［この組み合わせをプリセットに保存］ 押下後の命名 UI・完了表示が仕様に記載なし（上限50件のみ既定）。
- S4 の「例」行を、どの行に出してどの行に出さないかの対応が仕様に記載なし（図では「書き方」カードの下に1行だけ描かれ、本文では「各行の直下に『例』を出す」とある）。
- S5 の解像度セグメントで「元のまま」を選んだときの補足文（T1）の実文面が仕様に記載なし（「ふつう」選択時の文面のみ明記、「選択に応じて差し替え」とだけある）。
- S5 の見積り行『出来上がり: 約 0.6MB / 1枚』の複数枚時の文面が仕様に記載なし。
- S5 の『撮影情報を消して書き出す』チェックの既定値の明文がない（図が ☐ なので未チェック既定と読めるが、文章での宣言は無い）。
- Preflight の warn を「行として並べる」際の1行あたりの文面テンプレート（memory / text-fit / exif / geo-low / grain それぞれの warn 文言）が仕様に記載なし。block の2例のみ全文がある。
- 『書き出しを準備しています…』をシート内のどこに、どの形（バー／テキスト）で出すかが仕様に記載なし。
- S5→S6 の 400ms 待機中に何を表示するかが仕様に記載なし。
- 『canShare は true だが30枚が拒否される』を検出する具体的な条件・手順、および10枚ずつ3回に分ける際の UI 文言（ボタン文言・「2回目/3回目」の進行表示）が仕様に記載なし。
- iOS 判定（長押し注記 `↑ 長押しでも保存できます` の出し分け）の判定方法が仕様に記載なし。
- ZIP 事前告知『ZIP は「ファイル」アプリに入ります…』の表示位置・出すタイミング（ZIP 主動線が確定した時点か、押した後か）が仕様に記載なし。告知文中の ［1枚ずつ保存］ と S6 折りたたみの `・1枚ずつ順番に保存` の表記ゆれも未解消。
- S6 折りたたみ『・この設定を初期値にする』を押した後の完了表示・取り消し動線が仕様に記載なし。
- S6 折りたたみ『・1枚ずつ順番に保存』が1枚のみの書き出しでも表示されるか、また §8.5 画面から S6 へ戻る動線が仕様に記載なし。
- S6 の『この設定は次回も使われます』をレイアウト上のどこに置くかが仕様に記載なし（初回1回のみ・T1 とだけある）。
- S6 で共有シートを開いた後、OS 側で保存されたかどうかを知る手段がないときの完了表示（成功したことをどう見せるか）が仕様に記載なし。
- 利用者要望の「タブを活用してスマホでも操作しやすく」に対し、S4 の3セクション（作品の情報／撮影の情報／書き方）をタブ化するかは仕様に記載なし。仕様は縦スクロールの3カードとして固定しており、タブ化は仕様改訂に当たる（タブバーは S3 の5タブのみで『増やさない』と明記）。
- S5/S6 の前後移動（ステップ1↔2↔3）を戻るジェスチャでどう扱うか（S6 から戻るとステップ1に戻るのか、シートが閉じるのか）が仕様に記載なし。
- 【最重要・矛盾】お手軽の既定キャプション「1行目 `Place, Date` のみ」が、指定された機構では作れない。お手軽既定スタイル SQ3 の `caption.lines` は l1=[title, artist(gate)] / l2=[date, camera, lens, place(gate)] で、**camera と lens にゲートが無い**（`SettingGate` は exposureEnabled/focalEnabled/placeEnabled/artistEnabled の4つのみ・§3.1 900行）。お手軽既定（title='', artistEnabled=false, placeEnabled=true）を当てると l1 は消えるが、l2 は EXIF があれば `2026.9.20, FUJIFILM X-M5, SIGMA 18-50mm…, 広島市中区` と出る。しかも §10.1 の実装欄は「`StyleDef.caption.lines` は変えず、`gates` と Title 既定で制御」と明記しており SQ3 の編集も禁じている。解決策（cameraEnabled/lensEnabled ゲートの追加か、SQ3 の l2 の書き換えか、モード専用の行構成か、フィールド順の入れ替えか）は仕様に記載なし。
- 【矛盾】§10.1「書体タブ こだわる=欧文8＋**和文2**」だが、`FontRef.family`（§2.3 450行）の和文は `NotoSansJP` の1つだけ。同梱アセットも和文 Regular 3,476字（442.4KB）1本のみ（§12.1 C3）。2本目の和文が何かは仕様に記載なし。お手軽側の「和文1」は型と整合する。
- 【矛盾】同じボタンが §9.4/§9.5 では `［全部見る］`、§10.1/§10.3/§10.4 では「もっと見る」と書かれている。書体タブ側は §10.1 が「もっと見る」のみ。画面に出す文言をどちらに統一するか記載なし（スタイルタブ=全部見る／書体タブ=もっと見る と読み分ける可能性もあるが明記なし）。
- お手軽では 16:9 グループ（STN1/STN2/STN3）に `visibleIn: 'otegaru'` のスタイルが1つも無い。スタイルタブ上段の比率セグメント6個のうち `[16:9]` をどう扱うか（非表示にする／無効化する／タップすると「もっと見る」に誘導する）が仕様に記載なし。
- こだわるモードの「区切り文字」既定値が明記されていない。§10.1 は「設定可（`,` `·` `/` `—` ` `）」とだけ書き、お手軽のみ「`,` 固定」と明記。S4 のモック（§9.7）は `区切り文字 ,` を表示している。なお `SeparatorId` は7種（comma/middot/slash/emdash/pipe/space/none）あり、§10.1 が挙げる5種との差（pipe・none）の扱いも記載なし。
- 利用者が選ぶ「区切り文字」と、`StyleDef.caption.lines[].separator`（行ごとに comma/emdash/middot/none がベタ書き）の関係が仕様に記載なし。利用者設定が全行を上書きするのか、`separator:'none'`（OR3 の l1）や `'emdash'`（SQ3 の l1）は例外なのかが決まっていない。
- S0 ホームの「こだわる=上位12行」は列挙が無い（お手軽8行のみ `MODE/TITLE/DATE/PLACE/STYLE/SIZE/COLOR/FONT` と列挙）。全16項目の並び順どおりの先頭12個（…/BORDER まで）と読むのが自然だが、明記なし。
- §10.1 の地色タブ欄はお手軽について「背景色4種＋質感2チップ」としか書かず、**ボーダー（Standard/Bordered）をお手軽に出すか**が明記されていない。§9.3 のお手軽8行に `BORDER` が含まれないことから隠す解釈もありうるが、断定できない。
- 「一手で解決できない warn」の判定基準が定義されていない。例示された `［実寸で確かめる］` ボタンは design.md の他のどこにも登場せず、どの CheckId のどの `WarnUI` がこれに該当するのかが決まっていない。`WarnUI` / `BlockUI` の型定義自体も §11.5 に登場するだけで中身が書かれていない（3583-3584行）。
- お手軽の書き出し解像度「『詳しく』を開いたときだけ選択肢」の、`詳しく` の正確な文言・配置（S5 のどこに置く折りたたみか）・開いた状態を記憶するかが仕様に記載なし。
- 組みタブのお手軽レイアウト（文字サイズ＋組み方向の2コントロール）の行構成・高さが記載なし。こだわるの 2行×2列・各セル44px高・行間8＝96px は明記されているが、お手軽もオプション行96pxのままか縮めるかが不明。
- S1 を出す条件（初回判定）に使うキーが明記されていない。`flame:v1:settings.mode` の不在で判定するのか、`flame:v1:flags` に専用フラグを持つのかが不明。また S1 で戻る操作をしたときの挙動、`/welcome` に直接アクセスされたときの挙動も記載なし。
- S1（モード選択）と §12.6「初回起動時に1回だけ自動表示」されるプライバシー説明（`flame:v1:flags.privacyShown`）の表示順が仕様に記載なし。
- S1 で使う「同梱のサンプル写真」のファイル名・寸法・形式・ライセンス・配置先が仕様に記載なし。§15.4 の同梱アセット検査（`verify-assets.mjs`）の対象一覧にも `docs/assets.md` にも現れない。120×150 のカード内枠に対してどう contain するかも不明。
- `artistEnabled` の既定値がモード別に直接は書かれていない（「Artist の既定値: こだわる=空／お手軽=非表示、実装=`artistEnabled`」という書き方のみ）。こだわる=true / お手軽=false と解釈したが、明文ではない。
- S7 の `［このモードの標準に戻す］` が戻す範囲（`defaults` だけか、`lastUsed` も消すか、写真ごとの `overrides` はどうなるか）が仕様に記載なし。
- S3 のタブ内「もっと見る」で隠し項目を使ったことの検出条件（`visibleIn` 外のスタイルを選んだ時点か、書き出し時点の値が隠し項目かで判定するか）が仕様に記載なし。§9.9 は「隠し項目を使った場合」とだけ書いている。
- お手軽で整列・字間を S7「くわしい設定」から変更した場合に、S3 の組みタブに何も出ないまま値だけ効くことになるが、その値を利用者に見せる導線（S0 一覧のお手軽8行にも ALIGNMENT/SPACING は無い）が仕様に記載なし。
