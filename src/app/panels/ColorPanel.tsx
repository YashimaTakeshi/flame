/**
 * 地色と枠線。
 *
 * 色は横スクロールさせない。9色を5列×2段で全部見せる。
 * 名前は**選んでいる色の1つぶん**だけを出す。
 * 余白が「なし」（全面）のときは地が見えないので、色は押せなくする。枠線は効くので残す。
 */
import { cssColor } from '../../core/scene/ops';
import { useDoc } from '../state/doc';
import { Segmented } from '../ui/Segmented';
import { BORDER_OPTIONS, COLORS } from './constants';

export function ColorPanel(): React.ReactElement {
  const colorKey = useDoc((s) => s.colorKey);
  const bordered = useDoc((s) => s.bordered);
  const bleed = useDoc((s) => s.style.margin === 'none');
  const set = useDoc((s) => s.set);
  const current = COLORS.find((c) => c.key === colorKey);

  return (
    <div className="p-color">
      <div className="p-color__grid" role="radiogroup" aria-label="地色" aria-disabled={bleed || undefined}>
        {COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={colorKey === c.key}
            aria-label={c.label}
            className="sw"
            disabled={bleed}
            onClick={() => set('colorKey', c.key)}
          >
            <span className="sw__dot" style={{ background: cssColor(c.value) }} />
          </button>
        ))}
      </div>
      <div className="p-color__foot">
        <p className="picked">{bleed ? '' : (current?.label ?? '')}</p>
        <Segmented
          label="写真の枠線"
          options={BORDER_OPTIONS}
          value={bordered ? 'on' : 'off'}
          onChange={(v) => set('bordered', v === 'on')}
        />
      </div>
    </div>
  );
}
