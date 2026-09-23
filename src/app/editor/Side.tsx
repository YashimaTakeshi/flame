/**
 * PC の設定欄。右側に全部の道具を縦に並べ、見出しで畳める。
 *
 * スマホではタブで1つずつ見せるが、PC には幅がある。プレビューを見ながらどこでも触れる。
 * ただ全部を開くと長く、下の道具まで送る必要があった（UX の見直しで指摘された）。
 * 見出しを押すと畳め、畳んだ見出しには今の値を短く添える。
 * 「書き出す」は欄の下にいつも見えている（Ctrl/⌘+S でも）。
 */
import { useDoc } from '../state/doc';
import { TABS, useUi, type TabId } from '../state/ui';
import { BadgePanel } from '../panels/BadgePanel';
import { FontPanel } from '../panels/FontPanel';
import { FramePanel } from '../panels/FramePanel';
import { InfoPanel } from '../panels/InfoPanel';
import { TextPanel } from '../panels/TextPanel';
import { effectiveFields } from '../caption';
import { LATIN_FONTS } from '../fonts-catalog';
import { TAB_ICONS } from './TabBar';

const PANELS: Record<TabId, () => React.ReactElement> = {
  frame: FramePanel,
  text: TextPanel,
  font: FontPanel,
  badge: BadgePanel,
  info: InfoPanel,
};

/** 畳んだ見出しに添える今の値 */
function useSummaries(): Record<TabId, string> {
  const fontKey = useDoc((s) => s.fontKey);
  const badge = useDoc((s) => s.badge);
  const fields = useDoc((s) => s.fields);
  const skip = useDoc((s) => s.skipShotFacts);
  const hasFilm = useUi((s) => s.hasFilm);
  const facts = useUi((s) => s.facts);
  const shown = effectiveFields(fields, skip);
  const count = Object.entries(facts).filter(([k, v]) => v && shown[k as keyof typeof shown]).length;
  return {
    frame: '',
    text: '',
    font: fontKey === 'jp' ? '日本語' : (LATIN_FONTS.find((f) => f.key === fontKey)?.label ?? ''),
    badge: !hasFilm ? '記録なし' : badge === 'none' ? 'なし' : badge === 'text' ? '文字' : 'ロゴ',
    info: `${count}項目`,
  };
}

export function Side({ onExport, busy }: { onExport: () => void; busy: boolean }): React.ReactElement {
  const open = useUi((s) => s.openSecs);
  const toggle = useUi((s) => s.toggleSec);
  const summary = useSummaries();
  return (
    <aside className="side" aria-label="設定">
      <div className="side__scroll">
        {TABS.map((t) => {
          const Panel = PANELS[t.id];
          const Icon = TAB_ICONS[t.id];
          const isOpen = open[t.id];
          return (
            <section key={t.id} className="side__sec" data-open={isOpen || undefined}>
              <h2 className="side__hd">
                <button type="button" aria-expanded={isOpen} aria-controls={`side-${t.id}`} onClick={() => toggle(t.id)}>
                  <Icon size={18} />
                  <span>{t.label}</span>
                  {!isOpen && summary[t.id] && <small>{summary[t.id]}</small>}
                  <i className="side__chev" aria-hidden="true" />
                </button>
              </h2>
              <div id={`side-${t.id}`} hidden={!isOpen}>
                {isOpen && <Panel />}
              </div>
            </section>
          );
        })}
      </div>
      <div className="side__foot">
        <button type="button" className="btn--primary" disabled={busy} onClick={onExport}>
          書き出す
        </button>
        <small>Ctrl/⌘+S</small>
      </div>
    </aside>
  );
}
