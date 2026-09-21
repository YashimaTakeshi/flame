/**
 * 編集中の設定。
 *
 * 1段だけの取り消しを持つ。描けない設定にしてしまったとき、
 * 「1つ前に戻す」で必ず抜け出せるようにするため。
 */
import { create } from 'zustand';
import type { MarginId } from '../../core/styles/layout';
import { styleOf } from '../../core/styles/registry';
import type { Align, FieldId, SizeId, StyleId, TrackingId } from '../../core/styles/types';
import type { LatinFontKey } from '../fonts-catalog';

export interface Overrides {
  readonly camera: string | null;
  readonly lens: string | null;
  readonly date: Date | null;
}

export interface DocState {
  readonly styleId: StyleId;
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
  styleId: 'OR1',
  title: 'Untitled',
  artist: '',
  fontKey: 'helvetica',
  colorKey: 'white',
  align: 'left',
  tracking: 'Normal',
  size: 'Small',
  margin: 'normal',
  bordered: false,
  fields: DEFAULT_FIELDS,
  overrides: { camera: null, lens: null, date: null },
};

interface DocStore extends DocState {
  set<K extends keyof DocState>(key: K, value: DocState[K]): void;
  setStyle(id: StyleId): void;
  toggleField(id: FieldId): void;
  setOverride<K extends keyof Overrides>(key: K, value: Overrides[K]): void;
  reset(): void;
  undo(): void;
  canUndo(): boolean;
}

let previous: DocState | null = null;

const snapshot = (s: DocState): DocState => ({
  styleId: s.styleId,
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
   * スタイルを変えると、そのスタイルの既定の整列・字間・大きさも一緒に入る。
   * 16:9 の1行組みと 9:16 のストーリー組みでは、同じ設定が同じようには効かない。
   * 触ったあとに上書きするのは自由（1段の取り消しも効く）。
   */
  setStyle(id) {
    previous = snapshot(get());
    const d = styleOf(id).defaults;
    set({ styleId: id, align: d.align, tracking: d.tracking, size: d.size });
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
