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
import type { BandSide } from './styles/layout';
import type { Align, CaptionAlign } from './styles/types';
import { hairline, lu, point, px, rect, type RectLu } from './units';

export type BadgeMode = 'none' | 'text' | 'logo';
export type BadgeSize = 'S' | 'M' | 'L';

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

/** ロゴ版の一辺。基準サイズの倍。Medium(16lu) で 小64 / 中96 / 大128 lu（幅の 6〜13%） */
const LOGO_EM: Readonly<Record<BadgeSize, number>> = { S: 4, M: 6, L: 8 };
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

/**
 * 上に付く緑の札。多くの版では左上、PROVIA だけ右上。
 *
 * 各版は参考の札（富士フイルムの製品ページに並ぶもの）を見ながら、
 * 「札の位置・面の色・文字の顔・下の帯・縁の線」を数値で写している。
 * 色は目視の近似。書体は同梱の Tinos（セリフ）/ Arimo（サンセリフ）/ Oswald（縦長）で代える。
 */
const TAB: LRect = R(0, 0, 58, 30, G);

const LOGOS: Readonly<Record<string, LogoDesign>> = {
  // 右上に大きな緑、青い面に白いセリフの PROVIA、下に黒
  PROVIA: {
    parts: [R(30, 0, 70, 30, G), R(0, 30, 100, 44, rgba(29, 79, 158)), T('PROVIA', 3, 33, 94, 38, W, SERIF), R(0, 74, 100, 26, K)],
  },
  // 白い面、左に緑の縦線、黒いセリフの Velvia、下に緑
  Velvia: {
    parts: [R(0, 0, 62, 30, G), R(0, 30, 100, 48, W), R(0, 30, 10, 48, G), T('Velvia', 13, 33, 84, 42, K, SERIF), R(0, 78, 100, 22, G)],
  },
  // カーキの面に黒いサンセリフ、下に紺
  ASTIA: {
    parts: [TAB, R(0, 30, 100, 58, rgba(168, 142, 96)), T('ASTIA', 4, 36, 92, 44, rgba(20, 20, 20)), R(0, 88, 100, 12, rgba(30, 40, 70))],
  },
  // 焦げ茶の面に橙と赤の縦縞、FUJI と CLASSIC CHROME を縦長の白で
  'CLASSIC CHROME': {
    parts: [
      R(0, 0, 100, 100, rgba(88, 60, 30)),
      R(12, 0, 10, 100, rgba(214, 120, 40)),
      R(15, 0, 3, 100, rgba(178, 48, 36)),
      R(78, 0, 10, 100, rgba(214, 120, 40)),
      R(81, 0, 3, 100, rgba(178, 48, 36)),
      T('FUJI', 26, 20, 48, 26, W, COND),
      T('CLASSIC CHROME', 24, 50, 52, 18, W, COND),
    ],
  },
  'REALA ACE': {
    parts: [TAB, R(0, 30, 100, 52, rgba(25, 40, 70)), T('REALA', 5, 33, 90, 26, W), T('ACE', 5, 59, 90, 22, W, SANS, 700, 'right'), R(0, 82, 100, 18, rgba(200, 25, 45))],
  },
  // 濃灰の面、左に紫の線、PRO / Neg. を白いセリフで、Hi を大きく、下に紫
  'PRO Neg. Hi': {
    parts: [
      TAB,
      R(0, 30, 100, 52, rgba(62, 62, 62)),
      R(0, 30, 4, 52, rgba(118, 64, 160)),
      T('PRO', 8, 33, 46, 26, W, SERIF, 700, 'left'),
      T('Neg.', 8, 60, 46, 20, W, SERIF, 700, 'left'),
      T('Hi', 54, 33, 44, 48, W, SERIF, 400, 'right'),
      R(0, 82, 100, 18, rgba(118, 64, 160)),
    ],
  },
  // 明るい灰の面、左に赤紫の線、黒いセリフ、下に赤紫
  'PRO Neg. Std': {
    parts: [
      TAB,
      R(0, 30, 100, 52, rgba(205, 200, 195)),
      R(0, 30, 4, 52, rgba(190, 30, 120)),
      T('PRO', 8, 33, 46, 26, DARK, SERIF, 700, 'left'),
      T('Neg.', 8, 60, 46, 20, DARK, SERIF, 700, 'left'),
      T('Std', 54, 33, 44, 48, DARK, SERIF, 400, 'right'),
      R(0, 82, 100, 18, rgba(190, 30, 120)),
    ],
  },
  // 黄土色の面に赤いセリフの CLASSIC / Neg.、左下に虹の帯、右下に緑
  'CLASSIC Neg.': {
    parts: [
      R(0, 0, 100, 100, rgba(236, 190, 52)),
      T('CLASSIC', 4, 12, 92, 36, rgba(196, 22, 44), SERIF),
      T('Neg.', 4, 50, 92, 20, rgba(196, 22, 44), SERIF, 700, 'right'),
      {
        k: 'grad',
        x: 0,
        y: 84,
        w: 64,
        h: 10,
        stops: [
          [0, rgba(40, 90, 180)],
          [0.5, rgba(240, 240, 220)],
          [1, rgba(220, 40, 60)],
        ],
      },
      R(70, 82, 30, 18, G),
    ],
  },
  // 白い面に黒い縦長の NOSTALGIC Neg. を1行、左に赤い線、下に赤・橙・黄
  'NOSTALGIC Neg.': {
    parts: [
      TAB,
      R(0, 30, 100, 52, W),
      R(0, 30, 3, 52, rgba(220, 60, 40)),
      T('NOSTALGIC Neg.', 6, 36, 90, 40, K, COND),
      R(0, 82, 100, 3, rgba(200, 40, 40)),
      R(0, 85, 100, 9, rgba(240, 150, 40)),
      R(0, 94, 100, 6, rgba(245, 215, 60)),
    ],
  },
  // 黒い面に金のセリフ
  ETERNA: {
    parts: [TAB, R(0, 30, 100, 70, K), T('ETERNA', 5, 44, 90, 42, rgba(205, 170, 85), SERIF)],
  },
  // 上が黒に白い ETERNA、下が青灰に黒い BLEACH / BYPASS
  'ETERNA BLEACH BYPASS': {
    parts: [
      TAB,
      R(0, 30, 100, 28, K),
      T('ETERNA', 5, 32, 90, 24, W, SERIF),
      R(0, 58, 100, 42, rgba(186, 200, 210)),
      T('BLEACH', 6, 60, 88, 19, DARK),
      T('BYPASS', 6, 79, 88, 19, DARK),
    ],
  },
  'BLEACH BYPASS': {
    parts: [TAB, R(0, 30, 100, 52, rgba(186, 200, 210)), T('BLEACH', 6, 33, 88, 25, DARK), T('BYPASS', 6, 58, 88, 25, DARK), R(0, 82, 100, 18, K)],
  },
  // 上が明るい灰、下が炭色に白いサンセリフ
  ACROS: {
    parts: [TAB, R(0, 30, 100, 22, rgba(150, 150, 150)), R(0, 52, 100, 48, rgba(42, 42, 42)), T('ACROS', 4, 55, 92, 42, W)],
  },
  MONOCHROME: {
    parts: [TAB, R(0, 30, 100, 52, W), T('MONO', 6, 33, 88, 25, K), T('CHROME', 6, 58, 88, 25, K), R(0, 82, 100, 18, K)],
  },
  SEPIA: {
    parts: [TAB, R(0, 30, 100, 52, rgba(200, 165, 120)), T('SEPIA', 5, 36, 90, 44, rgba(70, 45, 25), SERIF), R(0, 82, 100, 18, rgba(70, 45, 25))],
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
 * 箱に収まる文字サイズ。箱の高さ、幅の 0.96 を越えない。
 * 幅は書体の実測から決めるので、設計時に想定した書体と違っても溢れない。
 * 参考の札は文字が面いっぱいに入っている。控えめに取ると別物に見える。
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
  const size = Math.min(boxH / perEmH, (boxW * 0.96) / Math.max(perEmW, 0.01));
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
