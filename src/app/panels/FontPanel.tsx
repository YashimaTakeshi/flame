/**
 * 書体。**字の形そのもの**を並べて選ぶ（名前の一覧ではなく、見本の「Aa」）。
 * 欧文13書体は起動時に読み込み済み。和文だけ選ばれた瞬間に取りに行き、読めなければ元の書体のまま。
 */
import { useCallback, useState } from 'react';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { ensureJapaneseFont, JP_FAMILY, LATIN_FONTS, type LatinFontKey } from '../fonts-catalog';

type Key = LatinFontKey | 'jp';

const CARDS: { key: Key; label: string; sample: string; style: React.CSSProperties }[] = [
  ...LATIN_FONTS.map((f) => ({
    key: f.key as Key,
    label: f.label,
    sample: 'Aa',
    style: { fontFamily: `"${f.family}", serif`, fontWeight: f.weight } as React.CSSProperties,
  })),
  { key: 'jp', label: '日本語', sample: 'あア', style: { fontFamily: `"${JP_FAMILY}", sans-serif` } },
];

export function FontPanel(): React.ReactElement {
  const fontKey = useDoc((s) => s.fontKey);
  const set = useDoc((s) => s.set);
  const setHint = useUi((s) => s.setHint);
  const [loading, setLoading] = useState(false);

  const pick = useCallback(
    (key: Key): void => {
      if (key !== 'jp') {
        set('fontKey', key);
        return;
      }
      setLoading(true);
      setHint('日本語の書体を読み込んでいます');
      void ensureJapaneseFont()
        .then(() => {
          set('fontKey', 'jp');
          setHint(null);
        })
        // 黙ってフォールバックしない。読めなかったことを告げ、書体は変えない
        .catch(() => setHint('和文の書体を読み込めませんでした'))
        .finally(() => setLoading(false));
    },
    [set, setHint],
  );

  return (
    <div className="pnl">
      <div className="fonts" role="radiogroup" aria-label="書体" aria-busy={loading || undefined}>
        {CARDS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            className="fontcard"
            aria-checked={fontKey === c.key}
            aria-label={c.label}
            title={c.label}
            data-busy={(loading && c.key === 'jp') || undefined}
            onClick={() => fontKey !== c.key && pick(c.key)}
          >
            <b style={c.style}>{c.sample}</b>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
