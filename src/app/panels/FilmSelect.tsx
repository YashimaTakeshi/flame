/**
 * 仕上がり（フィルムシミュレーション／ピクチャーコントロール等）の選択。刻印タブと情報タブの両方で同じ部品。
 * 選んだ値は手入力の仕上がり（overrides.film）で、刻印にもキャプションにも効く。
 * 候補に無い名前は「その他」で、その場の入力欄に打つ。
 * 選んだ・打ち終えた名前は候補（recent.ts）に覚える。情報タブでは欄の下に候補が出る。
 */
import { useState } from 'react';
import { useDoc } from '../state/doc';
import { useRecent } from '../state/recent';
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
  const record = useRecent((s) => s.record);
  // 候補（情報タブの欄の下）から一覧に無い名前が入ることもある。そのときも入力欄で見せる
  const other = typing || custom;

  return (
    <div className="filmsel">
      <select
        className="pselect"
        aria-label={label}
        data-field="film"
        value={other ? OTHER : (override ?? '')}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER) {
            setTyping(true);
            return;
          }
          setTyping(false);
          setOverride('film', v === '' ? null : v);
          record('film', v);
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
      {other && (
        <input
          className="pinput"
          aria-label={`${label}の名前`}
          autoFocus={typing}
          autoCapitalize="characters"
          value={custom ? override : ''}
          placeholder="ピクチャーコントロール名など"
          onChange={(e) => setOverride('film', e.target.value.trim() === '' ? null : e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur();
          }}
          onBlur={() => record('film', useDoc.getState().overrides.film)}
        />
      )}
    </div>
  );
}
