import { TABS, useUi } from '../state/ui';
import { useDoc } from '../state/doc';

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
          className={`tab${t.id === 'layout' && jaPicked ? ' tab__badge' : ''}`}
          onClick={() => setTab(t.id)}
        >
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
