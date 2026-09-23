/**
 * 書き出しと保存。
 *
 * **保存は利用者の操作から同期的に呼ぶ。** 書き出しを待ってから呼ぶと、
 * iOS は「利用者の操作から始まった処理」とみなさず共有を拒む。
 * だからシートを開いた時点で書き出しを終わらせ、ボタンの押下では待たずに渡す。
 */
import { useEffect, useState } from 'react';
import type { ExifWriteStatus } from '../../platform/exif-write';
import {
  inAppBrowser,
  inFrame,
  saveCapabilities,
  saveImage,
  type SaveOutcome,
  type SavePreference,
} from '../../platform/save';
import { useLayoutMode } from '../layout';
import { Sheet } from '../ui/Sheet';
import { ShareApp } from '../ui/ShareApp';

/**
 * 画像を data: にする。
 *
 * iOS は blob: の画像を長押ししても「写真に保存」を出さない。
 * 枠の中では共有もダウンロードも遮断されるので、長押しが唯一の保存方法になる。
 * そこで表示用だけは自己完結した data: にする。
 * base64 は元の約 4/3 に膨らむので、大きすぎるときは blob: のまま出して、
 * 保存できない旨を正直に伝える。
 */
const MAX_DATA_URL_BYTES = 12 * 1024 * 1024;

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('画像を読み込めませんでした'));
    reader.readAsDataURL(blob);
  });
}

/** 書き出しの結果。画像（または動画）と、その名前と、撮影情報を書き戻せたか */
export interface Exported {
  readonly blob: Blob;
  /** 撮影日時から付けた名前（§16.1） */
  readonly filename: string;
  readonly exif: ExifWriteStatus;
  /** 動画のときだけ。音声が入ったか、上限で切ったか */
  readonly video?: {
    readonly audio: 'kept' | 'dropped' | 'none';
    readonly seconds: number;
    readonly trimmed: boolean;
  };
}

/** 書き出しの手続き。動画は時間が掛かるので、進み具合を知らせ、途中でやめられる */
export type Render = (p: { readonly onProgress: (ratio: number) => void; readonly signal: AbortSignal }) => Promise<Exported>;

