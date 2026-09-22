/**
 * 情報。キャプションに載せる項目のオン／オフを縦の一覧で、仕上がりの刻印をホイールで。
 * 右に編集と初期値の印。項目は選ぶのではなく切り替えるので一覧にする。行の高さはホイールと同じ。
 */
import type { BadgeMode } from '../../core/badge';
import type { FieldId } from '../../core/styles/types';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { IconEdit, IconReset } from '../ui/icons';
import { Wheel, type WheelOption } from '../ui/Wheel';

const FIELDS: { id: FieldId; label: string }[] = [
  { id: 'title', label: 'タイトル' },
  { id: 'artist', label: '作者' },
  { id: 'date', label: '日付' },
  { id: 'camera', label: 'カメラ' },
  { id: 'lens', label: 'レンズ' },
  { id: 'film', label: '仕上がり' },
  { id: 'focalLength', label: '焦点距離' },
  { id: 'exposure', label: '露出' },
];

/** 刻印の見せ方。名前が分からない写真では何も出ない */
const BADGE_OPTIONS: readonly WheelOption<BadgeMode>[] = [
  { value: 'none', label: 'なし' },
  { value: 'text', label: '文字' },
  { value: 'logo', label: 'ロゴ' },
];

export function InfoPanel(): React.ReactElement {
  const fields = useDoc((s) => s.fields);
  const toggleField = useDoc((s) => s.toggleField);
  const badge = useDoc((s) => s.badge);
  const bleed = useDoc((s) => s.style.margin === 'none');
  const setDoc = useDoc((s) => s.set);
  const reset = useDoc((s) => s.reset);
  const openSheet = useUi((s) => s.openSheet);
  const setHint = useUi((s) => s.setHint);

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
      </div>
      <Wheel
        caption="刻印"
        label="仕上がりの刻印"
        options={BADGE_OPTIONS}
        value={badge}
        onChange={(v) => setDoc('badge', v)}
        disabled={bleed}
        onDisabledPick={() => setHint('余白なしでは刻印を置けません')}
      />
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
