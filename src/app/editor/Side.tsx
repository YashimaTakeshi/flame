/**
 * PC の設定欄。右側に全部の道具を縦に並べ、見出しで畳める。
 *
 * スマホではタブで1つずつ見せるが、PC には幅がある。プレビューを見ながらどこでも触れる。
 * ただ全部を開くと長く、下の道具まで送る必要があった（UX の見直しで指摘された）。
 * 見出しを押すと畳め、畳んだ見出しには今の値を短く添える。
 * 「書き出す」は欄の下にいつも見えている（Ctrl/⌘+S でも）。
 */
import { useEffect, useState } from 'react';
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

/** 欄の幅（px）。既定・下限・上限。上限は窓の半分まで */
const SIDE_DEFAULT = 440;
const SIDE_MIN = 340;
const SIDE_KEY = 'fuchidori:side-w';
const clampW = (w: number): number => Math.round(Math.min(Math.max(w, SIDE_MIN), Math.max(SIDE_MIN, window.innerWidth * 0.5)));
const applyW = (w: number): void => document.documentElement.style.setProperty('--side-w', `${w}px`);

/*
 * 欄の幅を変える（依頼者の要望）。左の縁のつまみをドラッグ。幅はこの端末に覚えておく（好みの見た目なので保存の仕組みには載せない）
 */
function useSideWidth(): { grip: React.ReactElement } {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let w = SIDE_DEFAULT;
    try {
      w = Number(localStorage.getItem(SIDE_KEY)) || SIDE_DEFAULT;
    } catch {
      /* 覚えられない環境では既定の幅 */
    }
    applyW(clampW(w));
    return () => {
      document.documentElement.style.removeProperty('--side-w');
    };
  }, []);
  const save = (w: number): void => {
    try {
      localStorage.setItem(SIDE_KEY, String(w));
    } catch {
      /* 覚えられなくても幅は変わる */
    }
  };
  const set = (w: number): void => {
    const c = clampW(w);
    applyW(c);
    save(c);
  };
  const grip = (
    <button
      type="button"
      className="side__grip"
      aria-label="設定の欄の幅を変える（左右キー）"
      title="ドラッグで幅を変える（ダブルクリックで元に戻す）"
      data-active={active || undefined}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (!active) return;
        // 欄は右端に付いている。指の位置から右端までが幅
        set(window.innerWidth - e.clientX);
      }}
      onPointerUp={() => setActive(false)}
      onPointerCancel={() => setActive(false)}
      onDoubleClick={() => set(SIDE_DEFAULT)}
      onKeyDown={(e) => {
        const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--side-w')) || SIDE_DEFAULT;
        if (e.key === 'ArrowLeft') set(cur + 20);
        else if (e.key === 'ArrowRight') set(cur - 20);
      }}
    />
  );
  return { grip };
}

export function Side({ onExport, busy }: { onExport: () => void; busy: boolean }): React.ReactElement {
  const { grip } = useSideWidth();
  const open = useUi((s) => s.openSecs);
  const toggle = useUi((s) => s.toggleSec);
  const summary = useSummaries();
  return (
    <aside className="side" aria-label="設定">
      {grip}
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
