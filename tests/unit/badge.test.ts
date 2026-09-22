/** 仕上がりの刻印。配色の表と、読み取れる名前の対応 */
import { describe, expect, it } from 'vitest';
import { buildBadge, LOGO_NAMES, logoFor } from '../../src/core/badge';
import { INK, WHITE } from '../../src/core/compose';
import type { TextMeasurer } from '../../src/core/ports';
import { buildFujiNote, parseFujiFilm } from '../../src/app/fuji';

const measurer: TextMeasurer = {
  measure: (text) => ({ advanceAtRef: [...text].length * 60, ascentAtRef: 74, descentAtRef: 21 }),
  isAvailable: () => true,
};
const ctx = { baseSize: 16, maxW: 900, ink: INK, background: WHITE, family: 'Arimo', weight: 400 as const };
const L = (text: string, over: Partial<Parameters<typeof buildBadge>[0]> = {}): Parameters<typeof buildBadge>[0] => ({ text, mode: 'logo', align: 'center', size: 'M', framed: false, ...over });

describe('刻印の版', () => {
  it('FUJIFILM から読み取れる名前には、すべて専用の配色がある', () => {
    const values = [0x000, 0x130, 0x200, 0x501, 0x502, 0x503, 0x600, 0x700, 0x800, 0x900, 0xa00, 0xb00];
    for (const v of values) {
      const name = parseFujiFilm(buildFujiNote([{ tag: 0x1401, value: v }]));
      expect(name).not.toBeNull();
      expect(LOGO_NAMES, String(name)).toContain(name);
    }
    for (const v of [0x300, 0x310, 0x500]) {
      const name = parseFujiFilm(buildFujiNote([{ tag: 0x1003, value: v }]));
      expect(LOGO_NAMES, String(name)).toContain(name);
    }
  });

  it('フィルターの記号（ACROS +R）は本体の版に畳む', () => {
    expect(logoFor('ACROS +R', INK, WHITE)).toBe(logoFor('ACROS', INK, WHITE));
    expect(logoFor('MONOCHROME +Ye', INK, WHITE)).toBe(logoFor('MONOCHROME', INK, WHITE));
  });

  it('知らない名前（他社のピクチャーコントロール等）は地色と文字色を反転した札になる', () => {
    const d = logoFor('ビビッド', INK, WHITE);
    expect(d.parts[0]).toMatchObject({ k: 'rect', c: INK });
    expect(d.parts[1]).toMatchObject({ k: 'text', t: 'ビビッド', c: WHITE });
  });

  it('ロゴの高さは基準サイズに比例し、段の幅を越えない', () => {
    const a = buildBadge(L('PROVIA'), ctx, measurer);
    const b = buildBadge(L('PROVIA'), { ...ctx, baseSize: 32 }, measurer);
    expect(a && b && b.h / a.h).toBeCloseTo(2, 6);
    expect(a && a.w / a.h).toBeCloseTo(1, 6);
    const narrow = buildBadge(L('PROVIA'), { ...ctx, maxW: 30 }, measurer);
    expect(narrow?.w).toBeLessThanOrEqual(30 + 1e-9);
  });

  it('版の文字は箱からはみ出さない（どの書体でも幅を実測して縮める）', () => {
    for (const name of LOGO_NAMES) {
      const block = buildBadge(L(name), ctx, measurer);
      expect(block, name).not.toBeNull();
      if (!block) continue;
      for (const op of block.emit(0, 0)) {
        if (op.op !== 'text') continue;
        expect(op.boundsLu.x + 2, `${name}: ${op.text}`).toBeGreaterThanOrEqual(-1e-6);
        expect(op.boundsLu.x + op.boundsLu.w - 2, `${name}: ${op.text}`).toBeLessThanOrEqual(block.w + 1e-6);
        expect(op.boundsLu.y + op.boundsLu.h - 2, `${name}: ${op.text}`).toBeLessThanOrEqual(block.h + 1e-6);
      }
    }
  });

  it('文字の刻印は段より広ければ置かない。空の名前も置かない', () => {
    expect(buildBadge(L('ETERNA BLEACH BYPASS', { mode: 'text' }), { ...ctx, maxW: 40 }, measurer)).toBeNull();
    expect(buildBadge(L('  '), ctx, measurer)).toBeNull();
  });
});
