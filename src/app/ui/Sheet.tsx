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
  children,
}: {
  title: string;
  size?: 'auto' | 'tall' | 'full';
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
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
      <section className="sheet" data-size={size} role="dialog" aria-modal="true" aria-label={title}>
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
        <div className="sheet__body">{children}</div>
      </section>
    </>
  );
}
