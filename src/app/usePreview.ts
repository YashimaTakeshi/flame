/**
 * プレビューを描く。
 *
 * 気をつけること:
 * 1. **canvas に width:100% を当てない。** 縦位置の写真が横いっぱいに引き伸ばされて
 *    縦にはみ出す。CSS の max-width/max-height に任せ、比率は置換要素の性質で保つ。
 * 2. **設定を変えるたびに原寸で描き直さない。** 画像1枚で約100MBを掴む。
 *    プレビューは縮小版、原寸は書き出しのときだけ。
 * 3. **連打しても1フレームに1回しか描かない。** rAF で合流させる。
 * 4. 入れ物の大きさが変わったら描き直す（タブを切り替えるとプレビュー領域が伸縮する）。
 */
import { useEffect, useRef, useState } from 'react';
import type { Scene } from '../core/scene/scene';
import { renderScene } from '../render/executor';
import { createVerifiedCanvas, release, type AnyCanvas, type Ctx } from '../render/guards';
import { grainTileFor } from '../render/resources/grainTiles';
import type { PhotoId } from '../core/scene/ops';
import type { RenderResources } from '../render/resources/types';
import { makePreviewTarget } from '../render/target';

export interface PreviewState {
  /** 描けなかったときの理由。画面に出す文面そのまま */
  readonly error: string | null;
  /** 100ms を超えて描いているか。超えたときだけ印を出す */
  readonly slow: boolean;
}

export function usePreview(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  hostRef: React.RefObject<HTMLElement | null>,
  scene: Scene | null,
  /** 識別子から画像を引く。写真のほかに仕上がりの札も載るので、1枚では足りない */
  image: (id: PhotoId) => CanvasImageSource | null,
  exportLongEdge: number,
  /**
   * canvas の要素が作り直されたことを知らせる値（画面の組み方など）。
   * ref は同じまま中身だけ差し替わるので、これが無いと新しい canvas に一度も描かれない。
   * ★実測: 全画面から窓を縮めて PC → スマホの組み方に切り替わると、プレビューが真っ暗のままだった。★
   */
  mountKey: string,
): PreviewState {
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const patternHost = useRef<{ canvas: AnyCanvas; ctx: Ctx } | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host || !scene) return;

    const draw = (): void => {
      raf.current = 0;
      const slowTimer = setTimeout(() => setSlow(true), 100);
      try {
        // 入れ物の内寸から決める。padding のぶんを引いた実寸
        const style = getComputedStyle(host);
        const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const cssWidth = Math.max(80, host.clientWidth - padX);

        const target = makePreviewTarget(scene, cssWidth, window.devicePixelRatio || 1, exportLongEdge);
        if (canvas.width !== target.widthPx) canvas.width = target.widthPx;
        if (canvas.height !== target.heightPx) canvas.height = target.heightPx;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('この端末では画像を描けませんでした');
          return;
        }

        if (!patternHost.current) {
          const r = createVerifiedCanvas(1, 1);
          if (r.ok) patternHost.current = { canvas: r.canvas, ctx: r.ctx };
        }

        const resources: RenderResources = {
          photo: (id) => image(id),
          grainTile: (op, t) => {
            const tile = grainTileFor(op, t);
            const hostCtx = patternHost.current;
            if (!tile || !hostCtx) return null;
            return hostCtx.ctx.createPattern(tile as CanvasImageSource, 'repeat');
          },
          verticalText: () => null,
        };

        renderScene(scene, ctx, target, resources);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'この設定では描けませんでした');
      } finally {
        clearTimeout(slowTimer);
        setSlow(false);
      }
    };

    const request = (): void => {
      if (raf.current) return; // すでに次のフレームで描く予定がある
      raf.current = requestAnimationFrame(draw);
    };

    request();

    // タブを切り替えるとプレビュー領域の高さが変わる。追従する
    const ro = new ResizeObserver(request);
    ro.observe(host);

    return () => {
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [canvasRef, hostRef, scene, image, exportLongEdge, mountKey]);

  useEffect(
    () => () => {
      if (patternHost.current) release(patternHost.current.canvas);
      patternHost.current = null;
    },
    [],
  );

  return { error, slow };
}
