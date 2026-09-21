/**
 * 文字の測定。**measureText を呼ぶのはこのファイルだけ**（eslint.config.js で強制）。
 *
 * 実行層のあちこちで測り直すと、プレビューと書き出しで違う値を使うことになり、
 * 「プレビュー＝書き出し」が壊れる。測るのはここ1箇所で、
 * 基準サイズ 100px の結果をキャッシュして線形換算する。
 */
import { REFERENCE_EM, type GlyphMetrics, type TextMeasurer } from '../core/ports';
import type { FontRef } from '../core/scene/ops';
import { createVerifiedCanvas, type Ctx } from './guards';
import { isReady } from './resources/fonts';

const cache = new Map<string, GlyphMetrics>();
let ctx: Ctx | null = null;

function measuringContext(): Ctx {
  if (ctx) return ctx;
  // 測定にしか使わないので最小のキャンバスでよい
  const r = createVerifiedCanvas(1, 1);
  if (!r.ok) throw new Error(`測定用のキャンバスを確保できません（${r.reason}）`);
  ctx = r.ctx;
  return ctx;
}

const fontCss = (font: FontRef, sizePx: number): string =>
  `${font.weight} ${sizePx}px "${font.family}"`;

export const canvasMeasurer: TextMeasurer = {
  measure(text: string, font: FontRef): GlyphMetrics {
    const key = `${font.family}/${font.weight}/${text}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const c = measuringContext();
    c.font = fontCss(font, REFERENCE_EM);
    // letterSpacing は測定に混ぜない。字間は core が文字数から足す
    if ('letterSpacing' in c) (c as { letterSpacing: string }).letterSpacing = '0px';
    const m = c.measureText(text);
    const metrics: GlyphMetrics = {
      advanceAtRef: m.width,
      ascentAtRef: m.actualBoundingBoxAscent,
      descentAtRef: m.actualBoundingBoxDescent,
    };
    cache.set(key, metrics);
    return metrics;
  },

  isAvailable(font: FontRef): boolean {
    return isReady(font);
  },
};

/** 書体を読み込み直したときは測定結果も捨てる。古い書体の幅を使い続けないように */
export function clearMeasureCache(): void {
  cache.clear();
}
