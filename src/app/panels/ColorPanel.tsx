/**
 * 地色と枠線。色は見本の丸と名前を1行にして縦に回す（参考アプリの Color タブと同じ形）。
 * 余白が「なし」（全面）のときは地が見えないので、色の列ごと押せなくする。枠線は効くので残す。
 */
import { cssColor } from '../../core/scene/ops';
import { useDoc } from '../state/doc';
import { Choice } from '../ui/Choice';
import { BORDER_OPTIONS, COLORS } from './constants';

const COLOR_OPTIONS = COLORS.map((c) => ({
  value: c.key,
  label: c.label,
  node: (
    <span className="swatchrow">
      <span className="swatchrow__dot" style={{ background: cssColor(c.value) }} />
      <span className="swatchrow__name">{c.label}</span>
    </span>
  ),
}));

export function ColorPanel(): React.ReactElement {
  const colorKey = useDoc((s) => s.colorKey);
  const bordered = useDoc((s) => s.bordered);
  const bleed = useDoc((s) => s.style.margin === 'none');
  const set = useDoc((s) => s.set);

  return (
    <div className="wheels">
      <Choice caption="地色" label="地色" options={COLOR_OPTIONS} value={colorKey} onChange={(v) => set('colorKey', v)} disabled={bleed} wide />
      <Choice caption="枠線" label="写真の枠線" options={BORDER_OPTIONS} value={bordered ? 'on' : 'off'} onChange={(v) => set('bordered', v === 'on')} />
    </div>
  );
}
