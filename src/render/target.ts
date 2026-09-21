/**
 * 解像度の決め方。
 *
 * プレビューは画面に見える大きさで足りる。設定を変えるたびに 6000px を描き直すと、
 * 1枚で約100MB を掴み、実機では落ちる（docs/poc/report-geo-batch.md）。
 */
import type { RenderTarget, Scene } from '../core/scene/scene';

/** プレビューの上限。9:16 で 1400x2489 ＝ 350万px。書き出し 4500万px の 1/13 */
export const PREVIEW_MAX_PX = 1400;

/** 端末の画素密度の上限。3 のまま使うとメモリが跳ねる */
export const DPR_CAP = 2;

/** 書き出しの既定。長辺 4096px。設定で「元の解像度のまま」も選べる */
export const DEFAULT_EXPORT_LONG_EDGE = 4096;

/** 上限に当たったときの落とし先。段ごとに理由を告げる */
export const EXPORT_FALLBACK_STEPS = [4096, 2560, 1600] as const;

function sizeFor(scene: Scene, longEdgePx: number): { widthPx: number; heightPx: number } {
  const aspect = scene.canvas.heightLu / scene.canvas.widthLu;
  return aspect >= 1
    ? { widthPx: Math.round(longEdgePx / aspect), heightPx: Math.round(longEdgePx) }
    : { widthPx: Math.round(longEdgePx), heightPx: Math.round(longEdgePx * aspect) };
}

export function makeTarget(
  scene: Scene,
  longEdgePx: number,
  kind: RenderTarget['kind'],
  kExport: number,
  dpr = 1,
): RenderTarget {
  const { widthPx, heightPx } = sizeFor(scene, longEdgePx);
  return { widthPx, heightPx, k: widthPx / scene.canvas.widthLu, kExport, kind, dpr };
}

/** 書き出しの倍率。プレビューもこの値を知っている必要がある（グレインのタイル寸法に使う） */
export function exportScaleFor(scene: Scene, longEdgePx: number): number {
  return sizeFor(scene, longEdgePx).widthPx / scene.canvas.widthLu;
}

export function makeExportTarget(scene: Scene, longEdgePx: number): RenderTarget {
  const k = exportScaleFor(scene, longEdgePx);
  return makeTarget(scene, longEdgePx, 'export', k, 1);
}

/**
 * プレビュー。実効は min(cssWidth × min(dpr,2), 1400)。
 * kExport は「いまの書き出し設定で書き出したときの倍率」を渡す。
 */
export function makePreviewTarget(
  scene: Scene,
  cssWidth: number,
  dpr: number,
  exportLongEdge: number,
): RenderTarget {
  const widthPx = Math.min(Math.round(cssWidth * Math.min(dpr, DPR_CAP)), PREVIEW_MAX_PX);
  const aspect = scene.canvas.heightLu / scene.canvas.widthLu;
  const longEdge = aspect >= 1 ? widthPx * aspect : widthPx;
  return makeTarget(scene, longEdge, 'preview', exportScaleFor(scene, exportLongEdge), dpr);
}
