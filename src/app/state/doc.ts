/**
 * 編集中の設定。
 *
 * 1段だけの取り消しを持つ。描けない設定にしてしまったとき、
 * 「1つ前に戻す」で必ず抜け出せるようにするため。
 */
import { create } from 'zustand';
import type { MarginId } from '../../core/styles/layout';
import { DEFAULT_SPEC, normalize } from '../../core/styles/spec';
import type { Align, FieldId, SizeId, StyleSpec, TrackingId } from '../../core/styles/types';
import type { LatinFontKey } from '../fonts-catalog';

export interface Overrides {
  readonly camera: string | null;
  readonly lens: string | null;
  readonly date: Date | null;
}

export interface DocState {
  /** 比率 × 写真の位置 × 文字の位置 × 行数 */
  readonly style: StyleSpec;
  readonly title: string;
  readonly artist: string;
  readonly fontKey: LatinFontKey | 'jp';
  readonly colorKey: string;
  readonly align: Align;
  readonly tracking: TrackingId;
  readonly size: SizeId;
  /** 余白の広さ。スタイルと直交する軸 */
  readonly margin: MarginId;
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
  title: 'Untitled',
  artist: '',
  fontKey: 'helvetica',
  colorKey: 'white',
  align: 'center',
  tracking: 'Normal',
  size: 'Medium',
  margin: 'normal',
  bordered: false,
  fields: DEFAULT_FIELDS,
  overrides: { camera: null, lens: null, date: null },
};

interface DocStore extends DocState {
  set<K extends keyof DocState>(key: K, value: DocState[K]): void;
  setStyle(patch: Partial<StyleSpec>): void;
  toggleField(id: FieldId): void;
  setOverride<K extends keyof Overrides>(key: K, value: Overrides[K]): void;
  reset(): void;
  undo(): void;
  canUndo(): boolean;
}

let previous: DocState | null = null;

const snapshot = (s: DocState): DocState => ({
  style: s.style,
  title: s.title,
  artist: s.artist,
  fontKey: s.fontKey,
  colorKey: s.colorKey,
  align: s.align,
  tracking: s.tracking,
  size: s.size,
  margin: s.margin,
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
   * 4軸のうち1つを変える。
   *
   * 「全面」と「重ね」は同じ状態の2つの入口なので、片方を触ったらもう片方も揃える。
   * 逆に、写真を全面から戻したら文字は「下」へ、文字を重ねから戻したら写真は「中央」へ。
   * 触った軸が"勝つ"。触っていない軸が勝手に動いて見えるのがいちばん混乱する。
   */
  setStyle(patch) {
    previous = snapshot(get());
    const cur = get().style;
    let next: StyleSpec = { ...cur, ...patch };
    if (patch.photo !== undefined && patch.photo !== 'bleed' && cur.caption === 'overlay') {
      next = { ...next, caption: 'below' };
    }
    if (patch.caption !== undefined && patch.caption !== 'overlay' && cur.photo === 'bleed') {
      next = { ...next, photo: 'center' };
    }
    set({ style: normalize(next) });
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
