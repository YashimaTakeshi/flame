/**
 * スタイル。比率を選んでから型を選ぶ2段構成。
 * 15個を一列に並べると親指での探索が長くなるので、比率で6つに畳む。
 */
import { Segmented } from '../ui/Segmented';
import { useUi } from '../state/ui';

const RATIOS = [
  { value: 'OR', label: '元比' },
  { value: 'SQ', label: '1:1', disabled: true },
  { value: 'TF', label: '3:4', disabled: true },
  { value: 'FF', label: '4:5', disabled: true },
  { value: 'NST', label: '9:16', disabled: true },
  { value: 'STN', label: '16:9', disabled: true },
] as const;

export function StylePanel(): React.ReactElement {
  const setHint = useUi((s) => s.setHint);

  return (
    <div className="p-style">
      <Segmented
        label="キャンバスの比率"
        options={RATIOS}
        value="OR"
        onChange={() => {}}
        onDisabledTap={() => setHint('いまは「元比」だけ使えます')}
      />
      <div className="p-style__types">
        <button type="button" className="stylechip" role="radio" aria-checked aria-label="元比・1行">
          <span className="stylechip__fig" aria-hidden="true">
            <i />
          </span>
          OR1
        </button>
        <p className="e1" style={{ padding: 0 }}>
          いまは「元比」だけ使えます
        </p>
      </div>
    </div>
  );
}
