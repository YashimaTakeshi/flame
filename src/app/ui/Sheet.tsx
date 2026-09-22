/**
 * 下から出る面。
 *
 * 閉じ方を必ず2つ持たせる（✕ と 背後をタップ）。行き止まりを作らないため。
 * ソフトキーボードが出たときに入力欄と確定ボタンが隠れないよう、
 * visualViewport の高さに追従する。
 */
import { useEffect } from 'react';

export function Sheet({
  title,
  size = 'auto',
  onClose,
  onConfirm,
  confirmLabel = '✓',
  bodyClass,
  fill = false,
  children,
}: {
  title: string;
  size?: 'auto' | 'tall' | 'full';
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  /** 中身の組み方を替える（書き出しの「画像を残りの高さに収める」など） */
  bodyClass?: string;
  /** PC でも高さを決める（中身が残りの高さに合わせて伸び縮みする面）。既定は中身の高さ */
  fill?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  // 背後の画面がスクロールしないようにする
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <button className="scrim" aria-label="閉じる" onClick={onClose} />
      <section className="sheet" data-size={size} data-fill={fill || undefined} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet__hdr">
          <button type="button" onClick={onClose} aria-label="やめる">
            ✕
          </button>
          <span>{title}</span>
          {onConfirm ? (
            <button type="button" onClick={onConfirm} aria-label="決める">
              {confirmLabel}
            </button>
          ) : (
            <span />
          )}
        </header>
        <div className={bodyClass ? `sheet__body ${bodyClass}` : 'sheet__body'}>{children}</div>
      </section>
    </>
  );
}
