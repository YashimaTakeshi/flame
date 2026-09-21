/**
 * スタイルの検査。
 *
 * スタイルは 比率 × 写真の位置 × 文字の位置 × 行数 の組み合わせで、寸法はその場で生成する。
 * ここで見るのは「参考アプリに似ているか」ではなく（それは目で見るしかない）、
 * **どの組み合わせでも破綻しないこと**。写真がはみ出さない、文字が枠を越えない、
 * 欠損を「（不明）」で埋めない。総当たりで確かめる。
 */
import { describe, expect, it } from 'vitest';
import { buildScene, INK, OVERLAY_INK, scrimAlphaAt, WHITE } from '../../src/core/compose';
import { typesetCaption, type Gates } from '../../src/core/caption';
import type { TextMeasurer } from '../../src/core/ports';
import {
  captionWidthLu,
  layoutViolations,
  MARGIN_SCALE,
  resolveLayout,
  type MarginId,
} from '../../src/core/styles/layout';
import { allSpecs, FRMM_PRESETS, normalize, styleFor } from '../../src/core/styles/spec';
import type { StyleSpec } from '../../src/core/styles/types';

/**
 * 代用の測定器。
 *
 * 1文字あたり 0.60em で数える。実際の欧文サンセリフの平均（約0.50em）より
 * **広い側**に倒してあるので、ここで収まるものは実書体でも必ず収まる。
 * 逆は保証しないので、見た目の詰めは実機で確かめる。
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

const ALL_ON: Gates = { exposureEnabled: true, focalEnabled: true, placeEnabled: true, artistEnabled: true };
const ALL_OFF: Gates = { exposureEnabled: false, focalEnabled: false, placeEnabled: false, artistEnabled: false };

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

const TYPO = { size: 'Medium', tracking: 'Normal', align: 'left', family: 'Arimo', weight: 400, hasBold: true } as const;

const key = (s: StyleSpec): string => `${s.ratio}/${s.photo}/${s.caption}/${s.lines}`;
const SPECS = allSpecs();
const MARGINS = Object.keys(MARGIN_SCALE) as MarginId[];
/** 縦位置から超パノラマまで。実際に来うる比を全部通す */
const ASPECTS = [0.5, 0.75, 1, 4 / 3, 1.5, 16 / 9, 3];

const inputFor = (over: Partial<Parameters<typeof buildScene>[0]> = {}): Parameters<typeof buildScene>[0] => ({
  style: FRMM_PRESETS.OR1!,
  photo: { id: 'p', aspect: 1.5 },
  facts: REFERENCE,
  gates: ALL_ON,
  family: 'Arimo',
  weight: 400,
  hasBold: true,
  align: 'left',
  tracking: 'Normal',
  size: 'Medium',
  margin: 'normal',
  bordered: false,
  background: WHITE,
  ink: INK,
  ...over,
});

describe('組み合わせの空間', () => {
  it('全面と重ねは同じ状態。どちらから来ても揃う', () => {
    expect(normalize({ ratio: 'SQ', photo: 'bleed', caption: 'below', lines: 1 }).caption).toBe('overlay');
    expect(normalize({ ratio: 'SQ', photo: 'top', caption: 'overlay', lines: 1 }).photo).toBe('bleed');
  });

  it('総当たりの数: 6比率 × (5配置×4文字 + 全面) × 3行 = 378', () => {
    expect(SPECS).toHaveLength(6 * (5 * 4 + 1) * 3);
  });

  it('参考アプリの15スタイルはすべてこの空間の点である', () => {
    const keys = new Set(SPECS.map(key));
    for (const [name, spec] of Object.entries(FRMM_PRESETS)) {
      expect(keys.has(key(normalize(spec))), name).toBe(true);
    }
    expect(Object.keys(FRMM_PRESETS)).toHaveLength(15);
  });
});

