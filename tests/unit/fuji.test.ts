/**
 * FUJIFILM MakerNote の読み取り。
 * 実機の写真は撮影者の個人情報を含むので同梱せず、形式どおりに組んだバイト列で確かめる。
 */
import { describe, expect, it } from 'vitest';
import { buildFujiNote, FILM_SUGGESTIONS, parseFujiFilm } from '../../src/app/fuji';

describe('FUJIFILM のフィルムシミュレーション', () => {
  it('FilmMode からカラーのフィルムを読む', () => {
    expect(parseFujiFilm(buildFujiNote([{ tag: 0x1401, value: 0x503 }]))).toBe('CLASSIC CHROME');
    expect(parseFujiFilm(buildFujiNote([{ tag: 0x1401, value: 0x000 }]))).toBe('PROVIA');
    expect(parseFujiFilm(buildFujiNote([{ tag: 0x1401, value: 0xb00 }]))).toBe('REALA ACE');
  });

  it('モノクロ系は Saturation が実体。FilmMode が既定値のまま残っていても勝つ', () => {
    const note = buildFujiNote([
      { tag: 0x1401, value: 0x000 },
      { tag: 0x1003, value: 0x500 },
    ]);
    expect(parseFujiFilm(note)).toBe('ACROS');
    expect(parseFujiFilm(buildFujiNote([{ tag: 0x1003, value: 0x310 }]))).toBe('SEPIA');
  });

  it('知らない値・他社の MakerNote・空は null（推測で名前を出さない）', () => {
    expect(parseFujiFilm(buildFujiNote([{ tag: 0x1401, value: 0xffff }]))).toBeNull();
    expect(parseFujiFilm(new TextEncoder().encode('Nikon\0\x02\x11\0\0'))).toBeNull();
    expect(parseFujiFilm(new Uint8Array(0))).toBeNull();
    expect(parseFujiFilm(null)).toBeNull();
    expect(parseFujiFilm(undefined)).toBeNull();
  });

  it('切り詰められたバイト列でも投げない', () => {
    const full = buildFujiNote([{ tag: 0x1401, value: 0x503 }]);
    for (let n = 0; n < full.length; n++) {
      expect(() => parseFujiFilm(full.slice(0, n))).not.toThrow();
    }
  });

  it('ArrayBuffer でも同じ', () => {
    const u8 = buildFujiNote([{ tag: 0x1401, value: 0x200 }]);
    const ab = new ArrayBuffer(u8.length);
    new Uint8Array(ab).set(u8);
    expect(parseFujiFilm(ab)).toBe('Velvia');
  });

  it('候補には読み取れる名前がすべて含まれる（読めた名前を候補から選び直せる）', () => {
    for (const v of [0x000, 0x130, 0x200, 0x501, 0x502, 0x503, 0x600, 0x700, 0x800, 0xa00, 0xb00]) {
      const name = parseFujiFilm(buildFujiNote([{ tag: 0x1401, value: v }]));
      expect(name).not.toBeNull();
      expect(FILM_SUGGESTIONS, String(name)).toContain(name);
    }
  });
});
