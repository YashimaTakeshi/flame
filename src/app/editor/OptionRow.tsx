/**
 * スマホの設定欄。道具（フレーム〜情報）の中の項目を、**選んだ1つずつ**出す（ui/tools.tsx）。
 * 以前は全部の行を縦に積んだ 236px の面で、写真が小さくなりすぎた（依頼者の指摘）。
 */
import { useUi } from '../state/ui';
import { BadgePanel } from '../panels/BadgePanel';
import { FontPanel } from '../panels/FontPanel';
import { FramePanel } from '../panels/FramePanel';
import { InfoPanel } from '../panels/InfoPanel';
import { TextPanel } from '../panels/TextPanel';
import { ToolModeContext } from '../ui/tools';

export function OptionRow(): React.ReactElement {
  const tab = useUi((s) => s.tab);

  return (
    <ToolModeContext.Provider value="one">
      <div className="optrow">
        {tab === 'frame' && <FramePanel />}
        {tab === 'text' && <TextPanel />}
        {tab === 'font' && <FontPanel />}
        {tab === 'badge' && <BadgePanel />}
        {tab === 'info' && <InfoPanel />}
      </div>
    </ToolModeContext.Provider>
  );
}
