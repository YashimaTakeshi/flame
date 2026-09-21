/**
 * スタイルチップの図。
 *
 * 図は手描きしない。**実際のレイアウト計算をそのまま通して**割合に直す。
 * 手で描くと、スタイルを直したときに図だけ古いまま残る。
 */
import { resolveLayout } from '../../core/styles/layout';
import type { StyleDef } from '../../core/styles/types';

export interface FigureRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Figure {
  /** キャンバスの横／縦 */
  readonly aspect: number;
  readonly photo: FigureRect;
  readonly lines: readonly FigureRect[];
  readonly overlay: boolean;
}

/** 図を描くための仮の写真比。3:2 の横位置を代表にする */
const SAMPLE_ASPECT = 3 / 2;
const SAMPLE_SIZE_LU = 16;

/** 行ごとの見かけの長さ。1行目を長く、以降を短く見せる */
const WIDTHS = [0.92, 0.72, 0.56, 0.48];

export function figureFor(def: StyleDef): Figure {
  const specs = def.caption.lines;
  const heights = specs.map((s) => SAMPLE_SIZE_LU * def.typeScale * s.relSize * s.leading);
  const captionH = heights.reduce((a, b) => a + b, 0);
  const l = resolveLayout(def, SAMPLE_ASPECT, captionH);
  const W = l.canvas.w as number;
  const H = l.canvas.h as number;

  const lines: FigureRect[] = [];
  let y = l.captionBox.y as number;
  specs.forEach((s, i) => {
    const lh = heights[i] ?? 0;
    const bar = Math.max(1.5, SAMPLE_SIZE_LU * def.typeScale * s.relSize * 0.62);
    const boxW = l.captionBox.w as number;
    const w = boxW * (WIDTHS[i] ?? 0.5);
    const align = s.alignOverride ?? def.defaults.align;
    const x =
      align === 'left'
        ? (l.captionBox.x as number)
        : align === 'right'
          ? (l.captionBox.x as number) + boxW - w
          : (l.captionBox.x as number) + (boxW - w) / 2;
    lines.push({ x: x / W, y: (y + (lh - bar) / 2) / H, w: w / W, h: bar / H });
    y += lh;
  });

  return {
    aspect: W / H,
    photo: {
      x: (l.photo.x as number) / W,
      y: (l.photo.y as number) / H,
      w: (l.photo.w as number) / W,
      h: (l.photo.h as number) / H,
    },
    lines,
    overlay: def.caption.place === 'overlay-bottom',
  };
}
