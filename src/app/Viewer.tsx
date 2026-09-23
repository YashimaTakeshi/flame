/**
 * 全画面で見る。仕上がりを画面いっぱいの大きさで確かめる（書き出す前に）。
 *
 * 描き方はプレビューと同じ（同じ Scene を同じ描き手で）。入れ物が画面いっぱいなだけ。
 * 閉じ方は3つ: ✕・背景のどこかを押す・Esc（と戻るスワイプ。面と同じく履歴に載る #view）。
 * 動画は流れたまま見られる。
 */
import { useEffect, useRef } from 'react';
import type { Scene } from '../core/scene/scene';
import type { PhotoId } from '../core/scene/ops';
import { usePreview } from './usePreview';

export function Viewer({
  scene,
  image,
  exportLongEdge,
  subscribe,
  onClose,
}: {
  scene: Scene;
  image: (id: PhotoId) => CanvasImageSource | null;
  exportLongEdge: number;
  subscribe: ((onFrame: () => void) => () => void) | null;
  onClose: () => void;
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // 画面いっぱいに描くので細かく描く（拡大の上限まで）
  const state = usePreview(canvasRef, hostRef, scene, image, exportLongEdge, 'view', subscribe, 1.6);

  /*
   * PC はブラウザ自体も全画面にする（見出しやタブの帯まで消す）。使えない端末（iPhone）は黙って窓の中だけ
   */
  useEffect(() => {
    const el = document.documentElement;
    let entered = false;
    if (typeof el.requestFullscreen === 'function' && !document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => {
          entered = true;
        })
        .catch(() => {});
    }
    // 利用者が Esc でブラウザの全画面を抜けたら、この表示も閉じる
    const onChange = (): void => {
      if (entered && !document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="全画面で見る" onClick={onClose}>
      <div className="viewer__host" ref={hostRef}>
        <canvas ref={canvasRef} className="viewer__canvas" role="img" aria-label="仕上がりの全画面表示" />
      </div>
      {state.error && <p className="viewer__err">{state.error}</p>}
      <button
        type="button"
        className="viewer__close"
        aria-label="閉じる"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ✕
      </button>
    </div>
  );
}
