/**
 * 動画の撮影情報と大きさ。
 * iPhone は 'com.apple.quicktime.*' の鍵に入れる。撮影日時は壁時計のまま（§4.4）。
 */
import { describe, expect, it } from 'vitest';
import { evenSize, metaFromTags, planExport, type AudioCandidate, type EncodeCaps } from '../../src/platform/video';

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

/**
 * 書き出しの計画（入れ物と音声の扱い）。
 * ★実機で「音が出ない」と指摘された。★ 原因は、写せる AAC まで作り直していたこと
 * （作り直せない端末では音声ごと落ちる）と、読めない音声を選びうること（iPhone 16 の空間オーディオ）。
 */

const IPHONE_SAFARI: EncodeCaps = { avc: true, vp9: false, aac: false, opus: false };
const PC_CHROME: EncodeCaps = { avc: true, vp9: true, aac: true, opus: true };
const LINUX_CHROME: EncodeCaps = { avc: true, vp9: true, aac: false, opus: true };
const NO_AVC: EncodeCaps = { avc: false, vp9: true, aac: false, opus: true };

const aac = (id: number): AudioCandidate => ({ id, codec: 'aac', decodable: false });
const apac = (id: number): AudioCandidate => ({ id, codec: null, decodable: false });
const pcm = (id: number): AudioCandidate => ({ id, codec: 'pcm-s24', decodable: true });
const opus = (id: number): AudioCandidate => ({ id, codec: 'opus', decodable: true });

describe('書き出しの計画', () => {
  it('★iPhone の AAC は、AAC を作れない端末でもそのまま写す（MP4）★', () => {
    expect(planExport([aac(2)], IPHONE_SAFARI)).toEqual({
      container: 'mp4',
      video: 'avc',
      audio: { id: 2, mode: 'copy', codec: 'aac' },
    });
  });

  it('★iPhone 16 の空間オーディオ（読めない形式）が先にあっても、AAC の方を選ぶ★', () => {
    expect(planExport([apac(2), aac(3)], IPHONE_SAFARI)?.audio).toEqual({ id: 3, mode: 'copy', codec: 'aac' });
    expect(planExport([apac(2), aac(3)], PC_CHROME)?.audio).toEqual({ id: 3, mode: 'copy', codec: 'aac' });
  });

  it('読めない音声しか無ければ、映像だけ（落として告げる）', () => {
    expect(planExport([apac(2)], PC_CHROME)).toEqual({ container: 'mp4', video: 'avc', audio: null });
  });

  it('富士の非圧縮音声: AAC を作れる端末では AAC にして MP4', () => {
    expect(planExport([pcm(2)], PC_CHROME)).toEqual({
      container: 'mp4',
      video: 'avc',
      audio: { id: 2, mode: 'transcode', codec: 'aac' },
    });
  });

  it('★富士の非圧縮音声: AAC を作れない端末では、MOV にそのまま写して音を残す★', () => {
    expect(planExport([pcm(2)], IPHONE_SAFARI)).toEqual({
      container: 'mov',
      video: 'avc',
      audio: { id: 2, mode: 'copy', codec: 'pcm-s24' },
    });
  });

  it('MP4 では音を残せないが WebM なら残せる環境では WebM（Linux の Chrome など）', () => {
    expect(planExport([opus(2)], LINUX_CHROME)).toEqual({
      container: 'webm',
      video: 'vp9',
      audio: { id: 2, mode: 'copy', codec: 'opus' },
    });
  });

  it('H.264 を書けなければ WebM。Opus はそのまま、ほかは Opus に作り直す', () => {
    expect(planExport([opus(2)], NO_AVC)?.audio).toEqual({ id: 2, mode: 'copy', codec: 'opus' });
    expect(planExport([pcm(2)], NO_AVC)?.audio).toEqual({ id: 2, mode: 'transcode', codec: 'opus' });
    expect(planExport([aac(2)], NO_AVC)).toEqual({ container: 'webm', video: 'vp9', audio: null });
  });

  it('音声が無ければ映像だけ。どちらの映像も書けなければ null（書き出せない）', () => {
    expect(planExport([], IPHONE_SAFARI)).toEqual({ container: 'mp4', video: 'avc', audio: null });
    expect(planExport([aac(2)], { avc: false, vp9: false, aac: true, opus: true })).toBeNull();
  });
});
