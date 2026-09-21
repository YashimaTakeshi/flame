import { useUi } from '../state/ui';
import { ColorPanel } from '../panels/ColorPanel';
import { FontPanel } from '../panels/FontPanel';
import { InfoPanel } from '../panels/InfoPanel';
import { LayoutPanel } from '../panels/LayoutPanel';
import { PlacePanel } from '../panels/PlacePanel';

export function OptionRow(): React.ReactElement {
  const tab = useUi((s) => s.tab);
  const hint = useUi((s) => s.hint);

  return (
    <div className="optrow">
      {tab === 'place' && <PlacePanel />}
      {tab === 'layout' && <LayoutPanel />}
      {tab === 'color' && <ColorPanel />}
      {tab === 'font' && <FontPanel />}
      {tab === 'info' && <InfoPanel />}
      {hint && <p className="e1 optrow__hint">{hint}</p>}
    </div>
  );
}
