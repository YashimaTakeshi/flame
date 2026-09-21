/**
 * スタイルの型。
 *
 * スタイルは「名前の付いたプリセット」ではなく、**4つの独立した選択の組み合わせ**である。
 *
 *   比率 × 写真の位置 × 文字の位置 × 行数
 *
 * 利用者はこの4つを別々に選ぶ。「OR2」のような名前を覚える必要はなく、
 * 変えた軸が何を動かすかは選択肢の名前そのものが言っている。
 * 組み合わせから寸法（StyleDef）をその場で生成する（spec.ts）。
 */
import type { Lu } from '../units';

/** キャンバスの比率 */
export type Ratio = 'OR' | 'SQ' | 'TF' | 'FF' | 'NST' | 'STN';

/** 写真をどこに置くか。bleed は余白なしの全面 */
export type PhotoPlace = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'bleed';

/** 文字をどこに置くか。overlay は写真の上に重ねる（写真が全面のとき） */
export type CaptionPlace = 'below' | 'above' | 'left' | 'right' | 'overlay';

export type LineCount = 1 | 2 | 3;

/** 利用者が選ぶ4つ。これが「スタイル」のすべて */
export interface StyleSpec {
  readonly ratio: Ratio;
  readonly photo: PhotoPlace;
  readonly caption: CaptionPlace;
  readonly lines: LineCount;
}

/** キャプションに載りうる項目 */
export type FieldId =
  | 'title'
  | 'artist'
  | 'date'
  | 'camera'
  | 'lens'
  | 'exposure'
  | 'focalLength'
  | 'place';

/** 利用者の設定で項目ごと消えるもの。欠損（値が無い）とは区別する */
export type SettingGate = 'exposureEnabled' | 'focalEnabled' | 'placeEnabled' | 'artistEnabled';

export type FieldToken =
  | { readonly t: 'field'; readonly id: FieldId; readonly gate?: SettingGate }
  | { readonly t: 'literal'; readonly text: string };

export type SeparatorId = 'comma' | 'middot' | 'slash' | 'emdash' | 'pipe' | 'space' | 'none';

export type TrackingId = 'Tight' | 'Normal' | 'Wide' | 'Widest';
export type SizeId = 'Small' | 'Medium' | 'Large';
export type Align = 'left' | 'center' | 'right';

export type CanvasSpec =
  | { readonly kind: 'derived' } // 写真比から高さを算出（元比）
  | { readonly kind: 'fixed'; readonly aspect: readonly [number, number] };

export interface InsetLu {
  readonly top: Lu;
  readonly right: Lu;
  readonly bottom: Lu;
  readonly left: Lu;
}

export interface PhotoSlot {
  readonly inset: InsetLu;
  readonly place: PhotoPlace;
}

export interface CaptionLineSpec {
  readonly id: string;
  /** 左から順に。値が無いもの・ゲートで切られたものは詰める */
  readonly fields: readonly FieldToken[];
  readonly separator: SeparatorId;
  readonly emphasis: 'normal' | 'bold' | 'muted';
  /** ブロック基準サイズに対する倍率 */
  readonly relSize: number;
  /** 行の高さ = sizeLu * relSize * leading */
  readonly leading: number;
  readonly alignOverride?: Align;
  /** 折り返しを許す行数。既定 1（＝折り返さない） */
  readonly maxWrap?: number;
}

export interface CaptionBlockSpec {
  readonly place: CaptionPlace;
  /** 写真との距離 */
  readonly gapLu: Lu;
  /** キャプションの左右インセット（上下配置のとき） */
  readonly sideInsetLu: Lu;
  /** キャンバス端からの距離 */
  readonly outerInsetLu: Lu;
  /** 左右配置のときの段の幅。★余白の倍率を掛けない（本文の幅であって余白ではない） */
  readonly bandLu: Lu;
  readonly lines: readonly CaptionLineSpec[];
  /** overlay のみ。写真の上に敷く暗幕 */
  readonly scrim?: { readonly heightLu: Lu; readonly alpha: number };
}

/** 組み合わせから生成される寸法。layout.ts と caption.ts はこれしか見ない */
export interface StyleDef {
  readonly spec: StyleSpec;
  readonly canvas: CanvasSpec;
  readonly photo: PhotoSlot;
  readonly caption: CaptionBlockSpec;
  /** アスペクト比による体感差の吸収 */
  readonly typeScale: number;
}
