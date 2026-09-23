/**
 * Scene は「何を描くか」だけを持ち、「どの大きさで描くか」は持たない。
 *
 * 解像度は RenderTarget にしか存在しない。この分離が、
 * 「プレビューだけ違う描画をする」コードを書けなくしている。
 */
import type { Lu, RectLu } from '../units';
import type { FieldId, StyleSpec } from '../styles/types';
import type { DrawOp, FontRef, Rgba } from './ops';

export interface Scene {
  readonly schema: 1;
  readonly canvas: {
    readonly widthLu: Lu; // 常に 1000
    readonly heightLu: Lu; // スタイル比または写真比から決まる
    readonly background: Rgba;
  };
  readonly ops: readonly DrawOp[];
  readonly meta: SceneMeta;
}

export interface SceneMeta {
  readonly style: StyleSpec;
  /**
   * 厳密な一致を要求しない領域。
   * 文字の輪郭・縦組み・ヘアライン・グレインは、原理的にプレビューと書き出しで
   * 数画素ぶれる（実測 0.159%、差分はすべて文字の縁）。
   * パリティテストはこの領域を除いた部分に、より厳しい基準を課す。
   */
  readonly exactnessExempt: readonly RectLu[];
  /** 実際に描かれる文字の集合。和文のカバレッジ検査と取り寄せの入力になる */
  readonly charsUsed: string;
  readonly fontsUsed: readonly FontRef[];
  readonly warnings: readonly SceneWarning[];
  /** 写真の位置・文字の寄せが効くか（layout.ts の freedom）。UI が効かない点を薄くする */
  readonly freedom?: { readonly photoX: boolean; readonly photoY: boolean; readonly textY: boolean };
  /** この比率・写真・文字の大きさで入る行数（1〜4）。UI は超える行数を薄くする */
  readonly linesFit?: number;
}

export type DegradeStep = 'strip-after-pipe' | 'abbreviate' | 'drop';

export type SceneWarning =
  | { readonly kind: 'exif-missing'; readonly fields: readonly FieldId[] }
  | { readonly kind: 'caption-shrunk'; readonly line: number; readonly factor: number }
  | {
      readonly kind: 'caption-degraded';
      readonly line: number;
      readonly field: FieldId;
      readonly step: DegradeStep;
    }
  | { readonly kind: 'caption-wrapped'; readonly line: number; readonly extraLines: number }
  | { readonly kind: 'caption-truncated'; readonly line: number; readonly field: FieldId }
  | { readonly kind: 'caption-empty' }
  /** 選んだ行数では高すぎた（写真が潰れる／重ねで写真を覆う）ので行数を減らした */
  | { readonly kind: 'caption-lines-reduced'; readonly from: number; readonly to: number }
  | { readonly kind: 'band-expanded'; readonly fromLu: number; readonly toLu: number }
  | { readonly kind: 'low-contrast'; readonly ratio: number };

/**
 * 解像度。**ここにしか存在しない。**
 *
 * kExport は「この描画が立っている書き出しの倍率」。
 * プレビューでも、いまの書き出し設定で書き出したときの倍率を持つ。
 * グレインのタイルはこの値で作る（docs/poc/report-grain.md の実測による）。
 * Scene には入らないので、buildScene が k を取らないという不変条件は保たれる。
 */
export interface RenderTarget {
  readonly widthPx: number;
  readonly heightPx: number;
  /** k = widthPx / scene.canvas.widthLu */
  readonly k: number;
  readonly kExport: number;
  readonly kind: 'preview' | 'export' | 'thumbnail';
  readonly dpr: number;
}
