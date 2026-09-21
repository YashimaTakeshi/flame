/**
 * 組み。行数・揃え・字間・大きさ・組み方向。
 * 升の幅は全部同じ（--cell）。項目は左から詰め、入らなければ次の行へ折り返す。
 * 項目が増えても崩れない並べ方にしておく。
 */
import { Segmented } from '../ui/Segmented';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { ALIGN_OPTIONS, DIRECTION_OPTIONS, LINE_OPTIONS, SIZE_OPTIONS, TRACK_OPTIONS } from './constants';

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
  const lines = useDoc((s) => s.style.lines);
  const fontKey = useDoc((s) => s.fontKey);
  const set = useDoc((s) => s.set);
  const setStyle = useDoc((s) => s.setStyle);
  const setHint = useUi((s) => s.setHint);

  return (
    <div className="p-layout">
      <Cell label="行数">
        <Segmented label="行数" options={LINE_OPTIONS} value={lines} onChange={(v) => setStyle({ lines: v })} />
      </Cell>
      <Cell label="揃え">
        <Segmented label="揃え" options={ALIGN_OPTIONS} value={align} onChange={(v) => set('align', v)} />
      </Cell>
      <Cell label="字間">
        <Segmented label="字間" options={TRACK_OPTIONS} value={tracking} onChange={(v) => set('tracking', v)} />
      </Cell>
      <Cell label="文字">
        <Segmented label="文字の大きさ" options={SIZE_OPTIONS} value={size} onChange={(v) => set('size', v)} />
      </Cell>
      <Cell label="方向">
        {/* 縦組みはまだ無い。押されたときだけ、和文の書体が要ることを短く伝える */}
        <Segmented
          label="組み方向"
          options={DIRECTION_OPTIONS}
          value="h"
          onChange={() => {}}
          onDisabledTap={() => setHint(fontKey === 'jp' ? '縦組みはまだ使えません' : '縦組みには和文の書体を選んでください')}
        />
      </Cell>
    </div>
  );
}
