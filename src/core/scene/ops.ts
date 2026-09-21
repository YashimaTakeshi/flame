/**
 * 描画の語彙。**13種で打ち止め**にする。
 *
 * なぜ「すぐ canvas に描く」のではなく「命令の配列を作ってから実行する」のか。
 *
 * 1. **プレビューと書き出しの一致が、構成上の帰結になる。**
 *    命令を作る側は解像度を知らない（buildScene は k を引数に取らない）。
 *    「プレビューのときだけ違う描き方をする」コードを書く場所が構文上存在しない。
 * 2. **ピクセルを作らずにテストできる。** 命令の配列は素の値なので、
 *    「この設定でこの矩形が出る」を高速に検証できる。
 * 3. **Scene 自身が「厳密一致しえない領域」を申告できる**（meta.exactnessExempt）。
 *    文字の輪郭のように原理的に一致しない部分を、テストが免責できる。
 * 4. **Worker にそのまま渡せる**（構造化複製できる素のオブジェクト）。
 * 5. 将来 Canvas 以外の実行層に載せ替えられる。
 *
 * op を増やすときは「既存の組み合わせで作れないこと」を説明すること。
 * 質感はグレイン以外すべてプリミティブに分解してあり、分解できたものは
 * 自動的にスケール不変＝ピクセル一致になる。
 */
import type { Lu, PointLu, RectLu, ScaledLength } from '../units';

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export const rgba = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a });

export interface FontRef {
  readonly family: string;
  readonly weight: 400 | 700;
}

/** 写真の識別子。core は画像の実体を知らない。解決するのは実行層の仕事 */
export type PhotoId = string & { readonly __photo: true };
export const photoId = (s: string): PhotoId => s as PhotoId;

/* ── op の分類 ─────────────────────────────────────────────────
 * invariant     : setTransform(k) だけで正しくなる。実行層は k を意識しなくてよい
 * regenerate-at-k: 実行層が k を受け取り、内部の生成物を作り直す必要がある
 *
 * 後者は **グレインと縦書きの2つだけ** に閉じ込める。
 * 増やすと、そのぶん「プレビューと書き出しが違う」可能性のある面が増える。
 */
export interface ScaleInvariant {
  readonly resolution: 'invariant';
}
export interface ResolutionAware {
  readonly resolution: 'regenerate-at-k';
}

export interface FillRectOp extends ScaleInvariant {
  readonly op: 'fillRect';
  readonly rect: RectLu;
  readonly color: Rgba;
}

export interface FillPathOp extends ScaleInvariant {
  readonly op: 'fillPath';
  /** 閉多角形。印画紙のフチやコマ枠の切り欠きに使う */
  readonly points: readonly PointLu[];
  readonly color: Rgba;
  readonly evenOdd?: boolean;
}

export interface StrokeRectOp {
  readonly op: 'strokeRect';
  readonly rect: RectLu;
  readonly color: Rgba;
  readonly width: ScaledLength;
  /** プレビューでだけデバイスピクセルに吸着させ、にじみを避ける */
  readonly snap: 'none' | 'device-pixel-when-preview';
  readonly resolution: 'invariant' | 'regenerate-at-k';
}

export interface GradientStop {
  readonly at: number;
  readonly color: Rgba;
}

export interface LinearGradientOp extends ScaleInvariant {
  readonly op: 'linearGradient';
  readonly rect: RectLu;
  readonly from: PointLu;
  readonly to: PointLu;
  readonly stops: readonly GradientStop[];
}

export interface RadialGradientOp extends ScaleInvariant {
  readonly op: 'radialGradient';
  readonly rect: RectLu;
  readonly center: PointLu;
  readonly innerR: Lu;
  readonly outerR: Lu;
  readonly stops: readonly GradientStop[];
}

export interface DrawPhotoOp extends ScaleInvariant {
  readonly op: 'photo';
  readonly photo: PhotoId;
  /**
   * 元画像側の切り出し矩形。**0..1 の正規化座標**。
   * 元の画素数に依存しないので、プレビュー（縮小版）でも書き出し（原寸）でも
   * 同じ領域を指す。ここを画素で持つと、経路が分かれた瞬間にずれる。
   */
  readonly srcNorm: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly dst: RectLu;
}

export interface ClipPushOp extends ScaleInvariant {
  readonly op: 'clipPush';
  readonly shape:
    | { readonly kind: 'rect'; readonly rect: RectLu; readonly radius?: Lu }
    | { readonly kind: 'path'; readonly points: readonly PointLu[] };
}

export interface ClipPopOp extends ScaleInvariant {
  readonly op: 'clipPop';
}

export type BlendMode = 'source-over' | 'multiply' | 'overlay' | 'soft-light' | 'screen';

export interface BlendPushOp extends ScaleInvariant {
  readonly op: 'blendPush';
  readonly mode: BlendMode;
  readonly alpha: number;
}

export interface BlendPopOp extends ScaleInvariant {
  readonly op: 'blendPop';
}

export interface TextOp extends ScaleInvariant {
  readonly op: 'text';
  readonly id: string;
  readonly text: string;
  readonly font: FontRef;
  readonly sizeLu: Lu;
  /** em 比ではなく絶対 lu。実行層は (value*k)+'px' を letterSpacing に入れるだけ */
  readonly letterSpacingLu: Lu;
  readonly color: Rgba;
  readonly anchor: PointLu;
  readonly align: 'left' | 'center' | 'right';
  /** core で確定済みの幅。**実行層は measureText を呼んではならない** */
  readonly measuredWidthLu: Lu;
  /** ヒンティング差の免責領域として meta に集められる */
  readonly boundsLu: RectLu;
}

export interface VerticalTextOp extends ResolutionAware {
  readonly op: 'verticalText';
  readonly id: string;
  readonly text: string;
  readonly font: FontRef;
  readonly sizeLu: Lu;
  readonly lineGapLu: Lu;
  readonly letterSpacingLu: Lu;
  readonly color: Rgba;
  /** 縦組みを流し込む矩形。SVG の viewBox はこの比率で作る */
  readonly box: RectLu;
  readonly raster: 'svg-vertical-rl';
}

export interface GrainOp extends ResolutionAware {
  readonly op: 'grain';
  readonly rect: RectLu;
  /**
   * 粒1個の論理サイズ。
   * ★物理ピクセル固定にすると、書き出しを縮小したときに粒の 89% が消える★
   * （docs/poc/report-grain.md）
   */
  readonly cellLu: Lu;
  readonly intensity: number;
  readonly blend: BlendMode;
  /** 決定論的なノイズの種。写真ごとに固定して、再描画でチラつかせない */
  readonly seed: number;
  readonly chroma: 'mono' | 'rgb';
  /** パターンは変換行列を戻してデバイス空間で敷く */
  readonly space: 'device';
}

export type DrawOp =
  | FillRectOp
  | FillPathOp
  | StrokeRectOp
  | LinearGradientOp
  | RadialGradientOp
  | DrawPhotoOp
  | ClipPushOp
  | ClipPopOp
  | BlendPushOp
  | BlendPopOp
  | TextOp
  | VerticalTextOp
  | GrainOp;

/** 実行層が k を見て作り直す必要がある op か */
export const isResolutionAware = (op: DrawOp): boolean =>
  'resolution' in op && op.resolution === 'regenerate-at-k';

export const cssColor = (c: Rgba): string =>
  c.a >= 1 ? `rgb(${c.r},${c.g},${c.b})` : `rgba(${c.r},${c.g},${c.b},${c.a})`;
