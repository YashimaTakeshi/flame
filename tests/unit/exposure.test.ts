/**
 * 露出の手入力（§3.32）。写真の値と同じ書き方で出し、入れていない部分は写真の値に戻る。
 */
import { describe, expect, it } from 'vitest';
import { NO_OVERRIDES, collectFacts, type CaptionParts } from '../../src/app/caption';
import { EMPTY_EXIF, type ExifFacts } from '../../src/app/exif';
import { DEFAULT_FIELDS, __resetHistoryForTest, useDoc } from '../../src/app/state/doc';

const parts = (exposure: CaptionParts['overrides']['exposure']): CaptionParts => ({
  title: '',
  artist: '',
  fields: DEFAULT_FIELDS,
  overrides: { ...NO_OVERRIDES, exposure },
  dateFormat: 'dots',
});
const exif: ExifFacts = { ...EMPTY_EXIF, fNumber: 2.8, exposureTime: 30, iso: 6400 };

describe('露出の手入力 → キャプションの字', () => {
  it('写真の値だけ（手入力なし）は今までどおり', () => {
    expect(collectFacts(exif, parts(null)).exposure).toBe('F2.8 30s ISO6400');
    expect(collectFacts({ ...EMPTY_EXIF, fNumber: 5.6, exposureTime: 1 / 250, iso: 200 }, parts(null)).exposure).toBe('F5.6 1/250s ISO200');
    expect(collectFacts(EMPTY_EXIF, parts(null)).exposure).toBeUndefined();
  });

  it('手入力だけ（写真に露出が無い）でも、写真の値と同じ書き方になる', () => {
    expect(collectFacts(EMPTY_EXIF, parts({ f: 2.8, s: 30, iso: 6400 })).exposure).toBe(collectFacts(exif, parts(null)).exposure);
    expect(collectFacts(EMPTY_EXIF, parts({ f: 1.4, s: 1 / 8000, iso: 100 })).exposure).toBe('F1.4 1/8000s ISO100');
    expect(collectFacts(EMPTY_EXIF, parts({ f: null, s: 1 / 2, iso: null })).exposure).toBe('1/2s');
  });

  it('一部だけ入れたら、入れていない部分は写真の値に戻る', () => {
    expect(collectFacts(exif, parts({ f: 8, s: null, iso: null })).exposure).toBe('F8 30s ISO6400');
    expect(collectFacts(exif, parts({ f: null, s: 1 / 60, iso: 400 })).exposure).toBe('F2.8 1/60s ISO400');
    // 写真にシャッター速度が無ければ、その部分は出ない
    expect(collectFacts({ ...EMPTY_EXIF, fNumber: 2 }, parts({ f: null, s: null, iso: 800 })).exposure).toBe('F2 ISO800');
  });

  it('手入力は取り消せて、写真を替えると消える', () => {
    useDoc.getState().startPhoto();
    __resetHistoryForTest();
    useDoc.getState().setOverride('exposure', { f: 2.8, s: null, iso: null });
    expect(useDoc.getState().overrides.exposure).toEqual({ f: 2.8, s: null, iso: null });
    useDoc.getState().undo();
    expect(useDoc.getState().overrides.exposure).toBeNull();
    useDoc.getState().redo();
    expect(useDoc.getState().overrides.exposure?.f).toBe(2.8);
    useDoc.getState().startPhoto();
    expect(useDoc.getState().overrides.exposure).toBeNull();
  });
});
