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
import { CANVAS_WIDTH_LU, hairline, lu, point, px, rect, type Lu } from './units';
import type { TextMeasurer } from './ports';
import { badgeBounds, buildBadge, type BadgeSpec } from './badge';
import { typesetCaption, type Facts, type Gates, type TypesetLine } from './caption';
import { SceneBuilder } from './scene/builder';
import { photoId, rgba, type PhotoId, type Rgba } from './scene/ops';
import type { Scene, SceneWarning } from './scene/scene';
import { captionWidthLu, layoutViolations, resolveLayout, type ExtraBand } from './styles/layout';
import { styleFor } from './styles/spec';
import { SIZE_LU } from './styles/tokens';
import { CENTER_FOCUS, type Align, type CaptionAlign, type Focus, type SizeId, type StyleSpec, type TrackingId } from './styles/types';

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
   * 仕上がり（PROVIA / CLASSIC CHROME / ビビッド …）の刻印。null か省略なら刻まない。
   * 写真の中ではなく帯の中。キャプションと同じ辺なら同じ帯を分け合い、別の辺ならその辺に帯を取る。
   * 重ね（全面）には帯が無いので置かない。
   */
  readonly badge?: BadgeSpec | null;
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

  const overlay = def.caption.place === 'overlay';

  /* 1b. 刻印。帯の大きさを決める前に組む。重ねには帯が無い */
  const baseSize = SIZE_LU[input.size] * def.typeScale;
  const bspec = input.badge && !overlay ? input.badge : null;
  const capPlace = def.caption.place;
  const shared = bspec !== null && bspec.place === capPlace; // キャプションと同じ帯を分け合う
  const sideBand = bspec !== null && (bspec.place === 'left' || bspec.place === 'right');
  const badgeMaxW = shared
    ? boxW
    : sideBand
      ? SIDE_BADGE_BAND_LU
      : (CANVAS_WIDTH_LU as number) - (def.caption.sideInsetLu as number) * 2;
  const badge = bspec
    ? buildBadge(
        bspec,
        {
          baseSize,
          maxW: badgeMaxW,
          ink: input.ink,
          background: input.background,
          family: input.family,
          weight: input.weight,
        },
        measurer,
      )
    : null;

  /*
   * 同じ帯を分け合うとき、帯に要る高さ。
   * 横に重なる（文字が中央で幅いっぱい、など）なら縦に積むぶんが要る。
   * 横に重ならない（文字は左、刻印は右）なら高い方だけあればよい。
   */
  const textH = typeset.heightLu;
  const textRange = hRangeOfLines(typeset.lines, boxW);
  const crossX =
    badge !== null && bspec !== null && textRange !== null
      ? rangesCross(textRange, hRange(bspec.align, badge.w, boxW))
      : false;
  const stackGap = badge && textH > 0 ? baseSize * 0.6 : 0;
  const need = badge && shared ? (crossX ? textH + stackGap + badge.h : Math.max(textH, badge.h)) : textH;
  const extra: ExtraBand | null =
    badge && bspec && !shared ? { place: bspec.place, sizeLu: sideBand ? badge.w : badge.h } : null;

  /* 2. 組み上がった高さで矩形を決める */
  const layout = resolveLayout(def, input.photo.aspect, need, input.focus ?? CENTER_FOCUS, extra);

  /*
   * 2b. 文字と刻印の置き場所。
   * 文字は帯の中で寄せ（captionAlign）、刻印は帯の中で自分の位置（align / valign）。
   * 同じ場所を取り合ったら、文字を先に、刻印をその下に積んで、まとめて寄せる。
   */
  let textTop = layout.captionBox.y as number;
  let badgeAt: { x: number; y: number } | null = null;
  if (badge && bspec) {
    const region = shared ? layout.band : layout.extraBand;
    if (region) {
      const rx = region.x as number;
      const rw = region.w as number;
      const ry = region.y as number;
      const rh = region.h as number;
      const bx = rx + hRange(bspec.align, badge.w, rw)[0];
      let by = valignIn(ry, rh, badge.h, bspec.valign);
      if (shared) {
        textTop = valignIn(ry, rh, textH, def.spec.captionAlign);
        // 左右の段は組んだ幅（300）より広いことがある。重なりは実際の帯の幅で見直す
        const textRangeNow = hRangeOfLines(typeset.lines, rw);
        const crossXNow = textRangeNow !== null && rangesCross(textRangeNow, hRange(bspec.align, badge.w, rw));
        const crossY = textH > 0 && textTop < by + badge.h && by < textTop + textH;
        if (crossXNow && crossY) {
          const top = valignIn(ry, rh, textH + stackGap + badge.h, def.spec.captionAlign);
          textTop = top;
          by = top + textH + stackGap;
        }
      }
      badgeAt = { x: bx, y: by };
    }
  }

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
  let y = textTop;
  for (const line of typeset.lines) {
    b.add(textOpFor(line, layout.captionBox.x, layout.captionBox.w, y, colorFor(line, ink, muted)));
    y += line.lineHeight;
  }

  /* 6b. 刻印 */
  if (badge && badgeAt) {
    b.exemptRect(badgeBounds(badgeAt.x, badgeAt.y, badge));
    b.addAll(badge.emit(badgeAt.x, badgeAt.y));
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

/** 刻印だけの左右の帯の幅の上限。ロゴの最大（基準 20lu × 8 = 160lu）が入る */
const SIDE_BADGE_BAND_LU = 200;

/** 幅 w の塊を幅 boxW の中で align に寄せたときの [左, 右]（箱の左端からの相対） */
function hRange(align: Align, w: number, boxW: number): [number, number] {
  const left = align === 'left' ? 0 : align === 'right' ? boxW - w : (boxW - w) / 2;
  return [left, left + w];
}

/** 組んだ行が横に占める範囲の合併。行が無ければ null */
function hRangeOfLines(lines: readonly TypesetLine[], boxW: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const l of lines) {
    const [a, b] = hRange(l.align, l.widthLu, boxW);
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  return lines.length ? [lo, hi] : null;
}

const rangesCross = (a: [number, number], b: [number, number]): boolean => a[0] < b[1] && b[0] < a[1];

/** 帯の中で上・中・下に寄せる（layout.ts の alignIn と同じ規則） */
function valignIn(top: number, h: number, size: number, a: CaptionAlign): number {
  const slack = Math.max(0, h - size);
  return a === 'start' ? top : a === 'end' ? top + slack : top + slack / 2;
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
