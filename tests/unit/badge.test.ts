/**
 * 仕上がりの刻印。
 *
 * 札の絵は core が持たない。core は識別子と縦横比だけを受け取り、
 * 実体は実行層が解決する（写真と同じ扱い）。
 * ここで見るのは「渡された比のとおりに置くか」「無いときに落ちるか」の2つ。
 */
import { describe, expect, it } from 'vitest';
import { buildBadge, type BadgeSpec } from '../../src/core/badge';
import { INK, WHITE } from '../../src/core/compose';
import type { TextMeasurer } from '../../src/core/ports';
import { buildFujiNote, parseFujiFilm } from '../../src/app/fuji';
// 配布物そのものを読む。目録を書き換えて札を消したら、ここで落ちる
import manifest from '../../public/film/manifest.json';

const measurer: TextMeasurer = {
  measure: (text) => ({ advanceAtRef: [...text].length * 60, ascentAtRef: 74, descentAtRef: 21 }),
  isAvailable: () => true,
};
const ctx = { baseSize: 16, maxW: 900, ink: INK, background: WHITE, family: 'Arimo', weight: 400 as const };
const spec = (over: Partial<BadgeSpec> = {}): BadgeSpec => ({
  text: 'PROVIA',
  mode: 'logo',
  place: 'below',
  align: 'center',
  valign: 'center',
  size: 'M',
  framed: false,
  ...over,
});
const IMAGE = { id: 'film:PROVIA', aspect: 300 / 220 };

describe('同梱した札を置く', () => {
  it('札があれば画像の命令を1つ出す。無ければ名前の面に落ちる', () => {
    const withImage = buildBadge(spec({ image: IMAGE }), ctx, measurer);
    expect(withImage?.emit(0, 0).filter((o) => o.op === 'photo')).toHaveLength(1);
    const without = buildBadge(spec(), ctx, measurer);
    expect(without?.emit(0, 0).some((o) => o.op === 'photo')).toBe(false);
    expect(without?.emit(0, 0).some((o) => o.op === 'text')).toBe(true);
  });

  it('高さは大きさの指定で決まり、幅は札の比に従う', () => {
    const h = (size: 'S' | 'M' | 'L'): number => buildBadge(spec({ image: IMAGE, size }), ctx, measurer)!.h;
    expect(h('S')).toBeLessThan(h('M'));
    expect(h('M')).toBeLessThan(h('L'));
    const b = buildBadge(spec({ image: IMAGE }), ctx, measurer)!;
    expect(b.w / b.h).toBeCloseTo(IMAGE.aspect, 6);
    expect(b.h).toBeCloseTo(16 * 6, 6);
  });

  it('段に入らなければ幅で止める。比は崩さない', () => {
    const b = buildBadge(spec({ image: IMAGE, size: 'L' }), { ...ctx, maxW: 60 }, measurer)!;
    expect(b.w).toBeCloseTo(60, 6);
    expect(b.w / b.h).toBeCloseTo(IMAGE.aspect, 6);
  });

  it('壊れた比でも落ちない', () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const b = buildBadge(spec({ image: { id: 'film:x', aspect } }), ctx, measurer);
      expect(b, String(aspect)).not.toBeNull();
      expect(b!.w).toBeGreaterThan(0);
      expect(b!.h).toBeGreaterThan(0);
    }
  });

  it('枠は選んだときだけ出る。文字でも札でも同じ', () => {
    const strokes = (s: BadgeSpec): number =>
      buildBadge(s, ctx, measurer)!.emit(0, 0).filter((o) => o.op === 'strokeRect').length;
    expect(strokes(spec({ image: IMAGE }))).toBe(0);
    expect(strokes(spec({ image: IMAGE, framed: true }))).toBe(1);
    expect(strokes(spec({ mode: 'text', framed: true }))).toBe(1);
  });

  it('段より広い名前は刻まない。空の名前も置かない', () => {
    expect(buildBadge(spec({ text: 'ETERNA BLEACH BYPASS', mode: 'text' }), { ...ctx, maxW: 40 }, measurer)).toBeNull();
    expect(buildBadge(spec({ text: '  ' }), ctx, measurer)).toBeNull();
  });
});

describe('同梱した札の品揃え', () => {
  /** 札を同梱していない名前。富士の一覧にあるが原画をもらっていない */
  const WITHOUT_LOGO = new Set(['MONOCHROME', 'BLEACH BYPASS']);

  it('★写真から読める名前には、札があるか、無いと分かっているかのどちらかである★', () => {
    const values = [0x000, 0x130, 0x200, 0x501, 0x502, 0x503, 0x600, 0x700, 0x800, 0x900, 0xa00, 0xb00];
    for (const v of values) {
      const name = parseFujiFilm(buildFujiNote([{ tag: 0x1401, value: v }]));
      expect(name).not.toBeNull();
      expect(name! in manifest.logos || WITHOUT_LOGO.has(name!), `${name} の札`).toBe(true);
    }
    for (const v of [0x300, 0x310, 0x500]) {
      const name = parseFujiFilm(buildFujiNote([{ tag: 0x1003, value: v }]));
      expect(name! in manifest.logos || WITHOUT_LOGO.has(name!), `${name} の札`).toBe(true);
    }
  });

  it('目録の札はどれも形を持つ（比を出せないと寸法が決まらない）', () => {
    expect(Object.keys(manifest.logos).length).toBeGreaterThanOrEqual(13);
    for (const [name, e] of Object.entries(manifest.logos)) {
      expect(e.w, name).toBeGreaterThan(0);
      expect(e.h, name).toBeGreaterThan(0);
      expect(e.file, name).toMatch(/^film\/[a-z0-9-]+\.webp$/);
    }
  });
});
