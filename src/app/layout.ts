/**
 * 画面の組み方を2つ持つ。
 *
 *   phone … 上から ヘッダー / プレビュー / オプション行 / タブバー。設定は1つのタブずつ、ホイールで選ぶ。
 *   desk  … 左にプレビュー、右に設定の欄。設定は全部見えていて、押しボタンで選ぶ。
 *
 * 分けるのは**幅だけ**。指か鼠かでは分けない。
 * 横向きのタブレットは幅があるので desk になり、ボタンは指でも押せる大きさにしてある。
 * 逆に狭い窓の PC は phone になるが、ホイールは鼠でも回せる。
 *
 * スマホの画面をそのまま横に伸ばしたものは PC では使いにくい（実機で指摘された）。
 * プレビューが小さく、設定は1タブずつしか見えず、ホイールは鼠に向かない。
 */
import { useSyncExternalStore } from 'react';

export type LayoutMode = 'phone' | 'desk';

/** この幅から上を desk にする。プレビュー 600px ＋ 設定の欄 360px が並ぶ最小 */
export const DESK_MIN_WIDTH = 960;

const QUERY = `(min-width: ${DESK_MIN_WIDTH}px)`;

const mql = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;

export function currentLayout(): LayoutMode {
  return mql()?.matches ? 'desk' : 'phone';
}

function subscribe(onChange: () => void): () => void {
  const m = mql();
  if (!m) return () => {};
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
}

/** 窓の幅が変わればその場で切り替わる */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, currentLayout, () => 'phone');
}
