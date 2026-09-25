/**
 * スマホの設定欄。道具（フレーム〜情報）の中の項目を、**組ごとに**出す（ui/tools.tsx）。
 * 以前は全部の行を縦に積んだ 236px の面で、写真が小さくなりすぎた（依頼者の指摘）。
 *
 * 欄を左右に払うと隣の道具へ移る（依頼者の要望。すばやく設定を替えられるように）。
 *   - 左へ払う → 右隣の道具（フレーム → 文字 → 書体 → 刻印 → 情報）、右へ払う → 左隣
 *   - 横に送れる列（比率・書体の見本・項目の名前など、はみ出して横に送れるもの）の上と、
 *     つまみ（スライダー）・入力欄・並べ替えのつまみの上から始めた指は、その部品のものにする
 *   - 移った道具は、払った向きから滑り込む
 */
import { useEffect, useRef } from 'react';
import { useUi } from '../state/ui';
import { BadgePanel } from '../panels/BadgePanel';
import { FontPanel } from '../panels/FontPanel';
import { FramePanel } from '../panels/FramePanel';
import { InfoPanel } from '../panels/InfoPanel';
import { TextPanel } from '../panels/TextPanel';
import { ToolModeContext } from '../ui/tools';

/** 払ったと見なす横の距離と速さ */
const SWIPE_PX = 56;
const SWIPE_MS = 700;

/** 指を置いた所が、横の動きを自分で使う部品か（そこから始めた指は払いにしない） */
function ownsHorizontal(target: EventTarget | null, root: HTMLElement): boolean {
  let el = target instanceof Element ? target : null;
  if (el?.closest('input, select, textarea, .irow__handle')) return true;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * 欄の中の送れる箱（縦に送る情報の一覧・横に並ぶ絵の列など）は、横に送る中身が無ければ横の指を手放す印を付ける。
 * 送れる箱の上では、ブラウザが横の指を自分の送り（と、送る先が無いときの「戻る」）に使い、
 * pointercancel になって払いが届かない（情報の一覧の上で払うと、ページが前の画面に戻っていた）。
 * touch-action は指を置いた瞬間に決まるので、中身が変わるたびに前もって付け直す（editor.css の data-swipe）。
 */
function markScrollers(root: HTMLElement): void {
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    const ox = getComputedStyle(el).overflowX;
    if (ox !== 'auto' && ox !== 'scroll') continue;
    const pass = el.scrollWidth <= el.clientWidth + 1;
    if (pass) el.dataset['swipe'] = 'pass';
    else delete el.dataset['swipe'];
  }
}

export function OptionRow(): React.ReactElement {
  const tab = useUi((s) => s.tab);
  const dir = useUi((s) => s.tabDir);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const later = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => markScrollers(el));
    };
    markScrollers(el);
    const mo = new MutationObserver(later);
    mo.observe(el, { childList: true, subtree: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later);
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; t: number; id: number } | null = null;
    const down = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' || !e.isPrimary || ownsHorizontal(e.target, el)) {
        start = null;
        return;
      }
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
    };
    const up = (e: PointerEvent): void => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const quick = e.timeStamp - start.t < SWIPE_MS;
      start = null;
      if (!quick || Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      useUi.getState().stepTab(dx < 0 ? 1 : -1);
    };
    const cancel = (): void => {
      start = null;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
  }, []);

  return (
    <ToolModeContext.Provider value="one">
      <div className="optrow" ref={ref} data-dir={dir === 1 ? 'next' : dir === -1 ? 'prev' : undefined}>
        {tab === 'frame' && <FramePanel />}
        {tab === 'text' && <TextPanel />}
        {tab === 'font' && <FontPanel />}
        {tab === 'badge' && <BadgePanel />}
        {tab === 'info' && <InfoPanel />}
      </div>
    </ToolModeContext.Provider>
  );
}
