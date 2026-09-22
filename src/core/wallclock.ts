/**
 * 壁時計の時刻。**タイムゾーンを持たない。**
 *
 * EXIF の DateTimeOriginal は「撮った土地の時刻」で、タイムゾーンを持たない。
 * Date にすると端末のタイムゾーンで読み替えられ、海外で撮った写真の日付が1日ずれる（§4.4）。
 * 写真に入れるべきは撮った土地の時刻であって、見ている人の時刻ではない。
 * だから変換せず、数字のまま持ち回る。
 */
export interface WallClock {
  readonly y: number;
  readonly m: number;
  readonly d: number;
  readonly hh: number;
  readonly mm: number;
  readonly ss: number;
}

const num = (s: string | undefined): number => (s === undefined || s === '' ? 0 : Number(s));

/**
 * EXIF の "2026:09:20 17:42:11" や入力欄の "2026-09-20" を読む。
 * 時刻が無ければ 0 時。読めない形（"0000:00:00 00:00:00" を含む）は null。
 */
export function parseWallClock(raw: unknown): WallClock | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})[:\-/](\d{1,2})[:\-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(raw.trim());
  if (!m) return null;
  const w: WallClock = { y: num(m[1]), m: num(m[2]), d: num(m[3]), hh: num(m[4]), mm: num(m[5]), ss: num(m[6]) };
  if (w.y < 1 || w.m < 1 || w.m > 12 || w.d < 1 || w.d > 31 || w.hh > 23 || w.mm > 59 || w.ss > 60) return null;
  return w;
}

/** 端末の時計から。ファイルの更新日時など、そもそも端末の時刻であるものに使う */
export const wallClockFromDate = (d: Date): WallClock => ({
  y: d.getFullYear(),
  m: d.getMonth() + 1,
  d: d.getDate(),
  hh: d.getHours(),
  mm: d.getMinutes(),
  ss: d.getSeconds(),
});

/** 日付の書き方。自由入力はさせない（§4.4） */
export const DATE_FORMATS = ['dots', 'dots-short', 'slash', 'ja', 'iso', 'dots-time'] as const;
export type DateFormatId = (typeof DATE_FORMATS)[number];

const p2 = (n: number): string => String(n).padStart(2, '0');

export function formatWallClock(w: WallClock, fmt: DateFormatId = 'dots'): string {
  switch (fmt) {
    case 'dots':
      return `${w.y}.${p2(w.m)}.${p2(w.d)}`;
    case 'dots-short':
      return `${w.y}.${w.m}.${w.d}`;
    case 'slash':
      return `${w.y}/${p2(w.m)}/${p2(w.d)}`;
    case 'ja':
      return `${w.y}年${w.m}月${w.d}日`;
    case 'iso':
      return `${w.y}-${p2(w.m)}-${p2(w.d)}`;
    case 'dots-time':
      // 手で入れた日付は時刻を持たない（0:00:00）。そのときは日付だけ
      return w.hh === 0 && w.mm === 0 && w.ss === 0
        ? `${w.y}.${p2(w.m)}.${p2(w.d)}`
        : `${w.y}.${p2(w.m)}.${p2(w.d)} ${p2(w.hh)}:${p2(w.mm)}`;
  }
}

/** EXIF の表記 "2026:09:20 17:42:11" */
export const toExifDateTime = (w: WallClock): string =>
  `${String(w.y).padStart(4, '0')}:${p2(w.m)}:${p2(w.d)} ${p2(w.hh)}:${p2(w.mm)}:${p2(w.ss)}`;

/** 入力欄（type="date"）の表記 "2026-09-20" */
export const toDateInput = (w: WallClock): string => `${String(w.y).padStart(4, '0')}-${p2(w.m)}-${p2(w.d)}`;

/** ファイル名の表記 "20260920-174211" */
export const toStamp = (w: WallClock): string =>
  `${String(w.y).padStart(4, '0')}${p2(w.m)}${p2(w.d)}-${p2(w.hh)}${p2(w.mm)}${p2(w.ss)}`;
