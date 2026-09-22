/**
 * 書き出した画像を端末に渡す。
 *
 * ここは**実機でしか確かめられない**部分。iOS Safari で
 *   - navigator.share にファイルを渡せるか
 *   - 渡せたとして写真アプリに保存できるか
 *   - 駄目なら長押し保存で足りるか
 * は、この環境では検証できない（docs/poc/report-geo-batch.md の未検証事項）。
 *
 * そのため「使える手段を順に試し、何が使えたかを返す」形にしてある。
 * 結果は自己診断に出るので、実機で1度触ればどの経路が通ったか分かる。
 */

export type SaveMethod = 'share' | 'download' | 'longpress';

/**
 * 枠の中（iframe）で動いているか。
 *
 * 枠の中では共有もダウンロードもブラウザに遮断される。遮断されたことは
 * 例外にならず「押しても何も起きない」形で現れるので、先に知っておく必要がある。
 */
export function inFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // クロスオリジンで比較自体が弾かれた＝枠の中にいる
    return true;
  }
}

export interface SaveOutcome {
  readonly method: SaveMethod;
  readonly ok: boolean;
  readonly detail: string;
}

export interface SaveCapabilities {
  readonly hasShare: boolean;
  readonly canShareFiles: boolean;
  readonly hasDownloadAttribute: boolean;
  readonly inFrame: boolean;
}

export function saveCapabilities(): SaveCapabilities {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  const canShareFiles = ((): boolean => {
    try {
      // 小さなファイルで試すだけ。実際の共有は起こさない
      const probe = new File([new Uint8Array(1)], 'probe.jpg', { type: 'image/jpeg' });
      return typeof nav.canShare === 'function' && nav.canShare({ files: [probe] });
    } catch {
      return false;
    }
  })();
  return {
    hasShare: typeof nav.share === 'function',
    canShareFiles,
    hasDownloadAttribute: 'download' in document.createElement('a'),
    inFrame: inFrame(),
  };
}

/**
 * 保存する。**利用者の操作から同期的に呼ぶこと。**
 * iOS の共有は「利用者の操作から始まった処理」でないと拒否される。
 * 書き出しを待ってから呼ぶと、その繋がりが切れて失敗しうる。
 */
export async function saveImage(blob: Blob, filename: string): Promise<SaveOutcome> {
  const caps = saveCapabilities();
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };

  // 枠の中では共有もダウンロードも遮断される。押しても何も起きない、という
  // いちばん分かりにくい失敗になるので、試さずに長押し保存へ案内する
  if (caps.inFrame) {
    return {
      method: 'longpress',
      ok: false,
      detail: 'この画面は枠の中で動いているため、自動で保存できません。下の画像を長押しして保存してください',
    };
  }

  if (caps.canShareFiles) {
    try {
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
      await nav.share!({ files: [file] });
      return { method: 'share', ok: true, detail: '共有シートに渡しました' };
    } catch (e) {
      // 利用者が共有シートを閉じた場合も例外になる。失敗と区別できない
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof Error && e.name === 'AbortError') {
        return { method: 'share', ok: false, detail: '共有を取りやめました' };
      }
      // 共有が駄目ならダウンロードへ落ちる
      void msg;
    }
  }

  if (caps.hasDownloadAttribute) {
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return { method: 'download', ok: true, detail: 'ダウンロードしました' };
    } finally {
      // すぐ revoke するとダウンロードが始まらない端末があるので少し置く
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  }

  return {
    method: 'longpress',
    ok: false,
    detail: '自動で保存できません。表示された画像を長押しして保存してください',
  };
}

/** fuchidori-20260921-084512.jpg のような名前にする */
export function makeFilename(at: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return (
    `fuchidori-${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}` +
    `-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}.jpg`
  );
}
