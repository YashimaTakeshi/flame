/**
 * 編集中の設定の既定値。
 * タイトルの既定は空。以前は 'Untitled' を毎回フチに焼いていて、
 * 配られた人の最初の1枚が「Untitled って何？」になった（入れた人だけ出る）。
 */
import { describe, expect, it } from 'vitest';
import { collectFacts } from '../../src/app/caption';
import { EMPTY_EXIF } from '../../src/app/exif';
import { useDoc } from '../../src/app/state/doc';

describe('既定値', () => {
  it('タイトルは空で始まり、空ならキャプションに行そのものが出ない', () => {
    const s = useDoc.getState();
    expect(s.title).toBe('');
    const facts = collectFacts(EMPTY_EXIF, {
      title: s.title,
      artist: s.artist,
      fields: s.fields,
      overrides: s.overrides,
      dateFormat: s.dateFormat,
    });
    expect(facts.title).toBeUndefined();
    expect(Object.keys(facts)).toEqual([]);
  });

  it('日付の書き方の既定は 2026.09.20 の形', () => {
    const s = useDoc.getState();
    expect(s.dateFormat).toBe('dots');
    const facts = collectFacts(
      { ...EMPTY_EXIF, dateTaken: { y: 2026, m: 9, d: 20, hh: 0, mm: 0, ss: 0 } },
      { title: '', artist: '', fields: s.fields, overrides: s.overrides, dateFormat: 'ja' },
    );
    expect(facts.date).toBe('2026年9月20日');
  });
});
