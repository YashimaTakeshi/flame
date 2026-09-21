/**
 * 文字の描画。**fillText を呼ぶのはこのファイルだけ**（eslint.config.js で強制）。
 *
 * 台帳に無い書体では描かない。読み込みを待たずに描くと、警告も例外も出ないまま
 * フォールバック書体で保存されるため（docs/poc/report-fonts.md）。
 */
import { cssColor, type TextOp } from '../../core/scene/ops';
import type { Ctx } from '../guards';
import { assertReady } from '../resources/fonts';

/**
 * 解像度を引数に取らないのが要点。
 * 呼び出し側が setTransform(k) を掛けているので、論理単位のまま指定すれば
 * プレビューでも書き出しでも同じ見た目になる。ここで k を掛けると二重になる。
 */
export function execText(op: TextOp, ctx: Ctx): void {
  assertReady(op.font); // ★台帳に無ければここで止める★

  // 論理単位のまま指定する。呼び出し側が setTransform(k) を掛けているので、
  // ここで k を掛けると二重になる
  ctx.font = `${op.font.weight} ${op.sizeLu}px "${op.font.family}"`;
  if ('letterSpacing' in ctx) {
    (ctx as { letterSpacing: string }).letterSpacing = `${op.letterSpacingLu}px`;
  }
  ctx.textAlign = op.align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = cssColor(op.color);
  ctx.fillText(op.text, op.anchor.x, op.anchor.y);
}
