/** 15スタイルが共有するトークンと、行構成の断片 */
import { lu, type Lu } from '../units';
import type {
  FieldId,
  FieldToken,
  LineLayout,
  InsetLu,
  SeparatorId,
  SettingGate,
  SizeId,
  TrackingId,
} from './types';

/** ブロック基準の em サイズ（論理単位）。推定値 */
export const SIZE_LU: Record<SizeId, number> = { Small: 13, Medium: 16, Large: 20 };

/**
 * 字間を em 比で持つ。実行時に実サイズを掛けて lu に落とす。
 * 絶対 lu で持つと、行ごとの relSize を掛けたときに字間だけ相対的に広がる。
 */
export const TRACKING_EM: Record<TrackingId, number> = {
  Tight: -0.015,
  Normal: 0,
  Wide: 0.09,
  Widest: 0.18,
};

export const SEPARATORS: Record<SeparatorId, string> = {
  comma: ', ',
  middot: ' · ',
  slash: ' / ',
  emdash: ' — ',
  pipe: ' | ',
  space: ' ',
  none: '',
};

export const F = (id: FieldId, gate?: SettingGate): FieldToken =>
  gate === undefined ? { t: 'field', id } : { t: 'field', id, gate };

export const ins = (top: number, right: number, bottom: number, left: number): InsetLu => ({
  top: lu(top),
  right: lu(right),
  bottom: lu(bottom),
  left: lu(left),
});

export const L = (n: number): Lu => lu(n);

/* ── 行の割り振り（利用者が情報タブで並べ替える） ─────────── */

/** 設定で切れる項目と、そのゲート。行に並べるときに付ける */
export const GATE_OF: Readonly<Partial<Record<FieldId, SettingGate>>> = {
  artist: 'artistEnabled',
  focalLength: 'focalEnabled',
  exposure: 'exposureEnabled',
  place: 'placeEnabled',
};

/**
 * 既定の割り振り。以前の固定の組みをそのまま再現する
 *   3行: タイトル・作者・日付 ／ カメラ ／ レンズ・仕上がり・焦点距離・露出・撮影地
 *   2行: 1行目はそのまま、2行目に残り全部（以前は焦点距離が抜けていた）
 *   1行: 全部を1行（LINE_ALL_IN_ONE と同じ順）
 */
export const DEFAULT_LINE_LAYOUT: LineLayout = [
  ['title', 'artist', 'date'],
  ['camera'],
  ['lens', 'film', 'focalLength', 'exposure', 'place'],
];

/** 行数 n に合わせた組。n を超える組は最後の行に続ける */
export function groupsFor(layout: LineLayout, n: number): FieldId[][] {
  const out: FieldId[][] = [];
  for (let k = 0; k < n; k++) out.push([...(layout[k] ?? [])]);
  for (let k = n; k < layout.length; k++) out[n - 1]!.push(...(layout[k] ?? []));
  return out;
}

/** 組の項目を、行に並べる字句に直す（ゲートを付ける） */
export const tokensOf = (ids: readonly FieldId[]): FieldToken[] => ids.map((id) => F(id, GATE_OF[id]));