const fmtSec = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export function ExportSheet({
  render,
  video = false,
  onClose,
}: {
  render: Render;
  /** 動画の書き出し。進み具合を出し、結果を動画で見せる */
  video?: boolean;
  onClose: () => void;
}): React.ReactElement {
  const [exported, setExported] = useState<Exported | null>(null);
  const [progress, setProgress] = useState(0);
  const blob = exported?.blob ?? null;
  const [url, setUrl] = useState<string | null>(null);
  const [savable, setSavable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const caps = saveCapabilities();
  const desk = useLayoutMode() === 'desk';

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    // 閉じたら書き出しも止める（動画は数十秒かかる）
    const abort = new AbortController();

    render({ onProgress: (r) => alive && setProgress(r), signal: abort.signal })
      .then(async (x) => {
        if (!alive) return;
        setExported(x);
        const b = x.blob;
        // 動画は長押し保存の対象にならない（data: にもしない。大きい）
        if (b.type.startsWith('video/')) {
          objectUrl = URL.createObjectURL(b);
          setUrl(objectUrl);
          setSavable(false);
          return;
        }
        // 長押しで保存できるのは data: のときだけ（blob: では保存の項目が出ない）
        if (b.size * 1.37 <= MAX_DATA_URL_BYTES) {
          try {
            const data = await toDataUrl(b);
            if (!alive) return;
            setUrl(data);
            setSavable(true);
            return;
          } catch {
            /* 下の blob: に落ちる */
          }
        }
        if (!alive) return;
        objectUrl = URL.createObjectURL(b);
        setUrl(objectUrl);
        setSavable(false);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : '書き出せませんでした');
      });

    return () => {
      alive = false;
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [render]);

  // ここで await を挟まない。挟むと iOS が共有を拒み、PC は保存先の窓を開けない
  const save = (prefer: SavePreference): void => {
    if (!exported) return;
    void saveImage(exported.blob, exported.filename, prefer).then(setOutcome);
  };

  /*
   * PC では「保存先を選ぶ」が第一。無ければダウンロード。共有は脇に置く。
   * スマホでは共有シート（写真アプリに入る）が第一。
   * PC の Chromium も共有にファイルを渡せるので、区別しないと Windows の共有パネルが開く。
   */
  const primary: { prefer: SavePreference; label: string } = desk
    ? caps.canPickLocation
      ? { prefer: 'picker', label: '名前を付けて保存…' }
      : { prefer: 'download', label: 'ダウンロード' }
    : { prefer: 'auto', label: caps.canShareFiles ? (video ? 'ビデオを保存 / 共有' : '写真に保存 / 共有') : 'ダウンロード' };
  const secondary: { prefer: SavePreference; label: string } | null = desk
    ? caps.canPickLocation && caps.hasDownloadAttribute
      ? { prefer: 'download', label: '既定の場所にダウンロード' }
      : null
    : null;
  const share = desk && caps.canShareFiles ? { prefer: 'share' as const, label: '共有…' } : null;

  return (
    /*
     * 高さは決めて（tall）、画像は残りの高さに収める。
     * 以前は中身の高さに任せていたので、大きな画像だとボタンまで送らないと届かなかった
     * （実機で指摘された）。画像が小さくなっても、保存の導線が見えているほうが先。
     */
    <Sheet
      title={blob ? '書き出しました' : video ? `書き出し中… ${Math.floor(progress * 100)}%` : '書き出し中…'}
      size="tall"
      fill
      bodyClass="sheet__body--fit"
      onClose={onClose}
    >
      <div className="result">
        {url &&
          (video ? (
            // 音を出さずに繰り返す。確かめたい人は操作で音を出せる
            <video src={url} className="result-img" controls playsInline loop muted autoPlay aria-label="書き出した動画" />
          ) : (
            <img src={url} alt="書き出した画像" className="result-img" />
          ))}
        {video && !blob && !error && (
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress * 100)}>
            <span style={{ width: `${Math.max(2, progress * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="result__rest">
        {error && <p className="band">{error}</p>}
        {exported?.video && (exported.video.trimmed || exported.video.audio === 'dropped') && (
          <p className="e1" style={{ padding: 0 }}>
            {exported.video.trimmed && `長い動画なので、先頭の ${fmtSec(exported.video.seconds)} を書き出しました。`}
            {exported.video.audio === 'dropped' && 'この端末では音声を入れられませんでした（映像だけです）。'}
          </p>
        )}
        {video && !blob && !error && (
          <p className="e1" style={{ padding: 0 }}>
            1コマずつ枠を描いています。この画面を閉じると取りやめます。
          </p>
        )}
        {url && savable && !video && (
          <p className="e1" style={{ padding: 0 }}>
            {/* 長押しはスマホの作法。PC では右クリック */}
            {desk ? '↑ 画像を右クリックして保存することもできます' : '↑ 画像を長押しして「写真に保存」'}
            {inFrame() && '（この画面は枠の中で動いているため、これが唯一の保存方法です）'}
          </p>
        )}
        {url && !savable && !video && (
          <p className="band">
            この画像は大きすぎて、長押しでは保存できません。
            {inFrame()
              ? 'この画面は枠の中で動いているため、ほかの保存方法も使えません。書き出しの大きさを下げるか、アプリを直接開いてください。'
              : '下のボタンから保存してください。'}
          </p>
        )}
        {outcome && <p className={outcome.ok ? 'e1' : 'band'}>{outcome.detail}</p>}
        {/* 書き戻しはおまけ。駄目でも写真は保存できている。控えめに1行 */}
        {exported?.exif === 'failed' && (
          <p className="e1" style={{ padding: 0 }}>
            元の撮影情報（EXIF）は書き戻せませんでした。焼き込んだ文字はそのままです。
          </p>
        )}
        {/* LINE などの中のブラウザ。共有も保存も効かないことが多い。出口を1行で */}
        {blob && inAppBrowser() && (
          <p className="e1" style={{ padding: 0 }}>
            アプリの中のブラウザで開いています。保存できないときは、右上の「…」から「ブラウザで開く」を選んでください。
          </p>
        )}
        {blob && !inFrame() && (
          <button type="button" className="btn" onClick={() => save(primary.prefer)}>
            {primary.label}
          </button>
        )}
        {blob && !inFrame() && (secondary || share) && (
          <div className="btnrow">
            {secondary && (
              <button type="button" className="btn btn--sec" onClick={() => save(secondary.prefer)}>
                {secondary.label}
              </button>
            )}
            {share && (
              <button type="button" className="btn btn--sec" onClick={() => save(share.prefer)}>
                {share.label}
              </button>
            )}
          </div>
        )}
        <button type="button" className="btn btn--sec" onClick={onClose}>
          続けて編集する
        </button>
        {/* 作ったものを見せた直後が、人に教えたくなるとき */}
        <ShareApp variant="button" />
      </div>
    </Sheet>
  );
}
