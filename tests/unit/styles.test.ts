/**
 * 15スタイルの検査。
 *
 * スタイルは**データ**なので、1つ足したらこのテストが自動でそれも見る。
 * 見ているのは「参考アプリに似ているか」ではなく（それは目で見るしかない）、
 * **破綻していないこと**である。写真がはみ出さない、文字が枠を越えない、
 * 欠損を「（不明）」で埋めない。
 */
import { describe, expect, it } from 'vitest';
import { buildScene, INK, OVERLAY_INK, scrimAlphaAt, WHITE } from '../../src/core/compose';
import { typesetCaption } from '../../src/core/caption';
import type { TextMeasurer } from '../../src/core/ports';
import {
  captionWidthLu,
  layoutViolations,
  MARGIN_SCALE,
  resolveLayout,
  type MarginId,
} from '../../src/core/styles/layout';
import { GROUPS, STYLES, STYLE_IDS } from '../../src/core/styles/registry';
import type { Gates } from '../../src/core/caption';

/**
 * 代用の測定器。
 *
 * 1文字あたり 0.60em で数える。実際の欧文サンセリフの平均（約0.50em）より
 * **広い側**に倒してあるので、ここで収まるものは実書体でも必ず収まる。
 * 逆は保証しないので、見た目の詰めは実機で確かめる（docs/design.md §3.3）。
 */
const WIDE_ADVANCE = 60;
const measurer: TextMeasurer = {
  measure: (text) => ({
    advanceAtRef: [...text].length * WIDE_ADVANCE,
    ascentAtRef: 74,
    descentAtRef: 21,
  }),
  isAvailable: () => true,
};

const ALL_ON: Gates = {
  exposureEnabled: true,
  focalEnabled: true,
  placeEnabled: true,
  artistEnabled: true,
};
const ALL_OFF: Gates = {
  exposureEnabled: false,
  focalEnabled: false,
  placeEnabled: false,
  artistEnabled: false,
};

/** 参考素材そのもの。長いレンズ名を含む、いちばん厳しい入力 */
const REFERENCE = {
  title: 'Untitled',
  artist: 'T. Yashima',
  date: '2026.09.20',
  camera: 'FUJIFILM X-M5',
  lens: 'SIGMA 18-50mm F2.8 DC DN | Contemporary 021',
  focalLength: '28mm',
  exposure: 'F2.8 1/250s ISO200',
  place: '東京都渋谷区',
} as const;

const inputFor = (over: Partial<Parameters<typeof buildScene>[0]> = {}): Parameters<typeof buildScene>[0] => ({
  styleId: 'OR1',
  photo: { id: 'p', aspect: 1.5 },
  facts: REFERENCE,
  gates: ALL_ON,
  family: 'Arimo',
  weight: 400,
  hasBold: true,
  margin: 'normal',
  bordered: false,
  align: 'left',
  tracking: 'Normal',
  size: 'Medium',
  background: WHITE,
  ink: INK,
  ...over,
});

describe('登録簿', () => {
  it('15スタイルある', () => {
    expect(STYLE_IDS).toHaveLength(15);
  });

  it('キーと id が一致し、id の接頭辞が group と一致する', () => {
    for (const id of STYLE_IDS) {
      const def = STYLES[id];
      expect(def.id).toBe(id);
      expect(id.startsWith(def.group)).toBe(true);
    }
  });

  it('比率の6グループに漏れなく振り分けられている', () => {
    const counted = GROUPS.reduce((a, g) => a + g.styles.length, 0);
    expect(counted).toBe(15);
    for (const g of GROUPS) expect(g.styles.length).toBeGreaterThan(0);
  });

  it('お手軽モードで見えるのは6つ', () => {
    const easy = STYLE_IDS.filter((id) => STYLES[id].visibleIn.includes('otegaru'));
    expect(easy).toEqual(['OR1', 'SQ1', 'SQ3', 'TF1', 'FF1', 'NST1']);
  });
});

/** 縦位置から超パノラマまで。実際に来うる比を全部通す */
const ASPECTS = [0.5, 0.75, 1, 4 / 3, 1.5, 16 / 9, 3];

