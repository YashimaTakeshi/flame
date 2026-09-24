/**
 * 編集中の設定。
 *
 * ★取り消しは何段でも（最大 HISTORY_MAX）。やり直しもできる。★
 * 以前は1段だけで、画面に出るのは描けないときだけだった。「初期値に戻す」を押すと
 * 作り込んだ設定が確認なしに消え、戻す手段が無かった（UX の見直しで指摘された）。
 *
 * 決まりごと:
 *   - 続けざまの同じ種類の変更（ホイールを回す・同じ列を続けて押す）は1段にまとめる
 *     （COALESCE_MS 以内なら）。回し切るまでの途中の値を1つずつ戻させない
 *   - 写真を替えたら履歴を捨てる。写真ごとの入力（タイトル・手入力・切り取り）も消す（§3.14）
 *   - 履歴は保存しない（開き直したら空）。好みの保存（persist）は今までどおり
 */
import { create } from 'zustand';
import { DEFAULT_SPEC, normalize } from '../../core/styles/spec';
import { DEFAULT_LINE_LAYOUT, groupsFor } from '../../core/styles/tokens';
import { CENTER_FOCUS, type Align, type CaptionAlign, type FieldId, type Focus, type LineLayout, type SeparatorId, type SizeId, type StyleSpec, type TrackingId } from '../../core/styles/types';
import type { BadgeMode, BadgeSize } from '../../core/badge';
import type { BandSide } from '../../core/styles/layout';
import type { DateFormatId, WallClock } from '../../core/wallclock';
import type { LatinFontKey } from '../fonts-catalog';
import { loadSettings, saveSettings, type Saved } from './persist';
import type { BorderWeight } from './border';
export { BORDER_LU, type BorderWeight } from './border';

export interface Overrides {
  readonly camera: string | null;
  readonly lens: string | null;
  /** 撮影日。タイムゾーンを持たない壁時計（§4.4） */
  readonly date: WallClock | null;
  /** 仕上がり（フィルムシミュレーション／ピクチャーコントロール等）。FUJIFILM 以外は手入力しかない */
  readonly film: string | null;
}

export interface DocState {
  /** 比率 × 写真の位置 × 文字の位置 × 寄せ × 行数 × 余白 */
  readonly style: StyleSpec;
  /** 全面のときの切り取りの中心。プレビューを指で動かして決める */
  readonly focus: Focus;
  readonly title: string;
  readonly artist: string;
  readonly fontKey: LatinFontKey | 'jp';
  readonly colorKey: string;
  readonly align: Align;
  readonly tracking: TrackingId;
  readonly size: SizeId;
  /** 写真の外側のヘアライン枠。参考アプリの Standard / Bordered */
  readonly bordered: boolean;
  readonly fields: Readonly<Record<FieldId, boolean>>;
  readonly overrides: Overrides;
  /** 日付の書き方。好みなので保存する */
  readonly dateFormat: DateFormatId;
  /** 仕上がりの刻印。帯の中、文字の下に置く。名前が分かるときだけ効く */
  readonly badge: BadgeMode;
  /** 刻印を置く辺。キャプションと同じ辺なら同じ帯を分け合う */
  readonly badgePlace: BandSide;
  /** 刻印の左右。キャプションの揃えとは独立 */
  readonly badgeAlign: Align;
  /** 刻印の上下（帯の中） */
  readonly badgeValign: CaptionAlign;
  readonly badgeSize: BadgeSize;
  /** 刻印の外周にヘアラインの枠。地色と版の色が同じときに */
  readonly badgeFramed: boolean;
  /**
   * 文字（キャプション）を入れるか。切ると文字の帯ごと消え、写真は余白の中央に収まる。
   * 文字の設定（置き場所・大きさ…）は残り、入れ直せば元どおり。好みなので保存する
   */
  readonly captionOn: boolean;
  /** どの項目を何行目に置くか（情報タブでドラッグして決める）。好みなので保存する */
  readonly lineLayout: LineLayout;
  /** 項目の区切り（「, 」「 · 」…）。好みなので保存する */
  readonly separator: SeparatorId;
  /** 写真の枠線の太さ。bordered が入のときだけ効く */
  readonly borderWeight: BorderWeight;
  /**
   * この写真では撮影情報（日付・カメラ・レンズ・露出・焦点距離）を載せない。
   * 撮影情報が無い写真の帯で「入れない」を選んだとき。**その1枚だけ**に効き、保存しない。
   * 以前は載せる項目（fields・保存される）を書き換えていて、次の富士の写真でも撮影情報が消えた
   */
  readonly skipShotFacts: boolean;
}

