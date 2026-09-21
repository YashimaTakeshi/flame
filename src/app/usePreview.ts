/**
 * プレビューを描く。
 *
 * 設定を変えるたびに原寸で描き直してはならない。画像1枚で約100MB を掴み、
 * 実機では落ちる（docs/poc/report-geo-batch.md）。
 * プレビューは縮小版を使い、書き出しのときだけ原寸を掴む。
 */
import { useEffect, useRef } from 'react';
import type { Scene } from '../core/scene/scene';
import { renderScene } from '../render/executor';
import { createVerifiedCanvas, release, type AnyCanvas, type Ctx } from '../render/guards';
import { grainTileFor } from '../render/resources/grainTiles';
import type { RenderResources } from '../render/resources/types';
import { makePreviewTarget } from '../render/target';

export interface PreviewFailure {
  readonly reason: 'canvas' | 'font' | 'unknown';
  readonly message: string;
}

export function usePreview(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  scene: Scene | null,
  photo: CanvasImageSource | null,
  exportLongEdge: number,
  onFail: (f: PreviewFailure | null) => void,
): void {
  const patternHost = useRef<{ canvas: AnyCanvas; ctx: Ctx } | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !scene) return;

    const cssWidth = el.parentElement?.clientWidth ?? 360;
    const target = makePreviewTarget(scene, cssWidth, window.devicePixelRatio || 1, exportLongEdge);

    el.width = target.widthPx;
    el.height = target.heightPx;
    el.style.width = '100%';
    el.style.height = 'auto';

    const ctx = el.getContext('2d');
    if (!ctx) {
      onFail({ reason: 'canvas', message: 'この端末では画像を描けませんでした' });
      return;
    }

    if (!patternHost.current) {
      const r = createVerifiedCanvas(1, 1);
      if (r.ok) patternHost.current = { canvas: r.canvas, ctx: r.ctx };
    }

    const resources: RenderResources = {
      photo: () => photo,
      grainTile: (op, t) => {
        const tile = grainTileFor(op, t);
        const host = patternHost.current;
        if (!tile || !host) return null;
        return host.ctx.createPattern(tile as CanvasImageSource, 'repeat');
      },
      verticalText: () => null,
    };

    try {
      renderScene(scene, ctx, target, resources);
      onFail(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      onFail({
        reason: message.includes('書体') ? 'font' : 'unknown',
        message,
      });
    }
  }, [canvasRef, scene, photo, exportLongEdge, onFail]);

  useEffect(
    () => () => {
      if (patternHost.current) release(patternHost.current.canvas);
      patternHost.current = null;
    },
    [],
  );
}
