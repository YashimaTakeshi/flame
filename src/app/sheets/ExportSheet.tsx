/**
 * 書き出しと保存。
 *
 * **保存は利用者の操作から同期的に呼ぶ。** 書き出しを待ってから呼ぶと、
 * iOS は「利用者の操作から始まった処理」とみなさず共有を拒む。
 * だからシートを開いた時点で書き出しを終わらせ、ボタンの押下では待たずに渡す。
 */
import { useEffect, useState } from 'react';
import { inFrame, makeFilename, saveCapabilities, saveImage, type SaveOutcome } from '../../platform/save';
import { Sheet } from '../ui/Sheet';

export function ExportSheet({
  render,
  onClose,
}: {
  render: () => Promise<Blob>;
  onClose: () => void;
}): React.ReactElement {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const caps = saveCapabilities();

  useEffect(() => {
    let alive = true;
    render()
      .then((b) => {
        if (!alive) return;
        setBlob(b);
        setUrl(URL.createObjectURL(b));
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : '書き出せませんでした');
      });
    return () => {
      alive = false;
    };
  }, [render]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  // ここで await を挟まない。挟むと iOS が共有を拒む
  const save = (): void => {
    if (!blob) return;
    void saveImage(blob, makeFilename()).then(setOutcome);
  };

  const mainLabel = caps.canShareFiles ? '写真に保存 / 共有' : 'ダウンロード';

  return (
    <Sheet title={blob ? '書き出しました' : '書き出し中…'} size="auto" onClose={onClose}>
      {error && <p className="band">{error}</p>}
      {url && <img src={url} alt="書き出した画像" className="result-img" />}
      {url && (
        <p className="e1" style={{ padding: 0 }}>
          ↑ 長押しでも保存できます
          {inFrame() && '（この画面は枠の中で動いているため、これが唯一の保存方法です）'}
        </p>
      )}
      {outcome && <p className={outcome.ok ? 'e1' : 'band'}>{outcome.detail}</p>}
      {blob && !inFrame() && (
        <button type="button" className="btn" onClick={save}>
          {mainLabel}
        </button>
      )}
      <button type="button" className="btn btn--sec" onClick={onClose}>
        続けて編集する
      </button>
    </Sheet>
  );
}
