import type { GrainOp, PhotoId, VerticalTextOp } from '../../core/scene/ops';
import type { RenderTarget } from '../../core/scene/scene';

/**
 * 実行層が外から受け取るもの。
 * 写真の実体・グレインのタイル・縦組みのラスタは core が知らないので、ここで解決する。
 */
export interface RenderResources {
  readonly photo: (id: PhotoId, target: RenderTarget) => CanvasImageSource | null;
  readonly grainTile: (op: GrainOp, target: RenderTarget) => CanvasPattern | null;
  readonly verticalText: (op: VerticalTextOp, target: RenderTarget) => CanvasImageSource | null;
}
