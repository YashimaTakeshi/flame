/**
 * 全面（余白なし）のとき、プレビューを指やマウスで動かして切り取りの位置を決める。
 *
 * 指の移動量（CSS px）を、切り取りの中心（0..1）の移動量に直す。
 * 画面には元画像の w（0..1）ぶんの幅が canvas の幅いっぱいに映っているので、
 * 指が dx 動いたら元画像の上では dx / canvasW × w だけ動いたことになる。
 * 中心 focus は余り (1 − w) を 0..1 で割り振っているので、さらに (1 − w) で割る。
 * 指を右に動かすと写真が右へ付いてきて、左側が見えてくる（focus は減る）。
 *
 * 余りが無い軸（切り取っていない軸）では何も起きない。
 */
import { useEffect, useRef } from 'react';
import type { Scene } from '../core/scene/scene';
import type { Focus } from '../core/styles/types';

export function usePan(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  scene: Scene | null,
  enabled: boolean,
  /** いまの中心を読む。描画のたびに ref を書き換えずに済むよう、関数で受け取る */
  getFocus: () => Focus,
  onBegin: () => void,
  onMove: (f: Focus) => void,
  /** canvas の要素が作り直されたことを知らせる値。ref は同じまま中身が差し替わる */
  mountKey = '',
): void {
  /*
   * 切り取りの幅（w, h）は Scene から読むが、リスナーは Scene に依存させない。
   * 指を動かすたびに focus が変わり Scene が作り直されるので、Scene に依存させると
   * 最初の1回の移動でリスナーが張り直され、「押している」状態が消えて以降が無視される
   * （実測: 120px 動かしても 12px ぶんしか効かなかった）。幅は ref で最新を持つ。
   */
  const cropRef = useRef({ w: 1, h: 1 });
  useEffect(() => {
    const photo = scene?.ops.find((o) => o.op === 'photo');
    if (photo && photo.op === 'photo') cropRef.current = { w: photo.srcNorm.w, h: photo.srcNorm.h };
  }, [scene]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !enabled) return;

    let active = false;
    /** 動かしている指。2本目の指が来たら切り取りをやめ、写真の拡大（useStageZoom）に譲る */
    let pid: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let fx = 0;
    let fy = 0;

    const down = (e: PointerEvent): void => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (pid !== null && pid !== e.pointerId) {
        active = false;
        return;
      }
      pid = e.pointerId;
      active = true;
      lastX = e.clientX;
      lastY = e.clientY;
      const f = getFocus();
      fx = f.x;
      fy = f.y;
      el.setPointerCapture(e.pointerId);
      onBegin();
      e.preventDefault();
    };
    const move = (e: PointerEvent): void => {
      if (!active || e.pointerId !== pid) return;
      const r = el.getBoundingClientRect();
      const { w, h } = cropRef.current;
      const slackX = 1 - w;
      const slackY = 1 - h;
      if (slackX <= 0 && slackY <= 0) return; // 切り取っていない。動かす余地が無い
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (slackX > 0 && r.width > 0) fx -= ((dx / r.width) * w) / slackX;
      if (slackY > 0 && r.height > 0) fy -= ((dy / r.height) * h) / slackY;
      fx = Math.min(1, Math.max(0, fx));
      fy = Math.min(1, Math.max(0, fy));
      onMove({ x: fx, y: fy });
    };
    const up = (e: PointerEvent): void => {
      if (e.pointerId !== pid) return;
      pid = null;
      active = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [canvasRef, enabled, getFocus, onBegin, onMove, mountKey]);
}
