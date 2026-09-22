/**
 * 情報。キャプションに載せる項目のオン／オフを縦の一覧で。右に編集と初期値の印。
 * 選ぶのではなく切り替えるので、ホイールではなく一覧にする。行の高さはホイールと同じ。
 */
import type { FieldId } from '../../core/styles/types';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { IconEdit, IconReset } from '../ui/icons';

const FIELDS: { id: FieldId; label: string }[] = [
  { id: 'title', label: 'タイトル' },
  { id: 'artist', label: '作者' },
  { id: 'date', label: '日付' },
  { id: 'camera', label: 'カメラ' },
  { id: 'lens', label: 'レンズ' },
  { id: 'film', label: 'フィルム' },
  { id: 'focalLength', label: '焦点距離' },
  { id: 'exposure', label: '露出' },
];

export function InfoPanel(): React.ReactElement {
  const fields = useDoc((s) => s.fields);
  const toggleField = useDoc((s) => s.toggleField);
  const badge = useDoc((s) => s.badge);
  const setDoc = useDoc((s) => s.set);
  const reset = useDoc((s) => s.reset);
  const openSheet = useUi((s) => s.openSheet);

  return (
    <div className="p-info">
      <div className="checklist" role="group" aria-label="キャプションに載せる項目">
        {FIELDS.map((f) => (
          <button key={f.id} type="button" className="check" aria-pressed={fields[f.id]} onClick={() => toggleField(f.id)}>
            <span>{f.label}</span>
            <span className="check__mark" aria-hidden="true">
              {fields[f.id] ? '✓' : ''}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="check check--sep"
          aria-pressed={badge}
          title="フィルム名を写真の右下に刻む"
          onClick={() => setDoc('badge', !badge)}
        >
          <span>右下にフィルム名を刻む</span>
          <span className="check__mark" aria-hidden="true">
            {badge ? '✓' : ''}
          </span>
        </button>
      </div>
      <div className="p-info__acts">
        <button type="button" className="iconbtn iconbtn--ghost" aria-label="編集" title="編集" onClick={() => openSheet('info')}>
          <IconEdit />
        </button>
        <button type="button" className="iconbtn iconbtn--ghost" aria-label="初期値に戻す" title="初期値に戻す" onClick={reset}>
          <IconReset />
        </button>
      </div>
    </div>
  );
}