describe('レイアウトが破綻しない（総当たり）', () => {
  it('どの組み合わせ × 写真比 × 余白 でも不変条件を満たす', () => {
    let checked = 0;
    for (const spec of SPECS) {
      const def = styleFor(spec);
      for (const margin of MARGINS) {
        const t = typesetCaption(def, { facts: REFERENCE, gates: ALL_ON, ...TYPO }, captionWidthLu(def, margin), measurer);
        for (const aspect of ASPECTS) {
          const l = resolveLayout(def, aspect, t.heightLu, margin);
          const where = `${key(spec)} @ ${aspect.toFixed(2)} / 余白${margin}`;
          expect(layoutViolations(l, def.caption.place), where).toEqual([]);
          expect(l.canvas.h, where).toBeGreaterThan(0);
          expect(l.photo.w, where).toBeGreaterThan(0);
          expect(l.photo.h, where).toBeGreaterThan(0);
          checked++;
        }
      }
    }
    expect(checked).toBe(SPECS.length * MARGINS.length * ASPECTS.length);
  });

  it('文字が無くても破綻しない（情報を全部切った状態）', () => {
    for (const spec of SPECS) {
      const def = styleFor(spec);
      for (const aspect of ASPECTS) {
        const l = resolveLayout(def, aspect, 0, 'normal');
        expect(layoutViolations(l, def.caption.place), key(spec)).toEqual([]);
      }
    }
  });

  it('比を固定した比率は写真比によらず同じキャンバスになる', () => {
    for (const spec of SPECS) {
      const def = styleFor(spec);
      if (def.canvas.kind !== 'fixed') continue;
      const [aw, ah] = def.canvas.aspect;
      for (const aspect of ASPECTS) {
        expect(resolveLayout(def, aspect, 40).canvas.h, key(spec)).toBeCloseTo((1000 * ah) / aw, 6);
      }
    }
  });

  it('元比は写真が縦長になるほどキャンバスも伸びる', () => {
    for (const caption of ['below', 'above', 'left', 'right'] as const) {
      const def = styleFor({ ratio: 'OR', photo: 'center', caption, lines: 1 });
      expect(resolveLayout(def, 0.75, 40).canvas.h, caption).toBeGreaterThan(resolveLayout(def, 1.5, 40).canvas.h);
    }
  });

  it('写真の位置が効く: 上寄せは中央より上にある', () => {
    const top = resolveLayout(styleFor({ ratio: 'SQ', photo: 'top', caption: 'below', lines: 1 }), 1.5, 40).photo;
    const mid = resolveLayout(styleFor({ ratio: 'SQ', photo: 'center', caption: 'below', lines: 1 }), 1.5, 40).photo;
    const bot = resolveLayout(styleFor({ ratio: 'SQ', photo: 'bottom', caption: 'below', lines: 1 }), 1.5, 40).photo;
    expect(top.y).toBeLessThan(mid.y);
    expect(mid.y).toBeLessThan(bot.y);
  });

  it('写真の位置が効く: 左寄せは右寄せより左にある（縦位置の写真）', () => {
    const l = resolveLayout(styleFor({ ratio: 'SQ', photo: 'left', caption: 'below', lines: 1 }), 0.75, 40).photo;
    const r = resolveLayout(styleFor({ ratio: 'SQ', photo: 'right', caption: 'below', lines: 1 }), 0.75, 40).photo;
    expect(l.x).toBeLessThan(r.x);
  });

  it('文字の位置が効く: 左の段は写真より左、右の段は写真より右', () => {
    const L = resolveLayout(styleFor({ ratio: 'STN', photo: 'center', caption: 'left', lines: 2 }), 1.5, 60);
    const R = resolveLayout(styleFor({ ratio: 'STN', photo: 'center', caption: 'right', lines: 2 }), 1.5, 60);
    expect(L.captionBox.x + L.captionBox.w).toBeLessThanOrEqual(L.photo.x + 0.01);
    expect(R.captionBox.x).toBeGreaterThanOrEqual(R.photo.x + R.photo.w - 0.01);
  });

  it('切り出しは0..1の正規化座標で、元画素数に依らない', () => {
    const l = resolveLayout(styleFor({ ratio: 'SQ', photo: 'bleed', caption: 'overlay', lines: 1 }), 1.5, 30);
    const s = l.photoSrcNorm;
    expect(s.w).toBeCloseTo(2 / 3, 6); // 3:2 を 1:1 に切るので横が削られる
    expect(s.h).toBe(1);
  });

  it('余白を狭めると写真が大きくなる', () => {
    for (const spec of SPECS) {
      if (spec.photo === 'bleed') continue; // 全面は余白を持たない
      const def = styleFor(spec);
      const wide = resolveLayout(def, 1.5, 40, 'wide').photo;
      const narrow = resolveLayout(def, 1.5, 40, 'narrow').photo;
      expect(narrow.w * narrow.h, key(spec)).toBeGreaterThan(wide.w * wide.h);
    }
  });
});

