/**
 * 画面の高さを自分で測って持つ。
 *
 * 100dvh を信じない。枠の中（iframe）に置かれると、枠そのものが
 * 見えている範囲より大きいことがあり、その場合 dvh は見えない部分まで含んだ
 * 高さを返す。結果、いちばん下のタブバーが画面外に出て**設定に触れなくなる**。
 * 実機で実際に起きた。
 *
 * あわせて、枠の中ではセーフエリアの余白を効かせない。
 * 枠は画面の端に接していないのに、端末のノッチぶんの余白が入って上下が削られる。
 */
import { useEffect } from 'react';

function inFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function useViewportHeight(): void {
  useEffect(() => {
    const root = document.documentElement;

    const apply = (): void => {
      // clientHeight はこの文書のレイアウト領域＝枠の内側の実寸
      const h = Math.min(
        root.clientHeight || window.innerHeight,
        window.visualViewport?.height ?? Number.POSITIVE_INFINITY,
      );
      root.style.setProperty('--app-h', `${Math.round(h)}px`);
    };

    if (inFrame()) {
      root.style.setProperty('--safe-top', '0px');
      root.style.setProperty('--safe-bottom', '0px');
      root.dataset['framed'] = 'true';
    }

    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    window.visualViewport?.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      window.visualViewport?.removeEventListener('resize', apply);
    };
  }, []);
}
