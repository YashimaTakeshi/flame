/**
 * 情報。キャプションに載せる項目を、**中身と一緒に、何行目に出るかの組ごとに**並べる。
 *
 * 1項目は「つまみ・名前・今の中身・載せるスイッチ」。名前を押すと情報シートがその欄から開く。
 * つまみ（⠿）をドラッグすると、ほかの行へ移したり順番を入れ替えたりできる（キーボードは上下キー）。
 * 組の数は「行数」と連動する（1行なら組は1つ）。行数は文字タブと同じ設定。
 */
import { useEffect, useRef, useState } from 'react';
import { groupsFor } from '../../core/styles/tokens';
import type { FieldId, LineCount } from '../../core/styles/types';
import { SHOT_FACTS, effectiveFields } from '../caption';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Pics, Row, Switch } from '../ui/controls';
import { LINE_OPTIONS } from './constants';
import { IconEdit, IconReset } from '../ui/icons';

/** 一覧に出す項目。撮影地（place）は未実装なので出さない（割り振りの中には残る） */
const FIELDS: { id: FieldId; label: string; editable: boolean; empty: string }[] = [
  { id: 'camera', label: 'カメラ', editable: true, empty: '記録なし' },
  { id: 'lens', label: 'レンズ', editable: true, empty: '記録なし' },
  { id: 'exposure', label: '露出', editable: false, empty: '記録なし' },
  { id: 'focalLength', label: '焦点距離', editable: false, empty: '記録なし' },
  { id: 'date', label: '日付', editable: true, empty: '記録なし' },
  { id: 'film', label: '仕上がり', editable: true, empty: '記録なし' },
  { id: 'title', label: 'タイトル', editable: true, empty: '未入力' },
  { id: 'artist', label: '作者', editable: true, empty: '未入力' },
];

/** 行ごとの見え方（spec.ts の linesFor と同じ）。組の見出しに小さく添える */
const LOOK: Record<LineCount, readonly string[]> = { 1: ['標準'], 2: ['標準', '小さく薄く'], 3: ['標準', '太字', '小さく薄く'] };

type Target = { g: number; i: number };

