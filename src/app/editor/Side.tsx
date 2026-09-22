/**
 * PC の設定欄。右側に全部の設定を縦に並べる。
 *
 * スマホではタブで1つずつ見せるが、PC には幅がある。
 * **全部見えていて、プレビューを見ながらどこでも触れる**のが PC の速さ。
 * 見出しはタブと同じ印と名前にして、スマホで覚えた場所がそのまま通じるようにする。
 */
import { TABS, type TabId } from '../state/ui';
import { BadgePanel } from '../panels/BadgePanel';
import { ColorPanel } from '../panels/ColorPanel';
import { FontPanel } from '../panels/FontPanel';
import { InfoPanel } from '../panels/InfoPanel';
import { LayoutPanel } from '../panels/LayoutPanel';
import { PlacePanel } from '../panels/PlacePanel';
import { IconFont, IconInfo, IconPlace, IconStamp, IconSwatch, IconType } from '../ui/icons';

const ICONS: Record<TabId, React.ReactElement> = {
  place: <IconPlace size={18} />,
  layout: <IconType size={18} />,
  color: <IconSwatch size={18} />,
  font: <IconFont size={18} />,
  badge: <IconStamp size={18} />,
  info: <IconInfo size={18} />,
};

const PANELS: Record<TabId, () => React.ReactElement> = {
  place: PlacePanel,
  layout: LayoutPanel,
  color: ColorPanel,
  font: FontPanel,
  badge: BadgePanel,
  info: InfoPanel,
};

export function Side(): React.ReactElement {
  return (
    <aside className="side" aria-label="設定">
      {TABS.map((t) => {
        const Panel = PANELS[t.id];
        return (
          <section key={t.id} className="side__sec" aria-labelledby={`side-${t.id}`}>
            <h2 className="side__hd" id={`side-${t.id}`}>
              {ICONS[t.id]}
              <span>{t.label}</span>
            </h2>
            <Panel />
          </section>
        );
      })}
    </aside>
  );
}
