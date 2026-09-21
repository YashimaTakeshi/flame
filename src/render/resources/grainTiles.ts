/**
 * グレインのタイル。
 *
 * **タイルは「書き出しの倍率」で1度だけ作り、プレビューでは同じタイルを縮小して敷く。**
 *
 * 実測（docs/poc/report-grain.md）:
 *   素朴に出力ピクセル位置で乱数を索く         → 一致率 0.114
 *   論理セル座標で索く（細かい粒）             → 0.287〜0.594
 *   タイルを書き出し倍率で作り縮小して敷く     → **0.977〜0.986**
 *
 * 一致しない原因は乱数の索き方ではなく、**書き出し側だけが縮小のならしを通っていたこと**
 * だった。プレビュー側にも同じならしを通せば揃う。
 */
import type { GrainOp } from '../../core/scene/ops';
import type { RenderTarget } from '../../core/scene/scene';
import { createVerifiedCanvas, release, type AnyCanvas } from '../guards';

/** 実測で 512 角あれば足りる（1024 にしても一致率は 0.004 しか上がらない） */
const TILE_TARGET_PX = 512;

/** 保持するタイルの数。強度4段ぶん。それ以上は古いものから捨てる */
const MAX_TILES = 4;

/** 決定論的なノイズ。同じ種なら毎回同じ図柄になり、再描画でチラつかない */
function hash2(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

interface Tile {
  readonly canvas: AnyCanvas;
  readonly key: string;
}

const cache = new Map<string, Tile>();

const keyOf = (op: GrainOp, kExport: number): string =>
  `${op.seed}/${(op.cellLu * kExport).toFixed(3)}/${op.intensity}/${op.chroma}`;

function buildTile(op: GrainOp, kExport: number): AnyCanvas | null {
  // 粒1個のデバイスピクセル寸法。★t.k ではなく kExport で決める★
  const cellPx = Math.max(1, Math.round(op.cellLu * kExport));
  // セルの境界とタイルの境界を一致させ、繰り返しの継ぎ目を作らない
  const cells = Math.max(1, Math.round(TILE_TARGET_PX / cellPx));
  const size = cells * cellPx;

  const r = createVerifiedCanvas(size, size);
  if (!r.ok) return null; // 粒なしで続行する。告げるのは呼び出し側の仕事

  const img = r.ctx.createImageData(size, size);
  const d = img.data;
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const mono = (hash2(op.seed, cx, cy) - 0.5) * 255 * op.intensity;
      const rr = 128 + (op.chroma === 'rgb' ? (hash2(op.seed + 1, cx, cy) - 0.5) * 255 * op.intensity : mono);
      const gg = 128 + (op.chroma === 'rgb' ? (hash2(op.seed + 2, cx, cy) - 0.5) * 255 * op.intensity : mono);
      const bb = 128 + (op.chroma === 'rgb' ? (hash2(op.seed + 3, cx, cy) - 0.5) * 255 * op.intensity : mono);
      for (let y = 0; y < cellPx; y++) {
        const row = (cy * cellPx + y) * size;
        for (let x = 0; x < cellPx; x++) {
          const i = (row + cx * cellPx + x) * 4;
          d[i] = rr;
          d[i + 1] = gg;
          d[i + 2] = bb;
          d[i + 3] = 255;
        }
      }
    }
  }
  r.ctx.putImageData(img, 0, 0);
  return r.canvas;
}

/** タイルを得る。キーは書き出し倍率で決まるので、書き出し解像度を変えると作り直される */
export function grainTileFor(op: GrainOp, target: RenderTarget): AnyCanvas | null {
  const key = keyOf(op, target.kExport);
  const hit = cache.get(key);
  if (hit) {
    // 直近に使ったものを末尾へ送る（古いものから捨てるため）
    cache.delete(key);
    cache.set(key, hit);
    return hit.canvas;
  }
  const canvas = buildTile(op, target.kExport);
  if (!canvas) return null;
  cache.set(key, { canvas, key });
  while (cache.size > MAX_TILES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    const t = cache.get(oldest);
    if (t) release(t.canvas);
    cache.delete(oldest);
  }
  return canvas;
}

export function clearGrainTiles(): void {
  for (const t of cache.values()) release(t.canvas);
  cache.clear();
}