export const DEFAULT_FIELDS: Record<FieldId, boolean> = {
  title: true,
  artist: true,
  date: true,
  camera: true,
  lens: true,
  exposure: true,
  focalLength: true,
  film: true,
  place: false, // 撮影地は未実装
};

/** 工場出荷の設定。「初期値に戻す」はここへ戻る（保存された好みへではない） */
const BASE: DocState = {
  style: DEFAULT_SPEC,
  focus: CENTER_FOCUS,
  /*
   * タイトルの既定は空。以前は 'Untitled' を毎回フチに焼いていて、
   * 配られた人の最初の1枚が「Untitled って何？」になった。入れた人だけ出る
   */
  title: '',
  artist: '',
  fontKey: 'helvetica',
  colorKey: 'white',
  align: 'center',
  tracking: 'Normal',
  size: 'Medium',
  bordered: false,
  fields: DEFAULT_FIELDS,
  overrides: { camera: null, lens: null, date: null, film: null },
  dateFormat: 'dots',
  badge: 'logo',
  badgePlace: 'below',
  badgeAlign: 'center',
  badgeValign: 'center',
  badgeSize: 'M',
  badgeFramed: false,
  captionOn: true,
  lineLayout: DEFAULT_LINE_LAYOUT,
  separator: 'comma',
  borderWeight: 'hair',
  skipShotFacts: false,
};

/** 保存するのは好みだけ。タイトル・切り取り・手入力はその1枚のものなので持ち越さない */
const savedOf = (s: DocState): Saved => ({
  style: s.style,
  artist: s.artist,
  fontKey: s.fontKey,
  colorKey: s.colorKey,
  align: s.align,
  tracking: s.tracking,
  size: s.size,
  bordered: s.bordered,
  fields: s.fields,
  dateFormat: s.dateFormat,
  badge: s.badge,
  badgePlace: s.badgePlace,
  badgeAlign: s.badgeAlign,
  badgeValign: s.badgeValign,
  badgeSize: s.badgeSize,
  badgeFramed: s.badgeFramed,
  captionOn: s.captionOn,
  lineLayout: s.lineLayout,
  separator: s.separator,
  borderWeight: s.borderWeight,
});

const INITIAL: DocState = { ...BASE, ...loadSettings(savedOf(BASE)) };

interface DocStore extends DocState {
  set<K extends keyof DocState>(key: K, value: DocState[K]): void;
  setStyle(patch: Partial<StyleSpec>): void;
  /** 指で動かし始めるとき1回。ここで取り消しの控えを取る */
  beginDrag(): void;
  /** 動かしている最中。控えは取らない（1回のドラッグが1回の取り消しになる） */
  dragFocus(f: Focus): void;
  resetFocus(): void;
  toggleField(id: FieldId): void;
  setOverride<K extends keyof Overrides>(key: K, value: Overrides[K]): void;
  /** 枠線。null で無し。入り切りと太さを1段で変える */
  setBorder(weight: BorderWeight | null): void;
  /** 文字の帯の中の位置（3×3 の点）。左右（align）と上下（寄せ）を1段で変える */
  setCaptionPos(align: Align, v: CaptionAlign): void;
  /** 刻印の位置（3×3 の点）。1段で変える */
  setBadgePos(align: Align, v: CaptionAlign): void;
  /**
   * 項目を行 group（0..2）の index 番目へ動かす。いまの行数で見えている組の上で動かし、
   * 見えていない行（行数より後ろ）にあった項目は最後の行に続けて書き戻す
   */
  moveField(id: FieldId, group: number, index: number, lines?: number): void;
  /** 情報シートの ✓。何欄変えても1段の取り消しにまとめる */
  applyInfo(patch: Partial<Pick<DocState, 'title' | 'artist' | 'dateFormat' | 'overrides'>>): void;
  /** 情報だけを初期値に戻す（載せる項目・日付の書き方・タイトル・手入力）。取り消せる */
  resetInfo(): void;
  /** 新しい写真を開いた。写真ごとの入力を消し、履歴を捨てる */
  startPhoto(): void;
  undo(): void;
  redo(): void;
  /** 戻せる段数・やり直せる段数。見出しの ↶ ↷ を押せるかに使う */
  readonly undoDepth: number;
  readonly redoDepth: number;
}

