/**
 * 焦点距離は 35mm 換算で出す（依頼者の指定）。
 * 写真の換算値が最優先、無ければ機種から見積もり、機種が分からなければ実焦点距離。
 */
import { describe, expect, it } from 'vitest';
import { NO_OVERRIDES, collectFacts, type CaptionParts } from '../../src/app/caption';
import { EMPTY_EXIF, equiv35, type ExifFacts } from '../../src/app/exif';
import { DEFAULT_FIELDS } from '../../src/app/state/doc';

const parts: CaptionParts = { title: '', artist: '', fields: DEFAULT_FIELDS, overrides: NO_OVERRIDES, dateFormat: 'dots' };
const focal = (e: Partial<ExifFacts>): string | undefined => collectFacts({ ...EMPTY_EXIF, ...e }, parts).focalLength;

describe('焦点距離（35mm 換算）', () => {
  it('写真に換算値があればそれを使う', () => {
    expect(focal({ camera: 'FUJIFILM X-T5', focalLength: 23, focalLength35: 35 })).toBe('35mm');
  });

  it('換算値が落ちた写真は、機種の撮像素子から見積もる', () => {
    expect(focal({ camera: 'FUJIFILM X-H2', focalLength: 18 })).toBe('27mm');
    expect(focal({ camera: 'FUJIFILM GFX100S', focalLength: 63 })).toBe('50mm');
    expect(focal({ camera: 'SONY ILCE-6700', focalLength: 16 })).toBe('24mm');
    expect(focal({ camera: 'Canon EOS R7', focalLength: 50 })).toBe('80mm');
  });

  it('機種で決まらないものは実焦点距離のまま（フルサイズや不明な機種を勝手に換算しない）', () => {
    expect(focal({ camera: 'SONY ILCE-7M4', focalLength: 20 })).toBe('20mm');
    expect(focal({ camera: null, focalLength: 50 })).toBe('50mm');
    expect(equiv35('Apple iPhone 16 Pro', 6.765)).toBeNull();
  });
});
