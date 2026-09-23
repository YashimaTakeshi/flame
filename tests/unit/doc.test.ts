/**
 * 編集中の設定の既定値。
 * タイトルの既定は空。以前は 'Untitled' を毎回フチに焼いていて、
 * 配られた人の最初の1枚が「Untitled って何？」になった（入れた人だけ出る）。
 */
import { describe, expect, it, vi } from 'vitest';
import { collectFacts, effectiveFields } from '../../src/app/caption';
import { EMPTY_EXIF } from '../../src/app/exif';
import { COALESCE_MS, DEFAULT_FIELDS, HISTORY_MAX, __resetHistoryForTest, useDoc } from '../../src/app/state/doc';
import { DEFAULT_SPEC } from '../../src/core/styles/spec';

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

describe('取り消し・やり直し', () => {
  const reset = (): void => {
    useDoc.getState().startPhoto();
    useDoc.setState({ fields: DEFAULT_FIELDS, style: DEFAULT_SPEC });
    __resetHistoryForTest();
  };

  it('何段でも戻せて、やり直せる', () => {
    reset();
    const d = useDoc.getState();
    d.toggleField('lens');
    d.toggleField('camera');
    d.set('title', 'A');
    expect(useDoc.getState().undoDepth).toBe(3);
    useDoc.getState().undo();
    expect(useDoc.getState().title).toBe('');
    useDoc.getState().undo();
    expect(useDoc.getState().fields.camera).toBe(true);
    expect(useDoc.getState().fields.lens).toBe(false);
    expect(useDoc.getState().redoDepth).toBe(2);
    useDoc.getState().redo();
    expect(useDoc.getState().fields.camera).toBe(false);
    expect(useDoc.getState().redoDepth).toBe(1);
  });

  it('新しい変更でやり直しの先は消える', () => {
    reset();
    useDoc.getState().toggleField('lens');
    useDoc.getState().undo();
    expect(useDoc.getState().redoDepth).toBe(1);
    useDoc.getState().toggleField('camera');
    expect(useDoc.getState().redoDepth).toBe(0);
  });

  it('続けざまの同じ種類の変更は1段にまとまる', () => {
    reset();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(10_000);
      useDoc.getState().setStyle({ ratio: 'SQ' });
      vi.setSystemTime(10_000 + COALESCE_MS / 2);
      useDoc.getState().setStyle({ ratio: 'FF' });
      expect(useDoc.getState().undoDepth).toBe(1);
      vi.setSystemTime(10_000 + COALESCE_MS * 3);
      useDoc.getState().setStyle({ ratio: 'STN' });
      expect(useDoc.getState().undoDepth).toBe(2);
      useDoc.getState().undo();
      useDoc.getState().undo();
      expect(useDoc.getState().style.ratio).toBe(DEFAULT_SPEC.ratio);
    } finally {
      vi.useRealTimers();
    }
  });

  it('変わらない操作は段を積まない', () => {
    reset();
    useDoc.getState().set('title', '');
    useDoc.getState().setStyle({ ratio: DEFAULT_SPEC.ratio });
    expect(useDoc.getState().undoDepth).toBe(0);
  });

  it(`段は ${HISTORY_MAX} まで`, () => {
    reset();
    for (let i = 0; i < HISTORY_MAX + 10; i++) useDoc.getState().toggleField('lens');
    expect(useDoc.getState().undoDepth).toBe(HISTORY_MAX);
  });

  it('情報を戻すのは情報だけで、取り消せる', () => {
    reset();
    useDoc.getState().setStyle({ ratio: 'SQ' });
    useDoc.getState().set('title', 'Kyoto');
    useDoc.getState().toggleField('lens');
    useDoc.getState().setOverride('camera', 'X100');
    useDoc.getState().resetInfo();
    const s = useDoc.getState();
    expect(s.title).toBe('');
    expect(s.fields.lens).toBe(true);
    expect(s.overrides.camera).toBeNull();
    expect(s.style.ratio).toBe('SQ'); // 配置は残る
    useDoc.getState().undo();
    expect(useDoc.getState().title).toBe('Kyoto');
    expect(useDoc.getState().overrides.camera).toBe('X100');
  });

  it('情報シートの反映は何欄変えても1段。変わっていなければ積まない', () => {
    reset();
    const o = useDoc.getState().overrides;
    useDoc.getState().applyInfo({ title: '', artist: useDoc.getState().artist, overrides: { ...o, date: null } });
    expect(useDoc.getState().undoDepth).toBe(0);
    useDoc.getState().applyInfo({ title: 'Kyoto', overrides: { ...o, camera: 'X100', date: { y: 2020, m: 1, d: 1, hh: 0, mm: 0, ss: 0 } } });
    expect(useDoc.getState().undoDepth).toBe(1);
    useDoc.getState().undo();
    expect(useDoc.getState().title).toBe('');
    expect(useDoc.getState().overrides.camera).toBeNull();
  });

  it('写真を替えたら写真ごとの入力と履歴を捨てる。好みは残す', () => {
    reset();
    useDoc.getState().setStyle({ ratio: 'SQ' });
    useDoc.getState().set('title', 'Kyoto');
    useDoc.getState().set('skipShotFacts', true);
    useDoc.getState().setOverride('date', { y: 2020, m: 1, d: 1, hh: 0, mm: 0, ss: 0 });
    useDoc.getState().startPhoto();
    const s = useDoc.getState();
    expect(s.title).toBe('');
    expect(s.skipShotFacts).toBe(false);
    expect(s.overrides.date).toBeNull();
    expect(s.style.ratio).toBe('SQ');
    expect(s.undoDepth).toBe(0);
    expect(s.redoDepth).toBe(0);
  });
});

describe('この写真では撮影情報を入れない', () => {
  it('保存される項目は変えず、その1枚だけ撮影情報を切る', () => {
    const f = effectiveFields(DEFAULT_FIELDS, true);
    expect(f.date || f.camera || f.lens || f.exposure || f.focalLength).toBe(false);
    expect(f.title && f.artist && f.film).toBe(true);
    expect(DEFAULT_FIELDS.camera).toBe(true);
    expect(effectiveFields(DEFAULT_FIELDS, false)).toBe(DEFAULT_FIELDS);
  });
});
