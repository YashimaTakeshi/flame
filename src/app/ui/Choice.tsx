/**
 * 「選ぶ」の入口。画面の組み方で見た目を替える。
 *
 *   phone … ホイール（指で回す）
 *   desk  … 押しボタンの並び（鼠で1回押す）
 *
 * 各パネルはこれだけを使う。どちらの見た目になるかをパネルは知らない。
 * 見た目を足したり替えたりするとき、直す場所はここ1つになる。
 */
import { useLayoutMode } from '../layout';
import { Segmented } from './Segmented';
import { Wheel, type WheelOption } from './Wheel';

export function Choice<T extends string | number>(props: {
  caption?: string;
  label: string;
  options: readonly WheelOption<T>[];
  value: T;
  onChange: (v: T) => void;
  onDisabledPick?: (v: T) => void;
  disabled?: boolean;
  wide?: boolean;
}): React.ReactElement {
  const mode = useLayoutMode();
  return mode === 'desk' ? <Segmented {...props} /> : <Wheel {...props} />;
}
