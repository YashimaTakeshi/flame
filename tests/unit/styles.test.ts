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
import { captionWidthLu, focusCrop, layoutViolations, resolveLayout } from '../../src/core/styles/layout';
import { allSpecs, FRMM_PRESETS, MARGINS, normalize, specKey, styleFor } from '../../src/core/styles/spec';
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

const key = specKey;
const SPECS = allSpecs();
const N = 'normal' as const;
const sp = (o: Partial<StyleSpec>): StyleSpec => ({ ratio: 'SQ', photo: 'center', caption: 'below', captionAlign: 'center', lines: 1, margin: N, ...o });
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
  bordered: false,
  background: WHITE,
  ink: INK,
  ...over,
});

describe('組み合わせの空間', () => {
  it('余白なしと重ねは同じ状態。どちらから来ても揃う', () => {
    expect(normalize(sp({ margin: 'none', caption: 'below' })).caption).toBe('overlay');
    expect(normalize(sp({ caption: 'overlay', margin: 'wide' })).margin).toBe('none');
  });

  it('文字が左右の段にあるとき、写真を同じ側に寄せる指定は中央に戻る', () => {
    expect(normalize(sp({ caption: 'left', photo: 'right' })).photo).toBe('center');
    expect(normalize(sp({ caption: 'right', photo: 'left' })).photo).toBe('center');
    expect(normalize(sp({ caption: 'right', photo: 'top' })).photo).toBe('top');
  });

  it('総当たりの数: 6比率 × 3行 × (余白3 × 16 × 寄せ3 + 全面1) = 2,610', () => {
    // 余白あり: 写真5 × 文字4（上下左右）= 20 から、左右×左右の 4 を除いた 16。寄せは3通り
    // 全面（余白なし）: 文字は重ねの1つ、写真の位置と寄せは効かないので1通り
    expect(SPECS).toHaveLength(6 * 3 * (3 * 16 * 3 + 1));
  });

  it('全面では写真の位置と寄せは中央に畳まれる（指で決めるので選択肢ではない）', () => {
    const n = normalize(sp({ margin: 'none', caption: 'overlay', photo: 'top', captionAlign: 'end' }));
    expect(n.photo).toBe('center');
    expect(n.captionAlign).toBe('center');
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
  it('どの組み合わせ × 写真比 でも不変条件を満たす', () => {
    let checked = 0;
    for (const spec of SPECS) {
      const def = styleFor(spec);
      const t = typesetCaption(def, { facts: REFERENCE, gates: ALL_ON, ...TYPO }, captionWidthLu(def), measurer);
      for (const aspect of ASPECTS) {
        const l = resolveLayout(def, aspect, t.heightLu);
        const where = `${key(spec)} @ ${aspect.toFixed(2)}`;
        expect(layoutViolations(l, def.caption.place), where).toEqual([]);
        expect(l.canvas.h, where).toBeGreaterThan(0);
        expect(l.photo.w, where).toBeGreaterThan(0);
        expect(l.photo.h, where).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBe(SPECS.length * ASPECTS.length);
  });

  it('文字が無くても破綻しない（情報を全部切った状態）', () => {
    for (const spec of SPECS) {
      const def = styleFor(spec);
      for (const aspect of ASPECTS) {
        const l = resolveLayout(def, aspect, 0);
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
      const def = styleFor(sp({ ratio: 'OR', caption }));
      expect(resolveLayout(def, 0.75, 40).canvas.h, caption).toBeGreaterThan(resolveLayout(def, 1.5, 40).canvas.h);
    }
  });

  it('写真の位置が効く: 上寄せは中央より上にある', () => {
    const top = resolveLayout(styleFor(sp({ photo: 'top' })), 1.5, 40).photo;
    const mid = resolveLayout(styleFor(sp({ photo: 'center' })), 1.5, 40).photo;
    const bot = resolveLayout(styleFor(sp({ photo: 'bottom' })), 1.5, 40).photo;
    expect(top.y).toBeLessThan(mid.y);
    expect(mid.y).toBeLessThan(bot.y);
  });

  it('写真の位置が効く: 左寄せは右寄せより左にある（縦位置の写真）', () => {
    const l = resolveLayout(styleFor(sp({ photo: 'left' })), 0.75, 40).photo;
    const r = resolveLayout(styleFor(sp({ photo: 'right' })), 0.75, 40).photo;
    expect(l.x).toBeLessThan(r.x);
  });

  it('文字の位置が効く: 左の段は写真より左、右の段は写真より右', () => {
    const L = resolveLayout(styleFor(sp({ ratio: 'STN', caption: 'left', lines: 2 })), 1.5, 60);
    const R = resolveLayout(styleFor(sp({ ratio: 'STN', caption: 'right', lines: 2 })), 1.5, 60);
    expect(L.captionBox.x + L.captionBox.w).toBeLessThanOrEqual(L.photo.x + 0.01);
    expect(R.captionBox.x).toBeGreaterThanOrEqual(R.photo.x + R.photo.w - 0.01);
  });

  it('切り出しは0..1の正規化座標で、元画素数に依らない', () => {
    const l = resolveLayout(styleFor(sp({ margin: 'none', caption: 'overlay' })), 1.5, 30);
    const s = l.photoSrcNorm;
    expect(s.w).toBeCloseTo(2 / 3, 6); // 3:2 を 1:1 に切るので横が削られる
    expect(s.h).toBe(1);
  });

  it('全面では切り取りの中心（focus）が余る軸だけを動かす', () => {
    const at = (fx: number, fy: number, aspect: number) =>
      resolveLayout(styleFor(sp({ margin: 'none', caption: 'overlay' })), aspect, 30, { x: fx, y: fy }).photoSrcNorm;
    // 横長を正方形に: 横が余る → x が効き、y は効かない
    expect(at(0, 0.9, 1.5).x).toBe(0);
    expect(at(0.5, 0.9, 1.5).x).toBeCloseTo(1 / 6, 6);
    expect(at(1, 0.9, 1.5).x).toBeCloseTo(1 / 3, 6);
    expect(at(1, 0.9, 1.5).y).toBe(0);
    // 縦長を正方形に: 縦が余る → y が効く
    expect(at(0.9, 0, 0.5).y).toBe(0);
    expect(at(0.9, 1, 0.5).y).toBeCloseTo(0.5, 6);
    expect(at(0.9, 0.5, 0.5).y).toBeCloseTo(0.25, 6);
    // 範囲の外は端に丸める
    expect(focusCrop(1.5, 1, { x: 7, y: -3 }).x).toBeCloseTo(1 / 3, 6);
  });

  it('寄せ: 写真を上に寄せたとき、文字は下の帯の中で上・中・下に動く', () => {
    const box = (a: StyleSpec['captionAlign']) =>
      resolveLayout(styleFor(sp({ photo: 'top', caption: 'below', captionAlign: a })), 1.5, 40);
    const s = box('start');
    const c = box('center');
    const e = box('end');
    // 帯: 写真の下端＋隙間 〜 キャンバス下端−余白
    expect(s.captionBox.y).toBeGreaterThan(s.photo.y + s.photo.h);
    expect(s.captionBox.y).toBeLessThan(c.captionBox.y);
    expect(c.captionBox.y).toBeLessThan(e.captionBox.y);
    expect(e.captionBox.y + e.captionBox.h).toBeLessThanOrEqual(e.canvas.h);
    // 中は帯の真ん中: 上の余りと下の余りが等しい
    const top = c.photo.y + c.photo.h + styleFor(sp({})).caption.gapLu;
    const bottom = c.canvas.h - styleFor(sp({})).caption.outerInsetLu;
    expect(c.captionBox.y - top).toBeCloseTo(bottom - (c.captionBox.y + c.captionBox.h), 6);
  });

  it('寄せ: 写真が中央で帯に余りが無ければ、寄せを変えても文字は動かない', () => {
    const y = (a: StyleSpec['captionAlign']) =>
      resolveLayout(styleFor(sp({ ratio: 'OR', captionAlign: a })), 1.5, 40).captionBox.y;
    expect(y('start')).toBeCloseTo(y('end'), 6);
  });

  it('寄せ: 左右の段では、段の中で上・中・下に動く', () => {
    const y = (a: StyleSpec['captionAlign']) =>
      resolveLayout(styleFor(sp({ ratio: 'STN', caption: 'right', lines: 2, captionAlign: a })), 1.5, 60).captionBox.y;
    expect(y('start')).toBeLessThan(y('center'));
    expect(y('center')).toBeLessThan(y('end'));
  });

  it('余白を狭めると写真が大きくなる', () => {
    for (const spec of SPECS) {
      if (spec.margin !== 'normal') continue;
      const wide = resolveLayout(styleFor({ ...spec, margin: 'wide' }), 1.5, 40).photo;
      const narrow = resolveLayout(styleFor({ ...spec, margin: 'narrow' }), 1.5, 40).photo;
      expect(narrow.w * narrow.h, key(spec)).toBeGreaterThan(wide.w * wide.h);
    }
  });

  it('余白なしでも重ね文字は端に寄らない（余白の倍率に依らない距離を持つ）', () => {
    const def = styleFor(sp({ margin: 'none', caption: 'overlay' }));
    expect(def.caption.sideInsetLu).toBeGreaterThan(0);
    expect(def.caption.outerInsetLu).toBeGreaterThan(0);
  });
});

describe('キャプションが枠を越えない（総当たり）', () => {
  it('どの組み合わせ × 文字設定でも帯の幅に収まる', () => {
    for (const spec of SPECS) {
      const def = styleFor(spec);
      const boxW = captionWidthLu(def);
      for (const size of ['Small', 'Medium', 'Large'] as const) {
        for (const tracking of ['Tight', 'Widest'] as const) {
          const t = typesetCaption(def, { facts: REFERENCE, gates: ALL_ON, ...TYPO, size, tracking }, boxW, measurer);
          for (const line of t.lines) {
            expect(line.widthLu, `${key(spec)} ${size}/${tracking}: 「${line.text}」`).toBeLessThanOrEqual(boxW + 0.001);
          }
        }
      }
    }
  });

  it('左右の段の幅は余白の設定で変わらない（本文の段であって余白ではない）', () => {
    for (const margin of MARGINS) {
      if (margin === 'none') continue; // 全面では段は無い
      expect(captionWidthLu(styleFor(sp({ ratio: 'STN', caption: 'right', lines: 3, margin }))), margin).toBe(300);
    }
  });
});

describe('欠損の扱い', () => {
  const def = styleFor(sp({ ratio: 'OR', lines: 3 }));
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
  const def = styleFor(sp({ ratio: 'STN' }));
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
    const scene = buildScene(inputFor({ style: sp({ margin: 'none', caption: 'overlay' }), bordered: true }), measurer);
    const r = scene.ops.find((o) => o.op === 'strokeRect');
    expect(r?.op === 'strokeRect' && r.rect.x).toBeGreaterThan(0);
  });

  describe('フィルムの刻印', () => {
    const badgeOf = (scene: ReturnType<typeof buildScene>) => scene.ops.find((o) => o.op === 'text' && o.id === 'badge');
    const inside = (r: { x: number; y: number; w: number; h: number }, p: { x: number; y: number; w: number; h: number }): boolean =>
      r.x >= p.x - 0.001 && r.y >= p.y - 0.001 && r.x + r.w <= p.x + p.w + 0.001 && r.y + r.h <= p.y + p.h + 0.001;
    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
      a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

    it('渡さなければ刻まない。渡せば板と文字が1つずつ出る', () => {
      expect(badgeOf(buildScene(inputFor(), measurer))).toBeUndefined();
      expect(badgeOf(buildScene(inputFor({ badge: null }), measurer))).toBeUndefined();
      const scene = buildScene(inputFor({ badge: 'CLASSIC CHROME' }), measurer);
      const t = badgeOf(scene);
      expect(t?.op === 'text' && t.text).toBe('CLASSIC CHROME');
      expect(scene.ops.filter((o) => o.op === 'fillRect')).toHaveLength(1);
    });

    it('全組み合わせ × 全比で、写真の右下に収まり、キャプションと重ならない', () => {
      for (const spec of SPECS) {
        for (const aspect of ASPECTS) {
          const scene = buildScene(inputFor({ style: spec, photo: { id: 'p', aspect }, badge: 'ETERNA BLEACH BYPASS' }), measurer);
          const photo = scene.ops.find((o) => o.op === 'photo');
          const plate = scene.ops.find((o) => o.op === 'fillRect');
          if (!plate || plate.op !== 'fillRect' || !photo || photo.op !== 'photo') continue; // 収まらないときは刻まない
          const name = `${key(spec)} @${aspect.toFixed(2)}`;
          expect(inside(plate.rect, photo.dst), name).toBe(true);
          // 右下: 板の右端は写真の中心より右、下端は写真の中心より下
          expect(plate.rect.x + plate.rect.w, name).toBeGreaterThan(photo.dst.x + photo.dst.w / 2);
          expect(plate.rect.y + plate.rect.h, name).toBeGreaterThan(photo.dst.y + photo.dst.h / 2);
          for (const o of scene.ops) {
            if (o.op !== 'text' || o.id === 'badge') continue;
            expect(overlaps(plate.rect, o.boundsLu), `${name}: ${o.id}`).toBe(false);
          }
        }
      }
    });

    it('通常の写真では必ず刻まれる（収まらないのは極端な比だけ）', () => {
      for (const spec of SPECS) {
        const scene = buildScene(inputFor({ style: spec, photo: { id: 'p', aspect: 1.5 }, badge: 'PROVIA' }), measurer);
        expect(badgeOf(scene), key(spec)).toBeDefined();
      }
    });

    it('フィルム名はキャプションの項目としても載る', () => {
      const scene = buildScene(inputFor({ facts: { ...REFERENCE, film: 'ACROS' } }), measurer);
      const texts = scene.ops.filter((o) => o.op === 'text' && o.id !== 'badge').map((o) => (o.op === 'text' ? o.text : ''));
      expect(texts.join(' ')).toContain('ACROS');
    });
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