describe('レイアウトが破綻しない', () => {
  const MARGINS = Object.keys(MARGIN_SCALE) as MarginId[];

  it.each(STYLE_IDS)('%s は どの写真比・どの余白でも不変条件を満たす', (id) => {
    const def = STYLES[id];
    for (const aspect of ASPECTS) {
      for (const margin of MARGINS) {
        const t = typesetCaption(
          def,
          { facts: REFERENCE, gates: ALL_ON, size: 'Medium', tracking: 'Normal', align: 'left', family: 'Arimo', weight: 400, hasBold: true },
          captionWidthLu(def, margin),
          measurer,
        );
        const l = resolveLayout(def, aspect, t.heightLu, margin);
        const where = `${id} @ ${aspect.toFixed(2)} / 余白${margin}`;
        expect(layoutViolations(l, def.caption.place), where).toEqual([]);
        expect(l.canvas.h, where).toBeGreaterThan(0);
        expect(l.photo.w, where).toBeGreaterThan(0);
        expect(l.photo.h, where).toBeGreaterThan(0);
      }
    }
  });

  it('余白を狭めると写真が大きくなる（比を固定したスタイル）', () => {
    for (const id of STYLE_IDS) {
      const def = STYLES[id];
      if (def.photo.bleed) continue; // 全面ブリードは余白を持たない
      const wide = resolveLayout(def, 1.5, 40, 'wide').photo;
      const narrow = resolveLayout(def, 1.5, 40, 'narrow').photo;
      expect(narrow.w * narrow.h, id).toBeGreaterThan(wide.w * wide.h);
    }
  });

  it('キャプションの帯も余白と一緒に伸び縮みする', () => {
    const def = STYLES.OR1;
    expect(captionWidthLu(def, 'narrow')).toBeGreaterThan(captionWidthLu(def, 'wide'));
  });

  it('比を固定したスタイルは写真比によらず同じキャンバスになる', () => {
    for (const id of STYLE_IDS) {
      const def = STYLES[id];
      if (def.canvas.kind !== 'fixed') continue;
      const [aw, ah] = def.canvas.aspect;
      for (const aspect of ASPECTS) {
        const l = resolveLayout(def, aspect, 40);
        expect(l.canvas.h, id).toBeCloseTo((1000 * ah) / aw, 6);
      }
    }
  });

  it('元比のスタイルは写真が縦長になるほどキャンバスも伸びる', () => {
    const def = STYLES.OR1;
    const a = resolveLayout(def, 1.5, 40).canvas.h;
    const b = resolveLayout(def, 0.75, 40).canvas.h;
    expect(b).toBeGreaterThan(a);
  });

  it('切り出しは0..1の正規化座標で、元画素数に依らない', () => {
    const l = resolveLayout(STYLES.SQ4, 1.5, 30);
    const s = l.photoSrcNorm;
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.x + s.w).toBeLessThanOrEqual(1.000001);
    expect(s.y + s.h).toBeLessThanOrEqual(1.000001);
    // 3:2 を 1:1 に切るので横が削られる
    expect(s.w).toBeCloseTo(2 / 3, 6);
    expect(s.h).toBe(1);
  });
});

describe('キャプションが枠を越えない', () => {
  it.each(STYLE_IDS)('%s は どの文字設定でも帯の幅に収まる', (id) => {
    const def = STYLES[id];
    const boxW = captionWidthLu(def);
    for (const size of ['Small', 'Medium', 'Large'] as const) {
      for (const tracking of ['Tight', 'Normal', 'Wide', 'Widest'] as const) {
        const t = typesetCaption(
          def,
          { facts: REFERENCE, gates: ALL_ON, size, tracking, align: 'left', family: 'Arimo', weight: 400, hasBold: true },
          boxW,
          measurer,
        );
        for (const line of t.lines) {
          expect(line.widthLu, `${id} ${size}/${tracking}: 「${line.text}」`).toBeLessThanOrEqual(
            boxW + 0.001,
          );
        }
      }
    }
  });
});

describe('欠損の扱い', () => {
  const def = STYLES.OR2;
  const box = captionWidthLu(def);
  const ts = (facts: Record<string, string>, gates: Gates = ALL_ON) =>
    typesetCaption(
      def,
      { facts, gates, size: 'Medium', tracking: 'Normal', align: 'left', family: 'Arimo', weight: 400, hasBold: true },
      box,
      measurer,
    );

  it('無い項目は詰める。「（不明）」のような文字列は作らない', () => {
    const t = ts({ title: 'Untitled', date: '2026.09.20' });
    const joined = t.lines.map((l) => l.text).join('\n');
    expect(joined).toBe('Untitled, 2026.09.20');
    expect(joined).not.toMatch(/不明|undefined|null|N\/A/);
  });

  it('項目が全部無い行は行ごと消える（空行を残さない）', () => {
    const t = ts({ camera: 'FUJIFILM X-M5' });
    expect(t.lines).toHaveLength(1);
    expect(t.lines[0]?.text).toBe('FUJIFILM X-M5');
  });

  it('利用者が切った項目はゲートで消える。欠損とは別の道', () => {
    const on = ts(REFERENCE, ALL_ON).lines.map((l) => l.text).join('\n');
    const off = ts(REFERENCE, ALL_OFF).lines.map((l) => l.text).join('\n');
    expect(on).toContain('F2.8 1/250s ISO200');
    expect(off).not.toContain('F2.8 1/250s ISO200');
  });

  it('何も無ければ行は0本、警告が1つ出る', () => {
    const scene = buildScene(inputFor({ facts: {}, styleId: 'OR2' }), measurer);
    expect(scene.ops.filter((o) => o.op === 'text')).toHaveLength(0);
    expect(scene.meta.warnings).toContainEqual({ kind: 'caption-empty' });
  });
});

