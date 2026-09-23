/** 15スタイルが共有するトークンと、行構成の断片 */
import { lu, type Lu } from '../units';
import type {
  FieldId,
  FieldToken,
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

/* ── よく使う行構成の断片 ───────────────────────────────── */

export const LINE_ALL_IN_ONE: readonly FieldToken[] = [
  F('title'),
  // 1行の組みにも作者を入れる。以前は入っておらず、情報で作者を載せても1行だと出なかった
  F('artist', 'artistEnabled'),
  F('date'),
  F('camera'),
  F('lens'),
  F('film'),
  F('focalLength', 'focalEnabled'),
  F('exposure', 'exposureEnabled'),
  F('place', 'placeEnabled'),
];

export const LINE_TITLE_DATE: readonly FieldToken[] = [
  F('title'),
  F('artist', 'artistEnabled'),
  F('date'),
];

export const LINE_CAMERA: readonly FieldToken[] = [F('camera')];

export const LINE_LENS_TECH: readonly FieldToken[] = [
  F('lens'),
  F('film'),
  F('focalLength', 'focalEnabled'),
  F('exposure', 'exposureEnabled'),
];

export const LINE_TECH_PLACE: readonly FieldToken[] = [
  F('camera'),
  F('lens'),
  F('film'),
  F('exposure', 'exposureEnabled'),
  F('place', 'placeEnabled'),
];
