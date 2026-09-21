import { useUi } from '../state/ui';
import { ColorPanel } from '../panels/ColorPanel';
import { FontPanel } from '../panels/FontPanel';
import { InfoPanel } from '../panels/InfoPanel';
import { LayoutPanel } from '../panels/LayoutPanel';
import { StylePanel } from '../panels/StylePanel';

export function OptionRow(): React.ReactElement {
  const tab = useUi((s) => s.tab);
  const hint = useUi((s) => s.hint);

  return (
    <div className="optrow">
      {tab === 'style' && <StylePanel />}
      {tab === 'layout' && <LayoutPanel />}
      {tab === 'color' && <ColorPanel />}
      {tab === 'font' && <FontPanel />}
      {tab === 'info' && <InfoPanel />}
      {hint && tab !== 'style' && <p className="e1">{hint}</p>}
    </div>
  );
}
