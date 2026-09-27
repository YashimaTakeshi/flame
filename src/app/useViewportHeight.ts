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

    /*
     * iPhone の Safari は、入力欄を押してキーボードを出すとき、入力欄が見えるように画面ごとずらす
     * （overflow: hidden の文書でも）。キーボードを閉じてもずれたまま戻さないことがあり、
     * 上の見出しが隠れ、下に空きができ、左右も切れていた（依頼者の指摘）。
     * 入力欄から離れたら、ずれを元に戻す。入力中は戻さない（入力欄がキーボードに隠れる）
     */
    const typing = (): boolean => {
      const a = document.activeElement;
      return a instanceof HTMLElement && (a.matches('input, textarea, select') || a.isContentEditable);
    };
    const unshift = (): void => {
      if (typing()) return;
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
      for (const el of [document.documentElement, document.body, document.querySelector('.app')]) {
        if (el && (el.scrollTop || el.scrollLeft)) {
          el.scrollTop = 0;
          el.scrollLeft = 0;
        }
      }
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = (): void => {
      clearTimeout(timer);
      // キーボードが閉じきってから（閉じる動きの途中で戻すと、また ずらされる）
      timer = setTimeout(unshift, 120);
    };
    const onResize = (): void => {
      apply();
      later();
    };

    apply();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    document.addEventListener('focusout', later);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      document.removeEventListener('focusout', later);
    };
  }, []);
}
