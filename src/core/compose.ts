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
import { hairline, lu, point, px, rect, type Lu, type RectLu } from './units';
import { advanceFor, ascentFor, descentFor, type TextMeasurer } from './ports';
import { typesetCaption, type Facts, type Gates, type TypesetLine } from './caption';
import { SceneBuilder } from './scene/builder';
import { photoId, rgba, type DrawOp, type FontRef, type PhotoId, type Rgba } from './scene/ops';
import type { Scene, SceneWarning } from './scene/scene';
import { captionWidthLu, layoutViolations, resolveLayout } from './styles/layout';
import { styleFor } from './styles/spec';
import type { StyleDef } from './styles/types';
import { CENTER_FOCUS, type Align, type Focus, type SizeId, type StyleSpec, type TrackingId } from './styles/types';

export interface SceneInput {
  /** 比率 × 写真の位置 × 文字の位置 × 寄せ × 行数 × 余白 */
  readonly style: StyleSpec;
  /** 全面のときの切り取りの中心。省くと中央 */
  readonly focus?: Focus;
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
  /** 地の太さ。参考アプリは Bold の書体を別の選択肢として並べている */
  readonly weight: 400 | 700;
  readonly hasBold: boolean;
  readonly align: Align;
  readonly tracking: TrackingId;
  readonly size: SizeId;
  /**
   * 写真の外側のヘアライン枠。
   * スタイルと直交する軸（参考アプリの Color タブの Standard / Bordered）。
   */
  readonly bordered: boolean;
  readonly background: Rgba;
  readonly ink: Rgba;
  /**
   * 写真の右下に刻むフィルム名（PROVIA / CLASSIC CHROME …）。null か省略なら刻まない。
   * 参考アプリはメーカーのロゴ画像を置くが、商標の絵は同梱しない。名前を文字で刻む。
   */
  readonly badge?: string | null;
}

/** 枠線の太さ。プレビューで消えないよう下限1pxを持つ */
const BORDER_LU = 1.2;

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
  const def = styleFor(input.style);
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
      weight: input.weight,
      hasBold: input.hasBold,
    },
    boxW,
    measurer,
  );
  warnings.push(...typeset.warnings);
  if (typeset.lines.length === 0) warnings.push({ kind: 'caption-empty' });

  /* 2. 組み上がった高さで矩形を決める */
  const layout = resolveLayout(def, input.photo.aspect, typeset.heightLu, input.focus ?? CENTER_FOCUS);

  const overlay = def.caption.place === 'overlay';
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

  /* 4. 枠線（Bordered）。写真の外周をヘアラインでなぞる */
  if (input.bordered) {
    /*
     * 線はパスの中心に引かれるので、全面ブリードのときは外側の半分が
     * キャンバスの外に落ちて線が半分の太さに見える。その分だけ内側に寄せる。
     */
    const half = def.spec.margin === 'none' ? BORDER_LU / 2 : 0;
    b.add({
      op: 'strokeRect',
      resolution: 'invariant',
      rect: rect(
        (layout.photo.x as number) + half,
        (layout.photo.y as number) + half,
        (layout.photo.w as number) - half * 2,
        (layout.photo.h as number) - half * 2,
      ),
      color: overlay ? OVERLAY_INK : input.ink,
      width: hairline(lu(BORDER_LU), px(1)),
      snap: 'device-pixel-when-preview',
    });
  }

  /* 5. 暗幕（重ね文字のときだけ） */
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

  /* 6. キャプション */
  let y = layout.captionBox.y as number;
  for (const line of typeset.lines) {
    b.add(textOpFor(line, layout.captionBox.x, layout.captionBox.w, y, colorFor(line, ink, muted)));
    y += line.lineHeight;
  }

  /* 6b. フィルムの刻印。重ねのときは文字の上に逃がす（重ならないように） */
  if (input.badge) {
    const badge = badgeOps(
      input.badge,
      def,
      layout.photo,
      overlay && typeset.lines.length > 0 ? (layout.captionBox.y as number) : null,
      input,
      measurer,
    );
    if (badge) {
      // 板の縁のアンチエイリアスは 1px ほど外に出るので、文字と同じく少し広く免責する
      const p = badge.plate;
      b.exemptRect(rect((p.x as number) - 2, (p.y as number) - 2, (p.w as number) + 4, (p.h as number) + 4));
      b.addAll(badge.ops);
    }
  }

  /* 7. 不変条件。ここで落ちるのはスタイル定義の誤りで、利用者の操作では起きない */
  const bad = layoutViolations(layout, def.caption.place);
  if (bad.length > 0) {
    const k = `${def.spec.ratio}/${def.spec.photo}/${def.spec.caption}/${def.spec.lines}/${def.spec.margin}`;
    throw new Error(`${k} のレイアウトが破綻しました: ${bad.join(' / ')}`);
  }

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
      style: def.spec,
      exactnessExempt: built.exactnessExempt,
      charsUsed: built.charsUsed,
      fontsUsed: built.fontsUsed,
      warnings,
    },
  };
}

