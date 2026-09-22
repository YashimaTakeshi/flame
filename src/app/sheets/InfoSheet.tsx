/** 作品の情報と、写真に無かった撮影情報の手入力 */
import { useState } from 'react';
import {
  DATE_FORMATS,
  formatWallClock,
  parseWallClock,
  toDateInput,
  type DateFormatId,
  type WallClock,
} from '../../core/wallclock';
import { useDoc } from '../state/doc';
import type { ExifFacts } from '../exif';
import { FILM_SUGGESTIONS } from '../fuji';
import { Sheet } from '../ui/Sheet';

/** select の「その他」。候補の名前と衝突しない値 */
const CUSTOM = '__custom__';
/** 書き方の見本に使う日。写真の日付があればそちらを見本にする */
const SAMPLE: WallClock = { y: 2026, m: 9, d: 20, hh: 17, mm: 42, ss: 11 };
const asFormat = (v: string): DateFormatId => DATE_FORMATS.find((f) => f === v) ?? 'dots';

export function InfoSheet({ exif, onClose }: { exif: ExifFacts; onClose: () => void }): React.ReactElement {
  const doc = useDoc();
  const [title, setTitle] = useState(doc.title);
  const [artist, setArtist] = useState(doc.artist);
  const [camera, setCamera] = useState(doc.overrides.camera ?? '');
  const [lens, setLens] = useState(doc.overrides.lens ?? '');
  const [date, setDate] = useState(doc.overrides.date ? toDateInput(doc.overrides.date) : '');
  const [dateFormat, setDateFormat] = useState<DateFormatId>(doc.dateFormat);
  const [film, setFilm] = useState(doc.overrides.film ?? '');
  // 候補に無い名前（他社の呼び名など）は「その他」を選んで手で入れる
  const [customFilm, setCustomFilm] = useState(film !== '' && !FILM_SUGGESTIONS.includes(film));

  // 手で入れた日付は時刻を持たない（0時）。書き方の見本もこの日で出す
  const typed = date ? parseWallClock(date) : null;
  const sample = typed ?? exif.dateTaken ?? SAMPLE;

  const confirm = (): void => {
    doc.set('title', title);
    doc.set('artist', artist);
    doc.setOverride('camera', camera.trim() || null);
    doc.setOverride('lens', lens.trim() || null);
    doc.setOverride('date', typed);
    doc.set('dateFormat', dateFormat);
    doc.setOverride('film', film.trim() || null);
    onClose();
  };

  return (
    <Sheet title="情報を編集" size="tall" onClose={onClose} onConfirm={confirm}>
      <p className="sheet__label">作品の情報</p>
      <div className="card">
        <label className="card__row">
          <span>タイトル</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル（省略できます）" />
        </label>
        <label className="card__row">
          <span>作者</span>
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="名前（省略できます）"
          />
        </label>
      </div>

      <p className="sheet__label">撮影の情報</p>
      <div className="card">
        <label className="card__row">
          <span>カメラ</span>
          <input
            value={camera}
            onChange={(e) => setCamera(e.target.value)}
            placeholder={exif.camera ?? 'カメラ名（写真に記録なし）'}
          />
        </label>
        <label className="card__row">
          <span>レンズ</span>
          <input
            value={lens}
            onChange={(e) => setLens(e.target.value)}
            placeholder={exif.lens ?? 'レンズ名（写真に記録なし）'}
          />
        </label>
        <label className={`card__row${customFilm ? ' card__row--stack' : ''}`}>
          <span>仕上がり</span>
          <select
            aria-label="仕上がり"
            value={customFilm ? CUSTOM : film}
            onChange={(e) => {
              const v = e.target.value;
              if (v === CUSTOM) {
                setCustomFilm(true);
                setFilm('');
              } else {
                setCustomFilm(false);
                setFilm(v);
              }
            }}
          >
            <option value="">{exif.film ? `${exif.film}（写真の値）` : '（なし）'}</option>
            {FILM_SUGGESTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
            <option value={CUSTOM}>その他（手で入れる）</option>
          </select>
          {customFilm && (
            <input
              value={film}
              autoFocus
              autoCapitalize="characters"
              onChange={(e) => setFilm(e.target.value)}
              placeholder="ピクチャーコントロール名など"
            />
          )}
        </label>
        <label className="card__row">
          <span>日付</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="card__row">
          <span>書き方</span>
          {/* 選択肢は見本そのもの。「dots」のような名前で選ばせない */}
          <select aria-label="日付の書き方" value={dateFormat} onChange={(e) => setDateFormat(asFormat(e.target.value))}>
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {formatWallClock(sample, f)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="e1" style={{ padding: 0 }}>
        ここに入れた内容は、写真に記録された値より優先されます。空欄なら写真の値を使います。
      </p>
    </Sheet>
  );
}