export function InfoPanel(): React.ReactElement {
  const fields = useDoc((s) => s.fields);
  const skip = useDoc((s) => s.skipShotFacts);
  const toggleField = useDoc((s) => s.toggleField);
  const set = useDoc((s) => s.set);
  const resetInfo = useDoc((s) => s.resetInfo);
  const layout = useDoc((s) => s.lineLayout);
  const lines = useDoc((s) => s.style.lines);
  const setStyle = useDoc((s) => s.setStyle);
  const moveField = useDoc((s) => s.moveField);
  const facts = useUi((s) => s.facts);
  const openInfo = useUi((s) => s.openInfo);
  const setHint = useUi((s) => s.setHint);
  const shown = effectiveFields(fields, skip);
  const captionOn = useDoc((s) => s.captionOn);
  const setTab = useUi((s) => s.setTab);

  const known = new Set(FIELDS.map((f) => f.id));
  const groups = groupsFor(layout, lines).map((g) => g.filter((id) => known.has(id)));
  const meta = (id: FieldId) => FIELDS.find((f) => f.id === id)!;

  /*
   * 戻すのは情報だけ（載せる項目・日付の書き方・タイトル・手入力・行の割り振り）。
   * 以前は配置も書体も地色もまとめて工場出荷に戻り、取り消せなかった
   */
  const reset = (): void => {
    resetInfo();
    setHint('情報を戻しました（↶ で元に戻せます）');
  };

  const toggle = (id: FieldId): void => {
    // 「この写真では撮影情報を入れない」を選んだあとに撮影情報を入れ直したら、その選択をやめる
    if (skip && SHOT_FACTS.includes(id)) {
      set('skipShotFacts', false);
      if (!fields[id]) toggleField(id);
      return;
    }
    toggleField(id);
  };

  /* ── ドラッグ ── */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ id: FieldId; target: Target | null } | null>(null);
  /** 動かしたあと、つまみにフォーカスを戻す（組をまたぐと要素が作り直される） */
  const refocus = useRef<FieldId | null>(null);
  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    rootRef.current?.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus();
  });

  /** 指の高さから、どの組の何番目に落とすかを決める */
  const targetAt = (y: number): Target | null => {
    const root = rootRef.current;
    if (!root) return null;
    const zones = [...root.querySelectorAll<HTMLElement>('[data-group]')];
    if (zones.length === 0) return null;
    let g = zones.length - 1;
    for (let k = 0; k < zones.length; k++) {
      if (y < zones[k]!.getBoundingClientRect().bottom) {
        g = k;
        break;
      }
    }
    const rows = [...zones[g]!.querySelectorAll<HTMLElement>('[data-i]')];
    for (const r of rows) {
      const b = r.getBoundingClientRect();
      if (y < b.top + b.height / 2) return { g, i: Number(r.dataset['i']) };
    }
    return { g, i: groups[g]!.length };
  };

  /** 面の端に指が来たら送る（スマホの面は低い） */
  const autoScroll = (y: number): void => {
    const sc = rootRef.current?.closest<HTMLElement>('.side__scroll, .pnl');
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    if (y < r.top + 32) sc.scrollTop -= 10;
    else if (y > r.bottom - 32) sc.scrollTop += 10;
  };

  const onHandleDown = (id: FieldId) => (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, target: null });
  };
  const onHandleMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (!drag) return;
    autoScroll(e.clientY);
    const t = targetAt(e.clientY);
    if (t && (t.g !== drag.target?.g || t.i !== drag.target?.i)) setDrag({ ...drag, target: t });
  };
  const onHandleUp = (): void => {
    if (drag?.target) {
      const g = drag.target.g;
      moveField(drag.id, g, drag.target.i);
    }
    setDrag(null);
  };
  /** キーボード: 上下キーで1つずつ。行の端では隣の行へ */
  const onHandleKey = (id: FieldId, g: number, i: number) => (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    refocus.current = id;
    if (e.key === 'ArrowUp') {
      if (i > 0) moveField(id, g, i - 1);
      else if (g > 0) moveField(id, g - 1, groups[g - 1]!.length);
    } else if (i < groups[g]!.length - 1) moveField(id, g, i + 2);
    else if (g < groups.length - 1) moveField(id, g + 1, 0);
  };

  return (
    <div className="pnl pnl--list" ref={rootRef}>
      {/* 文字を切っているあいだは何も載らない。どこで入れ直すかを1行で */}
      {!captionOn && (
        <button type="button" className="irows__off" onClick={() => setTab('text')}>
          文字は入れない設定です（文字タブで入れられます）
        </button>
      )}
      <Row label="行数">
        <Pics label="行数" options={LINE_OPTIONS} value={`${lines}`} onChange={(v) => setStyle({ lines: Number(v) as LineCount })} />
      </Row>
      <p className="irows__how">⠿ をドラッグして、項目を出す行や順番を変えられます</p>
      {groups.map((g, gi) => (
        <section key={gi} className="igroup" data-group={gi} data-drop-end={(drag?.target?.g === gi && drag.target.i === g.length) || undefined}>
          <h3 className="igroup__hd">
            {lines === 1 ? '1行' : `${gi + 1}行目`}
            <small>{LOOK[lines][gi]}</small>
          </h3>
          {g.length === 0 && <p className="igroup__empty">ここに項目をドラッグ</p>}
          {g.map((id, i) => {
            const f = meta(id);
            const v = facts[id];
            const body = (
              <>
                <span className="irow__name">{f.label}</span>
                <span className="irow__val" data-empty={v ? undefined : true}>
                  {v ?? f.empty}
                  {f.editable && <span aria-hidden="true"> ›</span>}
                </span>
              </>
            );
            return (
              <div
                key={id}
                className="irow"
                data-i={i}
                data-off={!shown[id] || undefined}
                data-dragging={drag?.id === id || undefined}
                data-drop-before={(drag?.target?.g === gi && drag.target.i === i) || undefined}
              >
                <button
                  type="button"
                  className="irow__handle"
                  data-handle={id}
                  aria-label={`${f.label}を動かす（上下キーで順番と行を変える）`}
                  onPointerDown={onHandleDown(id)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerCancel={() => setDrag(null)}
                  onKeyDown={onHandleKey(id, gi, i)}
                >
                  <svg viewBox="0 0 12 18" width="12" height="18" aria-hidden="true">
                    {[3, 9].map((x) => [3, 9, 15].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />))}
                  </svg>
                </button>
                {f.editable ? (
                  <button type="button" className="irow__main" aria-label={`${f.label}を編集`} onClick={() => openInfo(id)}>
                    {body}
                  </button>
                ) : (
                  <span className="irow__main">{body}</span>
                )}
                <Switch label={`${f.label}を載せる`} on={shown[id]} onChange={() => toggle(id)} />
              </div>
            );
          })}
        </section>
      ))}
      <div className="irows__acts">
        <button type="button" className="btn--s" onClick={() => openInfo(null)}>
          <IconEdit size={16} />
          まとめて編集
        </button>
        <button type="button" className="btn--s" aria-label="情報を初期値に戻す" onClick={reset}>
          <IconReset size={16} />
          情報を戻す
        </button>
      </div>
    </div>
  );
}
