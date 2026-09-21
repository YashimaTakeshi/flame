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
import { lu, point, rect, type Lu } from './units';
import type { TextMeasurer } from './ports';
import { typesetCaption, type Facts, type Gates, type TypesetLine } from './caption';
import { SceneBuilder } from './scene/builder';
import { photoId, rgba, type PhotoId, type Rgba } from './scene/ops';
import type { Scene, SceneWarning } from './scene/scene';
import { captionWidthLu, layoutViolations, resolveLayout } from './styles/layout';
import { styleOf } from './styles/registry';
import type { Align, SizeId, StyleId, TrackingId } from './styles/types';

export interface SceneInput {
  readonly styleId: StyleId;
  readonly photo: {
    readonly id: string;
    /** 幅 / 高さ。**Orientation 適用後**の値（platform/decode.ts の契約） */
    readonly aspect: number;
  };
  /** 撮影情報を文字列にしたもの。無い項目は入れない（空文字も入れない） */
  readonly facts: Facts;
  /** 利用者が情報タブで切った項目 */
  readonly gates: Gates;
  readonly family: string;
  readonly hasBold: boolean;
  readonly align: Align;
  readonly tracking: TrackingId;
  readonly size: SizeId;
  readonly background: Rgba;
  readonly ink: Rgba;
}

/** 写真の上に重ねるときの文字色。暗幕の上なので地色によらず明色で置く */
export const OVERLAY_INK: Rgba = rgba(244, 242, 239, 1);

/**
 * 暗幕の濃さの形。t=0 が暗幕の上端、t=1 がキャンバスの下端。
 *
 * **上端から下端まで一直線に濃くしてはいけない。**
 * キャプションは下端から outerInset だけ上にあり、そこがまだ薄いままだと読めない。
 * 実測: 設計値どおり（上端0→下端0.42 の直線）だと、キャプションの位置での
 * 濃さは 0.33 にしかならず、明るい写真の上でコントラストが 2.0:1 まで落ちた。
 * 途中で目標の濃さに達して、そこから下は平らにする。
 */
const SCRIM_PLATEAU_AT = 0.5;

export function scrimAlphaAt(t: number, peak: number): number {
  if (t <= 0) return 0;
  if (t >= SCRIM_PLATEAU_AT) return peak;
  /*
   * 立ち上がりは smoothstep。両端で傾きが 0 になるので、
   * 平らな部分との継ぎ目に折れ目が出ない。
   * 単純な冪（p**1.6）で試したら、継ぎ目が水平線のように見えた。
   */
  const p = t / SCRIM_PLATEAU_AT;
  return peak * p * p * (3 - 2 * p);
}

/** muted の色。地色へ寄せる。黒一色の濃淡ではなく「地に沈める」 */
const mix = (a: Rgba, b: Rgba, t: number): Rgba =>
  rgba(
    Math.round(a.r + (b.r - a.r) * t),
    Math.round(a.g + (b.g - a.g) * t),
    Math.round(a.b + (b.b - a.b) * t),
    1,
  );

export function buildScene(input: SceneInput, measurer: TextMeasurer): Scene {
  const def = styleOf(input.styleId);
  const b = new SceneBuilder();
  const warnings: SceneWarning[] = [];

  /* 1. 文字を組む。幅は高さを知らなくても決まるので循環しない */
  const boxW = captionWidthLu(def);
  const typeset = typesetCaption(
    def,
    {
      facts: input.facts,
      gates: input.gates,
      size: input.size,
      tracking: input.tracking,
      align: input.align,
      family: input.family,
      hasBold: input.hasBold,
    },
    boxW,
    measurer,
  );
  warnings.push(...typeset.warnings);
  if (typeset.lines.length === 0) warnings.push({ kind: 'caption-empty' });

  /* 2. 組み上がった高さで矩形を決める */
  const layout = resolveLayout(def, input.photo.aspect, typeset.heightLu);
  if (layout.bandExpanded) warnings.push({ kind: 'band-expanded', ...layout.bandExpanded });

  const overlay = def.caption.place === 'overlay-bottom';
  const ink = overlay ? OVERLAY_INK : input.ink;
  const muted = overlay ? mix(ink, rgba(0, 0, 0), 0.22) : mix(ink, input.background, 0.42);

  /* 3. 写真 */
  b.add({
    op: 'photo',
    resolution: 'invariant',
    photo: photoId(input.photo.id) as PhotoId,
    srcNorm: layout.photoSrcNorm,
    dst: layout.photo,
  });

  /* 4. 暗幕（重ね文字のときだけ） */
  const scrim = def.caption.scrim;
  if (overlay && scrim) {
    const h = scrim.heightLu as number;
    const top = (layout.canvas.h as number) - h;
    b.add({
      op: 'linearGradient',
      resolution: 'invariant',
      rect: rect(0, top, layout.canvas.w, h),
      from: point(0, top),
      to: point(0, top + h),
      // 上の曲線をそのまま刻む。式と描画を1箇所に保つ
      stops: [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.45, 0.5, 1].map((t) => ({
        at: t,
        color: rgba(0, 0, 0, scrimAlphaAt(t, scrim.alpha)),
      })),
    });
  }

  /* 5. キャプション */
  let y = layout.captionBox.y as number;
  for (const line of typeset.lines) {
    b.add(textOpFor(line, layout.captionBox.x, layout.captionBox.w, y, colorFor(line, ink, muted)));
    y += line.lineHeight;
  }

  /* 6. 不変条件。ここで落ちるのはスタイル定義の誤りで、利用者の操作では起きない */
  const bad = layoutViolations(layout, def.caption.place);
  if (bad.length > 0) throw new Error(`${def.id} のレイアウトが破綻しました: ${bad.join(' / ')}`);

  const built = b.build();
  return {
    schema: 1,
    canvas: {
      widthLu: layout.canvas.w,
      heightLu: layout.canvas.h,
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

const colorFor = (line: TypesetLine, ink: Rgba, muted: Rgba): Rgba =>
  line.emphasis === 'muted' ? muted : ink;

/** 1行を text op にする。行箱の中で上下中央に置く */
function textOpFor(
  line: TypesetLine,
  boxX: Lu,
  boxW: Lu,
  lineTop: number,
  color: Rgba,
): Parameters<SceneBuilder['add']>[0] {
  const inner = line.ascent + line.descent;
  const baseline = lineTop + (line.lineHeight - inner) / 2 + line.ascent;
  const anchorX =
    line.align === 'left' ? boxX : line.align === 'right' ? boxX + boxW : boxX + boxW / 2;
  const left =
    line.align === 'left'
      ? anchorX
      : line.align === 'right'
        ? anchorX - line.widthLu
        : anchorX - line.widthLu / 2;
  return {
    op: 'text',
    resolution: 'invariant',
    id: line.id,
    text: line.text,
    font: line.font,
    sizeLu: lu(line.sizeLu),
    letterSpacingLu: lu(line.letterSpacingLu),
    color,
    anchor: point(anchorX, baseline),
    align: line.align,
    measuredWidthLu: lu(line.widthLu),
    // 免責領域は実際に描かれる範囲より少し広く取る。
    // アンチエイリアスは字面の外側にもわずかに出る
    boundsLu: rect(left - 2, baseline - line.ascent - 2, line.widthLu + 4, inner + 4),
  };
}

export const WHITE: Rgba = rgba(255, 255, 255, 1);
export const INK: Rgba = rgba(35, 33, 31, 1);
