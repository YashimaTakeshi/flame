/** 画面の状態。設定そのものとは分けて持つ */
import { create } from 'zustand';
import type { FieldId } from '../../core/styles/types';

/**
 * 5つの道具。以前の6タブ（配置・組み・地色・書体・刻印・情報）を、触る対象で分け直した。
 * 余白・地色・枠線はどれも「額」の性質なのでフレームに、文字の置き場所・揃え・寄せ・大きさ・字間は文字に
 */
export type TabId = 'frame' | 'text' | 'font' | 'badge' | 'info';
export type SheetId = 'info' | 'export' | 'diagnostics' | null;
type OpenSheet = Exclude<SheetId, null>;

export const TABS: { id: TabId; label: string }[] = [
  { id: 'frame', label: 'フレーム' },
  { id: 'text', label: '文字' },
  { id: 'font', label: '書体' },
  { id: 'badge', label: '刻印' },
  { id: 'info', label: '情報' },
];

interface UiStore {
  tab: TabId;
  sheet: SheetId;
  /** オプション行の下に1行だけ出る注記。モーダルの代わり */
  hint: string | null;
  setTab(tab: TabId): void;
  openSheet(id: OpenSheet): void;
  closeSheet(): void;
  setHint(text: string | null): void;
  /**
   * 開いている写真に仕上がり（手入力を含む）があるか。刻印の列を押せるかを決める。
   * 写真は App が持つので、そこから知らせてもらう
   */
  hasFilm: boolean;
  /**
   * 写真から取れた（または手で入れた）項目の中身。情報の一覧に「何が載るか」を見せるため。
   * 載せる／載せないのスイッチとは無関係に、値そのもの
   */
  facts: Partial<Record<FieldId, string>>;
  /** 情報シートを開いたとき、最初に入力する欄 */
  infoFocus: FieldId | null;
  openInfo(focus?: FieldId | null): void;
  /** PC の欄で開いている見出し */
  openSecs: Readonly<Record<TabId, boolean>>;
  toggleSec(id: TabId): void;
}

/** 注記が出ている時間。読み終わる長さだけ出して、あとは黙る */
const HINT_MS = 2500;
const HINT_MS_DESK = 4000;
let hintTimer: ReturnType<typeof setTimeout> | null = null;

/*
 * 面は URL の印（#info など）と対にして履歴に載せる。
 * iPhone の戻るスワイプやブラウザの戻るで、アプリごと離れて写真を失うのではなく、
 * 面が1段閉じるだけになる。自己診断は画面に入口が無いので、この印が唯一の入口でもある。
 */
const SHEET_HASH: Record<OpenSheet, string> = { info: '#info', export: '#export', diagnostics: '#diag' };
const sheetOf = (hash: string): OpenSheet | null =>
  (Object.keys(SHEET_HASH) as OpenSheet[]).find((k) => SHEET_HASH[k] === hash) ?? null;
const hasHistory = (): boolean =>
  typeof window !== 'undefined' && typeof window.history?.pushState === 'function';
/** 自分で履歴を積んだか。積んでいないのに戻ると、前のページ（LINE など）へ出てしまう */
let pushed = false;

export const useUi = create<UiStore>((set) => ({
  tab: 'frame',
  sheet: null,
  hint: null,
  hasFilm: false,
  facts: {},
  infoFocus: null,
  openInfo: (focus = null) => {
    set({ infoFocus: focus });
    useUi.getState().openSheet('info');
  },
  openSecs: { frame: true, text: true, font: false, badge: false, info: false },
  toggleSec: (id) => set((s) => ({ openSecs: { ...s.openSecs, [id]: !s.openSecs[id] } })),
  setTab: (tab) => set({ tab, hint: null }),
  openSheet: (sheet) => {
    set({ sheet });
    if (!hasHistory()) return;
    const h = SHEET_HASH[sheet];
    if (window.location.hash === h) return;
    // 面から面へ直に移るときは積まない（戻るで前の面に戻るのは変）
    if (sheetOf(window.location.hash)) {
      window.history.replaceState(null, '', h);
    } else {
      window.history.pushState(null, '', h);
      pushed = true;
    }
  },
  closeSheet: () => {
    set({ sheet: null });
    if (!hasHistory() || !sheetOf(window.location.hash)) return;
    if (pushed) {
      window.history.back(); // popstate が来て印が消える（bindSheetHistory）
    } else {
      // 印つきの URL で開かれた（しおり・手打ち）。戻ると外へ出るので、印だけ消す
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  },
  /*
   * 注記は自分で消える。以前は次にタブを変えるまで残っていて、
   * レイアウトを変えたあとも古い注記が読めてしまった。
   */
  setHint: (hint) => {
    if (hintTimer) clearTimeout(hintTimer);
    set({ hint });
    // PC では注記がプレビューの端に出て目に入りにくいので、少し長く残す
    const desk = typeof document !== 'undefined' && document.querySelector('.app[data-layout="desk"]') !== null;
    if (hint) hintTimer = setTimeout(() => set({ hint: null }), desk ? HINT_MS_DESK : HINT_MS);
  },
}));

/**
 * URL の印と面を結ぶ。起動時に1度呼ぶ。
 * 戻る・進む（popstate）で印が変わったら、面をそれに合わせる。
 * 写真が無いのに #info / #export で開かれたら（しおり・進むボタン）、面は出さず印だけ消す。
 */
export function bindSheetHistory(canOpen: () => boolean): () => void {
  const apply = (): void => {
    const id = sheetOf(window.location.hash);
    if (id === null) {
      pushed = false;
      useUi.setState({ sheet: null });
      return;
    }
    if (id !== 'diagnostics' && !canOpen()) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      pushed = false;
      useUi.setState({ sheet: null });
      return;
    }
    useUi.setState({ sheet: id });
  };
  apply();
  window.addEventListener('popstate', apply);
  return () => window.removeEventListener('popstate', apply);
}