describe('はみ出したときのはしご', () => {
  const def = STYLES.STN1; // 16:9・1行・Small。いちばん窮屈
  const box = captionWidthLu(def);
  const long = 'X'.repeat(400);

  it('長すぎる行は黙って溢れず、必ず枠に収まる', () => {
    const t = typesetCaption(
      def,
      { facts: { title: long }, gates: ALL_ON, size: 'Large', tracking: 'Widest', align: 'left', family: 'Arimo', weight: 400, hasBold: true },
      box,
      measurer,
    );
    for (const l of t.lines) expect(l.widthLu).toBeLessThanOrEqual(box + 0.001);
  });

  it('降りた段は警告に残る。黙って縮めない', () => {
    const t = typesetCaption(
      def,
      { facts: { title: long }, gates: ALL_ON, size: 'Large', tracking: 'Widest', align: 'left', family: 'Arimo', weight: 400, hasBold: true },
      box,
      measurer,
    );
    expect(t.warnings.length).toBeGreaterThan(0);
  });

  it('レンズ名の縦棒以降を落とす段がある', () => {
    const t = typesetCaption(
      STYLES.OR2,
      {
        facts: { lens: 'SIGMA 18-50mm F2.8 DC DN | Contemporary 021'.repeat(2) },
        gates: ALL_ON,
        size: 'Large',
        tracking: 'Widest',
        align: 'left',
        family: 'Arimo',
        weight: 400,
        hasBold: true,
      },
      captionWidthLu(STYLES.OR2),
      measurer,
    );
    expect(t.lines.map((l) => l.text).join('')).not.toContain('|');
  });
});

/**
 * ★design.md §3.5 の検算★
 *
 * 16:9 のキャンバス高は 562.5lu しかない。右帯 300lu に参考素材そのものを
 * 流して成立するかは設計時点で未検証だった。ここで固定する。
 * 落ちたら STN2 を below-photo（STN1 と同じ配置）に倒す。
 */
describe('STN2 の右帯に参考素材が収まる', () => {
  const def = STYLES.STN2;
  const box = captionWidthLu(def);
  const t = typesetCaption(
    def,
    { facts: REFERENCE, gates: ALL_ON, size: 'Medium', tracking: 'Normal', align: 'left', family: 'Arimo', weight: 400, hasBold: true },
    box,
    measurer,
  );

  it('帯の幅は 300lu。余白の設定では変わらない（本文の段であって余白ではない）', () => {
    expect(box).toBe(300);
    expect(captionWidthLu(def, 'narrow')).toBe(300);
    expect(captionWidthLu(def, 'wide')).toBe(300);
  });

  it('切り詰め（…）まで落ちていない', () => {
    expect(t.warnings.filter((w) => w.kind === 'caption-truncated')).toEqual([]);
    expect(t.lines.map((l) => l.text).join('')).not.toContain('…');
  });

  it('行数が 3行 + 折り返しの許容（2+2+3）以内に収まる', () => {
    const allowed = def.caption.lines.reduce((a, l) => a + (l.maxWrap ?? 1), 0);
    expect(t.lines.length).toBeLessThanOrEqual(allowed);
  });

  it('組み上がりが帯の高さを越えない', () => {
    const l = resolveLayout(def, 1.5, t.heightLu);
    expect(t.heightLu).toBeLessThanOrEqual((l.canvas.h as number) - 38 * 2);
    expect(layoutViolations(l, def.caption.place)).toEqual([]);
  });
});