const colorFor = (line: TypesetLine, ink: Rgba, muted: Rgba): Rgba =>
  line.emphasis === 'muted' ? muted : ink;

/* ── フィルムの刻印 ─────────────────────────────────────────
 * 写真の右下に、暗い板の上へ明色の文字で置く。板は半透明で、明るい写真でも暗い写真でも
 * 文字が読める。写真の中に置くので、地色にもキャプションの色にも従わない。
 */
const BADGE_SIZE_LU = 15;
const BADGE_TRACK_EM = 0.08;
const BADGE_PLATE: Rgba = rgba(16, 16, 16, 0.6);
const BADGE_INK: Rgba = rgba(244, 242, 239, 1);

function badgeOps(
  text: string,
  def: StyleDef,
  photo: RectLu,
  captionTop: number | null,
  input: SceneInput,
  measurer: TextMeasurer,
): { ops: DrawOp[]; plate: RectLu } | null {
  const size = BADGE_SIZE_LU * def.typeScale;
  const font: FontRef = { family: input.family, weight: input.hasBold ? 700 : input.weight };
  const m = measurer.measure(text, font);
  const track = size * BADGE_TRACK_EM;
  const textW = advanceFor(m, size, track, [...text].length);
  const ascent = ascentFor(m, size);
  const descent = descentFor(m, size);
  const padX = size * 0.7;
  const padY = size * 0.45;
  const plateW = textW + padX * 2;
  const plateH = ascent + descent + padY * 2;

  const pw = photo.w as number;
  const ph = photo.h as number;
  const inset = Math.max(14, Math.min(pw, ph) * 0.03);
  // 写真が小さすぎて刻印が収まらないなら刻まない（はみ出すより無い方がよい）
  if (plateW > pw - inset * 2 || plateH > ph - inset * 2) return null;

  const right = (photo.x as number) + pw - inset;
  let bottom = (photo.y as number) + ph - inset;
  if (captionTop !== null) bottom = Math.min(bottom, captionTop - inset * 0.6);
  const x = right - plateW;
  const y = bottom - plateH;
  if (y < (photo.y as number) + inset) return null;

  const plate = rect(x, y, plateW, plateH);
  const baseline = y + padY + ascent;
  return {
    plate,
    ops: [
      { op: 'fillRect', resolution: 'invariant', rect: plate, color: BADGE_PLATE },
      {
        op: 'text',
        resolution: 'invariant',
        id: 'badge',
        text,
        font,
        sizeLu: lu(size),
        letterSpacingLu: lu(track),
        color: BADGE_INK,
        anchor: point(x + padX, baseline),
        align: 'left',
        measuredWidthLu: lu(textW),
        boundsLu: rect(x + padX - 2, baseline - ascent - 2, textW + 4, ascent + descent + 4),
      },
    ],
  };
}

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