describe('キャプションが枠を越えない（総当たり）', () => {
  it('どの組み合わせ × 文字設定でも帯の幅に収まる', () => {
    for (const spec of SPECS) {
      const def = styleFor(spec);
      for (const margin of MARGINS) {
        const boxW = captionWidthLu(def, margin);
        for (const size of ['Small', 'Medium', 'Large'] as const) {
          for (const tracking of ['Tight', 'Widest'] as const) {
            const t = typesetCaption(def, { facts: REFERENCE, gates: ALL_ON, ...TYPO, size, tracking }, boxW, measurer);
            for (const line of t.lines) {
              expect(line.widthLu, `${key(spec)} ${size}/${tracking}/${margin}: 「${line.text}」`).toBeLessThanOrEqual(boxW + 0.001);
            }
          }
        }
      }
    }
  });

  it('左右の段の幅は余白の設定で変わらない（本文の段であって余白ではない）', () => {
    const def = styleFor({ ratio: 'STN', photo: 'center', caption: 'right', lines: 3 });
    expect(captionWidthLu(def, 'narrow')).toBe(300);
    expect(captionWidthLu(def, 'wide')).toBe(300);
  });
});

describe('欠損の扱い', () => {
  const def = styleFor({ ratio: 'OR', photo: 'center', caption: 'below', lines: 3 });
  const box = captionWidthLu(def);
  const ts = (facts: Record<string, string>, gates: Gates = ALL_ON) =>
    typesetCaption(def, { facts, gates, ...TYPO }, box, measurer);

  it('無い項目は詰める。「（不明）」のような文字列は作らない', () => {
    const joined = ts({ title: 'Untitled', date: '2026.09.20' }).lines.map((l) => l.text).join('\n');
    expect(joined).toBe('Untitled, 2026.09.20');
    expect(joined).not.toMatch(/不明|undefined|null|N\/A/);
  });

  it('項目が全部無い行は行ごと消える', () => {
    const t = ts({ camera: 'FUJIFILM X-M5' });
    expect(t.lines).toHaveLength(1);
    expect(t.lines[0]?.text).toBe('FUJIFILM X-M5');
  });

  it('利用者が切った項目はゲートで消える。欠損とは別の道', () => {
    expect(ts(REFERENCE, ALL_ON).lines.map((l) => l.text).join('\n')).toContain('F2.8 1/250s ISO200');
    expect(ts(REFERENCE, ALL_OFF).lines.map((l) => l.text).join('\n')).not.toContain('F2.8 1/250s ISO200');
  });

  it('何も無ければ行は0本、警告が1つ出る', () => {
    const scene = buildScene(inputFor({ facts: {} }), measurer);
    expect(scene.ops.filter((o) => o.op === 'text')).toHaveLength(0);
    expect(scene.meta.warnings).toContainEqual({ kind: 'caption-empty' });
  });
});

describe('はみ出したときのはしご', () => {
  const def = styleFor({ ratio: 'STN', photo: 'center', caption: 'below', lines: 1 });
  const box = captionWidthLu(def);
  const long = 'X'.repeat(400);
  const hard = { facts: { title: long }, gates: ALL_ON, ...TYPO, size: 'Large', tracking: 'Widest' } as const;

  it('長すぎる行は黙って溢れず、必ず枠に収まる', () => {
    for (const l of typesetCaption(def, hard, box, measurer).lines) expect(l.widthLu).toBeLessThanOrEqual(box + 0.001);
  });

  it('降りた段は警告に残る。黙って縮めない', () => {
    expect(typesetCaption(def, hard, box, measurer).warnings.length).toBeGreaterThan(0);
  });

  it('レンズ名の縦棒以降を落とす段がある', () => {
    const t = typesetCaption(
      def,
      { facts: { lens: 'SIGMA 18-50mm F2.8 DC DN | Contemporary 021'.repeat(3) }, gates: ALL_ON, ...TYPO, size: 'Large', tracking: 'Widest' },
      box,
      measurer,
    );
    expect(t.lines.map((l) => l.text).join('')).not.toContain('|');
  });
});

/**
 * ★design.md §3.5 の検算★ 16:9 の右の段（300lu）に参考素材が収まるか。
 */
describe('16:9・右の段に参考素材が収まる', () => {
  const def = styleFor(FRMM_PRESETS.STN2!);
  const t = typesetCaption(def, { facts: REFERENCE, gates: ALL_ON, ...TYPO }, captionWidthLu(def), measurer);

  it('切り詰め（…）まで落ちていない', () => {
    expect(t.warnings.filter((w) => w.kind === 'caption-truncated')).toEqual([]);
    expect(t.lines.map((l) => l.text).join('')).not.toContain('…');
  });

  it('行数が折り返しの許容以内に収まる', () => {
    const allowed = def.caption.lines.reduce((a, l) => a + (l.maxWrap ?? 1), 0);
    expect(t.lines.length).toBeLessThanOrEqual(allowed);
  });

  it('組み上がりが段の高さを越えない', () => {
    const l = resolveLayout(def, 1.5, t.heightLu);
    expect(layoutViolations(l, def.caption.place)).toEqual([]);
  });
});

