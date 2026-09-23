/**
 * 操作の部品。**値の種類ごとに、一目で分かる形を使い分ける**（Lightroom と同じ考え方）。
 *
 *   段のある量（余白・大きさ・字間）… Stepper（段つきのスライダー。両端と今の値が読める）
 *   形で分かる選択（比率・置き場所）… Pics（絵のボタン。文字ではなく形で選ぶ）
 *   帯の中の位置 ……………………………… Anchor（3×3 の点。左右と上下が1回で決まる）
 *   色 …………………………………………………… Swatches（色の丸）
 *   載せる／載せない ………………………… Switch
 *
 * 以前はすべて縦に回すホイールで、どれも同じ見た目の文字のボタンだった。
 * 何を選んでいるのかが形から分からず、「全部ボタン式で分かりづらい」と指摘された。
 *
 * 共通の決まり:
 *   - 押せない値は消さずに薄く残す。押したら理由を1行で出す（onDisabledPick）
 *   - 選択中は白の線＋一段明るい地。画面のどこでも同じ見え方
 *   - 指で狙える大きさは 44px 以上
 */
export interface Opt<T> {
  readonly value: T;
  /** 読み上げと title。絵のボタンでは画面に出ない */
  readonly label: string;
  /** 絵。無ければ label を文字で出す */
  readonly icon?: React.ReactNode;
  /** 絵の下に添える短い文字（比率の「4:5」など） */
  readonly text?: string;
  readonly disabled?: boolean;
}

/** 左に見出し、右に部品。パネルはこの行を縦に積む */
export function Row({
  label,
  note,
  dim = false,
  children,
}: {
  label: string;
  /** 見出しの下に小さく添える今の値（色の名前など、形だけでは見分けにくいもの） */
  note?: string | undefined;
  dim?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="prow">
      <span className="prow__lbl" data-dim={dim || undefined}>
        {label}
        {note && <small>{note}</small>}
      </span>
      <div className="prow__ctl">{children}</div>
    </div>
  );
}

/**
 * 段つきのスライダー。中身は input[type=range] なので、キーボードと読み上げがそのまま効く。
 * 目盛りは段の数だけ。ダブルクリック（ダブルタップ）で既定の段に戻る（Lightroom と同じ）。
 */
export function Stepper<T extends string>({
  label,
  options,
  value,
  onChange,
  defaultValue,
  disabled = false,
  onDisabledPick,
  ends,
}: {
  label: string;
  options: readonly Opt<T>[];
  value: T;
  onChange: (v: T) => void;
  defaultValue?: T;
  disabled?: boolean;
  onDisabledPick?: () => void;
  /** 両端の言葉（なし〜広 など）。無ければ出さない */
  ends?: readonly [string, string];
}): React.ReactElement {
  const n = options.length;
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  const p = n > 1 ? i / (n - 1) : 0;
  const pick = (k: number): void => {
    const o = options[k];
    if (!o || o.value === value) return;
    if (disabled || o.disabled) {
      onDisabledPick?.();
      return;
    }
    onChange(o.value);
  };
  return (
    <div className="stepper" data-disabled={disabled || undefined}>
      <div
        className="stepper__track"
        style={{ '--p': p } as React.CSSProperties}
        onPointerDown={disabled ? () => onDisabledPick?.() : undefined}
      >
        <span className="stepper__ticks" aria-hidden="true">
          {options.map((o, k) => (
            <i key={String(o.value)} style={{ left: `${n > 1 ? (k / (n - 1)) * 100 : 0}%` }} />
          ))}
        </span>
        <input
          type="range"
          min={0}
          max={n - 1}
          step={1}
          value={i}
          aria-label={label}
          aria-valuetext={options[i]?.label}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : 0}
          onChange={(e) => pick(Number(e.target.value))}
          onDoubleClick={() => {
            if (defaultValue === undefined || disabled) return;
            const k = options.findIndex((o) => o.value === defaultValue);
            if (k >= 0) pick(k);
          }}
        />
        {ends && (
          <span className="stepper__ends" aria-hidden="true">
            <span>{ends[0]}</span>
            <span>{ends[1]}</span>
          </span>
        )}
      </div>
      <span className="stepper__val" aria-hidden="true">
        {options[i]?.label}
      </span>
    </div>
  );
}

