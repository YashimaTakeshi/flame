/** 描画命令を積むだけの薄い器。免責領域と使用文字を同時に集める */
import type { RectLu } from '../units';
import type { DrawOp, FontRef } from './ops';

export class SceneBuilder {
  private readonly ops: DrawOp[] = [];
  private readonly exempt: RectLu[] = [];
  private readonly chars = new Set<string>();
  private readonly fonts = new Map<string, FontRef>();

  add(op: DrawOp): this {
    this.ops.push(op);
    // 文字・縦組み・グレインは原理的に数画素ぶれる。免責領域として集めておく
    if (op.op === 'text') {
      this.exempt.push(op.boundsLu);
      for (const ch of op.text) this.chars.add(ch);
      this.fonts.set(`${op.font.family}/${op.font.weight}`, op.font);
    } else if (op.op === 'verticalText') {
      this.exempt.push(op.box);
      for (const ch of op.text) this.chars.add(ch);
      this.fonts.set(`${op.font.family}/${op.font.weight}`, op.font);
    } else if (op.op === 'grain') {
      this.exempt.push(op.rect);
    } else if (op.op === 'strokeRect' && op.width.mode === 'hairline') {
      this.exempt.push(op.rect);
    }
    return this;
  }

  addAll(ops: readonly DrawOp[]): this {
    for (const op of ops) this.add(op);
    return this;
  }

  /** 免責領域を明示的に足す（op から導けないものだけ） */
  exemptRect(rect: RectLu): this {
    this.exempt.push(rect);
    return this;
  }

  build(): {
    ops: readonly DrawOp[];
    exactnessExempt: readonly RectLu[];
    charsUsed: string;
    fontsUsed: readonly FontRef[];
  } {
    return {
      ops: this.ops,
      exactnessExempt: this.exempt,
      charsUsed: [...this.chars].join(''),
      fontsUsed: [...this.fonts.values()],
    };
  }
}
