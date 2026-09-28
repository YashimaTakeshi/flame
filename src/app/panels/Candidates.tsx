/**
 * 入力欄のすぐ下に出す候補（前に入れた値）の1列。押すと入り、長押しで候補から外す。
 *
 * - 入力欄が触られている間だけ出す（InfoPanel が開け閉めする）
 * - 押す前に入力欄の blur で列が消えると押せないので、pointerdown / mousedown の既定の動き
 *   （フォーカスの移動）を止める。click は届く
 * - 入りきらなければ横に送る（overflow-x:auto）。スマホの左右の払いは、送れる列を避けて働く（OptionRow）
 * - 長押し（LONG_MS）は外す。そのあとの click は入れないで捨てる
 */
import { useEffect, useRef } from 'react';
import { candidatesFor, useRecent, type RecentField } from '../state/recent';
import { useUi } from '../state/ui';

const LONG_MS = 500;
/** これ以上指が動いたら送る操作。長押しにしない */
const MOVE_PX = 8;

interface Props {
  readonly field: RecentField;
  /** 打ちかけの字（絞り込みに使う） */
  readonly query: string;
  /** いま入っている値（候補から除く） */
  readonly current: readonly (string | null | undefined)[];
  readonly onPick: (value: string) => void;
  /** 列からフォーカスが出たとき（Tab で候補に来て、さらに先へ出たら閉じる） */
  readonly onLeave: (e: React.FocusEvent) => void;
}

export function Candidates({ field, query, current, onPick, onLeave }: Props): React.ReactElement | null {
  const list = useRecent((s) => s.lists[field]);
  const remove = useRecent((s) => s.remove);
  const setHint = useUi((s) => s.setHint);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  /** 長押しで外した直後の click を捨てる */
  const swallow = useRef(false);
  useEffect(() => () => {
    if (press.current) clearTimeout(press.current.timer);
  }, []);

  const shown = candidatesFor(list, query, current);
  if (shown.length === 0) return null;

  const cancel = (): void => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };

  return (
    <div className="cands" data-row={field} role="group" aria-label="前に入れた値" onBlur={onLeave}>
      {shown.map((v) => (
        <button
          key={v}
          type="button"
          className="chip cands__chip"
          onPointerDown={(e) => {
            e.preventDefault();
            swallow.current = false;
            cancel();
            press.current = {
              x: e.clientX,
              y: e.clientY,
              timer: setTimeout(() => {
                press.current = null;
                swallow.current = true;
                remove(field, v);
                setHint('候補から外しました');
              }, LONG_MS),
            };
          }}
          onPointerMove={(e) => {
            const p = press.current;
            if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_PX) cancel();
          }}
          onPointerUp={cancel}
          onPointerCancel={cancel}
          onPointerLeave={cancel}
          onMouseDown={(e) => e.preventDefault()}
          // 長押しで出る OS のメニュー（コピーなど）を出さない
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (swallow.current) {
              swallow.current = false;
              return;
            }
            onPick(v);
          }}
          title={v}
        >
          <span>{v}</span>
        </button>
      ))}
    </div>
  );
}
