/**
 * 縦のホイール。選んでいる値を真ん中に大きく、前後の値を薄く見せる。
 *
 * ボタンを横に並べる方式をやめた理由:
 *   - 選択肢が増えるほど押す場所が増え、画面がうるさくなる
 *   - 行ごとに升の幅が変わり、揃って見えない
 * ホイールなら列の幅は選択肢の数に依らず、見えるのは「いま」と「その隣」だけになる。
 *
 * 仕組みは CSS の scroll-snap。1行ぶんの上下余白を持たせて、先頭と末尾も真ん中に止まれるようにする。
 * 止まった位置から行を割り出して onChange を呼ぶ。外から値が変わったら、その行へ滑らせる。
 *
 * 押せない値は薄く残す。そこで止まったら**いちばん近い押せる値へ滑り戻す**。
 * 消してしまうと「なぜ無いのか」が分からず、押せるように見せると裏切る。
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export interface WheelOption<T extends string | number> {
  readonly value: T;
  /** 読み上げと title。node が無ければこれを表示する */
  readonly label: string;
  /** 表示に使う印や装飾。書体の見本・色の見本など */
  readonly node?: React.ReactNode;
  readonly style?: React.CSSProperties;
  readonly disabled?: boolean;
}

const reduced = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Wheel<T extends string | number>({
  caption,
  label,
  options,
  value,
  onChange,
  onDisabledPick,
  disabled = false,
  wide = false,
}: {
  /** 列の上に出す短い見出し。無ければ出さない */
  caption?: string;
  label: string;
  options: readonly WheelOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** 押せない値に止まった／押されたとき。既定は何もしない */
  onDisabledPick?: (v: T) => void;
  /** 列ごと押せなくする（全面のときの地色など） */
  disabled?: boolean;
  /** 幅を広く取る列（色名・書体名） */
  wide?: boolean;
}): React.ReactElement {
  const viewRef = useRef<HTMLDivElement | null>(null);
  const firstRef = useRef(true);
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const rowOf = useCallback((): number => {
    const el = viewRef.current?.querySelector<HTMLElement>('.wheel__item');
    return el?.offsetHeight ?? 44;
  }, []);

  /* 外から値が変わったら、その行へ。初回は滑らせずに置く */
  useLayoutEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const top = idx * rowOf();
    const jump = firstRef.current || reduced();
    firstRef.current = false;
    if (Math.abs(v.scrollTop - top) < 1) return;
    v.scrollTo({ top, behavior: jump ? 'auto' : 'smooth' });
  }, [idx, options.length, rowOf]);

  /* 止まった行を値にする */
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    let timer: number | null = null;

    const settle = (): void => {
      const row = rowOf();
      const i = Math.min(options.length - 1, Math.max(0, Math.round(v.scrollTop / row)));
      const o = options[i];
      if (!o) return;
      if (disabled || o.disabled) {
        onDisabledPick?.(o.value);
        // いちばん近い押せる行へ戻す。無ければいまの値の行へ
        let best = -1;
        for (let d = 1; best < 0 && d < options.length; d++) {
          const lo = options[i - d];
          const hi = options[i + d];
          if (lo && !lo.disabled) best = i - d;
          else if (hi && !hi.disabled) best = i + d;
        }
        if (best < 0 || disabled) best = idx;
        v.scrollTo({ top: best * row, behavior: reduced() ? 'auto' : 'smooth' });
        return;
      }
      if (o.value !== value) onChange(o.value);
    };

    // scrollend が無いブラウザでは、スクロールが止まってから少し待って判定する
    const hasScrollEnd = 'onscrollend' in window;
    const onScroll = (): void => {
      if (hasScrollEnd) return;
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(settle, 140);
    };
    v.addEventListener('scroll', onScroll, { passive: true });
    v.addEventListener('scrollend', settle);
    return () => {
      v.removeEventListener('scroll', onScroll);
      v.removeEventListener('scrollend', settle);
      if (timer) clearTimeout(timer);
    };
  }, [options, value, onChange, onDisabledPick, idx, disabled, rowOf]);

  const pick = (i: number): void => {
    const v = viewRef.current;
    const o = options[i];
    if (!v || !o) return;
    if (disabled || o.disabled) {
      onDisabledPick?.(o.value);
      return;
    }
    v.scrollTo({ top: i * rowOf(), behavior: reduced() ? 'auto' : 'smooth' });
    // scrollend を待たずに値を入れる。押した瞬間にプレビューが変わるほうが気持ちがいい
    if (o.value !== value) onChange(o.value);
  };

  return (
    <div className={`wheel${wide ? ' wheel--wide' : ''}`} aria-disabled={disabled || undefined}>
      {caption && <span className="wheel__cap">{caption}</span>}
      <div className="wheel__frame">
        <div className="wheel__view" ref={viewRef} role="radiogroup" aria-label={label}>
          <div className="wheel__pad" aria-hidden="true" />
          {options.map((o, i) => (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={o.value === value}
              aria-disabled={disabled || o.disabled ? true : undefined}
              aria-label={o.node ? o.label : undefined}
              title={o.label}
              className="wheel__item"
              style={o.style}
              tabIndex={o.value === value ? 0 : -1}
              onClick={() => pick(i)}
            >
              {o.node ?? o.label}
            </button>
          ))}
          <div className="wheel__pad" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
