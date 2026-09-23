/**
 * 仕上がり（フィルムシミュレーション／ピクチャーコントロール等）の刻印。
 *
 * 写真の中には置かない。帯の中に置く。
 * 帯の大きさは compose がこの塊のぶんを足して決めるので、写真と重なることはない。
 *
 * 2つの見せ方:
 *   text … 地の色に名前。枠あり／なし
 *   logo … **同梱した札の画像**。フィルムの箱そのものの絵。
 *          札を持たない名前（他社の「ビビッド」など）は、地色と文字色を反転した札に落とす。
 *
 * ★札の絵は core が持たない。★ core は画像の実体を知らず、識別子と縦横比だけを受け取る。
 * 解決するのは実行層（app/film-logos.ts）。写真と同じ扱いである。
 *
 * 位置（辺・左右・上下）と大きさ（小・中・大）と枠線はキャプションとは独立に選ぶ。
 * 地色と札の色が同じ（黒地に ETERNA、白地に Velvia）ときは枠線を入れると輪郭が出る。
 */
import { advanceFor, ascentFor, descentFor, type TextMeasurer } from './ports';
import { photoId, type DrawOp, type FontRef, type PhotoId, type Rgba } from './scene/ops';
import type { BandSide } from './styles/layout';
import type { Align, CaptionAlign } from './styles/types';
import { hairline, lu, point, px, rect, type RectLu } from './units';

export type BadgeMode = 'none' | 'text' | 'logo';
/** 刻印の大きさ。小さい2段（XXS・XS）は依頼者の要望で足した（写真の脇に控えめに置きたい） */
export type BadgeSize = 'XXS' | 'XS' | 'S' | 'M' | 'L';

/** 同梱した札。実体は実行層が持つ。core は名札と形だけを知る */
export interface BadgeImage {
  readonly id: string;
  /** 幅 / 高さ */
  readonly aspect: number;
}

export interface BadgeSpec {
  readonly text: string;
  readonly mode: 'text' | 'logo';
  /** どの辺の帯に置くか。キャプションと同じ辺なら同じ帯を分け合う */
  readonly place: BandSide;
  /** 帯の中での左右 */
  readonly align: Align;
  /** 帯の中での上下 */
  readonly valign: CaptionAlign;
  readonly size: BadgeSize;
  /** 地の色でヘアラインの枠を回す */
  readonly framed: boolean;
  /** その名前の札。無ければ文字の札に落とす */
  readonly image?: BadgeImage | null;
}

export interface BadgeContext {
  /** キャプションの基準サイズ（lu）。刻印の大きさはこれに比例する */
  readonly baseSize: number;
  /** 置ける最大の幅（lu）。段の幅を越えない */
  readonly maxW: number;
  readonly ink: Rgba;
  readonly background: Rgba;
  /** text のときの書体。キャプションと揃える */
  readonly family: string;
  readonly weight: 400 | 700;
}

/** 組み上がった刻印。置く位置は後から決める */
export interface BadgeBlock {
  readonly w: number;
  readonly h: number;
  /** 左上を (x, y) に置いたときの描画命令 */
  emit(x: number, y: number): DrawOp[];
}

/* ── 寸法 ───────────────────────────────────────────────── */

/** 札の高さ。基準サイズの倍。Medium(16lu) で 極小32 / より小48 / 小64 / 中96 / 大128 lu */
const LOGO_EM: Readonly<Record<BadgeSize, number>> = { XXS: 2, XS: 3, S: 4, M: 6, L: 8 };
/** 文字の札の文字サイズ。基準サイズの倍 */
const TEXT_EM: Readonly<Record<BadgeSize, number>> = { XXS: 0.5, XS: 0.6, S: 0.7, M: 0.85, L: 1.05 };
const TEXT_TRACK_EM = 0.1;
const TEXT_PAD_X_EM = 0.6;
const TEXT_PAD_Y_EM = 0.35;
const FRAME_LU = 1.2;

/** 札を持たない名前のときの、文字を入れる面。地色と文字色を反転する */
const PLATE_PAD_EM = 0.5;

/* ── 組み立て ───────────────────────────────────────────── */

const chars = (s: string): number => [...s].length;

function textOp(
  id: string,
  text: string,
  font: FontRef,
  size: number,
  track: number,
  width: number,
  ascent: number,
  descent: number,
  left: number,
  baseline: number,
  color: Rgba,
): DrawOp {
  return {
    op: 'text',
    resolution: 'invariant',
    id,
    text,
    font,
    sizeLu: lu(size),
    letterSpacingLu: lu(track),
    color,
    anchor: point(left, baseline),
    align: 'left',
    measuredWidthLu: lu(width),
    boundsLu: rect(left - 2, baseline - ascent - 2, width + 4, ascent + descent + 4),
  };
}

