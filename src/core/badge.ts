/**
 * 仕上がり（フィルムシミュレーション／ピクチャーコントロール等）の刻印。
 *
 * 写真の中には置かない。キャプションと同じ帯の中、文字の下に積む。
 * 帯の高さは compose がこの塊の高さを足して決めるので、写真と重なることはない。
 *
 * 2つの見せ方:
 *   text … 地の色に細い枠と名前。どの書体・地色でも馴染む
 *   logo … 富士フイルムの各フィルムの札に倣った配色の版。名前ごとに配色を持ち、
 *          知らない名前（他社のピクチャーコントロール等）は地色と文字色を反転した札にする
 *
 * ★ロゴの絵（ビットマップ）は同梱しない。配色と文字だけで組む。★
 * 実行層は measureText を呼ばないので、文字の寸法はここで測って確定させる。
 */
import { advanceFor, ascentFor, descentFor, type TextMeasurer } from './ports';
import { rgba, type DrawOp, type FontRef, type Rgba } from './scene/ops';
import { hairline, lu, point, px, rect, type RectLu } from './units';

export type BadgeMode = 'none' | 'text' | 'logo';

export interface BadgeSpec {
  readonly text: string;
  readonly mode: 'text' | 'logo';
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

/** ロゴ版の高さ。基準サイズの倍。Medium(16lu) で 72lu（幅の約 12%）。参考アプリの札とほぼ同じ大きさ */
const LOGO_HEIGHT_EM = 4.5;
/** 文字版の文字サイズ。キャプションより一段小さい */
const TEXT_SIZE_EM = 0.85;
const TEXT_TRACK_EM = 0.1;
const TEXT_PAD_X_EM = 0.6;
const TEXT_PAD_Y_EM = 0.35;
const TEXT_FRAME_LU = 1.2;

/* ── ロゴの配色 ─────────────────────────────────────────── */

/** 同梱書体のうちロゴに使う顔。fonts-catalog の8ファミリはすべて先読みされている */
const SANS = 'Arimo';
const SERIF = 'Tinos';
const COND = 'Oswald';

const G: Rgba = rgba(0, 166, 81); // 富士フイルムの緑
const K: Rgba = rgba(0, 0, 0);
const W: Rgba = rgba(255, 255, 255);

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
  readonly align: 'left' | 'center' | 'right';
}
type LPart = LRect | LGrad | LText;

/** 設計単位で描いた版。幅 100 を基準に、高さは版ごと */
interface LogoDesign {
  readonly w: number;
  readonly h: number;
  readonly parts: readonly LPart[];
}

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
  align: 'left' | 'center' | 'right' = 'center',
): LText => ({ k: 'text', t, x, y, w, h, c, face, weight, align });

/** 上に付く緑の札。多くの版に共通 */
const TAB: LRect = R(8, 0, 48, 16, G);

