/** 画面の状態。設定そのものとは分けて持つ */
import { create } from 'zustand';

export type TabId = 'place' | 'layout' | 'color' | 'font' | 'info';
export type SheetId = 'info' | 'export' | 'diagnostics' | null;

export const TABS: { id: TabId; label: string }[] = [
  { id: 'place', label: '配置' },
  { id: 'layout', label: '組み' },
  { id: 'color', label: '地色' },
  { id: 'font', label: '書体' },
  { id: 'info', label: '情報' },
];

interface UiStore {
  tab: TabId;
  sheet: SheetId;
  /** オプション行の下に1行だけ出る注記。モーダルの代わり */
  hint: string | null;
  setTab(tab: TabId): void;
  openSheet(id: Exclude<SheetId, null>): void;
  closeSheet(): void;
  setHint(text: string | null): void;
}

export const useUi = create<UiStore>((set) => ({
  tab: 'place',
  sheet: null,
  hint: null,
  setTab: (tab) => set({ tab, hint: null }),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  setHint: (hint) => set({ hint }),
}));
