import { useUi } from '../state/ui';
import { BadgePanel } from '../panels/BadgePanel';
import { ColorPanel } from '../panels/ColorPanel';
import { FontPanel } from '../panels/FontPanel';
import { InfoPanel } from '../panels/InfoPanel';
import { LayoutPanel } from '../panels/LayoutPanel';
import { PlacePanel } from '../panels/PlacePanel';

export function OptionRow(): React.ReactElement {
  const tab = useUi((s) => s.tab);

  return (
    <div className="optrow">
      {tab === 'place' && <PlacePanel />}
      {tab === 'layout' && <LayoutPanel />}
      {tab === 'color' && <ColorPanel />}
      {tab === 'font' && <FontPanel />}
      {tab === 'badge' && <BadgePanel />}
      {tab === 'info' && <InfoPanel />}
    </div>
  );
}
