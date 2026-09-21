/**
 * スタイルの型。
 *
 * スタイルは**データ**であって、コードではない。`registry.ts` にオブジェクトを
 * 1つ足せば、チップ・レイアウト・組版・テストのすべてが自動で付いてくる。
 * コードを触るのは、新しい `CaptionPlace` や `crop` を導入したときだけ。
 */
import type { Lu } from '../units';

export type StyleId =
  | 'OR1' | 'OR2' | 'OR3'
  | 'SQ1' | 'SQ2' | 'SQ3' | 'SQ4'
  | 'TF1'
  | 'FF1' | 'FF2' | 'FF3'
  | 'NST1'
  | 'STN1' | 'STN2' | 'STN3';

export type StyleGroup = 'OR' | 'SQ' | 'TF' | 'FF' | 'NST' | 'STN';

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
  | { readonly kind: 'derived' } // 写真比から高さを算出（OR群）
  | { readonly kind: 'fixed'; readonly aspect: readonly [number, number] };

export interface InsetLu {
  readonly top: Lu;
  readonly right: Lu;
  readonly bottom: Lu;
  readonly left: Lu;
}

export interface PhotoSlot {
  readonly fit: 'contain' | 'cover';
  readonly crop: 'none' | 'square' | 'toCanvas';
  readonly inset: InsetLu;
  readonly anchor: 'top' | 'center' | 'bottom';
  /** true なら inset を無視して全面に敷く */
  readonly bleed: boolean;
}

export type CaptionPlace =
  | 'below-photo'
  | 'above-photo'
  | 'bottom-band' // 下部に確保した固定帯の中（ポラロイド）
  | 'right-of-photo'
  | 'overlay-bottom'; // 写真の上に重ねる

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
  /** キャプションの左右インセット */
  readonly sideInsetLu: Lu;
  /** キャンバス端（下 or 上）からの距離 */
  readonly outerInsetLu: Lu;
  /** bottom-band / right-of-photo の帯 */
  readonly bandLu?: Lu;
  readonly bandAlign?: 'start' | 'center' | 'end';
  readonly lines: readonly CaptionLineSpec[];
  /** overlay-bottom のみ。写真の上に敷く暗幕 */
  readonly scrim?: { readonly heightLu: Lu; readonly alpha: number };
}

export interface StyleDef {
  readonly id: StyleId;
  readonly group: StyleGroup;
  /** aria-label と自己診断に出す */
  readonly label: string;
  /** チップに出す '1:1' 等 */
  readonly ratioLabel: string;
  readonly canvas: CanvasSpec;
  readonly photo: PhotoSlot;
  readonly caption: CaptionBlockSpec;
  /** アスペクト比による体感差の吸収 */
  readonly typeScale: number;
  readonly defaults: {
    readonly align: Align;
    readonly tracking: TrackingId;
    readonly size: SizeId;
  };
  readonly visibleIn: readonly ('kodawaru' | 'otegaru')[];
  /**
   * 参考アプリから何が読み取れたか。
   * **余白・字送り・行送りの数値は15スタイルすべてで推定値である。**
   * どれが未確認かをコードから引けるようにしてある。
   */
  readonly confidence: 'observed' | 'partly-observed' | 'estimated';
  readonly note?: string;
}
