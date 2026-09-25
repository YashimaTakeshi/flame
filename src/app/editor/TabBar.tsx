/**
 * 道具の列。**画面の下に浮かぶ丸い帯に、印だけ**（依頼者の指定。最近の Instagram・iPhone の編集画面と同じ形）。
 *
 * 選んでいる道具は、明るい丸の地で囲む。丸は道具を替えると滑って移る。
 * 以前は印の下に名前を添えた帯（64px）で、画面の下端から浮いておらず、写真の場所を削っていた。
 *
 * 印だけでは「刻印」「情報」が何か分かりにくい。そこで
 *   - 使い始めの数回は、押したときに帯の上へ名前を一瞬だけ出す（覚えるまでの手がかり。
 *     毎回出すと、すぐ上の操作に一瞬かぶってうるさい）
 *   - 長押しの間は、いつでも名前を出し続ける
 *   - 読み上げ・マウスを重ねたときの名前（aria-label・title）は残す
 * 道具の中の項目の列（比率・余白…）も、いまどの道具かの手がかりになる。
 */
import { useEffect, useRef, useState } from 'react';
import { TABS, useUi, type TabId } from '../state/ui';
import { IconFont, IconFrame, IconInfo, IconStamp, IconText } from '../ui/icons';

export const TAB_ICONS: Record<TabId, (p: { size?: number }) => React.ReactElement> = {
  frame: IconFrame,
  text: IconText,
  font: IconFont,
  badge: IconStamp,
  info: IconInfo,
};

/** 名前を出しておく時間。押して離したとき */
const NAME_MS = 900;
/** 押したときに名前を出す回数（この端末で。以降は長押しのときだけ） */
const NAME_TIMES = 8;
const NAME_KEY = 'fuchidori:tabname-told';

/** 押したときに名前を出すか。出したら数える */
function shouldTellName(): boolean {
  try {
    const n = Number(localStorage.getItem(NAME_KEY) ?? '0');
    if (n >= NAME_TIMES) return false;
    localStorage.setItem(NAME_KEY, String(n + 1));
    return true;
  } catch {
    return false;
  }
}
/** 長押しと見なすまでの時間 */
const HOLD_MS = 380;

export function TabBar(): React.ReactElement {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const index = Math.max(0, TABS.findIndex((t) => t.id === tab));

  /* 帯の上に出す名前。どの道具の上に出すか */
  const [name, setName] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);

  const show = (i: number, ms: number | null): void => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setName(i);
    if (ms !== null) hideTimer.current = setTimeout(() => setName(null), ms);
  };
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  const down = (i: number) => (): void => {
    holding.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holding.current = true;
      show(i, null);
    }, HOLD_MS);
  };
  const up = (): void => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (holding.current) show(name ?? index, NAME_MS);
  };

  return (
    <nav className="tabbar" aria-label="設定">
      <div className="tabbar__cap" role="tablist" style={{ '--i': index } as React.CSSProperties}>
        <span className="tabbar__pill" aria-hidden="true" />
        {TABS.map((t, i) => {
          const Icon = TAB_ICONS[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-label={t.label}
              title={t.label}
              className="tab"
              onClick={() => {
                if (tab !== t.id) setTab(t.id);
                if (!holding.current && shouldTellName()) show(i, NAME_MS);
              }}
              onPointerDown={down(i)}
              onPointerUp={up}
              onPointerLeave={up}
              onPointerCancel={up}
              // 長押しで出る端末の選択メニューに、名前の吹き出しを取られないように
              onContextMenu={(e) => e.preventDefault()}
            >
              <Icon />
            </button>
          );
        })}
        {name !== null && (
          <span className="tabbar__name" aria-hidden="true" style={{ '--n': name } as React.CSSProperties}>
            {TABS[name]!.label}
          </span>
        )}
      </div>
    </nav>
  );
}
