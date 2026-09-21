/**
 * プリミティブの実行。どれもスケール不変で、setTransform(k) だけで正しくなる。
 * 質感（印画紙のフチ・コマ枠）もここまで分解してあるので、自動的に一致する。
 */
import {
  cssColor,
  type BlendPushOp,
  type ClipPushOp,
  type DrawPhotoOp,
  type FillPathOp,
  type FillRectOp,
  type GradientStop,
  type LinearGradientOp,
  type RadialGradientOp,
  type StrokeRectOp,
} from '../../core/scene/ops';
import type { RenderTarget } from '../../core/scene/scene';
import type { Ctx } from '../guards';
import type { RenderResources } from '../resources/types';

export function execFillRect(op: FillRectOp, ctx: Ctx): void {
  ctx.fillStyle = cssColor(op.color);
  ctx.fillRect(op.rect.x, op.rect.y, op.rect.w, op.rect.h);
}

function tracePath(ctx: Ctx, points: readonly { x: number; y: number }[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

export function execFillPath(op: FillPathOp, ctx: Ctx): void {
  if (op.points.length < 3) return;
  ctx.fillStyle = cssColor(op.color);
  tracePath(ctx, op.points);
  ctx.fill(op.evenOdd ? 'evenodd' : 'nonzero');
}

export function execStrokeRect(op: StrokeRectOp, ctx: Ctx, t: RenderTarget): void {
  // ヘアラインは k を掛けると 1px を下回って消える。論理単位に引き戻して下限を効かせる
  const width =
    op.width.mode === 'logical'
      ? op.width.value
      : op.width.mode === 'device'
        ? op.width.value / t.k
        : Math.max(op.width.value, op.width.minPx / t.k);

  // ここから先は論理単位の素の数値として扱う（ブランド型を剥がす）
  let x: number = op.rect.x;
  let y: number = op.rect.y;
  let w: number = op.rect.w;
  let h: number = op.rect.h;
  if (op.snap === 'device-pixel-when-preview' && t.kind === 'preview') {
    // 線の中心を半ピクセルに置くと、1px の線がにじまない
    const half = width / 2;
    const snap = (v: number): number => (Math.round(v * t.k) + 0.5) / t.k;
    x = snap(x + half) - half;
    y = snap(y + half) - half;
    w = Math.round(w * t.k) / t.k;
    h = Math.round(h * t.k) / t.k;
  }

  ctx.strokeStyle = cssColor(op.color);
  ctx.lineWidth = width;
  ctx.strokeRect(x + width / 2, y + width / 2, w - width, h - width);
}

function applyStops(g: CanvasGradient, stops: readonly GradientStop[]): void {
  for (const s of stops) g.addColorStop(s.at, cssColor(s.color));
}

export function execLinearGradient(op: LinearGradientOp, ctx: Ctx): void {
  const g = ctx.createLinearGradient(op.from.x, op.from.y, op.to.x, op.to.y);
  applyStops(g, op.stops);
  ctx.fillStyle = g;
  ctx.fillRect(op.rect.x, op.rect.y, op.rect.w, op.rect.h);
}

export function execRadialGradient(op: RadialGradientOp, ctx: Ctx): void {
  const g = ctx.createRadialGradient(
    op.center.x,
    op.center.y,
    op.innerR,
    op.center.x,
    op.center.y,
    op.outerR,
  );
  applyStops(g, op.stops);
  ctx.fillStyle = g;
  ctx.fillRect(op.rect.x, op.rect.y, op.rect.w, op.rect.h);
}

export function execPhoto(
  op: DrawPhotoOp,
  ctx: Ctx,
  t: RenderTarget,
  r: RenderResources,
): void {
  const img = r.photo(op.photo, t);
  if (!img) return; // 写真がまだ解決できていない。背景だけが描かれる

  // srcNorm は 0..1 の正規化座標。実際の画素数を掛けて切り出し矩形にする。
  // プレビュー（縮小版）でも書き出し（原寸）でも同じ領域を指す
  const sw = 'width' in img ? Number(img.width) : 0;
  const sh = 'height' in img ? Number(img.height) : 0;
  if (!sw || !sh) return;

  ctx.drawImage(
    img,
    op.srcNorm.x * sw,
    op.srcNorm.y * sh,
    op.srcNorm.w * sw,
    op.srcNorm.h * sh,
    op.dst.x,
    op.dst.y,
    op.dst.w,
    op.dst.h,
  );
}

export function execClipPush(op: ClipPushOp, ctx: Ctx): void {
  ctx.save();
  ctx.beginPath();
  if (op.shape.kind === 'rect') {
    const { rect, radius } = op.shape;
    if (radius && radius > 0) ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
    else ctx.rect(rect.x, rect.y, rect.w, rect.h);
  } else {
    tracePath(ctx, op.shape.points);
  }
  ctx.clip();
}

export function execBlendPush(op: BlendPushOp, ctx: Ctx): void {
  ctx.save();
  ctx.globalCompositeOperation = op.mode;
  ctx.globalAlpha = op.alpha;
}
