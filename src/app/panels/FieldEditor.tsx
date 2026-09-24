/**
 * 情報の1項目の中身を、その場で直接入力する欄（依頼者の提案。以前は別の画面を開いていた）。
 *
 *   タイトル・作者 …… 文字の欄
 *   カメラ・レンズ …… 文字の欄。空なら写真の値を見本の字で見せ、そのまま載る（打てば上書き）
 *   日付 ……………… 日付の欄。初めは写真の日付。消すと写真の日付に戻る
 *   仕上がり ………… 候補から選ぶ（刻印タブと同じ部品）
 *   露出・焦点距離 … 写真の値だけ（打てない）
 */
import type { FieldId } from '../../core/styles/types';
import { parseWallClock, toDateInput } from '../../core/wallclock';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { FilmSelect } from './FilmSelect';

export function FieldEditor({ id }: { id: FieldId }): React.ReactElement {
  const title = useDoc((s) => s.title);
  const artist = useDoc((s) => s.artist);
  const overrides = useDoc((s) => s.overrides);
  const set = useDoc((s) => s.set);
  const setOverride = useDoc((s) => s.setOverride);
  const photo = useUi((s) => s.photoFacts);
  const photoDate = useUi((s) => s.photoDate);

  switch (id) {
    case 'title':
    case 'artist':
      return (
        <input
          className="pinput"
          data-field={id}
          aria-label={id === 'title' ? 'タイトル' : '作者'}
          value={id === 'title' ? title : artist}
          placeholder="未入力"
          enterKeyHint="done"
          onChange={(e) => set(id, e.target.value)}
        />
      );
    case 'camera':
    case 'lens':
      return (
        <input
          className="pinput"
          data-field={id}
          aria-label={id === 'camera' ? 'カメラ' : 'レンズ'}
          value={overrides[id] ?? ''}
          placeholder={photo[id] ?? '記録なし'}
          enterKeyHint="done"
          onChange={(e) => setOverride(id, e.target.value.trim() === '' ? null : e.target.value)}
        />
      );
    case 'date': {
      const shown = overrides.date ?? photoDate;
      return (
        <input
          className="pinput"
          type="date"
          data-field="date"
          aria-label="日付"
          value={shown ? toDateInput(shown) : ''}
          onChange={(e) => {
            const wc = e.target.value ? parseWallClock(e.target.value) : null;
            // 写真の日付と同じなら手入力にしない（写真の値のまま）
            const same =
              wc && photoDate && wc.y === photoDate.y && wc.m === photoDate.m && wc.d === photoDate.d;
            setOverride('date', same ? null : wc);
          }}
        />
      );
    }
    case 'film':
      return <FilmSelect />;
    default:
      return (
        <span className="irow__val" data-empty={photo[id] ? undefined : true}>
          {photo[id] ?? '記録なし'}
        </span>
      );
  }
}
