/**
 * 仕上がり（フィルムシミュレーション／ピクチャーコントロール等）の選択。刻印タブと情報タブの両方で同じ部品。
 * 選んだ値は手入力の仕上がり（overrides.film）で、刻印にもキャプションにも効く。
 * 候補に無い名前は「その他」で、その場の入力欄に打つ。
 */
import { useState } from 'react';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { FILM_SUGGESTIONS } from '../fuji';

/** select の「その他」。候補の名前と衝突しない値 */
const OTHER = '__other__';

export function FilmSelect({ label = '仕上がり' }: { label?: string }): React.ReactElement {
  const override = useDoc((s) => s.overrides.film);
  const setOverride = useDoc((s) => s.setOverride);
  const photoFilm = useUi((s) => s.photoFilm);
  const custom = override !== null && !FILM_SUGGESTIONS.includes(override);
  const [typing, setTyping] = useState(custom);

  return (
    <div className="filmsel">
      <select
        className="pselect"
        aria-label={label}
        data-field="film"
        value={typing ? OTHER : (override ?? '')}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER) {
            setTyping(true);
            return;
          }
          setTyping(false);
          setOverride('film', v === '' ? null : v);
        }}
      >
        <option value="">{photoFilm ? `${photoFilm}（写真の値）` : '選んでください'}</option>
        {FILM_SUGGESTIONS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
        <option value={OTHER}>その他（手で入れる）</option>
      </select>
      {typing && (
        <input
          className="pinput"
          aria-label={`${label}の名前`}
          autoFocus
          autoCapitalize="characters"
          value={custom ? override : ''}
          placeholder="ピクチャーコントロール名など"
          onChange={(e) => setOverride('film', e.target.value.trim() === '' ? null : e.target.value)}
        />
      )}
    </div>
  );
}
