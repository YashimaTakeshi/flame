/**
 * 書体。名前を**その書体自身**で描いた行を縦に回す（参考アプリの Font タブと同じ形）。
 * 欧文13書体は起動時に読み込み済み。和文だけ選ばれた瞬間に取りに行き、読めなければ元の書体に戻す。
 */
import { useCallback, useState } from 'react';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { ensureJapaneseFont, JP_FAMILY, LATIN_FONTS, type LatinFontKey } from '../fonts-catalog';
import { Choice } from '../ui/Choice';

type Key = LatinFontKey | 'jp';

const OPTIONS: { value: Key; label: string; style: React.CSSProperties }[] = [
  ...LATIN_FONTS.map((f) => ({
    value: f.key as Key,
    label: f.label,
    style: { fontFamily: `"${f.family}", serif`, fontWeight: f.weight } as React.CSSProperties,
  })),
  { value: 'jp', label: '日本語', style: { fontFamily: `"${JP_FAMILY}", sans-serif` } },
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
      void ensureJapaneseFont()
        .then(() => set('fontKey', 'jp'))
        // 黙ってフォールバックしない。読めなかったことを告げ、書体は変えない（ホイールは元の行へ戻る）
        .catch(() => setHint('和文の書体を読み込めませんでした'))
        .finally(() => setLoading(false));
    },
    [set, setHint],
  );

  return (
    <div className="wheels" aria-busy={loading || undefined}>
      <Choice label="書体" options={OPTIONS} value={fontKey} onChange={pick} wide />
    </div>
  );
}
