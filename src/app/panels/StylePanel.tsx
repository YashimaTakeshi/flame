/**
 * スタイル。比率を選んでから型を選ぶ2段構成。
 * 15個を一列に並べると親指での探索が長くなるので、比率で6つに畳む。
 */
import { useEffect, useMemo, useRef } from 'react';
import { GROUPS } from '../../core/styles/registry';
import type { StyleDef, StyleGroup } from '../../core/styles/types';
import { useDoc } from '../state/doc';
import { Segmented } from '../ui/Segmented';
import { figureFor } from './styleFigure';

const RATIOS = GROUPS.map((g) => ({ value: g.id, label: g.label }));

/** 図は寸法どおりに描く。高さを揃え、横は比率ぶんだけ広げる（上限あり） */
const FIG_H = 44;
const FIG_MAX_W = 56;

function StyleFigure({ def }: { def: StyleDef }): React.ReactElement {
  const fig = useMemo(() => figureFor(def), [def]);
  const w = Math.min(FIG_MAX_W, FIG_H * fig.aspect);
  const h = w / fig.aspect;
  const pct = (n: number): string => `${(n * 100).toFixed(2)}%`;

  return (
    <span className="sfig" style={{ width: w, height: h }} aria-hidden="true">
      <i
        className="sfig__photo"
        style={{
          left: pct(fig.photo.x),
          top: pct(fig.photo.y),
          width: pct(fig.photo.w),
          height: pct(fig.photo.h),
        }}
      />
      {fig.lines.map((r, i) => (
        <i
          key={i}
          className={fig.overlay ? 'sfig__line sfig__line--over' : 'sfig__line'}
          style={{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) }}
        />
      ))}
    </span>
  );
}

export function StylePanel(): React.ReactElement {
  const styleId = useDoc((s) => s.styleId);
  const setStyle = useDoc((s) => s.setStyle);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const group: StyleGroup = useMemo(
    () => GROUPS.find((g) => g.styles.some((s) => s.id === styleId))?.id ?? 'OR',
    [styleId],
  );
  const styles = useMemo(
    () => GROUPS.find((g) => g.id === group)?.styles ?? [],
    [group],
  );

  // 選択中が画面外にあると「いま何か」が分からない。開いたら見える位置に寄せる
  useEffect(() => {
    const el = rowRef.current?.querySelector('[aria-checked="true"]');
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [styleId]);

  return (
    <div className="p-style">
      <Segmented
        label="キャンバスの比率"
        options={RATIOS}
        value={group}
        onChange={(g) => {
          // 比率を変えたら、その比率の先頭のスタイルに移る
          const first = GROUPS.find((x) => x.id === g)?.styles[0];
          if (first) setStyle(first.id);
        }}
      />
      <div className="hscroll p-style__types" role="radiogroup" aria-label="スタイル" ref={rowRef}>
        {styles.map((def) => (
          <button
            key={def.id}
            type="button"
            role="radio"
            aria-checked={styleId === def.id}
            className="stylechip"
            title={def.note ?? def.label}
            onClick={() => setStyle(def.id)}
          >
            <StyleFigure def={def} />
            <span className="stylechip__name">{def.label.split('・').slice(1).join('・')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
