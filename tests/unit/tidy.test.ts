/**
 * キャプションの表記の整理（U07）。表示だけで、書き戻す EXIF は元のまま
 */
import { describe, expect, it } from 'vitest';
import { collectFacts, tidyCamera, tidyLens } from '../../src/app/caption';
import { EMPTY_EXIF, minimalExifOf } from '../../src/app/exif';
import { DEFAULT_FIELDS } from '../../src/app/state/doc';

describe('tidyCamera', () => {
  it('iPhone の「Apple 」を落とす', () => {
    expect(tidyCamera('Apple iPhone 16 Pro')).toBe('iPhone 16 Pro');
  });
  it('ほかのメーカーは触らない', () => {
    expect(tidyCamera('FUJIFILM X-M5')).toBe('FUJIFILM X-M5');
    expect(tidyCamera('Google Pixel 9')).toBe('Google Pixel 9');
    expect(tidyCamera(null)).toBeNull();
  });
});

describe('tidyLens', () => {
  it('iPhone の標準の書き方はまるごと落ちる（焦点距離と露出は別の項目で出る）', () => {
    expect(tidyLens('Apple iPhone 16 Pro', 'iPhone 16 Pro back camera 6.765mm f/1.78')).toBeNull();
    expect(tidyLens('Apple iPhone 15 Pro', 'iPhone 15 Pro back triple camera 6.765mm f/1.78')).toBeNull();
    expect(tidyLens('Apple iPhone 13', 'iPhone 13 back dual wide camera 5.1mm f/1.6')).toBeNull();
    expect(tidyLens('Apple iPhone 13', 'iPhone 13 front camera 2.71mm f/2.2')).toBeNull();
  });
  it('機種名で始まらないレンズは系列名だけ落とす', () => {
    expect(tidyLens('FUJIFILM X-M5', 'SIGMA 18-50mm F2.8 DC DN | Contemporary 021')).toBe('SIGMA 18-50mm F2.8 DC DN');
  });
  it('製品名の中の F 値は残す', () => {
    expect(tidyLens('FUJIFILM X-T5', 'XF27mmF2.8 R WR')).toBe('XF27mmF2.8 R WR');
    expect(tidyLens('FUJIFILM X-T5', 'XF35mmF1.4 R')).toBe('XF35mmF1.4 R');
  });
  it('値が無ければそのまま', () => {
    expect(tidyLens('Apple iPhone 16 Pro', null)).toBeNull();
  });
});

describe('collectFacts での整理', () => {
  const exif = { ...EMPTY_EXIF, camera: 'Apple iPhone 16 Pro', lens: 'iPhone 16 Pro back camera 6.765mm f/1.78' };
  const parts = {
    title: '',
    artist: '',
    fields: DEFAULT_FIELDS,
    dateFormat: 'dots' as const,
    overrides: { camera: null, lens: null, date: null, film: null },
  };
  it('写真の値は整える', () => {
    const f = collectFacts(exif, parts);
    expect(f.camera).toBe('iPhone 16 Pro');
    expect(f.lens).toBeUndefined();
  });
  it('手入力はそのまま出す', () => {
    const f = collectFacts(exif, { ...parts, overrides: { ...parts.overrides, camera: 'Apple iPhone 16 Pro', lens: 'Main 24mm' } });
    expect(f.camera).toBe('Apple iPhone 16 Pro');
    expect(f.lens).toBe('Main 24mm');
  });
  it('書き戻す EXIF は元の値のまま', () => {
    const m = minimalExifOf(exif);
    expect(m.model).toBe('Apple iPhone 16 Pro');
    expect(m.lens).toBe('iPhone 16 Pro back camera 6.765mm f/1.78');
  });
});
