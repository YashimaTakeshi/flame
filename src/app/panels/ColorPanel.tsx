/** 地色。32φ の円と色名。名前が無いと White / Warm White / Ivory を見分けられない */
import { useEffect, useRef } from 'react';
import { cssColor } from '../../core/scene/ops';
import { useDoc } from '../state/doc';
import { COLORS } from './constants';

export function ColorPanel(): React.ReactElement {
  const colorKey = useDoc((s) => s.colorKey);
  const set = useDoc((s) => s.set);
  const rowRef = useRef<HTMLDivElement | null>(null);

  // 選択中が画面外にあると「いま何色か」が分からない。開いたら中央に寄せる
  useEffect(() => {
    const el = rowRef.current?.querySelector('[aria-checked="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [colorKey]);

  return (
    <div className="p-color">
      <div className="hscroll" role="radiogroup" aria-label="地色" ref={rowRef}>
        {COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={colorKey === c.key}
            className="sw"
            onClick={() => set('colorKey', c.key)}
          >
            <span className="sw__dot" style={{ background: cssColor(c.value) }} />
            <span className="sw__name">{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
