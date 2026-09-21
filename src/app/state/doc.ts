/**
 * 編集中の設定。
 *
 * 1段だけの取り消しを持つ。描けない設定にしてしまったとき、
 * 「1つ前に戻す」で必ず抜け出せるようにするため。
 */
import { create } from 'zustand';
import type { FieldId } from '../../core/styles/types';
import type { LatinFontKey } from '../fonts-catalog';

export type AlignKey = 'left' | 'center' | 'right';
export type TrackKey = 'tight' | 'normal' | 'wide' | 'widest';
export type SizeKey = 'S' | 'M' | 'L';

export interface Overrides {
  readonly camera: string | null;
  readonly lens: string | null;
  readonly date: Date | null;
}

export interface DocState {
  readonly title: string;
  readonly artist: string;
  readonly fontKey: LatinFontKey | 'jp';
  readonly colorKey: string;
  readonly align: AlignKey;
  readonly tracking: TrackKey;
  readonly size: SizeKey;
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
  title: 'Untitled',
  artist: '',
  fontKey: 'helvetica',
  colorKey: 'white',
  align: 'left',
  tracking: 'normal',
  size: 'M',
  fields: DEFAULT_FIELDS,
  overrides: { camera: null, lens: null, date: null },
};

interface DocStore extends DocState {
  set<K extends keyof DocState>(key: K, value: DocState[K]): void;
  toggleField(id: FieldId): void;
  setOverride<K extends keyof Overrides>(key: K, value: Overrides[K]): void;
  reset(): void;
  undo(): void;
  canUndo(): boolean;
}

let previous: DocState | null = null;

const snapshot = (s: DocState): DocState => ({
  title: s.title,
  artist: s.artist,
  fontKey: s.fontKey,
  colorKey: s.colorKey,
  align: s.align,
  tracking: s.tracking,
  size: s.size,
  fields: s.fields,
  overrides: s.overrides,
});

export const useDoc = create<DocStore>((set, get) => ({
  ...INITIAL,

  set(key, value) {
    previous = snapshot(get());
    set({ [key]: value } as Partial<DocState>);
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
