/**
 * 仕上がり（フィルムシミュレーション／ピクチャーコントロール等）の刻印。
 *
 * 写真の中には置かない。キャプションと同じ帯の中、文字の下に積む。
 * 帯の高さは compose がこの塊の高さを足して決めるので、写真と重なることはない。
 *
 * 2つの見せ方:
 *   text … 地の色に名前。枠あり／なし
 *   logo … 富士フイルムの各フィルムの札に倣った**正方形**の配色の版。名前ごとに配色を持ち、
 *          知らない名前（他社のピクチャーコントロール等）は地色と文字色を反転した札にする
 *
 * 位置（左・中・右）と大きさ（小・中・大）と枠線はキャプションとは独立に選ぶ。
 * 地色と版の色が同じ（黒地に ETERNA、白地に Velvia）ときは枠線を入れると輪郭が出る。
 *
 * ★ロゴの絵（ビットマップ）は同梱しない。配色と文字だけで組む。★
 * 実行層は measureText を呼ばないので、文字の寸法はここで測って確定させる。
 */
import { advanceFor, ascentFor, descentFor, type TextMeasurer } from './ports';
import { rgba, type DrawOp, type FontRef, type Rgba } from './scene/ops';
import type { Align } from './styles/types';
import { hairline, lu, point, px, rect, type RectLu } from './units';

export type BadgeMode = 'none' | 'text' | 'logo';
export type BadgeSize = 'S' | 'M' | 'L';

