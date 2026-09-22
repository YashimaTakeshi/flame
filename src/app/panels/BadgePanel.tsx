/**
 * 刻印。仕上がり（PROVIA / ビビッド …）を帯の中にどう置くか。
 * 見せ方・位置・大きさ・枠の4本のホイール。キャプションの揃えや大きさとは独立。
 * 余白なし（重ね）には帯が無いので、列ごと止める。
 */
import type { BadgeMode, BadgeSize } from '../../core/badge';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Wheel, type WheelOption } from '../ui/Wheel';
import { ALIGN_OPTIONS, BORDER_OPTIONS } from './constants';

const MODE_OPTIONS: readonly WheelOption<BadgeMode>[] = [
  { value: 'none', label: 'なし' },
  { value: 'text', label: '文字' },
  { value: 'logo', label: 'ロゴ' },
];

const SIZE_OPTIONS: readonly WheelOption<BadgeSize>[] = [
  { value: 'S', label: '小' },
  { value: 'M', label: '中' },
  { value: 'L', label: '大' },
];

export function BadgePanel(): React.ReactElement {
  const mode = useDoc((s) => s.badge);
  const align = useDoc((s) => s.badgeAlign);
  const size = useDoc((s) => s.badgeSize);
  const framed = useDoc((s) => s.badgeFramed);
  const bleed = useDoc((s) => s.style.margin === 'none');
  const set = useDoc((s) => s.set);
  const setHint = useUi((s) => s.setHint);
  const off = bleed || mode === 'none';
  const noBand = (): void => setHint('余白なしでは刻印を置けません');

  return (
    <div className="wheels">
      <Wheel caption="刻印" label="刻印の見せ方" options={MODE_OPTIONS} value={mode} onChange={(v) => set('badge', v)} disabled={bleed} onDisabledPick={noBand} />
      <Wheel caption="位置" label="刻印の位置" options={ALIGN_OPTIONS} value={align} onChange={(v) => set('badgeAlign', v)} disabled={off} onDisabledPick={noBand} />
      <Wheel caption="大きさ" label="刻印の大きさ" options={SIZE_OPTIONS} value={size} onChange={(v) => set('badgeSize', v)} disabled={off} onDisabledPick={noBand} />
      <Wheel
        caption="枠"
        label="刻印の枠線"
        options={BORDER_OPTIONS}
        value={framed ? 'on' : 'off'}
        onChange={(v) => set('badgeFramed', v === 'on')}
        disabled={off}
        onDisabledPick={noBand}
      />
    </div>
  );
}
