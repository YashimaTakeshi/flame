/**
 * 編集中の設定。
 *
 * 1段だけの取り消しを持つ。描けない設定にしてしまったとき、
 * 「1つ前に戻す」で必ず抜け出せるようにするため。
 */
import { create } from 'zustand';
import { DEFAULT_SPEC, normalize } from '../../core/styles/spec';
import { CENTER_FOCUS, type Align, type FieldId, type Focus, type SizeId, type StyleSpec, type TrackingId } from '../../core/styles/types';
import type { LatinFontKey } from '../fonts-catalog';

export interface Overrides {
  readonly camera: string | null;
  readonly lens: string | null;
  readonly date: Date | null;
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
}

export const DEFAULT_FIELDS: Record<FieldId, boolean> = {
  title: true,
  artist: true,
  date: true,
  camera: true,
  lens: true,
  exposure: true,
  focalLength: true,
  place: false, // 撮影地は未実装
};

const INITIAL: DocState = {
  style: DEFAULT_SPEC,
  focus: CENTER_FOCUS,
  title: 'Untitled',
  artist: '',
  fontKey: 'helvetica',
  colorKey: 'white',
  align: 'center',
  tracking: 'Normal',
  size: 'Medium',
  bordered: false,
  fields: DEFAULT_FIELDS,
  overrides: { camera: null, lens: null, date: null },
};

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
  reset(): void;
  undo(): void;
  canUndo(): boolean;
}

let previous: DocState | null = null;

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
});

export const useDoc = create<DocStore>((set, get) => ({
  ...INITIAL,

  set(key, value) {
    previous = snapshot(get());
    set({ [key]: value } as Partial<DocState>);
  },

  /**
   * 5軸のうち1つを変える。**触った軸が勝つ。**
   *
   * 触っていない軸が勝手に動いて見えるのがいちばん混乱するので、
   * 揃えるための動きは「いま触った軸に従わせる」方向にだけ起こす。
   *
   * - 余白を「なし」にしたら文字は「重ね」。余白を戻したら文字は「下」。
   * - 文字を「重ね」にしたら余白は「なし」。文字を戻したら余白は「標準」。
   * - 文字を左右の段にしたら、同じ側に寄せていた写真は「中央」。
   * - 写真を左右に寄せたら、左右の段にあった文字は「下」。
   */
  setStyle(patch) {
    previous = snapshot(get());
    const cur = get().style;
    const side = (v: string | undefined): boolean => v === 'left' || v === 'right';
    let next: StyleSpec = { ...cur, ...patch };
    if (patch.margin !== undefined) {
      if (patch.margin === 'none') next = { ...next, caption: 'overlay' };
      else if (cur.caption === 'overlay') next = { ...next, caption: 'below' };
    }
    if (patch.caption !== undefined) {
      if (patch.caption === 'overlay') next = { ...next, margin: 'none' };
      else if (cur.margin === 'none') next = { ...next, margin: 'normal' };
      if (side(patch.caption) && side(cur.photo)) next = { ...next, photo: 'center' };
    }
    if (patch.photo !== undefined && side(patch.photo) && side(cur.caption)) {
      next = { ...next, caption: 'below' };
    }
    set({ style: normalize(next) });
  },

  beginDrag() {
    previous = snapshot(get());
  },

  dragFocus(f) {
    const c = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
    set({ focus: { x: c(f.x), y: c(f.y) } });
  },

  resetFocus() {
    set({ focus: CENTER_FOCUS });
  },

  toggleField(id) {
    previous = snapshot(get());
    const fields = { ...get().fields, [id]: !get().fields[id] };
    set({ fields });
  },

  setOverride(key, value) {
    previous = snapshot(get());
    set({ overrides: { ...get().overrides, [key]: value } });
  },

  reset() {
    previous = snapshot(get());
    set({ ...INITIAL });
  },

  undo() {
    if (!previous) return;
    const back = previous;
    previous = null;
    set({ ...back });
  },

  canUndo: () => previous !== null,
}));
