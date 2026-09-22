/**
 * 刻印。仕上がり（PROVIA / ビビッド …）を帯の中にどう置くか。
 * 文字と同じ数の軸: どの辺（上下左右）・横（左中右）・縦（上中下）。それに見せ方・大きさ・枠。
 * キャプションの設定とは独立。余白なし（重ね）には帯が無いので、列ごと止める。
 */
import type { BadgeMode, BadgeSize } from '../../core/badge';
import type { BandSide } from '../../core/styles/layout';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Wheel, type WheelOption } from '../ui/Wheel';
import { ALIGN_OPTIONS, BORDER_OPTIONS, CAPTION_ALIGN_OPTIONS } from './constants';

const MODE_OPTIONS: readonly WheelOption<BadgeMode>[] = [
  { value: 'none', label: 'なし' },
  { value: 'text', label: '文字' },
  { value: 'logo', label: 'ロゴ' },
];

/** 文字の「上下左右」と同じ並び。重ねは無い（帯が無い） */
const PLACE_OPTIONS: readonly WheelOption<BandSide>[] = [
  { value: 'above', label: '上' },
  { value: 'below', label: '下' },
  { value: 'left', label: '左' },
  { value: 'right', label: '右' },
];

const SIZE_OPTIONS: readonly WheelOption<BadgeSize>[] = [
  { value: 'S', label: '小' },
  { value: 'M', label: '中' },
  { value: 'L', label: '大' },
];

export function BadgePanel(): React.ReactElement {
  const mode = useDoc((s) => s.badge);
  const place = useDoc((s) => s.badgePlace);
  const align = useDoc((s) => s.badgeAlign);
  const valign = useDoc((s) => s.badgeValign);
  const size = useDoc((s) => s.badgeSize);
  const framed = useDoc((s) => s.badgeFramed);
  const bleed = useDoc((s) => s.style.margin === 'none');
  const set = useDoc((s) => s.set);
  const setHint = useUi((s) => s.setHint);
  const off = bleed || mode === 'none';
  const why = (): void => setHint(bleed ? '余白なしでは刻印を置けません' : '刻印を「文字」か「ロゴ」にしてください');

  return (
    <div className="wheels">
      <Wheel caption="刻印" label="刻印の見せ方" options={MODE_OPTIONS} value={mode} onChange={(v) => set('badge', v)} disabled={bleed} onDisabledPick={why} />
      <Wheel caption="辺" label="刻印を置く辺" options={PLACE_OPTIONS} value={place} onChange={(v) => set('badgePlace', v)} disabled={off} onDisabledPick={why} />
      <Wheel caption="横" label="刻印の左右" options={ALIGN_OPTIONS} value={align} onChange={(v) => set('badgeAlign', v)} disabled={off} onDisabledPick={why} />
      <Wheel caption="縦" label="刻印の上下" options={CAPTION_ALIGN_OPTIONS} value={valign} onChange={(v) => set('badgeValign', v)} disabled={off} onDisabledPick={why} />
      <Wheel caption="大" label="刻印の大きさ" options={SIZE_OPTIONS} value={size} onChange={(v) => set('badgeSize', v)} disabled={off} onDisabledPick={why} />
      <Wheel
        caption="枠"
        label="刻印の枠線"
        options={BORDER_OPTIONS}
        value={framed ? 'on' : 'off'}
        onChange={(v) => set('badgeFramed', v === 'on')}
        disabled={off}
        onDisabledPick={why}
      />
    </div>
  );
}