describe('Scene の組み立て', () => {
  it.each(STYLE_IDS)('%s は写真を1つと、行数ぶんの文字を出す', (id) => {
    const scene = buildScene(inputFor({ styleId: id }), measurer);
    expect(scene.ops.filter((o) => o.op === 'photo')).toHaveLength(1);
    expect(scene.ops.filter((o) => o.op === 'text').length).toBeGreaterThan(0);
    expect(scene.meta.styleId).toBe(id);
    expect(scene.canvas.widthLu).toBe(1000);
  });

  it('枠あり（Bordered）にすると写真の外周にヘアラインが1本出る', () => {
    for (const id of STYLE_IDS) {
      const off = buildScene(inputFor({ styleId: id }), measurer);
      const on = buildScene(inputFor({ styleId: id, bordered: true }), measurer);
      expect(off.ops.filter((o) => o.op === 'strokeRect'), id).toHaveLength(0);
      const strokes = on.ops.filter((o) => o.op === 'strokeRect');
      expect(strokes, id).toHaveLength(1);
      // プレビューで消えないよう下限を持つ引き方でなければならない
      expect(strokes[0]?.op === 'strokeRect' && strokes[0].width.mode).toBe('hairline');
    }
  });

  it('全面ブリードの枠線はキャンバスの内側に収まる', () => {
    for (const id of ['SQ4', 'STN3'] as const) {
      const scene = buildScene(inputFor({ styleId: id, bordered: true }), measurer);
      const r = scene.ops.find((o) => o.op === 'strokeRect');
      expect(r?.op === 'strokeRect' && r.rect.x, id).toBeGreaterThan(0);
      expect(r?.op === 'strokeRect' && r.rect.y, id).toBeGreaterThan(0);
    }
  });

  it('地がすでに Bold の書体なら、強調しても 700 を超えない', () => {
    const scene = buildScene(inputFor({ styleId: 'OR2', weight: 700 }), measurer);
    const weights = new Set(
      scene.ops.filter((o) => o.op === 'text').map((o) => (o.op === 'text' ? o.font.weight : 0)),
    );
    expect([...weights]).toEqual([700]);
  });

  it('重ね文字のスタイルだけ暗幕を敷く', () => {
    const withScrim = buildScene(inputFor({ styleId: 'SQ4' }), measurer);
    const without = buildScene(inputFor({ styleId: 'SQ1' }), measurer);
    expect(withScrim.ops.filter((o) => o.op === 'linearGradient')).toHaveLength(1);
    expect(without.ops.filter((o) => o.op === 'linearGradient')).toHaveLength(0);
  });

  it('和文書体には Bold を頼まない（合成太字で字形が崩れる）', () => {
    const scene = buildScene(inputFor({ styleId: 'OR2', family: 'NotoSansJP', hasBold: false }), measurer);
    for (const op of scene.ops) {
      if (op.op === 'text') expect(op.font.weight).toBe(400);
    }
  });

  it('文字の免責領域が行数ぶん集まる', () => {
    const scene = buildScene(inputFor({ styleId: 'OR2' }), measurer);
    const texts = scene.ops.filter((o) => o.op === 'text').length;
    expect(scene.meta.exactnessExempt.length).toBe(texts);
  });
});

/**
 * ★重ね文字が、どんな写真の上でも読めること★
 *
 * 写真の中身はこちらで選べない。真っ白な空や雪の上に置かれても読めなければ、
 * そのスタイルは壊れている。暗幕がいちばん薄くなるのはキャプションの**上端**なので、
 * そこで最悪値を測る。
 */
describe('重ね文字のコントラスト', () => {
  const rl = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (r: number, g: number, b: number): number =>
    0.2126 * rl(r) + 0.7152 * rl(g) + 0.0722 * rl(b);
  const inkL = lum(OVERLAY_INK.r, OVERLAY_INK.g, OVERLAY_INK.b);

  const overlayStyles = STYLE_IDS.filter((id) => STYLES[id].caption.place === 'overlay-bottom');

  it('重ね文字のスタイルは2つある', () => {
    expect(overlayStyles).toEqual(['SQ4', 'STN3']);
  });

  it.each(overlayStyles)('%s は真っ白な写真の上でも 4.5:1 を確保する', (id) => {
    const def = STYLES[id];
    const scrim = def.caption.scrim;
    expect(scrim).toBeDefined();
    if (!scrim) return;

    for (const size of ['Small', 'Medium', 'Large'] as const) {
      const t = typesetCaption(
        def,
        { facts: REFERENCE, gates: ALL_ON, size, tracking: 'Normal', align: 'left', family: 'Arimo', weight: 400, hasBold: true },
        captionWidthLu(def),
        measurer,
      );
      const l = resolveLayout(def, 1.5, t.heightLu);
      const canvasH = l.canvas.h as number;
      const h = scrim.heightLu as number;
      // 暗幕がいちばん薄いのはキャプションの上端
      const at = ((l.captionBox.y as number) - (canvasH - h)) / h;
      const a = scrimAlphaAt(at, scrim.alpha);
      const c = 255 * (1 - a); // 真っ白な写真の上に黒の暗幕を alpha で乗せた地
      const ratio = (inkL + 0.05) / (lum(c, c, c) + 0.05);
      expect(ratio, `${id} ${size}: 暗幕 ${a.toFixed(3)} → ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
