/**
 * 動画の撮影情報と大きさ。
 * iPhone は 'com.apple.quicktime.*' の鍵に入れる。撮影日時は壁時計のまま（§4.4）。
 */
import { describe, expect, it } from 'vitest';
import { evenSize, metaFromTags } from '../../src/platform/video';

describe('動画の撮影情報', () => {
  it('iPhone の鍵から機種・撮影日時（壁時計）・位置を読む', () => {
    const m = metaFromTags({
      raw: {
        'com.apple.quicktime.make': 'Apple',
        'com.apple.quicktime.model': 'iPhone 16 Pro',
        'com.apple.quicktime.creationdate': '2026-09-21T00:30:00+0900',
        'com.apple.quicktime.location.ISO6709': '+34.2959+132.3197+003.000/',
      },
      // 入れ物の作成日時（世界時）。creationdate があればこちらは使わない
      date: new Date('2026-09-20T15:30:00Z'),
    });
    expect(m.camera).toBe('Apple iPhone 16 Pro');
    // ★撮った土地の 0:30 のまま。端末のタイムゾーンで前日にならない★
    expect(m.dateTaken).toEqual({ y: 2026, m: 9, d: 21, hh: 0, mm: 30, ss: 0 });
    expect(m.gps).toEqual({ lat: 34.2959, lng: 132.3197 });
  });

  it('鍵が無ければ入れ物の作成日時、それも無ければ null', () => {
    const d = new Date(2026, 8, 20, 10, 0, 0);
    expect(metaFromTags({ date: d }).dateTaken).toEqual({ y: 2026, m: 9, d: 20, hh: 10, mm: 0, ss: 0 });
    expect(metaFromTags({}).dateTaken).toBeNull();
    expect(metaFromTags({}).camera).toBeNull();
  });

  it('QuickTime の udta の文字（長さ＋言語つき）も読む', () => {
    const text = 'FUJIFILM';
    const bytes = new Uint8Array(4 + text.length);
    bytes.set([0, text.length, 0x15, 0xc7], 0);
    bytes.set(new TextEncoder().encode(text), 4);
    expect(metaFromTags({ raw: { '©mak': bytes, '©mod': 'X-M5' } }).camera).toBe('FUJIFILM X-M5');
  });

  it('壊れた位置は採らない', () => {
    expect(metaFromTags({ raw: { 'com.apple.quicktime.location.ISO6709': 'nope' } }).gps).toBeNull();
    expect(metaFromTags({ raw: { 'com.apple.quicktime.location.ISO6709': '+95.0+10.0/' } }).gps).toBeNull();
  });
});

describe('書き出しの大きさ', () => {
  it('長辺は上限以下、縦横とも偶数（H.264 の約束）', () => {
    for (const aspect of [9 / 16, 3 / 4, 4 / 5, 1, 16 / 9, 0.7137, 1.4979, 2 / 3]) {
      const { w, h } = evenSize(aspect, 1920);
      expect(w % 2).toBe(0);
      expect(h % 2).toBe(0);
      expect(Math.max(w, h)).toBeLessThanOrEqual(1920);
      expect(Math.abs(w / h - aspect)).toBeLessThan(0.01);
    }
    expect(evenSize(9 / 16, 1920)).toEqual({ w: 1080, h: 1920 });
    expect(evenSize(16 / 9, 1920)).toEqual({ w: 1920, h: 1080 });
  });
});
