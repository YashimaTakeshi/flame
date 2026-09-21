/**
 * 座標系。
 *
 * このアプリの描画は「キャンバス幅を常に 1000 とする論理座標系」で組み立て、
 * 実行するときに倍率 k を掛ける。プレビュー（幅800px）と書き出し（幅6000px）で
 * 同じ命令列を使い、k だけを変える。
 *
 * 幅 1000 を基準にする理由は docs/design.md §2.2 にある。要点は、
 * 横組みキャプションの見かけの大きさがフレームの幅に対する比で決まること、
 * そして k がスカラー1個で済むこと（縦横別倍率にすると線幅や字間が非等方に歪む）。
 *
 * Lu と Px は名前だけの別型にしてある。数値としては同じ number だが、
 * 論理単位のつもりでデバイスピクセルを渡す取り違えを型で止められる。
 */

declare const LU: unique symbol;
declare const PX: unique symbol;

/** 論理単位。キャンバス幅を常に 1000 とする座標系上の長さ */
export type Lu = number & { readonly [LU]: true };

/** 出力先のデバイスピクセル */
export type Px = number & { readonly [PX]: true };

export const lu = (n: number): Lu => n as Lu;
export const px = (n: number): Px => n as Px;

/** キャンバスの幅は常にこの値。高さはスタイルと写真の比から決まる */
export const CANVAS_WIDTH_LU: Lu = lu(1000);

export interface PointLu {
  readonly x: Lu;
  readonly y: Lu;
}

export interface SizeLu {
  readonly w: Lu;
  readonly h: Lu;
}

export interface RectLu {
  readonly x: Lu;
  readonly y: Lu;
  readonly w: Lu;
  readonly h: Lu;
}

export const point = (x: number, y: number): PointLu => ({ x: lu(x), y: lu(y) });
export const size = (w: number, h: number): SizeLu => ({ w: lu(w), h: lu(h) });
export const rect = (x: number, y: number, w: number, h: number): RectLu => ({
  x: lu(x),
  y: lu(y),
  w: lu(w),
  h: lu(h),
});

/**
 * 長さをデバイスピクセルへ直すときの規則。
 *
 * ほとんどの長さは k を掛けるだけでよい（logical）。
 * ヘアラインだけは別で、そのまま掛けるとプレビューで 1px を下回って消えるため、
 * 下限を設ける（hairline）。device は画面 UI 専用で、書き出しには使わない。
 */
export type ScaledLength =
  | { readonly mode: 'logical'; readonly value: Lu }
  | { readonly mode: 'device'; readonly value: Px }
  | { readonly mode: 'hairline'; readonly value: Lu; readonly minPx: Px };

export const logical = (value: Lu): ScaledLength => ({ mode: 'logical', value });
export const device = (value: Px): ScaledLength => ({ mode: 'device', value });
export const hairline = (value: Lu, minPx: Px = px(1)): ScaledLength => ({
  mode: 'hairline',
  value,
  minPx,
});

/**
 * 長さを倍率 k のもとでデバイスピクセルに直す。
 *
 * core では丸めない。デバイスピクセルへのスナップは render 層の、
 * しかも明示的に許可した op でのみ行う（docs/design.md §2.2）。
 */
export function resolveLength(len: ScaledLength, k: number): Px {
  switch (len.mode) {
    case 'logical':
      return px(len.value * k);
    case 'device':
      return len.value;
    case 'hairline':
      return px(Math.max(len.value * k, len.minPx));
  }
}

export const rectContains = (r: RectLu, p: PointLu): boolean =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** 矩形を内側に縮める。負の値を渡せば広がる */
export const inset = (r: RectLu, top: number, right = top, bottom = top, left = right): RectLu =>
  rect(r.x + left, r.y + top, r.w - left - right, r.h - top - bottom);
