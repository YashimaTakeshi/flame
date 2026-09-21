import { describe, expect, it } from 'vitest';
import { hairline, logical, lu, px, resolveLength, rect, inset } from '../../src/core/units';

describe('長さの解決', () => {
  it('論理単位は k を掛けるだけ', () => {
    expect(resolveLength(logical(lu(16)), 0.8)).toBe(12.8);
    expect(resolveLength(logical(lu(16)), 6)).toBe(96);
  });

  it('core では丸めない。端数はそのまま実行層へ渡す', () => {
    expect(resolveLength(logical(lu(1)), 0.333)).toBe(0.333);
  });

  it('ヘアラインはプレビューで消えないよう下限が効く', () => {
    // 書き出し(k=6)では素直に 0.5*6=3px
    expect(resolveLength(hairline(lu(0.5)), 6)).toBe(3);
    // プレビュー(k=0.8)では 0.4px になってしまうので 1px に持ち上げる
    expect(resolveLength(hairline(lu(0.5)), 0.8)).toBe(1);
  });

  it('スケールは線形。倍率の比がそのまま長さの比になる', () => {
    const a = resolveLength(logical(lu(37.5)), 0.8);
    const b = resolveLength(logical(lu(37.5)), 6);
    expect(b / a).toBeCloseTo(7.5, 10);
  });
});

describe('矩形', () => {
  it('inset は四辺を個別に縮められる', () => {
    expect(inset(rect(0, 0, 100, 100), 10)).toEqual(rect(10, 10, 80, 80));
    expect(inset(rect(0, 0, 100, 100), 10, 20)).toEqual(rect(20, 10, 60, 80));
    expect(inset(rect(0, 0, 100, 100), 1, 2, 3, 4)).toEqual(rect(4, 1, 94, 96));
  });

  it('負の値を渡すと広がる', () => {
    expect(inset(rect(10, 10, 80, 80), -10)).toEqual(rect(0, 0, 100, 100));
  });
});

describe('ブランド型', () => {
  it('px と lu は実行時にはただの数値', () => {
    expect(px(3) + lu(4)).toBe(7);
  });
});
