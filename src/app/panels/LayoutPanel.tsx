/** 組み。2行×2列。組み方向・整列・字間・文字サイズ */
import { Segmented } from '../ui/Segmented';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { ALIGN_OPTIONS, SIZE_OPTIONS, TRACK_OPTIONS } from './constants';

const DIRECTIONS = [
  { value: 'h', label: '横組み' },
  { value: 'v', label: '縦組み', disabled: true },
] as const;

export function LayoutPanel(): React.ReactElement {
  const align = useDoc((s) => s.align);
  const tracking = useDoc((s) => s.tracking);
  const size = useDoc((s) => s.size);
  const fontKey = useDoc((s) => s.fontKey);
  const set = useDoc((s) => s.set);
  const setHint = useUi((s) => s.setHint);

  return (
    <div className="p-layout">
      <div className="p-layout__cell">
        <span className="p-layout__lbl">組み方向</span>
        <Segmented
          label="組み方向"
          options={DIRECTIONS}
          value="h"
          onChange={() => {}}
          onDisabledTap={() =>
            setHint(
              fontKey === 'jp'
                ? '縦組みはまだ使えません'
                : '縦組みには和文の書体を選んでください',
            )
          }
        />
      </div>
      <div className="p-layout__cell">
        <span className="p-layout__lbl">整列</span>
        <Segmented
          label="整列"
          options={ALIGN_OPTIONS}
          value={align}
          onChange={(v) => set('align', v)}
        />
      </div>
      <div className="p-layout__cell">
        <span className="p-layout__lbl">字間</span>
        <Segmented
          label="字間"
          options={TRACK_OPTIONS}
          value={tracking}
          onChange={(v) => set('tracking', v)}
        />
      </div>
      <div className="p-layout__cell">
        <span className="p-layout__lbl">文字</span>
        <Segmented
          label="文字の大きさ"
          options={SIZE_OPTIONS}
          value={size}
          onChange={(v) => set('size', v)}
        />
      </div>
    </div>
  );
}
