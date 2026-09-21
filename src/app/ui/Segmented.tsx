/**
 * 選択肢を隣り合わせに並べる。隙間を作らないので、指が少しずれても必ずどれかに当たる。
 * 高さは必ず 44px 以上（指で狙える最小の大きさ）。
 */
export interface SegmentOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  onDisabledTap,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  onDisabledTap?: (v: T) => void;
}): React.ReactElement {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-disabled={o.disabled ? true : undefined}
          className="seg__b"
          onClick={() => (o.disabled ? onDisabledTap?.(o.value) : onChange(o.value))}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
