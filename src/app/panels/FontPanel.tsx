/**
 * 書体。見本を「その書体自身」で描く。名前だけ並べても選べない。
 *
 * Bold は「太字にする設定」ではなく独立した書体として並べる（参考アプリと同じ）。
 * 3列×3行の升目で14書体を出す。横スクロールにすると端で切れて見える。
 */
import { useState } from 'react';
import { useDoc } from '../state/doc';
import { ensureJapaneseFont, LATIN_FONTS } from '../fonts-catalog';

export function FontPanel(): React.ReactElement {
  const fontKey = useDoc((s) => s.fontKey);
  const set = useDoc((s) => s.set);
  const [loadingJa, setLoadingJa] = useState(false);
  const [jaError, setJaError] = useState(false);

  const pickedLabel =
    fontKey === 'jp'
      ? '日本語 — Noto Sans JP'
      : (LATIN_FONTS.find((f) => f.key === fontKey)?.label ?? '');

  const pickJapanese = async (): Promise<void> => {
    setJaError(false);
    setLoadingJa(true);
    try {
      await ensureJapaneseFont();
      set('fontKey', 'jp');
    } catch {
      // 黙ってフォールバックしない。読めなかったことを告げ、書体は変えない
      setJaError(true);
    } finally {
      setLoadingJa(false);
    }
  };

  return (
    <div className="p-font">
      <p className="picked">{pickedLabel}</p>
      <div className="p-font__grid" role="radiogroup" aria-label="書体">
        {LATIN_FONTS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="radio"
            aria-checked={fontKey === f.key}
            aria-label={f.label}
            className="fcard"
            style={{ fontFamily: `"${f.family}", serif`, fontWeight: f.weight }}
            onClick={() => set('fontKey', f.key)}
          >
            <span className="fcard__aa">Aa</span>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={fontKey === 'jp'}
          aria-busy={loadingJa}
          aria-label="日本語"
          className="fcard"
          style={{ fontFamily: '"NotoSansJP", sans-serif' }}
          onClick={() => void pickJapanese()}
        >
          <span className="fcard__aa">{loadingJa ? '…' : 'あ'}</span>
        </button>
      </div>
      {jaError && (
        <p className="e1">
          書体「Noto Sans JP」を読み込めませんでした{' '}
          <button type="button" className="btn--txt" onClick={() => void pickJapanese()}>
            もう一度読み込む
          </button>
        </p>
      )}
    </div>
  );
}
