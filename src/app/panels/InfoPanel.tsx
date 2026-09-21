/** 情報。キャプションに載せる項目の取捨と、編集への入口 */
import type { FieldId } from '../../core/styles/types';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';

const FIELDS: { id: FieldId; label: string }[] = [
  { id: 'title', label: 'タイトル' },
  { id: 'artist', label: '作者' },
  { id: 'date', label: '日付' },
  { id: 'camera', label: 'カメラ' },
  { id: 'lens', label: 'レンズ' },
  { id: 'focalLength', label: '焦点距離' },
  { id: 'exposure', label: '露出' },
];

export function InfoPanel(): React.ReactElement {
  const fields = useDoc((s) => s.fields);
  const toggleField = useDoc((s) => s.toggleField);
  const reset = useDoc((s) => s.reset);
  const openSheet = useUi((s) => s.openSheet);

  return (
    <div className="p-info">
      <div className="hscroll" aria-label="キャプションに載せる項目">
        {FIELDS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="tg"
            aria-pressed={fields[f.id]}
            onClick={() => toggleField(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="p-info__acts">
        <button type="button" className="btn--s" onClick={reset}>
          初期値に戻す
        </button>
        <button type="button" className="btn--s" onClick={() => openSheet('info')}>
          編集…
        </button>
      </div>
    </div>
  );
}