export interface BadgeSpec {
  readonly text: string;
  readonly mode: 'text' | 'logo';
  /** 帯の中での左右。キャプションの揃えとは別に選ぶ */
  readonly align: Align;
  readonly size: BadgeSize;
  /** 地の色でヘアラインの枠を回す */
  readonly framed: boolean;
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

/** ロゴ版の一辺。基準サイズの倍。Medium(16lu) で 小48 / 中72 / 大96 lu（幅の 5〜10%） */
const LOGO_EM: Readonly<Record<BadgeSize, number>> = { S: 3, M: 4.5, L: 6 };
/** 文字版の文字サイズ。基準サイズの倍 */
const TEXT_EM: Readonly<Record<BadgeSize, number>> = { S: 0.7, M: 0.85, L: 1.05 };
const TEXT_TRACK_EM = 0.1;
const TEXT_PAD_X_EM = 0.6;
const TEXT_PAD_Y_EM = 0.35;
const FRAME_LU = 1.2;

/* ── ロゴの配色 ─────────────────────────────────────────── */

/** 同梱書体のうちロゴに使う顔。fonts-catalog の8ファミリはすべて先読みされている */
const SANS = 'Arimo';
const SERIF = 'Tinos';
const COND = 'Oswald';

const G: Rgba = rgba(0, 166, 81); // 富士フイルムの緑
const K: Rgba = rgba(0, 0, 0);
const W: Rgba = rgba(255, 255, 255);
const DARK: Rgba = rgba(30, 30, 30);

interface LRect {
  readonly k: 'rect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly c: Rgba;
}
interface LGrad {
  readonly k: 'grad';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly stops: readonly (readonly [number, Rgba])[];
}
interface LText {
  readonly k: 'text';
  readonly t: string;
  /** 文字を収める箱。箱の中で上下中央、align で左右 */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly c: Rgba;
  readonly face: string;
  readonly weight: 400 | 700;
  readonly align: Align;
}
type LPart = LRect | LGrad | LText;

/** 設計単位で描いた版。**すべて 100 × 100 の正方形** */
interface LogoDesign {
  readonly parts: readonly LPart[];
}
const DESIGN = 100;

const R = (x: number, y: number, w: number, h: number, c: Rgba): LRect => ({ k: 'rect', x, y, w, h, c });
const T = (
  t: string,
  x: number,
  y: number,
  w: number,
  h: number,
  c: Rgba,
  face: string = SANS,
  weight: 400 | 700 = 700,
  align: Align = 'center',
): LText => ({ k: 'text', t, x, y, w, h, c, face, weight, align });

/** 上に付く緑の札。多くの版では左上に */
const TAB: LRect = R(0, 0, 55, 26, G);

const LOGOS: Readonly<Record<string, LogoDesign>> = {
  PROVIA: {
    parts: [R(35, 0, 65, 28, G), R(0, 28, 100, 52, rgba(29, 79, 158)), T('PROVIA', 4, 32, 92, 44, W, SERIF), R(0, 80, 100, 20, K)],
  },
  Velvia: {
    parts: [R(0, 0, 60, 28, G), R(0, 28, 100, 50, W), R(0, 28, 10, 50, G), T('Velvia', 14, 32, 82, 42, K, SERIF), R(0, 78, 100, 22, G)],
  },
  ASTIA: {
    parts: [TAB, R(0, 26, 100, 74, rgba(176, 150, 105)), T('ASTIA', 6, 40, 88, 40, rgba(25, 35, 60)), R(0, 90, 40, 10, rgba(25, 35, 60))],
  },
  'CLASSIC CHROME': {
    parts: [
      R(0, 0, 100, 100, rgba(120, 80, 40)),
      R(10, 0, 10, 100, rgba(220, 120, 40)),
      R(14, 0, 2, 100, rgba(200, 30, 30)),
      R(80, 0, 10, 100, rgba(220, 120, 40)),
      R(84, 0, 2, 100, rgba(200, 30, 30)),
      T('FUJI', 24, 22, 52, 24, W, COND),
      T('CLASSIC CHROME', 22, 52, 56, 20, W, COND),
    ],
  },
  'REALA ACE': {
    parts: [TAB, R(0, 26, 100, 62, rgba(25, 40, 70)), T('REALA', 6, 30, 88, 30, W), T('ACE', 6, 60, 88, 26, W, SANS, 700, 'right'), R(0, 88, 100, 12, rgba(200, 25, 45))],
  },
  'PRO Neg. Hi': {
    parts: [
      TAB,
      R(0, 26, 100, 62, rgba(60, 60, 60)),
      R(0, 26, 5, 62, rgba(120, 60, 160)),
      T('PRO', 10, 30, 46, 30, W, SERIF, 700, 'left'),
      T('Neg.', 10, 60, 46, 22, W, SERIF, 700, 'left'),
      T('Hi', 58, 30, 38, 52, W, SERIF, 400, 'right'),
      R(0, 88, 100, 12, rgba(120, 60, 160)),
    ],
  },
  'PRO Neg. Std': {
    parts: [
      TAB,
      R(0, 26, 100, 62, rgba(200, 196, 190)),
      R(0, 26, 5, 62, rgba(190, 30, 120)),
      T('PRO', 10, 30, 46, 30, DARK, SERIF, 700, 'left'),
      T('Neg.', 10, 60, 46, 22, DARK, SERIF, 700, 'left'),
      T('Std', 58, 30, 38, 52, DARK, SERIF, 400, 'right'),
      R(0, 88, 100, 12, rgba(190, 30, 120)),
    ],
  },
  'CLASSIC Neg.': {
    parts: [
      R(0, 0, 100, 100, rgba(240, 195, 50)),
      T('CLASSIC', 6, 14, 88, 36, rgba(200, 20, 45)),
      T('Neg.', 6, 50, 88, 22, rgba(200, 20, 45), SANS, 700, 'right'),
      {
        k: 'grad',
        x: 0,
        y: 84,
        w: 62,
        h: 10,
        stops: [
          [0, rgba(40, 90, 180)],
          [0.5, rgba(250, 200, 60)],
          [1, rgba(220, 60, 120)],
        ],
      },
    ],
  },
  'NOSTALGIC Neg.': {
    parts: [
      TAB,
      R(0, 26, 100, 58, W),
      R(0, 26, 4, 58, rgba(220, 60, 40)),
      T('NOSTALGIC', 8, 30, 88, 30, K),
      T('Neg.', 8, 60, 88, 22, K, SANS, 700, 'right'),
      R(0, 84, 100, 9, rgba(240, 150, 40)),
      R(0, 93, 100, 7, rgba(245, 215, 60)),
    ],
  },
  ETERNA: {
    parts: [TAB, R(0, 26, 100, 74, K), T('ETERNA', 6, 40, 88, 44, rgba(200, 165, 80), SERIF)],
  },
  'ETERNA BLEACH BYPASS': {
    parts: [
      TAB,
      R(0, 26, 100, 30, K),
      T('ETERNA', 6, 28, 88, 26, W, SERIF),
      R(0, 56, 100, 44, rgba(185, 200, 210)),
      T('BLEACH', 6, 58, 88, 20, DARK),
      T('BYPASS', 6, 78, 88, 20, DARK),
    ],
  },
  'BLEACH BYPASS': {
    parts: [TAB, R(0, 26, 100, 62, rgba(185, 200, 210)), T('BLEACH', 6, 30, 88, 28, DARK), T('BYPASS', 6, 58, 88, 28, DARK), R(0, 88, 100, 12, K)],
  },
  ACROS: {
    parts: [TAB, R(0, 26, 100, 26, rgba(120, 120, 120)), R(0, 52, 100, 48, rgba(45, 45, 45)), T('ACROS', 6, 56, 88, 40, W, SERIF)],
  },
  MONOCHROME: {
    parts: [TAB, R(0, 26, 100, 62, W), T('MONO', 6, 30, 88, 28, K), T('CHROME', 6, 58, 88, 28, K), R(0, 88, 100, 12, K)],
  },
  SEPIA: {
    parts: [TAB, R(0, 26, 100, 62, rgba(200, 165, 120)), T('SEPIA', 6, 34, 88, 46, rgba(70, 45, 25), SERIF), R(0, 88, 100, 12, rgba(70, 45, 25))],
  },
};

/** 配色を持っている名前。テストで fuji.ts の読み取り結果と突き合わせる */
export const LOGO_NAMES: readonly string[] = Object.keys(LOGOS);

/** 「ACROS +R」→「ACROS」。フィルターの記号は版には載せない */
const baseName = (name: string): string => name.replace(/\s\+\w+$/, '').trim();

/** 知らない名前の版。地色と文字色を反転した札。他社の名前もこれで置ける */
function genericLogo(text: string, ink: Rgba, background: Rgba): LogoDesign {
  return { parts: [R(0, 0, 100, 100, ink), T(text, 6, 8, 88, 84, background)] };
}

export function logoFor(name: string, ink: Rgba, background: Rgba): LogoDesign {
  return LOGOS[baseName(name)] ?? genericLogo(name, ink, background);
}

/* ── 組み立て ───────────────────────────────────────────── */

const chars = (s: string): number => [...s].length;

/**
 * 箱に収まる文字サイズ。高さの 0.9、幅の 0.92 を越えない。
 * 幅は書体の実測から決めるので、設計時に想定した書体と違っても溢れない。
 */
function fitText(
  p: LText,
  scale: number,
  measurer: TextMeasurer,
): { size: number; width: number; ascent: number; descent: number; font: FontRef } {
  const font: FontRef = { family: p.face, weight: p.weight };
  const m = measurer.measure(p.t, font);
  const boxW = p.w * scale;
  const boxH = p.h * scale;
  const perEmH = (m.ascentAtRef + m.descentAtRef) / 100;
  const perEmW = m.advanceAtRef / 100;
  const size = Math.min((boxH * 0.9) / perEmH, (boxW * 0.92) / Math.max(perEmW, 0.01));
  return {
    size,
    width: advanceFor(m, size, 0, chars(p.t)),
    ascent: ascentFor(m, size),
    descent: descentFor(m, size),
    font,
  };
}

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

/** 塊の外周にヘアラインの枠。地色と版の色が同じときの輪郭 */
const frameOp = (x: number, y: number, w: number, h: number, color: Rgba): DrawOp => ({
  op: 'strokeRect',
  resolution: 'invariant',
  rect: rect(x, y, w, h),
  color,
  width: hairline(lu(FRAME_LU), px(1)),
  snap: 'device-pixel-when-preview',
});

function buildLogo(spec: BadgeSpec, ctx: BadgeContext, measurer: TextMeasurer): BadgeBlock | null {
  const design = logoFor(spec.text, ctx.ink, ctx.background);
  const side = Math.min(ctx.baseSize * LOGO_EM[spec.size], ctx.maxW);
  const scale = side / DESIGN;
  if (!(scale > 0)) return null;
  const w = side;
  const h = side;
  return {
    w,
    h,
    emit(x, y) {
      const ops: DrawOp[] = [];
      let n = 0;
      for (const p of design.parts) {
        if (p.k === 'rect') {
          ops.push({
            op: 'fillRect',
            resolution: 'invariant',
            rect: rect(x + p.x * scale, y + p.y * scale, p.w * scale, p.h * scale),
            color: p.c,
          });
        } else if (p.k === 'grad') {
          const r = rect(x + p.x * scale, y + p.y * scale, p.w * scale, p.h * scale);
          ops.push({
            op: 'linearGradient',
            resolution: 'invariant',
            rect: r,
            from: point(r.x, r.y),
            to: point((r.x as number) + (r.w as number), r.y),
            stops: p.stops.map(([at, color]) => ({ at, color })),
          });
        } else {
          const f = fitText(p, scale, measurer);
          const boxX = x + p.x * scale;
          const boxW = p.w * scale;
          const left =
            p.align === 'left' ? boxX : p.align === 'right' ? boxX + boxW - f.width : boxX + (boxW - f.width) / 2;
          const boxY = y + p.y * scale;
          const boxH = p.h * scale;
          const baseline = boxY + (boxH - (f.ascent + f.descent)) / 2 + f.ascent;
          ops.push(textOp(`badge-${n++}`, p.t, f.font, f.size, 0, f.width, f.ascent, f.descent, left, baseline, p.c));
        }
      }
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
  return spec.mode === 'logo' ? buildLogo(spec, ctx, measurer) : buildText(spec, ctx, measurer);
}

/** 免責領域。縁のアンチエイリアスぶん少し広く */
export const badgeBounds = (x: number, y: number, b: BadgeBlock): RectLu => rect(x - 2, y - 2, b.w + 4, b.h + 4);