const LOGOS: Readonly<Record<string, LogoDesign>> = {
  PROVIA: {
    w: 100,
    h: 80,
    parts: [TAB, R(0, 16, 100, 48, rgba(29, 79, 158)), T('PROVIA', 6, 20, 88, 40, W, SERIF), R(0, 64, 100, 16, K)],
  },
  Velvia: {
    w: 100,
    h: 60,
    parts: [TAB, R(8, 16, 92, 36, W), R(0, 16, 8, 36, G), T('Velvia', 12, 18, 84, 32, K, SERIF), R(0, 52, 100, 8, G)],
  },
  ASTIA: {
    w: 100,
    h: 60,
    parts: [TAB, R(0, 16, 100, 36, rgba(176, 150, 105)), T('ASTIA', 6, 18, 88, 32, rgba(30, 30, 30)), R(0, 52, 100, 8, rgba(120, 100, 66))],
  },
  'CLASSIC CHROME': {
    w: 100,
    h: 60,
    parts: [
      R(0, 0, 100, 60, rgba(120, 80, 40)),
      R(12, 0, 8, 60, rgba(220, 120, 40)),
      R(15, 0, 2, 60, rgba(200, 30, 30)),
      R(80, 0, 8, 60, rgba(220, 120, 40)),
      R(83, 0, 2, 60, rgba(200, 30, 30)),
      T('FUJI', 24, 8, 52, 18, W, COND),
      T('CLASSIC CHROME', 24, 30, 52, 20, W, COND),
    ],
  },
  'REALA ACE': {
    w: 100,
    h: 60,
    parts: [TAB, R(0, 16, 100, 36, rgba(25, 40, 70)), T('REALA ACE', 6, 18, 88, 32, W), R(0, 52, 100, 8, rgba(200, 25, 45))],
  },
  'PRO Neg. Hi': {
    w: 100,
    h: 60,
    parts: [
      TAB,
      R(0, 16, 100, 36, rgba(60, 60, 60)),
      T('PRO Neg.', 4, 18, 56, 32, W, SERIF, 700, 'left'),
      T('Hi', 62, 18, 34, 32, W, SERIF, 400, 'right'),
      R(0, 52, 100, 8, rgba(120, 60, 160)),
    ],
  },
  'PRO Neg. Std': {
    w: 100,
    h: 60,
    parts: [
      TAB,
      R(0, 16, 100, 36, rgba(200, 196, 190)),
      T('PRO Neg.', 4, 18, 56, 32, rgba(30, 30, 30), SERIF, 700, 'left'),
      T('Std', 62, 18, 34, 32, rgba(30, 30, 30), SERIF, 400, 'right'),
      R(0, 52, 100, 8, rgba(190, 30, 120)),
    ],
  },
  'CLASSIC Neg.': {
    w: 100,
    h: 60,
    parts: [
      R(0, 0, 100, 52, rgba(240, 195, 50)),
      T('CLASSIC', 6, 4, 88, 28, rgba(200, 20, 45)),
      T('Neg.', 6, 32, 88, 18, rgba(200, 20, 45), SANS, 700, 'right'),
      {
        k: 'grad',
        x: 0,
        y: 52,
        w: 100,
        h: 8,
        stops: [
          [0, rgba(40, 90, 180)],
          [0.5, rgba(250, 200, 60)],
          [1, rgba(220, 60, 120)],
        ],
      },
    ],
  },
  'NOSTALGIC Neg.': {
    w: 100,
    h: 60,
    parts: [TAB, R(0, 16, 100, 36, W), T('NOSTALGIC Neg.', 4, 18, 92, 32, K), R(0, 52, 100, 5, rgba(240, 150, 40)), R(0, 57, 100, 3, rgba(245, 215, 60))],
  },
  ETERNA: {
    w: 100,
    h: 60,
    parts: [TAB, R(0, 16, 100, 44, K), T('ETERNA', 6, 20, 88, 34, rgba(200, 165, 80), SERIF)],
  },
  'ETERNA BLEACH BYPASS': {
    w: 100,
    h: 70,
    parts: [
      TAB,
      R(0, 16, 100, 26, K),
      T('ETERNA', 6, 18, 88, 22, W, SERIF),
      R(0, 42, 100, 28, rgba(185, 200, 210)),
      T('BLEACH BYPASS', 6, 45, 88, 22, rgba(30, 30, 30)),
    ],
  },
  'BLEACH BYPASS': {
    w: 100,
    h: 60,
    parts: [TAB, R(0, 16, 100, 36, rgba(185, 200, 210)), T('BLEACH BYPASS', 6, 18, 88, 32, rgba(30, 30, 30)), R(0, 52, 100, 8, K)],
  },
  ACROS: {
    w: 100,
    h: 60,
    parts: [TAB, R(0, 16, 100, 36, rgba(55, 55, 55)), T('ACROS', 6, 18, 88, 32, W, SERIF), R(0, 52, 100, 8, rgba(90, 90, 90))],
  },
  MONOCHROME: {
    w: 100,
    h: 60,
    parts: [TAB, R(0, 16, 100, 36, W), T('MONOCHROME', 4, 18, 92, 32, K), R(0, 52, 100, 8, K)],
  },
  SEPIA: {
    w: 100,
    h: 60,
    parts: [TAB, R(0, 16, 100, 36, rgba(200, 165, 120)), T('SEPIA', 6, 18, 88, 32, rgba(70, 45, 25), SERIF), R(0, 52, 100, 8, rgba(70, 45, 25))],
  },
};

/** 配色を持っている名前。テストで fuji.ts の読み取り結果と突き合わせる */
export const LOGO_NAMES: readonly string[] = Object.keys(LOGOS);

/** 「ACROS +R」→「ACROS」。フィルターの記号は版には載せない */
const baseName = (name: string): string => name.replace(/\s\+\w+$/, '').trim();

/** 知らない名前の版。地色と文字色を反転した札。他社の名前もこれで置ける */
function genericLogo(text: string, ink: Rgba, background: Rgba): LogoDesign {
  return {
    w: 100,
    h: 60,
    parts: [R(0, 0, 100, 60, ink), T(text, 6, 6, 88, 48, background)],
  };
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

function buildLogo(spec: BadgeSpec, ctx: BadgeContext, measurer: TextMeasurer): BadgeBlock | null {
  const design = logoFor(spec.text, ctx.ink, ctx.background);
  const targetH = ctx.baseSize * LOGO_HEIGHT_EM;
  const scale = Math.min(targetH / design.h, ctx.maxW / design.w);
  if (!(scale > 0)) return null;
  const w = design.w * scale;
  const h = design.h * scale;
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
      return ops;
    },
  };
}

function buildText(spec: BadgeSpec, ctx: BadgeContext, measurer: TextMeasurer): BadgeBlock | null {
  const size = ctx.baseSize * TEXT_SIZE_EM;
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
      return [
        {
          op: 'strokeRect',
          resolution: 'invariant',
          rect: rect(x, y, w, h),
          color: ctx.ink,
          width: hairline(lu(TEXT_FRAME_LU), px(1)),
          snap: 'device-pixel-when-preview',
        },
        textOp('badge', spec.text, font, size, track, width, ascent, descent, x + padX, y + padY + ascent, ctx.ink),
      ];
    },
  };
}

export function buildBadge(spec: BadgeSpec, ctx: BadgeContext, measurer: TextMeasurer): BadgeBlock | null {
  if (spec.text.trim() === '' || !(ctx.maxW > 0)) return null;
  return spec.mode === 'logo' ? buildLogo(spec, ctx, measurer) : buildText(spec, ctx, measurer);
}

/** 免責領域。縁のアンチエイリアスぶん少し広く */
export const badgeBounds = (x: number, y: number, b: BadgeBlock): RectLu => rect(x - 2, y - 2, b.w + 4, b.h + 4);
