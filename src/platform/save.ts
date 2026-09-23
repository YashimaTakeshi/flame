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
import { toStamp, wallClockFromDate, type WallClock } from '../core/wallclock';


export type SaveMethod = 'picker' | 'share' | 'download' | 'longpress';

/**
 * どの経路を先に試すか。
 *   auto    … 端末に任せる（スマホ: 共有シート→ダウンロード）
 *   picker  … 保存先を選ぶ窓（エクスプローラー / Finder）。PC の第一候補
 *   share   … 共有シート
 *   download… 既定の保存先へ
 *
 * PC の Chromium は navigator.share にファイルを渡せるので、auto のままだと
 * Windows の共有パネルが開く（実機で指摘された）。PC では保存先を選ぶ窓が期待される。
 */
export type SavePreference = 'auto' | 'picker' | 'share' | 'download';

/** File System Access API。Chromium 系の PC にしか無いので、あるときだけ使う */
interface PickerWindow {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>;
}

export function canPickLocation(): boolean {
  return typeof (window as Window & PickerWindow).showSaveFilePicker === 'function' && !inFrame();
}

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
  /** 保存先を選ぶ窓（エクスプローラー / Finder）を開けるか */
  readonly canPickLocation: boolean;
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
    canPickLocation: canPickLocation(),
    inFrame: inFrame(),
  };
}

/**
 * 保存先を選んで書く。**利用者の操作から同期的に呼ぶこと**（窓を開く権利は操作に紐づく）。
 * 取りやめは失敗ではない。窓を閉じただけの人に落ち度があるように見せない。
 */
/** 保存先を選ぶ窓に出す種類。動画は動画として（拡張子が .jpg に直されないように） */
function pickerType(mime: string): { description: string; accept: Record<string, string[]> } {
  if (mime === 'video/mp4') return { description: 'MP4 動画', accept: { 'video/mp4': ['.mp4'] } };
  if (mime === 'video/webm') return { description: 'WebM 動画', accept: { 'video/webm': ['.webm'] } };
  return { description: 'JPEG 画像', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } };
}

async function saveWithPicker(blob: Blob, filename: string): Promise<SaveOutcome | null> {
  const w = window as Window & PickerWindow;
  if (typeof w.showSaveFilePicker !== 'function') return null;
  let handle: Awaited<ReturnType<NonNullable<PickerWindow['showSaveFilePicker']>>>;
  try {
    handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: [pickerType(blob.type)],
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { method: 'picker', ok: false, detail: '保存を取りやめました' };
    }
    return null; // 窓を開けない環境（枠の中・権限なし）。下の経路へ
  }
  try {
    const out = await handle.createWritable();
    await out.write(blob);
    await out.close();
    return { method: 'picker', ok: true, detail: '保存しました' };
  } catch (e) {
    return { method: 'picker', ok: false, detail: `書き込めませんでした: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * 保存する。**利用者の操作から同期的に呼ぶこと。**
 * iOS の共有は「利用者の操作から始まった処理」でないと拒否される。
 * 書き出しを待ってから呼ぶと、その繋がりが切れて失敗しうる。
 */
export async function saveImage(
  blob: Blob,
  filename: string,
  prefer: SavePreference = 'auto',
): Promise<SaveOutcome> {
  const caps = saveCapabilities();
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };

  // 保存先を選ぶ窓。開けたらそれで完結し、開けなければ下へ落ちる
  if (prefer === 'picker' && caps.canPickLocation) {
    const r = await saveWithPicker(blob, filename);
    if (r) return r;
  }

  // 枠の中では共有もダウンロードも遮断される。押しても何も起きない、という
  // いちばん分かりにくい失敗になるので、試さずに長押し保存へ案内する
  if (caps.inFrame) {
    return {
      method: 'longpress',
      ok: false,
      detail: 'この画面は枠の中で動いているため、自動で保存できません。下の画像を長押しして保存してください',
    };
  }

  // 共有は「頼まれたとき」か「任せる」のとき。ダウンロードを頼まれたら飛ばす
  if (caps.canShareFiles && (prefer === 'auto' || prefer === 'share')) {
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

/** 端末の時計の壁時計。撮影日時が無いときのファイル名に使う */
export const nowWallClock = (): WallClock => wallClockFromDate(new Date());

/**
 * fuchidori-20260921-084512.jpg のような名前にする。
 * 時刻は**撮影日時**（あれば）。書き出した時刻にすると、写真アプリやフォルダで
 * 旅行の順番が崩れる。撮影日時は壁時計のまま使う（§16.1）
 */
export function makeFilename(at: WallClock = nowWallClock(), ext: 'jpg' | 'mp4' | 'webm' = 'jpg'): string {
  return `fuchidori-${toStamp(at)}.${ext}`;
}

/**
 * LINE や Instagram の中のブラウザで開いているか。
 * そこでは共有シートが無く、ダウンロードも不安定で、ホーム画面にも置けない。
 * 判定は UA の印だけ（それ以外に手掛かりが無い）。外れても案内が1行増えるだけ
 */
export function inAppBrowser(): boolean {
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent ?? '') : '';
  return /\bLine\/|Instagram|FBAN|FBAV/.test(ua);
}