/** 取り消しの段数の上限 */
export const HISTORY_MAX = 50;
/** この間隔より短い同じ種類の変更は1段にまとめる */
export const COALESCE_MS = 600;

let past: DocState[] = [];
let future: DocState[] = [];
let lastKind = '';
let lastAt = 0;

const snapshot = (s: DocState): DocState => ({
  style: s.style,
  focus: s.focus,
  title: s.title,
  artist: s.artist,
  fontKey: s.fontKey,
  colorKey: s.colorKey,
  align: s.align,
  tracking: s.tracking,
  size: s.size,
  bordered: s.bordered,
  fields: s.fields,
  overrides: s.overrides,
  dateFormat: s.dateFormat,
  badge: s.badge,
  badgePlace: s.badgePlace,
  badgeAlign: s.badgeAlign,
  badgeValign: s.badgeValign,
  badgeSize: s.badgeSize,
  badgeFramed: s.badgeFramed,
  captionOn: s.captionOn,
  lineLayout: s.lineLayout,
  separator: s.separator,
  borderWeight: s.borderWeight,
  skipShotFacts: s.skipShotFacts,
});

/**
 * 変える前の状態を控える。kind は変更の種類（どの設定か）。
 * 同じ種類が COALESCE_MS 以内に続いたら控えない（最初の控えが残る＝1段にまとまる）。
 * force は必ず新しい段にする（ドラッグの始まり・戻す操作など、1回で意味のある変更）
 */
function remember(cur: DocState, kind: string, force = false): { undoDepth: number; redoDepth: number } {
  const now = Date.now();
  const merge = !force && kind === lastKind && now - lastAt < COALESCE_MS;
  lastKind = kind;
  lastAt = now;
  if (!merge) {
    past.push(snapshot(cur));
    if (past.length > HISTORY_MAX) past.shift();
  }
  future = [];
  return { undoDepth: past.length, redoDepth: 0 };
}

