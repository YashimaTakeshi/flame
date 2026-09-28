/**
 * 項目ごとの「前に入れた値」（候補）。情報タブの入力欄の下に並べて、押すだけで入れられるようにする。
 *
 * 撮影情報（EXIF）の無い写真が多く、同じカメラ名・レンズ名・作者を毎回打つことになっていた
 * （依頼者の要望。§3.32）。写真ごとの手入力（doc.ts の overrides）は写真を替えると消すので、
 * 覚えておく先はこちらに分けた。
 *
 * 決まりごと:
 *   - 項目ごとに新しい順（MRU）。最大 RECENT_MAX 件。前後の空白は落とし、空は覚えない
 *   - 同じ値は増やさず先頭へ動かす（大文字小文字は区別する。「X100V」と「x100v」は別の表記）
 *   - 日付・露出・焦点距離は持たない（写真ごとに違う値なので候補にならない）
 *   - 保存はこの端末の localStorage だけ。どこにも送らない。保存が使えなくてもメモリで動く
 *     （safeStorage が try/catch とメモリへの退避を受け持つ）
 */
import { create } from 'zustand';
import { KEYS, safeStorage } from '../../platform/storage';

export const RECENT_FIELDS = ['camera', 'lens', 'film', 'title', 'artist'] as const;
export type RecentField = (typeof RECENT_FIELDS)[number];
export type RecentLists = Readonly<Record<RecentField, readonly string[]>>;

/** 候補の上限。横1列で送って見渡せる数に抑える */
export const RECENT_MAX = 8;

export const isRecentField = (id: string): id is RecentField => (RECENT_FIELDS as readonly string[]).includes(id);

const EMPTY: RecentLists = { camera: [], lens: [], film: [], title: [], artist: [] };

/** 先頭に足す（同じ値は先頭へ動かす）。空は無視して元の配列を返す */
export function pushRecent(list: readonly string[], value: string, max = RECENT_MAX): readonly string[] {
  const v = value.trim();
  if (v === '') return list;
  if (list[0] === v) return list;
  return [v, ...list.filter((x) => x !== v)].slice(0, max);
}

/** 保存の中身を読む。壊れていたら、その項目だけ空から始める（候補のために起動を止めない） */
export function readRecent(raw: string | null): RecentLists {
  if (!raw) return EMPTY;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return EMPTY;
  const obj = parsed as Record<string, unknown>;
  const out: Record<RecentField, readonly string[]> = { ...EMPTY };
  for (const f of RECENT_FIELDS) {
    const v = obj[f];
    if (!Array.isArray(v)) continue;
    let list: readonly string[] = [];
    // 古い順に積み直すと、同じ値の重なり・空・上限をここでも正しく落とせる
    for (const s of [...v].reverse()) if (typeof s === 'string') list = pushRecent(list, s);
    out[f] = list;
  }
  return out;
}

interface RecentStore {
  readonly lists: RecentLists;
  /** 値を確かめた（欄を離れた・Enter・候補を押した・写真から読めた）ときだけ呼ぶ。打つたびには呼ばない */
  record(field: RecentField, value: string | null | undefined): void;
  /** 候補を長押しで外す */
  remove(field: RecentField, value: string): void;
}

const save = (lists: RecentLists): void => {
  safeStorage.set(KEYS.recent, JSON.stringify(lists));
};

export const useRecent = create<RecentStore>((set, get) => ({
  lists: readRecent(safeStorage.get(KEYS.recent)),
  record(field, value) {
    if (!value) return;
    const cur = get().lists;
    const next = pushRecent(cur[field], value);
    if (next === cur[field]) return;
    const lists = { ...cur, [field]: next };
    set({ lists });
    save(lists);
  },
  remove(field, value) {
    const cur = get().lists;
    if (!cur[field].includes(value)) return;
    const lists = { ...cur, [field]: cur[field].filter((x) => x !== value) };
    set({ lists });
    save(lists);
  },
}));

/**
 * 入力欄の下に出す候補。打ちかけの字があれば、それを含むもの（大文字小文字を問わない）。
 * いま入っている値と同じものは出さない（押しても何も変わらない）
 */
export function candidatesFor(list: readonly string[], query: string, current: readonly (string | null | undefined)[]): string[] {
  const q = query.trim().toLowerCase();
  const now = new Set(current.filter((c): c is string => !!c).map((c) => c.trim()));
  return list.filter((c) => !now.has(c) && (q === '' || c.toLowerCase().includes(q)));
}

/** テスト用。保存から読み直す */
export function __reloadRecentForTest(): void {
  useRecent.setState({ lists: readRecent(safeStorage.get(KEYS.recent)) });
}
