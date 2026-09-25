/**
 * 行数。情報タブの「項目」の一覧の上に置く（すぐ下の行の組が増え減りして見える）。
 * 以前は文字タブにも入口があり、同じ設定が2か所にあるように見えた。
 * 比率・写真・文字の大きさで入る行数が変わる。入らない行数は薄くし、押すと理由を出す。
 * 選んだ行数は覚えておき、入るようになれば（比率や大きさを変えれば）その行数に戻る
 */
import type { LineCount } from '../../core/styles/types';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Pics } from '../ui/controls';
import { LINE_OPTIONS } from './constants';

export function LinesPicker({ disabled = false, onDisabledPick }: { disabled?: boolean; onDisabledPick?: () => void }): React.ReactElement {
  const lines = useDoc((s) => s.style.lines);
  const setStyle = useDoc((s) => s.setStyle);
  const fit = useUi((s) => s.linesFit);
  const setHint = useUi((s) => s.setHint);
  const shown = Math.min(lines, fit);
  const options = LINE_OPTIONS.map((o) => (Number(o.value) > fit ? { ...o, disabled: true } : o));
  return (
    <Pics
      label="行数"
      options={options}
      value={`${shown}` as `${LineCount}`}
      onChange={(v) => setStyle({ lines: Number(v) as LineCount })}
      disabled={disabled}
      onDisabledPick={() =>
        disabled ? onDisabledPick?.() : setHint(`この比率・文字の大きさでは${fit}行まで入ります`)
      }
    />
  );
}

/** いま実際に組まれている行数（選んだ行数と入る行数の小さい方） */
export function useLinesUsed(): LineCount {
  const lines = useDoc((s) => s.style.lines);
  const fit = useUi((s) => s.linesFit);
  return Math.min(lines, fit) as LineCount;
}
