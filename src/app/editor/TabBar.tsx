/**
 * タブバー。印の下に名前。6つとも。
 *
 * 一度「選んでいるタブにだけ名前」を試したが、配置と組みはどちらもレイアウトの印になり、
 * 押すまで区別が付かなかった。2文字の名前は文字数として無視できる。全部に添える。
 */
import { TABS, useUi, type TabId } from '../state/ui';
import { useDoc } from '../state/doc';
import { IconFont, IconInfo, IconPlace, IconStamp, IconSwatch, IconType } from '../ui/icons';

const ICONS: Record<TabId, React.ReactElement> = {
  place: <IconPlace />,
  layout: <IconType />,
  color: <IconSwatch />,
  font: <IconFont />,
  badge: <IconStamp />,
  info: <IconInfo />,
};

export function TabBar(): React.ReactElement {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  // 和文書体を選ぶと「組み」に新しい選択肢が出る。その唯一の合図
  const jaPicked = useDoc((s) => s.fontKey === 'jp');

  return (
    <nav className="tabbar" aria-label="設定">
      <div className="tabbar__pill" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-label={t.label}
            className={`tab${t.id === 'layout' && jaPicked ? ' tab__badge' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {ICONS[t.id]}
            <span className="tab__label">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
