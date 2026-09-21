/**
 * core の唯一の公開入口。
 *
 * ★この関数は解像度倍率 k を引数に取らない。★
 *
 * これがこのアプリで最も重要な不変条件である。k を受け取らないので、
 * 「プレビューのときだけ違う描き方をする」コードを書く場所が構文上存在しない。
 * 「プレビュー＝書き出し」は検証事項ではなく、構成上の帰結になる。
 *
 * この不変条件を壊す変更は許可しない。k を渡したくなったら、
 * それは RenderTarget に置くべき値である。
 */
import { CANVAS_WIDTH_LU, lu, rect, type Lu } from './units';
import { advanceFor, ascentFor, descentFor, type TextMeasurer } from './ports';
import { SceneBuilder } from './scene/builder';
import { photoId, rgba, type FontRef, type PhotoId, type Rgba } from './scene/ops';
import type { Scene, SceneWarning } from './scene/scene';
import type { StyleId } from './styles/types';

export interface SceneInput {
  readonly styleId: StyleId;
  readonly photo: {
    readonly id: string;
    /** 幅 / 高さ。**Orientation 適用後**の値（platform/decode.ts の契約） */
    readonly aspect: number;
  };
  readonly caption: {
    readonly text: string;
    readonly font: FontRef;
    readonly sizeLu: number;
    readonly letterSpacingLu: number;
    readonly align: 'left' | 'center' | 'right';
  };
  readonly background: Rgba;
  readonly ink: Rgba;
}

/**
 * 段階3 の範囲。写真・背景・1行キャプションだけを組む。
 * スタイルの15種は段階5 でデータから引くようになる。
 */
export function buildScene(input: SceneInput, measurer: TextMeasurer): Scene {
  const b = new SceneBuilder();
  const warnings: SceneWarning[] = [];

  // 余白と写真の配置（段階5 で StyleDef から引く。いまは OR1 相当の固定値）
  const pad = 24;
  const captionGap = 14;
  const photoW = CANVAS_WIDTH_LU - pad * 2;
  const photoH = photoW / input.photo.aspect;

  const metrics = measurer.measure(input.caption.text, input.caption.font);
  const textW = advanceFor(
    metrics,
    input.caption.sizeLu,
    input.caption.letterSpacingLu,
    [...input.caption.text].length,
  );
  const ascent = ascentFor(metrics, input.caption.sizeLu);
  const descent = descentFor(metrics, input.caption.sizeLu);

  const captionTop = pad + photoH + captionGap;
  const baseline = captionTop + ascent;
  const canvasH = baseline + descent + pad;

  b.add({
    op: 'photo',
    resolution: 'invariant',
    photo: photoId(input.photo.id) as PhotoId,
    srcNorm: { x: 0, y: 0, w: 1, h: 1 },
    dst: rect(pad, pad, photoW, photoH),
  });

  if (input.caption.text.length > 0) {
    const anchorX =
      input.caption.align === 'left'
        ? pad
        : input.caption.align === 'right'
          ? pad + photoW
          : pad + photoW / 2;
    b.add({
      op: 'text',
      resolution: 'invariant',
      id: 'caption',
      text: input.caption.text,
      font: input.caption.font,
      sizeLu: lu(input.caption.sizeLu),
      letterSpacingLu: lu(input.caption.letterSpacingLu),
      color: input.ink,
      anchor: { x: lu(anchorX), y: lu(baseline) },
      align: input.caption.align,
      measuredWidthLu: lu(textW),
      // 免責領域は実際に描かれる範囲より少し広く取る。
      // アンチエイリアスは字面の外側にもわずかに出る
      boundsLu: rect(
        (input.caption.align === 'right' ? anchorX - textW : input.caption.align === 'center' ? anchorX - textW / 2 : anchorX) - 2,
        captionTop - 2,
        textW + 4,
        ascent + descent + 4,
      ),
    });
  } else {
    warnings.push({ kind: 'caption-empty' });
  }

  const built = b.build();
  return {
    schema: 1,
    canvas: {
      widthLu: CANVAS_WIDTH_LU,
      heightLu: lu(canvasH) as Lu,
      background: input.background,
    },
    ops: built.ops,
    meta: {
      styleId: input.styleId,
      exactnessExempt: built.exactnessExempt,
      charsUsed: built.charsUsed,
      fontsUsed: built.fontsUsed,
      warnings,
    },
  };
}

export const WHITE: Rgba = rgba(255, 255, 255, 1);
export const INK: Rgba = rgba(35, 33, 31, 1);
