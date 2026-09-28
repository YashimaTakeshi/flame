/**
 * 項目ごとの候補（前に入れた値）。§3.32
 * 新しい順・同じ値は先頭へ・上限 8 件・空白と空は覚えない・保存が死んでいてもメモリで動く。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECENT_MAX, __reloadRecentForTest, candidatesFor, pushRecent, readRecent, useRecent } from '../../src/app/state/recent';
import { KEYS, safeStorage } from '../../src/platform/storage';

function install(impl: Partial<Storage>): void {
  const base: Storage = { length: 0, clear: () => {}, getItem: () => null, key: () => null, removeItem: () => {}, setItem: () => {} };
  vi.stubGlobal('localStorage', { ...base, ...impl });
}
function working(): Map<string, string> {
  const map = new Map<string, string>();
  install({
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  });
  return map;
}

beforeEach(() => {
  safeStorage.__resetForTest();
});
afterEach(() => vi.unstubAllGlobals());

describe('pushRecent', () => {
  it('新しいものが先頭。同じ値は増やさず先頭へ動かす', () => {
    let l: readonly string[] = [];
    l = pushRecent(l, 'X100V');
    l = pushRecent(l, 'GR III');
    l = pushRecent(l, 'X-T5');
    expect(l).toEqual(['X-T5', 'GR III', 'X100V']);
    l = pushRecent(l, 'X100V');
    expect(l).toEqual(['X100V', 'X-T5', 'GR III']);
  });

  it(`上限 ${RECENT_MAX} 件。古いものから落ちる`, () => {
    let l: readonly string[] = [];
    for (let i = 0; i < 12; i++) l = pushRecent(l, `c${i}`);
    expect(l).toHaveLength(RECENT_MAX);
    expect(l[0]).toBe('c11');
    expect(l).not.toContain('c3');
  });

  it('前後の空白は落とし、空・空白だけは覚えない', () => {
    let l: readonly string[] = ['A'];
    l = pushRecent(l, '  B  ');
    expect(l).toEqual(['B', 'A']);
    expect(pushRecent(l, '')).toBe(l);
    expect(pushRecent(l, '   ')).toBe(l);
    expect(pushRecent(l, ' A ')).toEqual(['A', 'B']);
  });
});

describe('readRecent', () => {
  it('壊れた保存・知らない形は空から。項目ごとに検証する', () => {
    expect(readRecent(null).camera).toEqual([]);
    expect(readRecent('{壊れた').camera).toEqual([]);
    expect(readRecent('[]').title).toEqual([]);
    const r = readRecent(JSON.stringify({ camera: ['A', 1, 'A', ' B '], lens: 'x', title: ['T'] }));
    expect(r.camera).toEqual(['A', 'B']);
    expect(r.lens).toEqual([]);
    expect(r.title).toEqual(['T']);
  });
});

describe('候補の絞り込み', () => {
  const list = ['X100V', 'X-T5', 'GR III', 'x-e4'];
  it('空なら全部。打ちかけの字は大文字小文字を問わず含むもの', () => {
    expect(candidatesFor(list, '', [])).toEqual(list);
    expect(candidatesFor(list, 'x-', [])).toEqual(['X-T5', 'x-e4']);
    expect(candidatesFor(list, 'zzz', [])).toEqual([]);
  });
  it('いまの値と同じものは出さない', () => {
    expect(candidatesFor(list, 'X-T5', ['X-T5'])).toEqual([]);
    expect(candidatesFor(list, '', ['GR III', null, undefined])).toEqual(['X100V', 'X-T5', 'x-e4']);
  });
});

describe('store（保存と読み戻し）', () => {
  it('覚えたものは保存され、読み直しても同じ順。長押しで外せる', () => {
    const map = working();
    __reloadRecentForTest();
    const r = useRecent.getState();
    r.record('artist', 'T. Yashima');
    r.record('artist', 'K. Sato');
    r.record('camera', 'X100V');
    expect(JSON.parse(map.get(KEYS.recent)!).artist).toEqual(['K. Sato', 'T. Yashima']);
    useRecent.setState({ lists: readRecent(null) });
    __reloadRecentForTest();
    expect(useRecent.getState().lists.artist).toEqual(['K. Sato', 'T. Yashima']);
    useRecent.getState().remove('artist', 'K. Sato');
    expect(useRecent.getState().lists.artist).toEqual(['T. Yashima']);
    expect(JSON.parse(map.get(KEYS.recent)!).artist).toEqual(['T. Yashima']);
  });

  it('★保存が投げても（プライベートモード）メモリで動き続ける★', () => {
    const boom = (): never => {
      throw new Error('SecurityError');
    };
    install({ getItem: boom, setItem: boom, removeItem: boom });
    useRecent.setState({ lists: readRecent(null) });
    expect(() => __reloadRecentForTest()).not.toThrow();
    const r = useRecent.getState();
    expect(() => r.record('lens', 'XF23mmF2 R WR')).not.toThrow();
    expect(useRecent.getState().lists.lens).toEqual(['XF23mmF2 R WR']);
    expect(() => useRecent.getState().remove('lens', 'XF23mmF2 R WR')).not.toThrow();
    expect(useRecent.getState().lists.lens).toEqual([]);
  });

  it('空・null は覚えない', () => {
    working();
    useRecent.setState({ lists: readRecent(null) });
    useRecent.getState().record('title', '');
    useRecent.getState().record('title', null);
    useRecent.getState().record('title', '  ');
    expect(useRecent.getState().lists.title).toEqual([]);
  });
});
