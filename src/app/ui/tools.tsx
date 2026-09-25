/**
 * 道具（フレーム・文字・書体・刻印・情報）の中の「項目」の並べ方。
 *
 * スマホ … 項目の名前を小さなボタンで横に並べ、**選んだ1つの組の操作だけ**を出す
 *          （iPhone の写真アプリの編集と同じ考え方）。
 *          以前は全部の行を縦に積んだ 236px の面で、iPhone の Safari では写真が 177×268px まで縮み、
 *          「写真が小さくなりすぎて編集しづらい」と指摘された（依頼者が選んだ形）。
 *          1項目ずつにしたら今度は「まとめ過ぎ（細切れ過ぎ）」と言われ、意味の近い項目は同じ組に入れた
 *          （例: 余白と地色＝額、写真の位置と枠線＝写真）。組の中は Line（小さな見出し＋部品の1行）と
 *          Cells（横に並べる）で組む。
 * PC     … 欄に幅があるので、今までどおり全部の行を縦に並べる（Row）。
 *
 * どちらで並べるかは、置かれた場所が決める（ToolModeContext。スマホの OptionRow が 'one' にする）。
 * 各道具のパネルは項目の一覧（Tool）を渡すだけで、並べ方を知らない。
 */
import { Fragment, createContext, useContext, useEffect, useRef } from 'react';
import { useUi, type TabId } from '../state/ui';
import { Row } from './controls';

export interface Tool {
  /** 覚えておくときの名前（道具の中で一意） */
  key: string;
  /** 項目の名前。スマホではボタン、PC では行の見出し */
  label: string;
  /** 今の値を短く（地色の名前など）。PC は見出しの下、スマホは選んでいる項目のボタンに添える */
  note?: string | undefined;
  /** 今は効かない。薄く見せるが隠さない（押せば理由が出る） */
  dim?: boolean | undefined;
  /** PC で見出しを付けず、欄の幅いっぱいに置く（情報の一覧など） */
  bare?: boolean;
  /** スマホで欄を背の高い形にする（一覧を送りながら入力する項目） */
  tall?: boolean;
  /** スマホで項目の並びの先頭に置く（PC の並びは変えない） */
  lead?: boolean;
  /** スマホで出す組の操作 */
  control: React.ReactNode;
  /** PC の欄での行（組を行に分けて並べる）。無ければ label と control で1行 */
  rows?: readonly ToolRow[];
}

export interface ToolRow {
  key: string;
  label: string;
  note?: string | undefined;
  dim?: boolean | undefined;
  bare?: boolean;
  control: React.ReactNode;
}

/** 組の中の1行。左に小さな見出し、右に部品 */
export function Line({ label, dim, children }: { label: string; dim?: boolean | undefined; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="ln">
      <span className="ln__lbl" data-dim={dim || undefined}>
        {label}
      </span>
      <div className="ln__ctl">{children}</div>
    </div>
  );
}

/** 組の中で横に並べる。それぞれ上に小さな見出し */
export function Cells({ cells }: { cells: readonly { label: string; dim?: boolean | undefined; grow?: boolean; node: React.ReactNode }[] }): React.ReactElement {
  return (
    <div className="cells">
      {cells.map((c) => (
        <div key={c.label} className="cell" data-grow={c.grow || undefined}>
          <span className="cell__lbl" data-dim={c.dim || undefined}>
            {c.label}
          </span>
          {c.node}
        </div>
      ))}
    </div>
  );
}

export type ToolMode = 'rows' | 'one';
export const ToolModeContext = createContext<ToolMode>('rows');

export function ToolPanel({
  tab,
  tools,
  banner,
  className,
}: {
  tab: TabId;
  tools: readonly Tool[];
  /** 項目の上に置く1行（情報タブの「文字は入れない設定です」など） */
  banner?: React.ReactNode;
  /** PC の欄での追加の class */
  className?: string;
}): React.ReactElement {
  const mode = useContext(ToolModeContext);
  const picked = useUi((s) => s.toolOf[tab]);
  const setTool = useUi((s) => s.setTool);
  const chipsRef = useRef<HTMLDivElement | null>(null);

  const order = mode === 'one' ? [...tools.filter((t) => t.lead), ...tools.filter((t) => !t.lead)] : tools;
  const cur = order.find((t) => t.key === picked) ?? order[0]!;

  // 選んでいる項目のボタンが横に送った先に隠れていたら、見える所まで送る（情報タブへ飛んできたときなど）
  useEffect(() => {
    if (mode !== 'one') return;
    const el = chipsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [mode, cur.key]);

  // 右に続きがあるか（項目が画面の幅に入りきらないとき）。右端を薄く消して知らせる
  useEffect(() => {
    const el = chipsRef.current;
    if (mode !== 'one' || !el) return;
    const check = (): void => {
      if (el.scrollLeft + el.clientWidth < el.scrollWidth - 2) el.dataset['more'] = 'true';
      else delete el.dataset['more'];
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro?.disconnect();
    };
  }, [mode, tab]);

  if (mode === 'rows') {
    return (
      <div className={className ? `pnl ${className}` : 'pnl'}>
        {banner}
        {tools
          .flatMap((t): readonly ToolRow[] => t.rows ?? [{ key: t.key, label: t.label, note: t.note, dim: t.dim, bare: t.bare ?? false, control: t.control }])
          .map((r) =>
            r.bare ? (
              <Fragment key={r.key}>{r.control}</Fragment>
            ) : (
              <Row key={r.key} label={r.label} note={r.note} dim={r.dim}>
                {r.control}
              </Row>
            ),
          )}
      </div>
    );
  }

  /* 左右の矢印で項目を移る（ボタンの並びをキーボードでも行き来できるように） */
  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = order.findIndex((t) => t.key === cur.key);
    const next = order[(i + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length]!;
    e.preventDefault();
    setTool(tab, next.key);
    requestAnimationFrame(() => chipsRef.current?.querySelector<HTMLElement>(`[data-key="${next.key}"]`)?.focus());
  };

  return (
    <div className="pnl pnl--one" data-tall={cur.tall || undefined}>
      {banner}
      <div className="chips" role="tablist" aria-label="項目" ref={chipsRef} onKeyDown={onKey}>
        {order.map((t) => {
          const on = t.key === cur.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`chip-${tab}-${t.key}`}
              data-key={t.key}
              aria-selected={on}
              aria-controls={`tool-${tab}`}
              tabIndex={on ? 0 : -1}
              className="chip"
              data-dim={t.dim || undefined}
              onClick={() => !on && setTool(tab, t.key)}
            >
              {t.label}
              {on && t.note && <small>{t.note}</small>}
            </button>
          );
        })}
      </div>
      <div className="tool" id={`tool-${tab}`} role="tabpanel" aria-labelledby={`chip-${tab}-${cur.key}`}>
        {cur.control}
      </div>
    </div>
  );
}
