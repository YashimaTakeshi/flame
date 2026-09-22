/**
 * 壁時計の日付。EXIF の日時はタイムゾーンを持たないので、Date にせず数字のまま扱う（§4.4）。
 * ★端末のタイムゾーンが何であっても、写真に入る日付は撮った土地の日付★
 */
import { describe, expect, it } from 'vitest';
import {
  formatWallClock,
  parseWallClock,
  toDateInput,
  toExifDateTime,
  toStamp,
  wallClockFromDate,
} from '../../src/core/wallclock';

describe('壁時計', () => {
  it('EXIF の表記をそのまま数字にする', () => {
    expect(parseWallClock('2026:09:20 17:42:11')).toEqual({ y: 2026, m: 9, d: 20, hh: 17, mm: 42, ss: 11 });
  });

  it('入力欄の表記（日付だけ）は 0 時', () => {
    expect(parseWallClock('2026-09-20')).toEqual({ y: 2026, m: 9, d: 20, hh: 0, mm: 0, ss: 0 });
  });

  it('壊れた値・空の値は null（"0000:00:00" を撮影日にしない）', () => {
    expect(parseWallClock('0000:00:00 00:00:00')).toBeNull();
    expect(parseWallClock('2026:13:01 00:00:00')).toBeNull();
    expect(parseWallClock('')).toBeNull();
    expect(parseWallClock(undefined)).toBeNull();
    expect(parseWallClock(new Date())).toBeNull();
  });

  it('★深夜 0:30 に撮った写真の日付が、西の端末で見ても前日にならない★', () => {
    // Date 経由だと "2026:09:21 00:30:00" は UTC-9 の端末で 9/20 になる。数字のままなら 21 のまま
    const w = parseWallClock('2026:09:21 00:30:00');
    expect(w?.d).toBe(21);
    expect(formatWallClock(w!)).toBe('2026.09.21');
  });

  it('6 つの書き方', () => {
    const w = { y: 2026, m: 9, d: 5, hh: 17, mm: 42, ss: 11 };
    expect(formatWallClock(w, 'dots')).toBe('2026.09.05');
    expect(formatWallClock(w, 'dots-short')).toBe('2026.9.5');
    expect(formatWallClock(w, 'slash')).toBe('2026/09/05');
    expect(formatWallClock(w, 'ja')).toBe('2026年9月5日');
    expect(formatWallClock(w, 'iso')).toBe('2026-09-05');
    expect(formatWallClock(w, 'dots-time')).toBe('2026.09.05 17:42');
  });

  it('手で入れた日付（時刻なし）は、時刻つきの書き方でも日付だけ', () => {
    expect(formatWallClock({ y: 2026, m: 9, d: 5, hh: 0, mm: 0, ss: 0 }, 'dots-time')).toBe('2026.09.05');
  });

  it('EXIF・入力欄・ファイル名の表記', () => {
    const w = { y: 2026, m: 9, d: 5, hh: 7, mm: 4, ss: 9 };
    expect(toExifDateTime(w)).toBe('2026:09:05 07:04:09');
    expect(toDateInput(w)).toBe('2026-09-05');
    expect(toStamp(w)).toBe('20260905-070409');
  });

  it('端末の時計からは、その端末の見た目の時刻で作る（ファイルの更新日時など）', () => {
    const d = new Date(2026, 8, 5, 7, 4, 9);
    expect(wallClockFromDate(d)).toEqual({ y: 2026, m: 9, d: 5, hh: 7, mm: 4, ss: 9 });
  });
});