export const useDoc = create<DocStore>((set, get) => ({
  ...INITIAL,
  undoDepth: 0,
  redoDepth: 0,

  set(key, value) {
    if (get()[key] === value) return;
    set({ ...remember(get(), key), [key]: value } as Partial<DocStore>);
  },

  /**
   * 軸のうち1つを変える。**触った軸だけが変わる。**
   *
   * 以前は効かない組み合わせを避けるため、相手の軸を勝手に動かしていた
   * （文字を左右にすると写真は中央へ、写真を左右に寄せると文字は下へ）。
   * 「写真と文字のどちらが優先か分からない」と依頼者が混乱した。
   * 今は値を書き換えず、効かない軸は画面で薄くし、押すと理由を出す（FramePanel・TextPanel）。
   */
  setStyle(patch) {
    const cur = get().style;
    const style = normalize({ ...cur, ...patch });
    if (sameStyle(style, cur)) return;
    set({ ...remember(get(), `style.${Object.keys(patch).join(',')}`), style });
  },

  beginDrag() {
    set(remember(get(), 'focus', true));
  },

  dragFocus(f) {
    const c = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
    set({ focus: { x: c(f.x), y: c(f.y) } });
  },

  resetFocus() {
    set({ focus: CENTER_FOCUS });
  },

  toggleField(id) {
    const fields = { ...get().fields, [id]: !get().fields[id] };
    // 項目ごとに別の段（続けて別の項目を外したら、それぞれ戻せる）
    set({ ...remember(get(), `field.${id}`, true), fields });
  },

  setOverride(key, value) {
    if (get().overrides[key] === value) return;
    set({ ...remember(get(), `override.${key}`), overrides: { ...get().overrides, [key]: value } });
  },

  moveField(id, group, index, lines) {
    const cur = get();
    // 画面に出ている組の数（入らない行数は減らして見せる）。渡されなければ選んだ行数
    const n = lines ?? cur.style.lines;
    const shown = groupsFor(cur.lineLayout, n);
    const from = shown.findIndex((g) => g.includes(id));
    if (from < 0 || group < 0 || group >= n) return;
    const fromIdx = shown[from]!.indexOf(id);
    shown[from]!.splice(fromIdx, 1);
    // 同じ組の中で後ろへ動かすときは、抜いたぶん1つ詰まる
    const at = from === group && index > fromIdx ? index - 1 : index;
    shown[group]!.splice(Math.max(0, Math.min(at, shown[group]!.length)), 0, id);
    const next: FieldId[][] = [0, 1, 2, 3].map((k) => shown[k] ?? []);
    if (JSON.stringify(next) === JSON.stringify(cur.lineLayout)) return;
    set({ ...remember(cur, 'layout', true), lineLayout: next });
  },

  setBorder(weight) {
    const cur = get();
    const bordered = weight !== null;
    if (cur.bordered === bordered && (!bordered || cur.borderWeight === weight)) return;
    set({ ...remember(cur, 'border'), bordered, ...(weight ? { borderWeight: weight } : {}) });
  },

  setCaptionPos(align, v) {
    const cur = get();
    if (cur.align === align && cur.style.captionAlign === v) return;
    set({ ...remember(cur, 'captionPos'), align, style: normalize({ ...cur.style, captionAlign: v }) });
  },

  setBadgePos(align, v) {
    const cur = get();
    if (cur.badgeAlign === align && cur.badgeValign === v) return;
    set({ ...remember(cur, 'badgePos'), badgeAlign: align, badgeValign: v });
  },

  applyInfo(patch) {
    const cur = get();
    const o = patch.overrides;
    const changed =
      (patch.title !== undefined && patch.title !== cur.title) ||
      (patch.artist !== undefined && patch.artist !== cur.artist) ||
      (patch.dateFormat !== undefined && patch.dateFormat !== cur.dateFormat) ||
      (o !== undefined &&
        (o.camera !== cur.overrides.camera ||
          o.lens !== cur.overrides.lens ||
          o.film !== cur.overrides.film ||
          !sameClock(o.date, cur.overrides.date)));
    if (!changed) return;
    set({ ...remember(cur, 'info', true), ...patch });
  },

  resetInfo() {
    set({
      ...remember(get(), 'resetInfo', true),
      fields: BASE.fields,
      dateFormat: BASE.dateFormat,
      title: BASE.title,
      overrides: BASE.overrides,
      lineLayout: BASE.lineLayout,
      skipShotFacts: false,
    });
  },

  startPhoto() {
    past = [];
    future = [];
    lastKind = '';
    set({
      focus: CENTER_FOCUS,
      title: BASE.title,
      overrides: BASE.overrides,
      skipShotFacts: false,
      undoDepth: 0,
      redoDepth: 0,
    });
  },

  undo() {
    const back = past.pop();
    if (!back) return;
    future.push(snapshot(get()));
    lastKind = '';
    set({ ...back, undoDepth: past.length, redoDepth: future.length });
  },

  redo() {
    const fwd = future.pop();
    if (!fwd) return;
    past.push(snapshot(get()));
    lastKind = '';
    set({ ...fwd, undoDepth: past.length, redoDepth: future.length });
  },
}));

const sameStyle = (a: StyleSpec, b: StyleSpec): boolean =>
  a.ratio === b.ratio &&
  a.photo === b.photo &&
  a.caption === b.caption &&
  a.captionAlign === b.captionAlign &&
  a.lines === b.lines &&
  a.margin === b.margin;

const sameClock = (a: WallClock | null, b: WallClock | null): boolean =>
  a === b || (a !== null && b !== null && a.y === b.y && a.m === b.m && a.d === b.d && a.hh === b.hh && a.mm === b.mm && a.ss === b.ss);

/** テスト用。履歴を空にする */
export function __resetHistoryForTest(): void {
  past = [];
  future = [];
  lastKind = '';
  lastAt = 0;
  useDoc.setState({ undoDepth: 0, redoDepth: 0 });
}

/*
 * 好みが変わったら保存する。
 * 個々の操作に保存を書き足すのではなく、1か所で store を見張る。
 * こうすれば軸を足したときに「ここにも保存を書き忘れた」が起きない。
 */
useDoc.subscribe((s) => saveSettings(savedOf(s)));