describe('Scene の組み立て', () => {
  it('参考アプリの15組み合わせは写真を1つと、行数ぶんの文字を出す', () => {
    for (const [name, spec] of Object.entries(FRMM_PRESETS)) {
      const scene = buildScene(inputFor({ style: spec }), measurer);
      expect(scene.ops.filter((o) => o.op === 'photo'), name).toHaveLength(1);
      expect(scene.ops.filter((o) => o.op === 'text').length, name).toBeGreaterThan(0);
      expect(scene.canvas.widthLu).toBe(1000);
    }
  });

  it('枠あり（Bordered）にすると写真の外周にヘアラインが1本出る', () => {
    for (const spec of SPECS) {
      const on = buildScene(inputFor({ style: spec, bordered: true }), measurer);
      const strokes = on.ops.filter((o) => o.op === 'strokeRect');
      expect(strokes, key(spec)).toHaveLength(1);
      expect(strokes[0]?.op === 'strokeRect' && strokes[0].width.mode).toBe('hairline');
    }
    expect(buildScene(inputFor(), measurer).ops.filter((o) => o.op === 'strokeRect')).toHaveLength(0);
  });

  it('全面の枠線はキャンバスの内側に収まる', () => {
    const scene = buildScene(inputFor({ style: { ratio: 'SQ', photo: 'bleed', caption: 'overlay', lines: 1 }, bordered: true }), measurer);
    const r = scene.ops.find((o) => o.op === 'strokeRect');
    expect(r?.op === 'strokeRect' && r.rect.x).toBeGreaterThan(0);
  });

  it('重ね文字のときだけ暗幕を敷く', () => {
    expect(buildScene(inputFor({ style: FRMM_PRESETS.SQ4! }), measurer).ops.filter((o) => o.op === 'linearGradient')).toHaveLength(1);
    expect(buildScene(inputFor({ style: FRMM_PRESETS.SQ1! }), measurer).ops.filter((o) => o.op === 'linearGradient')).toHaveLength(0);
  });

  it('和文書体には Bold を頼まない（合成太字で字形が崩れる）', () => {
    const scene = buildScene(inputFor({ style: FRMM_PRESETS.OR2!, family: 'NotoSansJP', hasBold: false }), measurer);
    for (const op of scene.ops) if (op.op === 'text') expect(op.font.weight).toBe(400);
  });

  it('地がすでに Bold なら、強調しても 700 を超えない', () => {
    const scene = buildScene(inputFor({ style: FRMM_PRESETS.OR2!, weight: 700 }), measurer);
    const weights = new Set(scene.ops.filter((o) => o.op === 'text').map((o) => (o.op === 'text' ? o.font.weight : 0)));
    expect([...weights]).toEqual([700]);
  });
});

/**
 * ★重ね文字が、どんな写真の上でも読めること★
 * 暗幕がいちばん薄くなるのはキャプションの**上端**なので、そこで最悪値を測る。
 */
describe('重ね文字のコントラスト', () => {
  const rl = (c: number): number => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = (r: number, g: number, b: number): number => 0.2126 * rl(r) + 0.7152 * rl(g) + 0.0722 * rl(b);
  const inkL = lum(OVERLAY_INK.r, OVERLAY_INK.g, OVERLAY_INK.b);

  it('どの比率・行数でも、真っ白な写真の上で 4.5:1 を確保する', () => {
    for (const spec of SPECS) {
      if (spec.caption !== 'overlay') continue;
      const def = styleFor(spec);
      const scrim = def.caption.scrim;
      expect(scrim, key(spec)).toBeDefined();
      if (!scrim) continue;
      for (const size of ['Small', 'Medium', 'Large'] as const) {
        const t = typesetCaption(def, { facts: REFERENCE, gates: ALL_ON, ...TYPO, size }, captionWidthLu(def), measurer);
        const l = resolveLayout(def, 1.5, t.heightLu);
        const h = scrim.heightLu as number;
        const at = ((l.captionBox.y as number) - ((l.canvas.h as number) - h)) / h;
        const a = scrimAlphaAt(at, scrim.alpha);
        const c = 255 * (1 - a);
        const ratio = (inkL + 0.05) / (lum(c, c, c) + 0.05);
        expect(ratio, `${key(spec)} ${size}: 暗幕 ${a.toFixed(3)} → ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
