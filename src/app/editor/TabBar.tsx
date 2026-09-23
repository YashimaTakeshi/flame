/**
 * 道具の列。印の下に名前、5つとも。
 *
 * 選んでいる道具は、地を塗らずに**字と印を白く、上に短い線**（Lightroom と同じ控えめな見せ方）。
 * 以前は白い丸で塗っていて、写真の白いフチに次いで画面でいちばん明るく、目を引いた。
 */
import { TABS, useUi, type TabId } from '../state/ui';
import { IconFont, IconFrame, IconInfo, IconStamp, IconText } from '../ui/icons';

export const TAB_ICONS: Record<TabId, (p: { size?: number }) => React.ReactElement> = {
  frame: IconFrame,
  text: IconText,
  font: IconFont,
  badge: IconStamp,
  info: IconInfo,
};

export function TabBar(): React.ReactElement {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);

  return (
    <nav className="tabbar" aria-label="設定">
      <div className="tabbar__row" role="tablist">
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-label={t.label}
              className="tab"
              onClick={() => setTab(t.id)}
            >
              <Icon />
              <span className="tab__label">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
