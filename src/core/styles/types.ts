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
/**
 * キャンバスの比率。SNS で使う比率を揃えた（依頼者の要望で 2:3 と 1.91:1 を足した）
 *   OR 元比 / FF 4:5 / TF 3:4 / TT 2:3 / SQ 1:1 / NST 9:16 / STN 16:9 / IGL 1.91:1
 */
export type Ratio = 'OR' | 'SQ' | 'TF' | 'FF' | 'TT' | 'NST' | 'STN' | 'IGL';

/**
 * 写真を額の中でどちらに寄せるか。3×3 の9通り（UI も 3×3 の点）。
 * 写真は額の余りの中に収めるので、余りがあるのは横か縦のどちらか一方だけ。
 * 余りの無い軸の指定は効かないが、**消さずに覚えておく**（比率や写真を替えて余りが出たら効く）。
 * 以前は5通りで、効かない組み合わせを避けるため文字の辺を勝手に変えていた（依頼者が混乱した）。
 * 全面（余白なし）では使わない（切り取りの位置は指で決める）。
 */
export type PhotoPlace =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/**
 * 文字をどの辺に置くか。
 * 余白があれば額の帯に、余白が「なし」なら**写真の上のその辺に重ねる**。
 * 以前は「重ね」が5つ目の選択肢で、余白「なし」と同じ状態の入口が2つあった。
 * しかも重ねは下にしか置けなかった（利用者に指摘された）
 */
export type CaptionPlace = 'above' | 'below' | 'left' | 'right';

export type LineCount = 1 | 2 | 3 | 4;

/** 余白の広さ。none は写真がキャンバスの端まで届く（全面） */
export type MarginId = 'thin' | 'narrow' | 'normal' | 'wide' | 'none';

/**
 * 文字を、その帯の中で上下どこに寄せるか。
 * 写真を上に寄せたときの下の余白、左右の段の中、どちらもこれで決まる。
 * 帯に余りが無ければ（写真が中央で余白がぴったり）効かない。重ねでは使わない。
 */
export type CaptionAlign = 'start' | 'center' | 'end';

/** 利用者が選ぶ6つ。これが「スタイル」のすべて */
export interface StyleSpec {
  readonly ratio: Ratio;
  readonly photo: PhotoPlace;
  readonly caption: CaptionPlace;
  readonly captionAlign: CaptionAlign;
  readonly lines: LineCount;
  readonly margin: MarginId;
}

/**
 * 全面（余白なし）のときの切り取りの中心。0..1 の正規化座標。
 * 利用者がプレビューを指で動かして決める。余る軸だけが効く。
 */
export interface Focus {
  readonly x: number;
  readonly y: number;
}

export const CENTER_FOCUS: Focus = { x: 0.5, y: 0.5 };

/** キャプションに載りうる項目 */
export type FieldId =
  | 'title'
  | 'artist'
  | 'date'
  | 'camera'
  | 'lens'
  | 'exposure'
  | 'focalLength'
  | 'film'
  | 'place';

/**
 * どの項目を何行目に置くか。**いつも4組**（1行目〜4行目）で、組の中は左からの順。
 * 行数が3より少ないときは、はみ出した組を最後の行に続ける（groupsFor）。
 * 利用者が情報タブでドラッグして決める。
 */
export type LineLayout = readonly (readonly FieldId[])[];

/** 利用者の設定で項目ごと消えるもの。欠損（値が無い）とは区別する */
export type SettingGate = 'exposureEnabled' | 'focalEnabled' | 'placeEnabled' | 'artistEnabled';

export type FieldToken =
  | { readonly t: 'field'; readonly id: FieldId; readonly gate?: SettingGate }
  | { readonly t: 'literal'; readonly text: string };

export type SeparatorId = 'comma' | 'middot' | 'slash' | 'emdash' | 'pipe' | 'space' | 'none';

export type TrackingId = 'Tight' | 'Normal' | 'Wide' | 'Widest';
export type SizeId = 'Tiny' | 'Small' | 'Medium' | 'Large';
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
  /** 余白なし。文字を写真の上に重ねる（place の辺に） */
  readonly overlay: boolean;
  /**
   * 重ねのときだけ。写真の上に敷く暗幕。depthLu は辺からの奥行き、
   * plateauAt は暗幕の内側の端（0）から辺（1）のどこで目標の濃さに達するか
   */
  readonly scrim?: { readonly depthLu: Lu; readonly alpha: number; readonly plateauAt: number };
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
