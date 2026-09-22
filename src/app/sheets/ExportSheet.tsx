/**
 * 書き出しと保存。
 *
 * **保存は利用者の操作から同期的に呼ぶ。** 書き出しを待ってから呼ぶと、
 * iOS は「利用者の操作から始まった処理」とみなさず共有を拒む。
 * だからシートを開いた時点で書き出しを終わらせ、ボタンの押下では待たずに渡す。
 */
import { useEffect, useState } from 'react';
import {
  inFrame,
  makeFilename,
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

export function ExportSheet({
  render,
  onClose,
}: {
  render: () => Promise<Blob>;
  onClose: () => void;
}): React.ReactElement {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [savable, setSavable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const caps = saveCapabilities();
  const desk = useLayoutMode() === 'desk';

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;

    render()
      .then(async (b) => {
        if (!alive) return;
        setBlob(b);
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
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [render]);

  // ここで await を挟まない。挟むと iOS が共有を拒み、PC は保存先の窓を開けない
  const save = (prefer: SavePreference): void => {
    if (!blob) return;
    void saveImage(blob, makeFilename(), prefer).then(setOutcome);
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
    : { prefer: 'auto', label: caps.canShareFiles ? '写真に保存 / 共有' : 'ダウンロード' };
  const secondary: { prefer: SavePreference; label: string } | null = desk
    ? caps.canPickLocation && caps.hasDownloadAttribute
      ? { prefer: 'download', label: '既定の場所にダウンロード' }
      : null
    : null;
  const share = desk && caps.canShareFiles ? { prefer: 'share' as const, label: '共有…' } : null;

  return (
    <Sheet title={blob ? '書き出しました' : '書き出し中…'} size="auto" onClose={onClose}>
      {error && <p className="band">{error}</p>}
      {url && <img src={url} alt="書き出した画像" className="result-img" />}
      {url && savable && (
        <p className="e1" style={{ padding: 0 }}>
          {/* 長押しはスマホの作法。PC では右クリック */}
          {desk ? '↑ 画像を右クリックして保存することもできます' : '↑ 画像を長押しして「写真に保存」'}
          {inFrame() && '（この画面は枠の中で動いているため、これが唯一の保存方法です）'}
        </p>
      )}
      {url && !savable && (
        <p className="band">
          この画像は大きすぎて、長押しでは保存できません。
          {inFrame()
            ? 'この画面は枠の中で動いているため、ほかの保存方法も使えません。書き出しの大きさを下げるか、アプリを直接開いてください。'
            : '下のボタンから保存してください。'}
        </p>
      )}
      {outcome && <p className={outcome.ok ? 'e1' : 'band'}>{outcome.detail}</p>}
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
    </Sheet>
  );
}
