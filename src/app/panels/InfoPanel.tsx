/**
 * 情報。キャプションに載せる項目を、**中身と一緒に、何行目に出るかの組ごとに**並べる。
 *
 * 1項目は「つまみ・名前・中身（その場で直接入力）・載せるスイッチ」。
 * 以前は名前を押すと別の画面（情報シート）が開いた。依頼者の提案で、その場で打てるようにした。
 * つまみ（⠿）をドラッグすると、ほかの行へ移したり順番を入れ替えたりできる（キーボードは上下キー）。
 * 組の数は「行数」と連動する（1行なら組は1つ）。行数は文字タブと同じ設定。
 */
import { useEffect, useRef, useState } from 'react';
import { groupsFor } from '../../core/styles/tokens';
import type { FieldId, LineCount, SeparatorId } from '../../core/styles/types';
import { SHOT_FACTS, effectiveFields } from '../caption';
import { useDoc } from '../state/doc';
import { INFO_ITEMS, useUi } from '../state/ui';
import { Pics, Switch, type Opt } from '../ui/controls';
import { ToolPanel } from '../ui/tools';
import { LinesPicker, useLinesUsed } from './LinesPicker';
import { IconReset } from '../ui/icons';
import { DATE_FORMATS, formatWallClock, type DateFormatId, type WallClock } from '../../core/wallclock';
import { FieldEditor } from './FieldEditor';

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
const SEPARATOR_OPTIONS: readonly Opt<SeparatorId>[] = [
  { value: 'comma', label: 'カンマ', text: ',' },
  { value: 'middot', label: '中黒', text: '·' },
  { value: 'slash', label: 'スラッシュ', text: '/' },
  { value: 'emdash', label: 'ダッシュ', text: '—' },
  { value: 'pipe', label: '縦線', text: '|' },
  { value: 'space', label: '空白', text: '空白' },
];

const SAMPLE_DATE: WallClock = { y: 2026, m: 9, d: 20, hh: 17, mm: 42, ss: 11 };
const asFormat = (v: string): DateFormatId => DATE_FORMATS.find((f) => f === v) ?? 'dots';

const LOOK: Record<LineCount, readonly string[]> = {
  1: ['標準'],
  2: ['標準', '小さく薄く'],
  3: ['標準', '太字', '小さく薄く'],
  4: ['標準', '太字', '小さく薄く', '小さく薄く'],
};

type Target = { g: number; i: number };

export function InfoPanel(): React.ReactElement {
  const fields = useDoc((s) => s.fields);
  const skip = useDoc((s) => s.skipShotFacts);
  const toggleField = useDoc((s) => s.toggleField);
  const set = useDoc((s) => s.set);
  const resetInfo = useDoc((s) => s.resetInfo);
  const layout = useDoc((s) => s.lineLayout);
  // 組の数は実際に組まれている行数（入らない行数は最後の行に続く）
  const lines = useLinesUsed();
  const moveField = useDoc((s) => s.moveField);
  const setHint = useUi((s) => s.setHint);
  const shown = effectiveFields(fields, skip);
  const captionOn = useDoc((s) => s.captionOn);
  const separator = useDoc((s) => s.separator);
  const dateFormat = useDoc((s) => s.dateFormat);
  const photoDate = useUi((s) => s.photoDate);
  const infoFocus = useUi((s) => s.infoFocus);
  // ほかのタブ（刻印の「その他」・撮影情報の無い写真の帯）から来たら、その欄から入力を始める
  useEffect(() => {
    if (!infoFocus) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-field="${infoFocus}"]`);
    el?.scrollIntoView({ block: 'nearest' });
    el?.focus();
    useUi.setState({ infoFocus: null });
  }, [infoFocus]);
  const setTab = useUi((s) => s.setTab);

  const known = new Set(FIELDS.map((f) => f.id));
  const groups = groupsFor(layout, lines).map((g) => g.filter((id) => known.has(id)));
  const meta = (id: FieldId) => FIELDS.find((f) => f.id === id)!;
  const rootRef = useRef<HTMLDivElement | null>(null);

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
    // スマホは一覧の項目（.tool）が送られる。PC は欄（.side__scroll）
    const sc = rootRef.current?.closest<HTMLElement>('.side__scroll, .tool, .pnl');
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
      moveField(drag.id, g, drag.target.i, lines);
    }
    setDrag(null);
  };
  /** キーボード: 上下キーで1つずつ。行の端では隣の行へ */
  const onHandleKey = (id: FieldId, g: number, i: number) => (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    refocus.current = id;
    if (e.key === 'ArrowUp') {
      if (i > 0) moveField(id, g, i - 1, lines);
      else if (g > 0) moveField(id, g - 1, groups[g - 1]!.length, lines);
    } else if (i < groups[g]!.length - 1) moveField(id, g, i + 2, lines);
    else if (g < groups.length - 1) moveField(id, g + 1, 0, lines);
  };

  // 項目の一覧（その場で入力・つまみで並べ替え）。スマホでは「項目」を選ぶと、欄を高くしてこれを出す
  const items = (
    <div className="ilist" ref={rootRef}>
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
                <span className="irow__name">{f.label}</span>
                <FieldEditor id={id} />
                <Switch label={`${f.label}を載せる`} on={shown[id]} onChange={() => toggle(id)} />
              </div>
            );
          })}
        </section>
      ))}
      <div className="irows__acts">
        <button type="button" className="btn--s" aria-label="情報を初期値に戻す" onClick={reset}>
          <IconReset size={16} />
          情報を戻す
        </button>
      </div>
    </div>
  );

  return (
    <ToolPanel
      tab="info"
      className="pnl--list"
      banner={
        // 文字を切っているあいだは何も載らない。どこで入れ直すかを1行で
        !captionOn && (
          <button type="button" className="irows__off" onClick={() => setTab('text')}>
            文字は入れない設定です（文字タブで入れられます）
          </button>
        )
      }
      tools={[
        { key: 'lines', label: '行数', control: <LinesPicker /> },
        {
          // 項目の区切り（依頼者の要望で選べるようにした）。字そのものを見せて選ぶ
          key: 'sep',
          label: '区切り',
          control: <Pics label="項目の区切り" variant="text" options={SEPARATOR_OPTIONS} value={separator} onChange={(v) => set('separator', v)} />,
        },
        {
          key: 'date',
          label: '日付',
          control: (
            <select className="pselect" aria-label="日付の書き方" value={dateFormat} onChange={(e) => set('dateFormat', asFormat(e.target.value))}>
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {formatWallClock(photoDate ?? SAMPLE_DATE, f)}
                </option>
              ))}
            </select>
          ),
        },
        { key: INFO_ITEMS, label: '項目', bare: true, tall: true, lead: true, control: items },
      ]}
    />
  );
}
