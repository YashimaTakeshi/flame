/**
 * core が外界に求める唯一の能力。
 *
 * 文字の幅はフォントの実体を見ないと分からないが、core はフォントを知らない。
 * そこでポートとして切り出し、実行層から注入する。
 *
 * **基準サイズ 100px で1回だけ測り、あとは線形に換算する。**
 * 実測でスケールが厳密に比例することを確認している（letterSpacing の比が
 * 7.500000 で期待値と完全一致・docs/poc/report-canvas.md）。
 * プレビューと書き出しで測り直さないので、両者が同じ値を使うことが保証される。
 */
import type { FontRef } from './scene/ops';

/** 測定の基準サイズ。この値で測って、実サイズ / 100 を掛ける */
export const REFERENCE_EM = 100;

export interface GlyphMetrics {
  /** 基準サイズで測った前進幅の合計（字間は含まない） */
  readonly advanceAtRef: number;
  readonly ascentAtRef: number;
  readonly descentAtRef: number;
}

export interface TextMeasurer {
  /** 字間抜きの素の前進幅を、基準サイズで測る */
  measure(text: string, font: FontRef): GlyphMetrics;
  /** その書体が本当に使えるか（台帳を見る。document.fonts.check() は使わない） */
  isAvailable(font: FontRef): boolean;
}

/** 同梱書体に文字が収録されているか。豆腐（□）の焼き込みを防ぐ */
export interface CoverageOracle {
  covers(codePoint: number, font: FontRef): boolean;
}

/**
 * 測った幅を実サイズに換算する。
 * 字間は文字数 - 1 個ぶん入る（末尾には付けない）。
 */
export function advanceFor(
  metrics: GlyphMetrics,
  sizeLu: number,
  letterSpacingLu: number,
  charCount: number,
): number {
  const base = (metrics.advanceAtRef * sizeLu) / REFERENCE_EM;
  const gaps = Math.max(0, charCount - 1);
  return base + gaps * letterSpacingLu;
}

export const ascentFor = (m: GlyphMetrics, sizeLu: number): number =>
  (m.ascentAtRef * sizeLu) / REFERENCE_EM;

export const descentFor = (m: GlyphMetrics, sizeLu: number): number =>
  (m.descentAtRef * sizeLu) / REFERENCE_EM;
