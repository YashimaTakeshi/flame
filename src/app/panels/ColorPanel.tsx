/**
 * 地色と枠線。
 *
 * 色は**横スクロールさせない**。9色を2段に並べて全部見せる。
 * 端で丸や名前が切れていると、それは「まだ続く」ではなく「壊れている」に見える。
 *
 * 一つ一つに名前を添えるのはやめ、**選んでいる色の名前だけ**を1行で出す。
 * White / Warm White / Ivory は並べても見分けがつかないので名前は要るが、
 * 要るのは「いま選んでいるものが何か」であって、9個ぶんの札ではない。
 */
import { cssColor } from '../../core/scene/ops';
import { useDoc } from '../state/doc';
import { Segmented } from '../ui/Segmented';
import { COLORS } from './constants';

const BORDERS = [
  { value: 'off', label: '枠なし' },
  { value: 'on', label: '枠あり' },
] as const;

export function ColorPanel(): React.ReactElement {
  const colorKey = useDoc((s) => s.colorKey);
  const bordered = useDoc((s) => s.bordered);
  const set = useDoc((s) => s.set);
  const current = COLORS.find((c) => c.key === colorKey);

  return (
    <div className="p-color">
      <div className="p-color__grid" role="radiogroup" aria-label="地色">
        {COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={colorKey === c.key}
            aria-label={c.label}
            className="sw"
            onClick={() => set('colorKey', c.key)}
          >
            <span className="sw__dot" style={{ background: cssColor(c.value) }} />
          </button>
        ))}
      </div>
      <div className="p-color__foot">
        <p className="picked">{current?.label ?? ''}</p>
        <Segmented
          label="写真の枠線"
          options={BORDERS}
          value={bordered ? 'on' : 'off'}
          onChange={(v) => set('bordered', v === 'on')}
        />
      </div>
    </div>
  );
}
