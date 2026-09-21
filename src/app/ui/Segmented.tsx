/**
 * 選択肢を隣り合わせに並べる。隙間を作らないので、指が少しずれても必ずどれかに当たる。
 *
 * **すべての升は同じ幅**（--cell）。行によって升の幅が違うと、
 * 同じ「左」でも別の大きさに見えて、画面に統一感が無くなる。
 * 項目が増えても升の幅は変わらず、行が右に伸びるだけ。
 *
 * 押せない選択肢は薄く見せるだけで、押しても何も起きない。理由の文章は出さない。
 */
export interface SegmentOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
  /** 文字の代わりに置く印。label は aria-label に回る */
  readonly icon?: React.ReactNode;
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
  /** 押せない選択肢が押されたとき。既定は何もしない */
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
          aria-label={o.icon ? o.label : undefined}
          title={o.icon ? o.label : undefined}
          className="seg__b"
          onClick={() => (o.disabled ? onDisabledTap?.(o.value) : onChange(o.value))}
        >
          {o.icon ?? o.label}
        </button>
      ))}
    </div>
  );
}
