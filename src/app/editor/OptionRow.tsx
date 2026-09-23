import { useUi } from '../state/ui';
import { BadgePanel } from '../panels/BadgePanel';
import { FontPanel } from '../panels/FontPanel';
import { FramePanel } from '../panels/FramePanel';
import { InfoPanel } from '../panels/InfoPanel';
import { TextPanel } from '../panels/TextPanel';

export function OptionRow(): React.ReactElement {
  const tab = useUi((s) => s.tab);

  return (
    <div className="optrow">
      {tab === 'frame' && <FramePanel />}
      {tab === 'text' && <TextPanel />}
      {tab === 'font' && <FontPanel />}
      {tab === 'badge' && <BadgePanel />}
      {tab === 'info' && <InfoPanel />}
    </div>
  );
}
