/**
 * 縦書きの実行。段階15 で中身を入れる。
 *
 * 実装するときの要点（docs/poc/report-svg-font.md で実測済み）:
 *   **SVG 内にフォントを data: URI で埋め込まないと、親文書の FontFace は届かない。**
 *   フォールバックで描いた場合と 1 画素も違わない結果になり、横組みは正しい書体・
 *   縦組みだけ別書体という壊れ方をする。例外も警告も出ない。
 */
import type { VerticalTextOp } from '../../core/scene/ops';
import type { RenderTarget } from '../../core/scene/scene';
import type { Ctx } from '../guards';
import type { RenderResources } from '../resources/types';

export function execVerticalText(
  op: VerticalTextOp,
  ctx: Ctx,
  t: RenderTarget,
  r: RenderResources,
): void {
  const img = r.verticalText(op, t);
  if (!img) return; // まだ用意できていない。縦組みは描かれない
  ctx.drawImage(img, op.box.x, op.box.y, op.box.w, op.box.h);
}
