/**
 * 書体。見本を「その書体自身」で描く。名前だけ並べても選べない。
 * 欧文8書体は起動時に読み込み済みなので待ちは無い。和文だけ押した瞬間に取りに行く。
 */
import { useState } from 'react';
import { useDoc } from '../state/doc';
import { ensureJapaneseFont, LATIN_FONTS } from '../fonts-catalog';

export function FontPanel(): React.ReactElement {
  const fontKey = useDoc((s) => s.fontKey);
  const set = useDoc((s) => s.set);
  const [loadingJa, setLoadingJa] = useState(false);
  const [jaError, setJaError] = useState(false);

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
      <div className="hscroll" role="radiogroup" aria-label="書体">
        {LATIN_FONTS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="radio"
            aria-checked={fontKey === f.key}
            className="fcard"
            style={{ fontFamily: `"${f.family}", serif` }}
            onClick={() => set('fontKey', f.key)}
          >
            <span className="fcard__aa">Aa</span>
            <span className="fcard__name">{f.label}</span>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={fontKey === 'jp'}
          aria-busy={loadingJa}
          className="fcard"
          style={{ fontFamily: '"NotoSansJP", sans-serif' }}
          onClick={() => void pickJapanese()}
        >
          <span className="fcard__aa">{loadingJa ? '…' : 'あА'}</span>
          <span className="fcard__name">日本語</span>
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
