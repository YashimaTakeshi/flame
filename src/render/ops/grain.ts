/**
 * グレインの実行。
 *
 * 要点は1つだけ。**タイルは書き出しの倍率で作り、プレビューでは縮小して敷く。**
 * ここを t.k で作ると、実測 0.114 の素朴実装に戻る（docs/poc/report-grain.md）。
 */
import type { GrainOp } from '../../core/scene/ops';
import type { RenderTarget } from '../../core/scene/scene';
import type { Ctx } from '../guards';
import type { RenderResources } from '../resources/types';

export function execGrain(
  op: GrainOp,
  ctx: Ctx,
  t: RenderTarget,
  r: RenderResources,
): void {
  const pattern = r.grainTile(op, t);
  if (!pattern) return; // タイルを確保できなかった。粒なしで続ける

  // プレビューでは書き出し用のタイルを縮小して敷く。
  // 縮小のならしを通すことで、書き出しを縮小して見たときと同じ粒になる
  const scale = t.k / t.kExport;
  pattern.setTransform(new DOMMatrix().scale(scale, scale));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // デバイス空間で敷く
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalCompositeOperation = op.blend;
  ctx.fillStyle = pattern;
  ctx.fillRect(op.rect.x * t.k, op.rect.y * t.k, op.rect.w * t.k, op.rect.h * t.k);
  ctx.restore();
}
