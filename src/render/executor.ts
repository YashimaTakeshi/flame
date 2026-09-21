/**
 * 描画命令を実行する。**ctx に触れるのはこの層だけ。**
 *
 * setTransform(k) を1回掛けてから、あとは論理単位のまま描く。
 * 実行関数の中で k を掛け直してはならない（二重になる）。
 * k を見てよいのは、内部の生成物を作り直す必要がある op だけ
 * （グレインと縦書き。型の resolution タグで区別している）。
 */
import { cssColor, type DrawOp } from '../core/scene/ops';
import type { RenderTarget, Scene } from '../core/scene/scene';
import type { Ctx } from './guards';
import { execText } from './ops/text';
import {
  execBlendPush,
  execClipPush,
  execFillPath,
  execFillRect,
  execLinearGradient,
  execPhoto,
  execRadialGradient,
  execStrokeRect,
} from './ops/primitives';
import { execGrain } from './ops/grain';
import { execVerticalText } from './ops/vertical-text';
import type { RenderResources } from './resources/types';

export function renderScene(
  scene: Scene,
  ctx: Ctx,
  target: RenderTarget,
  res: RenderResources,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, target.widthPx, target.heightPx);

  // ★プレビューと書き出しの両方に同じならしを通す★
  // 片方だけにすると、グレインや縮小画像の見え方が食い違う（docs/poc/report-grain.md）
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.setTransform(target.k, 0, 0, target.k, 0, 0);
  ctx.fillStyle = cssColor(scene.canvas.background);
  ctx.fillRect(0, 0, scene.canvas.widthLu, scene.canvas.heightLu);

  for (const op of scene.ops) execOp(op, ctx, target, res);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();
}

function execOp(op: DrawOp, ctx: Ctx, t: RenderTarget, r: RenderResources): void {
  switch (op.op) {
    case 'fillRect':
      return execFillRect(op, ctx);
    case 'fillPath':
      return execFillPath(op, ctx);
    case 'strokeRect':
      return execStrokeRect(op, ctx, t);
    case 'linearGradient':
      return execLinearGradient(op, ctx);
    case 'radialGradient':
      return execRadialGradient(op, ctx);
    case 'photo':
      return execPhoto(op, ctx, t, r);
    case 'clipPush':
      return execClipPush(op, ctx);
    case 'clipPop':
      return void ctx.restore();
    case 'blendPush':
      return execBlendPush(op, ctx);
    case 'blendPop':
      return void ctx.restore();
    case 'text':
      return execText(op, ctx);
    case 'verticalText':
      return execVerticalText(op, ctx, t, r);
    case 'grain':
      return execGrain(op, ctx, t, r);
    default: {
      // 新しい op を足したときに「k をどう扱うか決めていない」まま通過させない
      const never: never = op;
      throw new Error(`未知の描画命令です: ${JSON.stringify(never)}`);
    }
  }
}