/** 塊の外周にヘアラインの枠。地色と札の色が同じときの輪郭 */
const frameOp = (x: number, y: number, w: number, h: number, color: Rgba): DrawOp => ({
  op: 'strokeRect',
  resolution: 'invariant',
  rect: rect(x, y, w, h),
  color,
  width: hairline(lu(FRAME_LU), px(1)),
  snap: 'device-pixel-when-preview',
});

/**
 * 同梱した札を置く。
 * 高さは大きさの指定で決まり、幅は札の比に従う。段に入らなければ幅で止める。
 */
function buildImageBadge(spec: BadgeSpec, image: BadgeImage, ctx: BadgeContext): BadgeBlock | null {
  const aspect = image.aspect > 0 && Number.isFinite(image.aspect) ? image.aspect : 1;
  let h = ctx.baseSize * LOGO_EM[spec.size];
  let w = h * aspect;
  if (w > ctx.maxW) {
    w = ctx.maxW;
    h = w / aspect;
  }
  if (!(w > 0 && h > 0)) return null;
  return {
    w,
    h,
    emit(x, y) {
      const ops: DrawOp[] = [
        {
          op: 'photo',
          resolution: 'invariant',
          photo: photoId(image.id) as PhotoId,
          srcNorm: { x: 0, y: 0, w: 1, h: 1 },
          dst: rect(x, y, w, h),
        },
      ];
      if (spec.framed) ops.push(frameOp(x, y, w, h, ctx.ink));
      return ops;
    },
  };
}

/**
 * 札を持たない名前の版。地色と文字色を反転した面に名前を入れる。
 *
 * 以前はここで富士の札を矩形と文字で描き起こしていたが、実機で「全然違う」と言われた。
 * 似せきれない絵を置くより、**名前だけの札**のほうが正直で、他社の名前にも同じ形で使える。
 */
function buildPlate(spec: BadgeSpec, ctx: BadgeContext, measurer: TextMeasurer): BadgeBlock | null {
  const size = ctx.baseSize * TEXT_EM[spec.size];
  const font: FontRef = { family: ctx.family, weight: 700 };
  const m = measurer.measure(spec.text, font);
  const track = size * TEXT_TRACK_EM;
  const width = advanceFor(m, size, track, chars(spec.text));
  const ascent = ascentFor(m, size);
  const descent = descentFor(m, size);
  const pad = size * PLATE_PAD_EM;
  const w = width + pad * 2;
  const h = ascent + descent + pad * 2;
  if (w > ctx.maxW) return null;
  return {
    w,
    h,
    emit(x, y) {
      const ops: DrawOp[] = [
        { op: 'fillRect', resolution: 'invariant', rect: rect(x, y, w, h), color: ctx.ink },
        textOp('badge', spec.text, font, size, track, width, ascent, descent, x + pad, y + pad + ascent, ctx.background),
      ];
      if (spec.framed) ops.push(frameOp(x, y, w, h, ctx.ink));
      return ops;
    },
  };
}

function buildText(spec: BadgeSpec, ctx: BadgeContext, measurer: TextMeasurer): BadgeBlock | null {
  const size = ctx.baseSize * TEXT_EM[spec.size];
  const font: FontRef = { family: ctx.family, weight: ctx.weight };
  const m = measurer.measure(spec.text, font);
  const track = size * TEXT_TRACK_EM;
  const width = advanceFor(m, size, track, chars(spec.text));
  const ascent = ascentFor(m, size);
  const descent = descentFor(m, size);
  const padX = size * TEXT_PAD_X_EM;
  const padY = size * TEXT_PAD_Y_EM;
  const w = width + padX * 2;
  const h = ascent + descent + padY * 2;
  if (w > ctx.maxW) return null; // 段より広い名前は刻まない（縮めると読めない）
  return {
    w,
    h,
    emit(x, y) {
      const ops: DrawOp[] = [
        textOp('badge', spec.text, font, size, track, width, ascent, descent, x + padX, y + padY + ascent, ctx.ink),
      ];
      if (spec.framed) ops.push(frameOp(x, y, w, h, ctx.ink));
      return ops;
    },
  };
}

export function buildBadge(spec: BadgeSpec, ctx: BadgeContext, measurer: TextMeasurer): BadgeBlock | null {
  if (spec.text.trim() === '' || !(ctx.maxW > 0)) return null;
  if (spec.mode === 'text') return buildText(spec, ctx, measurer);
  return spec.image ? buildImageBadge(spec, spec.image, ctx) : buildPlate(spec, ctx, measurer);
}

/** 免責領域。縁のアンチエイリアスぶん少し広く */
export const badgeBounds = (x: number, y: number, b: BadgeBlock): RectLu => rect(x - 2, y - 2, b.w + 4, b.h + 4);
