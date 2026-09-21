/**
 * タブバー。印だけで並べ、**選んでいるタブにだけ名前を添える**。
 * 5つ全部に名前を書くと文字が増えるが、全部を印だけにすると「配置」と「組み」の区別が付かない。
 * いま開いている場所の名前だけが見えていれば、残りは押せば分かる。
 */
import { TABS, useUi, type TabId } from '../state/ui';
import { useDoc } from '../state/doc';
import { IconFont, IconInfo, IconPlace, IconSwatch, IconType } from '../ui/icons';

const ICONS: Record<TabId, React.ReactElement> = {
  place: <IconPlace />,
  layout: <IconType />,
  color: <IconSwatch />,
  font: <IconFont />,
  info: <IconInfo />,
};

export function TabBar(): React.ReactElement {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  // 和文書体を選ぶと「組み」に新しい選択肢が出る。その唯一の合図
  const jaPicked = useDoc((s) => s.fontKey === 'jp');

  return (
    <nav className="tabbar" role="tablist" aria-label="設定">
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
          <span className="tab__pill">
            {ICONS[t.id]}
            <span className="tab__label">{t.label}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
