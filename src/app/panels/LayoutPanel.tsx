/** 組み。行数・揃え・字間・大きさ・組み方向の5本のホイール */
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Choice } from '../ui/Choice';
import { ALIGN_OPTIONS, DIRECTION_OPTIONS, LINE_OPTIONS, SIZE_OPTIONS, TRACK_OPTIONS } from './constants';

export function LayoutPanel(): React.ReactElement {
  const align = useDoc((s) => s.align);
  const tracking = useDoc((s) => s.tracking);
  const size = useDoc((s) => s.size);
  const lines = useDoc((s) => s.style.lines);
  const fontKey = useDoc((s) => s.fontKey);
  const set = useDoc((s) => s.set);
  const setStyle = useDoc((s) => s.setStyle);
  const setHint = useUi((s) => s.setHint);

  return (
    <div className="wheels">
      <Choice caption="行数" label="行数" options={LINE_OPTIONS} value={lines} onChange={(v) => setStyle({ lines: v })} />
      <Choice caption="揃え" label="揃え" options={ALIGN_OPTIONS} value={align} onChange={(v) => set('align', v)} />
      <Choice caption="字間" label="字間" options={TRACK_OPTIONS} value={tracking} onChange={(v) => set('tracking', v)} />
      <Choice caption="文字" label="文字の大きさ" options={SIZE_OPTIONS} value={size} onChange={(v) => set('size', v)} />
      <Choice
        caption="方向"
        label="組み方向"
        options={DIRECTION_OPTIONS}
        value="h"
        onChange={() => {}}
        onDisabledPick={() => setHint(fontKey === 'jp' ? '縦組みはまだ使えません' : '縦組みには和文の書体を選んでください')}
      />
    </div>
  );
}