/** 絵のボタンの並び。1つだけ選ぶ */
export function Pics<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  onDisabledPick,
  variant,
}: {
  label: string;
  options: readonly Opt<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  onDisabledPick?: (v: T) => void;
  /** shape … 絵の下に文字を添える（比率）。text … 文字だけのボタン */
  variant?: 'shape' | 'text';
}): React.ReactElement {
  return (
    <div className="pics" role="radiogroup" aria-label={label} data-variant={variant} data-disabled={disabled || undefined}>
      {options.map((o) => {
        const dead = disabled || o.disabled === true;
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            className="pic"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            aria-disabled={dead || undefined}
            onClick={() => {
              if (dead) onDisabledPick?.(o.value);
              else if (!on) onChange(o.value);
            }}
          >
            {o.icon ?? <span className="pic__txt">{o.text ?? o.label}</span>}
            {o.icon && o.text && <span className="pic__cap">{o.text}</span>}
          </button>
        );
      })}
    </div>
  );
}

export type H = 'left' | 'center' | 'right';
export type V = 'start' | 'center' | 'end';
const HS: readonly H[] = ['left', 'center', 'right'];
const VS: readonly V[] = ['start', 'center', 'end'];
const H_JA: Record<H, string> = { left: '左', center: '中央', right: '右' };
const V_JA: Record<V, string> = { start: '上', center: '中', end: '下' };

/**
 * 3×3 の点。帯の中のどこに置くかを1回で決める。
 * 以前は「揃え（左右）」が組みタブ、「寄せ（上下）」が配置タブに分かれていた。
 *
 * lockV … 上下が決まっているとき（写真の上辺・下辺に重ねるときは辺に付く）。
 * その行だけが生きていて、どの点を押しても左右だけが変わる
 */
export function Anchor({
  label,
  h,
  v,
  onChange,
  lockV,
  activeH = true,
  activeV = true,
  disabled = false,
  onDisabledPick,
}: {
  label: string;
  h: H;
  v: V;
  onChange: (h: H, v: V) => void;
  lockV?: V | undefined;
  /**
   * 左右・上下が効くか。効かない軸は真ん中の列（行）だけを生かし、ほかは薄くする。
   * 値は書き換えない（覚えておき、効くようになったらその位置に戻る）
   */
  activeH?: boolean;
  activeV?: boolean;
  disabled?: boolean;
  /** 押せない点を押したとき。どちらの軸が効かないかを渡す */
  onDisabledPick?: (why: 'all' | 'h' | 'v') => void;
}): React.ReactElement {
  const shownV = lockV ?? (activeV ? v : 'center');
  const shownH = activeH ? h : 'center';
  return (
    <div className="anchor" role="radiogroup" aria-label={label} data-disabled={disabled || undefined}>
      {VS.map((vv) =>
        HS.map((hh) => {
          const on = hh === shownH && vv === shownV;
          const lockedOut = lockV !== undefined && vv !== lockV;
          const deadH = !activeH && hh !== 'center';
          const deadV = lockV === undefined && !activeV && vv !== 'center';
          return (
            <button
              key={`${vv}-${hh}`}
              type="button"
              role="radio"
              className="anchor__pt"
              aria-checked={on}
              aria-label={lockV ? H_JA[hh] : `${V_JA[vv]}・${H_JA[hh]}`}
              aria-disabled={disabled || deadH || deadV || undefined}
              data-off={lockedOut || deadH || deadV || undefined}
              onClick={() => {
                if (disabled) {
                  onDisabledPick?.('all');
                  return;
                }
                if (deadH || deadV) {
                  onDisabledPick?.(deadH ? 'h' : 'v');
                  return;
                }
                // 効かない軸の値はそのまま（覚えておく）
                onChange(activeH ? hh : h, lockV !== undefined || !activeV ? v : vv);
              }}
            >
              <i />
            </button>
          );
        }),
      )}
    </div>
  );
}

/** 色の丸 */
export function Swatches({
  label,
  options,
  value,
  onChange,
  disabled = false,
  onDisabledPick,
}: {
  label: string;
  options: readonly { key: string; label: string; css: string }[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
  onDisabledPick?: () => void;
}): React.ReactElement {
  return (
    <div className="swatches" role="radiogroup" aria-label={label} data-disabled={disabled || undefined}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          className="swatch"
          aria-checked={o.key === value}
          aria-label={o.label}
          title={o.label}
          aria-disabled={disabled || undefined}
          style={{ '--c': o.css } as React.CSSProperties}
          onClick={() => (disabled ? onDisabledPick?.() : onChange(o.key))}
        />
      ))}
    </div>
  );
}

/** 入り／切り */
export function Switch({
  label,
  on,
  onChange,
  disabled = false,
  onDisabledPick,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  onDisabledPick?: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={on}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={() => (disabled ? onDisabledPick?.() : onChange(!on))}
    >
      <i />
    </button>
  );
}
