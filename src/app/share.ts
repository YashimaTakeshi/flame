/**
 * このアプリそのものを人に渡す。
 *
 * 渡すのは URL ひとつ。入れてもらう手間が要らないのが web の強みなので、
 * 「ストアで探して」ではなく「開いたらもう使える」形で渡す。
 *
 * 経路は3つ。上から順に試す。
 *   1. 共有シート（navigator.share）… iOS なら LINE・AirDrop・メッセージがそのまま出る
 *   2. クリップボード … 共有シートが無い端末（多くの PC）
 *   3. どちらも駄目 … URL をそのまま見せて、手で選んでもらう
 *
 * ★やめたときを失敗として扱わない。★ 共有シートを開いて閉じると AbortError が飛ぶ。
 * これを失敗として赤く出すと、自分でやめた人に落ち度があるように見える。
 */

export type ShareOutcome =
  | { readonly kind: 'shared' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'copied'; readonly url: string }
  | { readonly kind: 'manual'; readonly url: string };

const TITLE = 'Fuchidori';
const TEXT = '写真に撮影情報のフチを付けるアプリです。開くだけで使えます。';

/**
 * 配る URL。
 * 検索語や現在地（?a=1#x）は自分の事情なので落とす。人に渡るのは入口だけでよい。
 */
export function appUrl(): string {
  const { origin, pathname } = window.location;
  return origin + pathname;
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'NotAllowedError');
}

export async function shareApp(): Promise<ShareOutcome> {
  const url = appUrl();
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };

  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: TITLE, text: TEXT, url });
      return { kind: 'shared' };
    } catch (e) {
      // やめただけなら、ここで終わり。下の経路に落とすと勝手にコピーされて驚かせる
      if (isAbort(e)) return { kind: 'cancelled' };
      /* 共有そのものが使えなかった。下へ落ちる */
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return { kind: 'copied', url };
  } catch {
    return { kind: 'manual', url };
  }
}
