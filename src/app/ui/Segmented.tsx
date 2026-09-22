/**
 * 押しボタンの並び。PC（desk）でホイールの代わりに使う。
 *
 * ホイールは指で回すための形で、鼠では「回す」が「小さく引っ張る」になって狙いにくい。
 * PC では選択肢を**全部見せて1回押す**のがいちばん速い。
 *
 * ホイールと同じ props を受ける（Choice が差し替えるため）。
 *   - 押せない値は薄く残し、押されたら onDisabledPick に知らせる（消さない。「なぜ無いか」が分からなくなる）
 *   - 列ごと押せないとき（全面のときの地色など）も同じ
 *   - wide は選択肢が多い列（書体・地色）。1行に収まらないので折り返す
 *
 * 鍵盤: 左右（上下）の矢印で隣へ。radiogroup の慣例に合わせる。
 */
import type { WheelOption } from './Wheel';

export function Segmented<T extends string | number>({
  caption,
  label,
  options,
  value,
  onChange,
  onDisabledPick,
  disabled = false,
  wide = false,
}: {
  caption?: string;
  label: string;
  options: readonly WheelOption<T>[];
  value: T;
  onChange: (v: T) => void;
  onDisabledPick?: (v: T) => void;
  disabled?: boolean;
  wide?: boolean;
}): React.ReactElement {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const pick = (o: WheelOption<T>): void => {
    if (disabled || o.disabled) {
      onDisabledPick?.(o.value);
      return;
    }
    if (o.value !== value) onChange(o.value);
  };

  /** 矢印で隣の押せる値へ。端で止まる（回り込まない。ホイールと同じ） */
  const step = (dir: 1 | -1): void => {
    if (disabled) return;
    for (let i = idx + dir; i >= 0 && i < options.length; i += dir) {
      const o = options[i];
      if (o && !o.disabled) {
        onChange(o.value);
        return;
      }
    }
  };

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    }
  };

  return (
    <div className="seg" data-wide={wide || undefined} data-disabled={disabled || undefined}>
      {caption && <span className="seg__cap">{caption}</span>}
      <div className="seg__opts" role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} onKeyDown={onKey}>
        {options.map((o, i) => {
          const checked = i === idx;
          const off = disabled || o.disabled === true;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              className="seg__opt"
              aria-checked={checked}
              aria-disabled={off || undefined}
              // 選んでいる1つだけが Tab で止まる。矢印で隣へ移る
              tabIndex={checked ? 0 : -1}
              title={o.label}
              style={o.style}
              onClick={() => pick(o)}
            >
              {o.node ?? o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
