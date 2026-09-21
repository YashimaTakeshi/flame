/** 組み。3行×2列。組み方向・整列・字間・文字サイズ・余白 */
import { Segmented } from '../ui/Segmented';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { ALIGN_OPTIONS, MARGIN_OPTIONS, SIZE_OPTIONS, TRACK_OPTIONS } from './constants';

const DIRECTIONS = [
  { value: 'h', label: '横組み' },
  { value: 'v', label: '縦組み', disabled: true },
] as const;

function Cell({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="p-layout__cell">
      <span className="p-layout__lbl">{label}</span>
      {children}
    </div>
  );
}

export function LayoutPanel(): React.ReactElement {
  const align = useDoc((s) => s.align);
  const tracking = useDoc((s) => s.tracking);
  const size = useDoc((s) => s.size);
  const margin = useDoc((s) => s.margin);
  const fontKey = useDoc((s) => s.fontKey);
  const set = useDoc((s) => s.set);
  const setHint = useUi((s) => s.setHint);

  return (
    <div className="p-layout">
      <Cell label="組み方向">
        <Segmented
          label="組み方向"
          options={DIRECTIONS}
          value="h"
          onChange={() => {}}
          onDisabledTap={() =>
            setHint(
              fontKey === 'jp' ? '縦組みはまだ使えません' : '縦組みには和文の書体を選んでください',
            )
          }
        />
      </Cell>
      <Cell label="整列">
        <Segmented label="整列" options={ALIGN_OPTIONS} value={align} onChange={(v) => set('align', v)} />
      </Cell>
      <Cell label="字間">
        <Segmented label="字間" options={TRACK_OPTIONS} value={tracking} onChange={(v) => set('tracking', v)} />
      </Cell>
      <Cell label="文字">
        <Segmented label="文字の大きさ" options={SIZE_OPTIONS} value={size} onChange={(v) => set('size', v)} />
      </Cell>
      <Cell label="余白">
        <Segmented label="余白の広さ" options={MARGIN_OPTIONS} value={margin} onChange={(v) => set('margin', v)} />
      </Cell>
      <span />
    </div>
  );
}
