/**
 * スタイルの検査。
 *
 * スタイルは 比率 × 写真の位置 × 文字の位置 × 行数 の組み合わせで、寸法はその場で生成する。
 * ここで見るのは「参考アプリに似ているか」ではなく（それは目で見るしかない）、
 * **どの組み合わせでも破綻しないこと**。写真がはみ出さない、文字が枠を越えない、
 * 欠損を「（不明）」で埋めない。総当たりで確かめる。
 */
import { describe, expect, it } from 'vitest';
import type { BadgeSpec } from '../../src/core/badge';
import { buildScene, INK, OVERLAY_INK, scrimAlphaAt, scrimDepth, WHITE } from '../../src/core/compose';
import { typesetCaption, type Gates } from '../../src/core/caption';
import type { TextMeasurer } from '../../src/core/ports';
import { captionWidthLu, focusCrop, layoutViolations, resolveLayout } from '../../src/core/styles/layout';
import { allSpecs, FRMM_PRESETS, MARGINS, normalize, specKey, styleFor } from '../../src/core/styles/spec';
import type { FieldId, StyleSpec } from '../../src/core/styles/types';

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
  it('余白なしと文字の辺は独立。余白なしなら選んだ辺に重ねる', () => {
    for (const caption of ['above', 'below', 'left', 'right'] as const) {
      const n = normalize(sp({ margin: 'none', caption }));
      expect(n.caption).toBe(caption);
      expect(styleFor(n).caption.overlay).toBe(true);
      expect(styleFor(sp({ margin: 'normal', caption })).caption.overlay).toBe(false);
    }
  });

  it('旧い保存の「重ね」は、余白なし・下に読み替える（見た目は以前のまま）', () => {
    const n = normalize(sp({ caption: 'overlay' as never, margin: 'wide' }));
    expect(n.caption).toBe('below');
    expect(n.margin).toBe('none');
  });

  it('★選んだ値は書き換えない★ 文字を左右に置いても写真の位置はそのまま', () => {
    expect(normalize(sp({ caption: 'left', photo: 'right' })).photo).toBe('right');
    expect(normalize(sp({ caption: 'right', photo: 'left' })).photo).toBe('left');
    expect(normalize(sp({ caption: 'right', photo: 'top-left' })).photo).toBe('top-left');
  });

  it('写真を左に寄せて文字を右に置くと、写真は左・文字は写真の右（依頼者の画像2→3）', () => {
    const l = resolveLayout(styleFor(sp({ ratio: 'SQ', caption: 'right', photo: 'left' })), 0.5, 40);
    const r = resolveLayout(styleFor(sp({ ratio: 'SQ', caption: 'right', photo: 'center' })), 0.5, 40);
    expect(l.photo.x).toBeLessThan(r.photo.x);
    expect(l.captionBox.x).toBeGreaterThan(l.photo.x + l.photo.w);
    expect(l.freedom.photoX).toBe(true);
  });

  it('余りの無い軸は効かないと知らせる（1:1 に横長の写真、文字は左 → 上下だけ動く）', () => {
    const l = resolveLayout(styleFor(sp({ ratio: 'SQ', caption: 'left' })), 1.5, 40);
    expect(l.freedom.photoX).toBe(false);
    expect(l.freedom.photoY).toBe(true);
    const or = resolveLayout(styleFor(sp({ ratio: 'OR' })), 1.5, 40);
    expect(or.freedom.photoX || or.freedom.photoY).toBe(false);
  });

  it('★文字は写真に揃える★ 上下の帯は写真の幅、左右の段は写真の高さの範囲', () => {
    const def = styleFor(sp({ ratio: 'SQ', caption: 'below', photo: 'left', margin: 'normal' }));
    // 縦長の写真を左に寄せ、短い文字を左揃え → 写真の左端から始まる
    const l = resolveLayout(def, 0.6, 30, undefined, null, { w: 120, align: 'left' });
    expect(l.captionBox.x).toBeCloseTo(l.photo.x as number, 6);
    expect(l.captionBox.w).toBeCloseTo(l.photo.w as number, 6);
    // 写真より長い文字は広げる（額の内側に収まる）
    const wide = resolveLayout(def, 0.6, 30, undefined, null, { w: 900, align: 'center' });
    expect(wide.captionBox.w).toBeGreaterThan(wide.photo.w as number);
    expect(wide.captionBox.x).toBeGreaterThanOrEqual((def.caption.sideInsetLu as number) - 0.01);
    // 左の段は写真の上下の範囲で寄せる
    const side = styleFor(sp({ ratio: 'SQ', caption: 'left', photo: 'bottom', captionAlign: 'start' }));
    const s2 = resolveLayout(side, 1.5, 30);
    expect(s2.captionBox.y).toBeCloseTo(s2.photo.y as number, 6);
  });

  it('総当たりの数: 8比率 × 4行 × (余白4 × 写真9 × 文字4 × 寄せ3 + 全面 4辺 × 寄せ3) = 14,208', () => {
    // 比率は SNS 向けに 2:3・1.91:1 を足して8つ。行数は4行まで。余白は 極狭・狭い・標準・広い の4段
    // 全面（余白なし）: 写真の位置は効かない（指で決める）ので1通り。文字は4辺に重ね、寄せは3通り
    expect(SPECS).toHaveLength(8 * 4 * (4 * 9 * 4 * 3 + 4 * 3));
  });

  it('★入る行数を超えたら減らす★（比率・大きさで入る行数が変わる）', () => {
    const facts = { ...REFERENCE, title: 'Kyoto', artist: 'yashima takeshi' };
    // 縦長の比率・小さい字なら4行入る
    const tall = buildScene(inputFor({ style: sp({ ratio: 'NST', lines: 4 }), facts, size: 'Small' }), measurer);
    expect(tall.meta.linesFit).toBe(4);
    expect(tall.meta.style.lines).toBe(4);
    // 元比でパノラマ（5:1）の写真・大きい字 → 写真が細く、4行は入らない
    const wide = buildScene(
      inputFor({ style: sp({ ratio: 'OR', lines: 4 }), photo: { id: 'p', aspect: 5 }, facts, size: 'Large' }),
      measurer,
    );
    expect(wide.meta.linesFit).toBeLessThan(4);
    expect(wide.meta.style.lines).toBe(wide.meta.linesFit);
    expect(wide.meta.warnings.some((w) => w.kind === 'caption-lines-reduced')).toBe(true);
  });

  it('余白の段は なし < 極狭 < 狭い < 標準 < 広い', () => {
    const area = (margin: 'thin' | 'narrow' | 'normal' | 'wide') => {
      const l = resolveLayout(styleFor(sp({ ratio: 'SQ', margin })), 1, 30);
      return (l.photo.w as number) * (l.photo.h as number);
    };
    expect(area('thin')).toBeGreaterThan(area('narrow'));
    expect(area('narrow')).toBeGreaterThan(area('normal'));
    expect(area('normal')).toBeGreaterThan(area('wide'));
  });

  it('★行の割り振り★ 既定は以前の固定の組みと同じ。並べ替えた順・行で組む', () => {
    const facts = { title: 'Kyoto', date: '2026.09.20', camera: 'X-M5', lens: 'XF35', focalLength: '35mm' };
    const lines = (n: 1 | 2 | 3, layout?: readonly (readonly FieldId[])[]) =>
      typesetCaption(styleFor(sp({ lines: n }), layout), { facts, gates: ALL_ON, ...TYPO }, 5000, measurer).lines.map((l) => l.text);
    expect(lines(3)).toEqual(['Kyoto, 2026.09.20', 'X-M5', 'XF35, 35mm']);
    expect(lines(1)).toEqual(['Kyoto, 2026.09.20, X-M5, XF35, 35mm']);
    // 2行では、はみ出した3行目を2行目に続ける（以前は焦点距離が抜けていた）
    expect(lines(2)).toEqual(['Kyoto, 2026.09.20', 'X-M5, XF35, 35mm']);
    const custom = [['camera', 'lens'], ['focalLength', 'date'], ['artist', 'title', 'film', 'exposure', 'place']] as const;
    expect(lines(3, custom)).toEqual(['X-M5, XF35', '35mm, 2026.09.20', 'Kyoto']);
    expect(lines(2, custom)).toEqual(['X-M5, XF35', '35mm, 2026.09.20, Kyoto']);
  });

  it('全面では写真の位置は効かない（値は覚えている）。同じ絵になる', () => {
    const n = normalize(sp({ margin: 'none', caption: 'left', photo: 'top', captionAlign: 'end' }));
    expect(n.photo).toBe('top');
    const a = resolveLayout(styleFor(n), 1.5, 30);
    const b = resolveLayout(styleFor({ ...n, photo: 'center' }), 1.5, 30);
    expect(a.photo).toEqual(b.photo);
    expect(a.freedom.photoX || a.freedom.photoY).toBe(false);
  });

  it('全面の重ねは選んだ辺の、端から内側に置く', () => {
    const at = (caption: 'above' | 'below' | 'left' | 'right', captionAlign: 'start' | 'center' | 'end' = 'center') =>
      resolveLayout(styleFor(sp({ ratio: 'SQ', margin: 'none', caption, captionAlign })), 1.5, 60);
    const H = (l: ReturnType<typeof at>): number => l.canvas.h as number;
    const b = at('below');
    const a = at('above');
    expect(b.captionBox.y + b.captionBox.h).toBeGreaterThan(H(b) * 0.9);
    expect(a.captionBox.y).toBeLessThan(H(a) * 0.1);
    const L = at('left');
    const R = at('right');
    expect(L.captionBox.x).toBeLessThan(100);
    expect(R.captionBox.x + R.captionBox.w).toBeGreaterThan(900);
    // 左右は寄せで上・中・下
    expect(at('left', 'start').captionBox.y).toBeLessThan(at('left', 'center').captionBox.y);
    expect(at('left', 'end').captionBox.y).toBeGreaterThan(at('left', 'center').captionBox.y);
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
        expect(layoutViolations(l, def.caption.overlay), where).toEqual([]);
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
        expect(layoutViolations(l, def.caption.overlay), key(spec)).toEqual([]);
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
    const l = resolveLayout(styleFor(sp({ margin: 'none', caption: 'below' })), 1.5, 30);
    const s = l.photoSrcNorm;
    expect(s.w).toBeCloseTo(2 / 3, 6); // 3:2 を 1:1 に切るので横が削られる
    expect(s.h).toBe(1);
  });

  it('全面では切り取りの中心（focus）が余る軸だけを動かす', () => {
    const at = (fx: number, fy: number, aspect: number) =>
      resolveLayout(styleFor(sp({ margin: 'none', caption: 'below' })), aspect, 30, { x: fx, y: fy }).photoSrcNorm;
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
    const def = styleFor(sp({ margin: 'none', caption: 'below' }));
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

  it('★折るときは項目の切れ目で折り、行末に区切りを残さない★（「yashima takeshi,」）', () => {
    const side = styleFor(sp({ ratio: 'SQ', caption: 'right', lines: 2 }));
    // 1行に入らない狭さで組む（実機では段の幅 300lu に大きな字で入らなかった）
    const t = typesetCaption(side, { facts: { artist: 'yashima takeshi', date: '2026.02.07' }, gates: ALL_ON, ...TYPO }, 200, measurer);
    const texts = t.lines.map((l) => l.text);
    expect(texts.length).toBeGreaterThan(1);
    for (const x of texts) expect(x).not.toMatch(/,\s*$|^,/);
    expect(texts.join(' ')).toContain('yashima takeshi');
    expect(texts.join(' ')).toContain('2026.02.07');
  });

  it('1行の組みでも作者が載る（以前は1行だと作者だけ落ちていた）', () => {
    const one = styleFor(sp({ lines: 1 }));
    const t = typesetCaption(one, { facts: { artist: 'yashima takeshi', date: '2026.02.07' }, gates: ALL_ON, ...TYPO }, captionWidthLu(one), measurer);
    expect(t.lines.map((l) => l.text).join(' ')).toContain('yashima takeshi');
  });

  it('入る項目は途中で割らない（項目ごと次の行へ送る）', () => {
    const side = styleFor(sp({ ratio: 'SQ', caption: 'right', lines: 1 }));
    const t = typesetCaption(side, { facts: REFERENCE, gates: ALL_ON, ...TYPO }, captionWidthLu(side), measurer);
    for (const l of t.lines) expect(l.text).not.toMatch(/,\s*$/);
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
    expect(layoutViolations(l, def.caption.overlay)).toEqual([]);
  });
});

describe('左右の段の中での揃え', () => {
  /*
   * 縦位置の写真を左に置くと右の余白が広い。文字は 300lu の幅で組むが、
   * 置く場所は余り全部で、その中で左・中・右に揃う（実機で「余白の中央に置けない」と指摘された）。
   */
  const spec = sp({ ratio: 'SQ', photo: 'left', caption: 'right', lines: 1 });
  const lineOf = (align: 'left' | 'center' | 'right') => {
    const scene = buildScene(inputFor({ style: spec, photo: { id: 'p', aspect: 0.75 }, facts: { title: 'Untitled', date: '2026.08.16' }, align }), measurer);
    const photo = scene.ops.find((o) => o.op === 'photo');
    const t = scene.ops.find((o) => o.op === 'text');
    if (photo?.op !== 'photo' || t?.op !== 'text') throw new Error('写真か文字が無い');
    return { photo: photo.dst, left: t.boundsLu.x + 2, right: t.boundsLu.x + t.boundsLu.w - 2, W: scene.canvas.widthLu as number };
  };
  it('中央揃えは、写真の右端からキャンバスの右の余白までの真ん中に来る', () => {
    const { photo, left, right, W } = lineOf('center');
    const def = styleFor(spec);
    const regionL = photo.x + photo.w + (def.caption.gapLu as number);
    const regionR = W - (def.caption.outerInsetLu as number);
    expect((left + right) / 2).toBeCloseTo((regionL + regionR) / 2, 1);
  });
  it('右揃えは右の余白の内側の端に、左揃えは写真の右端＋隙間に付く', () => {
    const def = styleFor(spec);
    const r = lineOf('right');
    expect(r.right).toBeCloseTo(r.W - (def.caption.outerInsetLu as number), 1);
    const l = lineOf('left');
    expect(l.left).toBeCloseTo(l.photo.x + l.photo.w + (def.caption.gapLu as number), 1);
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
    const scene = buildScene(inputFor({ style: sp({ margin: 'none', caption: 'below' }), bordered: true }), measurer);
    const r = scene.ops.find((o) => o.op === 'strokeRect');
    expect(r?.op === 'strokeRect' && r.rect.x).toBeGreaterThan(0);
  });

  describe('仕上がりの刻印', () => {
    type R = { x: number; y: number; w: number; h: number };
    const badgeOps = (scene: ReturnType<typeof buildScene>) =>
      scene.ops.filter((o) => o.op === 'text' && o.id.startsWith('badge'));
    const overlaps = (a: R, b: R): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const LOGO = { text: 'CLASSIC CHROME', mode: 'logo', place: 'below', align: 'center', valign: 'center', size: 'M', framed: false } as const;
    const TEXT = { text: 'CLASSIC CHROME', mode: 'text', place: 'below', align: 'center', valign: 'center', size: 'M', framed: true } as const;
    const PLACES = ['above', 'below', 'left', 'right'] as const;

    it('★刻印はキャンバスの外に出ない★ 16:9・3行・大きい字・広い字間・刻印は右下（実機で切れた）', () => {
      const IMG = { id: 'film:Velvia', aspect: 300 / 220 };
      const facts = { ...REFERENCE, film: 'Velvia' };
      for (const ratio of ['STN', 'SQ', 'FF', 'OR'] as const)
        for (const photo of ['left', 'center', 'right'] as const)
          for (const align of ['left', 'center', 'right'] as const)
            for (const size of ['XXS', 'M', 'L'] as const) {
              const scene = buildScene(
                inputFor({
                  style: sp({ ratio, photo, caption: 'below', lines: 3, margin: 'narrow' }),
                  photo: { id: 'p', aspect: 4 / 3 },
                  facts,
                  size: 'Large',
                  tracking: 'Widest',
                  badge: { ...LOGO, place: 'below', align, valign: 'end', size, image: IMG },
                }),
                measurer,
              );
              const mark = scene.ops.find((o) => o.op === 'photo' && String(o.photo).startsWith('film:'));
              const name = `${ratio} 写真:${photo} 刻印:${align} ${size}`;
              expect(mark?.op, name).toBe('photo');
              if (mark?.op !== 'photo') continue;
              expect(mark.dst.y + mark.dst.h, name).toBeLessThanOrEqual((scene.canvas.heightLu as number) + 0.01);
              expect(mark.dst.x + mark.dst.w, name).toBeLessThanOrEqual((scene.canvas.widthLu as number) + 0.01);
            }
    });
    const noOverlapWithPhotoAndText = (scene: ReturnType<typeof buildScene>, name: string): void => {
      const photo = scene.ops.find((o) => o.op === 'photo');
      const marks = badgeOps(scene);
      expect(marks.length, name).toBeGreaterThan(0);
      for (const o of scene.ops) {
        if (o.op !== 'text') continue;
        const r = o.boundsLu;
        if (photo?.op === 'photo') {
          const inner = { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 };
          expect(overlaps(inner, photo.dst), `${name}: ${o.id} が写真に掛かる`).toBe(false);
        }
        expect(r.x + 2, name).toBeGreaterThanOrEqual(-0.01);
        expect(r.x + r.w - 2, name).toBeLessThanOrEqual((scene.canvas.widthLu as number) + 0.01);
        expect(r.y + 2, name).toBeGreaterThanOrEqual(-0.01);
        expect(r.y + r.h - 2, name).toBeLessThanOrEqual((scene.canvas.heightLu as number) + 0.01);
      }
      const caps = scene.ops.filter((o) => o.op === 'text' && !o.id.startsWith('badge'));
      for (const m of marks) {
        if (m.op !== 'text') continue;
        for (const c of caps) if (c.op === 'text') expect(overlaps(m.boundsLu, c.boundsLu), `${name}: ${m.id}/${c.id}`).toBe(false);
      }
    };

    it('渡さなければ刻まない。文字は枠1本と文字1つ、札の無い名前は面と文字', () => {
      expect(badgeOps(buildScene(inputFor(), measurer))).toHaveLength(0);
      expect(badgeOps(buildScene(inputFor({ badge: null }), measurer))).toHaveLength(0);
      const t = buildScene(inputFor({ badge: TEXT }), measurer);
      expect(badgeOps(t)).toHaveLength(1);
      expect(t.ops.filter((o) => o.op === 'strokeRect')).toHaveLength(1);
      // 札を持たない名前は、地色と文字色を反転した面に名前を入れる
      const l = buildScene(inputFor({ badge: LOGO }), measurer);
      expect(badgeOps(l)).toHaveLength(1);
      expect(l.ops.filter((o) => o.op === 'fillRect')).toHaveLength(1);
    });

    /*
     * 2,610 通り × 7 比 × 2 見せ方 = 3.6 万 Scene。既定の 5 秒に収まったり収まらなかったりして
     * 揺れたので、時間の上限を明示する。決定的な計算であり、揺れの原因は上限だけ。
     */
    it('★写真の中には置かない★ 全組み合わせ × 全比 × 4辺で、帯の中・写真の外・文字と非重複', { timeout: 60_000 }, () => {
      for (const spec of SPECS) {
        if (spec.margin === 'none') continue;
        for (const aspect of [0.75, 1.5]) {
          for (const place of PLACES) {
            const badge = place === spec.caption ? LOGO : { ...TEXT, place };
            const scene = buildScene(inputFor({ style: spec, photo: { id: 'p', aspect }, badge: { ...badge, place } }), measurer);
            noOverlapWithPhotoAndText(scene, `${key(spec)} @${aspect} 刻印:${place}`);
          }
        }
      }
    });

    it('同じ帯で場所を取り合っても重ならない（横・縦の寄せの総当たり）', { timeout: 60_000 }, () => {
      const base = sp({ ratio: 'SQ', photo: 'top', caption: 'below' });
      for (const captionAlign of ['start', 'center', 'end'] as const) {
        for (const align of ['left', 'center', 'right'] as const) {
          for (const valign of ['start', 'center', 'end'] as const) {
            for (const capAlign of ['left', 'center', 'right'] as const) {
              for (const size of ['S', 'M', 'L'] as const) {
                const scene = buildScene(
                  inputFor({ style: { ...base, captionAlign }, align: capAlign, badge: { ...LOGO, align, valign, size } }),
                  measurer,
                );
                noOverlapWithPhotoAndText(scene, `寄せ ${captionAlign}/${capAlign} 刻印 ${align}/${valign}/${size}`);
              }
            }
          }
        }
      }
    });

    it('別の辺に置くと、その辺に帯ができて刻印だけが入る', () => {
      for (const place of PLACES) {
        if (place === 'below') continue;
        const scene = buildScene(inputFor({ style: sp({ ratio: 'OR' }), badge: { ...LOGO, place } }), measurer);
        const photo = scene.ops.find((o) => o.op === 'photo');
        const marks = badgeOps(scene);
        expect(marks.length, place).toBeGreaterThan(0);
        if (photo?.op !== 'photo') throw new Error('photo が無い');
        for (const m of marks) {
          if (m.op !== 'text') continue;
          const r = m.boundsLu;
          if (place === 'above') expect(r.y + r.h - 2, place).toBeLessThanOrEqual(photo.dst.y + 0.01);
          if (place === 'left') expect(r.x + r.w - 2, place).toBeLessThanOrEqual(photo.dst.x + 0.01);
          if (place === 'right') expect(r.x + 2, place).toBeGreaterThanOrEqual(photo.dst.x + photo.dst.w - 0.01);
        }
      }
    });

    it('同梱した札（画像）も帯の中に収まり、写真と重ならない', () => {
      const IMG = { id: 'film:PROVIA', aspect: 300 / 220 };
      for (const spec of SPECS) {
        if (spec.margin === 'none') continue;
        for (const place of PLACES) {
          const scene = buildScene(inputFor({ style: spec, badge: { ...LOGO, place, image: IMG } }), measurer);
          const photo = scene.ops.find((o) => o.op === 'photo' && o.photo === 'photo');
          const mark = scene.ops.find((o) => o.op === 'photo' && String(o.photo).startsWith('film:'));
          const name = `${key(spec)} 刻印:${place}`;
          expect(mark, name).toBeDefined();
          if (mark?.op !== 'photo' || photo?.op !== 'photo') continue;
          expect(mark.dst.w / mark.dst.h, name).toBeCloseTo(IMG.aspect, 3);
          expect(overlaps(mark.dst, photo.dst), `${name}: 札が写真に掛かる`).toBe(false);
          expect(mark.dst.x, name).toBeGreaterThanOrEqual(-0.01);
          expect(mark.dst.x + mark.dst.w, name).toBeLessThanOrEqual((scene.canvas.widthLu as number) + 0.01);
          expect(mark.dst.y + mark.dst.h, name).toBeLessThanOrEqual((scene.canvas.heightLu as number) + 0.01);
        }
      }
    });

    it('重ね（全面）でも刻む。写真の上、キャンバスの内側で、キャプションと重ならない', () => {
      const IMG = { id: 'film:PROVIA', aspect: 300 / 220 };
      const style = sp({ margin: 'none', caption: 'below' });
      for (const aspect of [0.75, 1.5]) {
        for (const align of ['left', 'center', 'right'] as const) {
          for (const valign of ['start', 'center', 'end'] as const) {
            for (const badge of [
              { ...LOGO, align, valign, image: IMG },
              { ...TEXT, align, valign },
            ]) {
              const scene = buildScene(inputFor({ style, photo: { id: 'p', aspect }, badge }), measurer);
              const name = `重ね @${aspect} ${badge.mode} ${align}/${valign}`;
              const mark =
                scene.ops.find((o) => o.op === 'photo' && String(o.photo).startsWith('film:')) ??
                scene.ops.find((o) => o.op === 'strokeRect');
              expect(mark, name).toBeDefined();
              if (!mark) continue;
              const r = mark.op === 'photo' ? mark.dst : mark.op === 'strokeRect' ? mark.rect : null;
              if (!r) continue;
              const W = scene.canvas.widthLu as number;
              const H = scene.canvas.heightLu as number;
              expect(r.x, name).toBeGreaterThanOrEqual(-0.01);
              expect(r.y, name).toBeGreaterThanOrEqual(-0.01);
              expect(r.x + r.w, name).toBeLessThanOrEqual(W + 0.01);
              expect(r.y + r.h, name).toBeLessThanOrEqual(H + 0.01);
              for (const c of scene.ops) {
                if (c.op !== 'text' || c.id.startsWith('badge')) continue;
                expect(overlaps(r, c.boundsLu), `${name}: キャプション ${c.id} と重なる`).toBe(false);
              }
            }
          }
        }
      }
    });

    it('刻印のぶん帯が伸び、キャプションが無くても刻印だけ置ける', () => {
      const without = buildScene(inputFor({ style: sp({ ratio: 'OR' }) }), measurer);
      const withBadge = buildScene(inputFor({ style: sp({ ratio: 'OR' }), badge: LOGO }), measurer);
      expect(withBadge.canvas.heightLu).toBeGreaterThan(without.canvas.heightLu);
      const only = buildScene(inputFor({ style: sp({ ratio: 'OR' }), facts: {}, badge: LOGO }), measurer);
      expect(badgeOps(only).length).toBeGreaterThan(0);
    });

    it('左右は刻印自身の位置に従い、キャプションの揃えには従わない', () => {
      const xOf = (align: 'left' | 'center' | 'right', capAlign: 'left' | 'center' | 'right'): number => {
        const scene = buildScene(inputFor({ badge: { ...TEXT, align }, align: capAlign }), measurer);
        const r = scene.ops.find((o) => o.op === 'strokeRect');
        return r?.op === 'strokeRect' ? (r.rect.x as number) : NaN;
      };
      expect(xOf('left', 'right')).toBeLessThan(xOf('center', 'right'));
      expect(xOf('center', 'left')).toBeLessThan(xOf('right', 'left'));
      expect(xOf('center', 'left')).toBeCloseTo(xOf('center', 'right'), 6);
    });

    it('大きさは 小 < 中 < 大。札は比を保つ。枠は選んだときだけ', () => {
      const IMG = { id: 'film:PROVIA', aspect: 300 / 220 };
      const box = (size: 'S' | 'M' | 'L'): { w: number; h: number } => {
        const scene = buildScene(inputFor({ badge: { ...LOGO, size, image: IMG } }), measurer);
        const mark = scene.ops.find((o) => o.op === 'photo' && String(o.photo).startsWith('film:'));
        if (mark?.op !== 'photo') throw new Error('札が無い');
        return { w: mark.dst.w as number, h: mark.dst.h as number };
      };
      const s = box('S');
      const m = box('M');
      const l = box('L');
      expect(s.h).toBeLessThan(m.h);
      expect(m.h).toBeLessThan(l.h);
      for (const r of [s, m, l]) expect(r.w / r.h).toBeCloseTo(IMG.aspect, 6);
      const strokes = (badge: BadgeSpec): number =>
        buildScene(inputFor({ badge }), measurer).ops.filter((o) => o.op === 'strokeRect').length;
      expect(strokes({ ...LOGO, image: IMG })).toBe(0);
      expect(strokes({ ...LOGO, image: IMG, framed: true })).toBe(1);
    });

    it('仕上がりの名前はキャプションの項目としても載る', () => {
      const scene = buildScene(inputFor({ facts: { ...REFERENCE, film: 'ACROS' } }), measurer);
      const texts = scene.ops.filter((o) => o.op === 'text' && !o.id.startsWith('badge')).map((o) => (o.op === 'text' ? o.text : ''));
      expect(texts.join(' ')).toContain('ACROS');
    });
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

  it('どの比率・行数・辺でも、真っ白な写真の上で 4.5:1 を確保する（文字のいちばん内側で）', () => {
    let checked = 0;
    for (const spec of SPECS) {
      if (spec.margin !== 'none') continue;
      const def = styleFor(spec);
      const scrim = def.caption.scrim;
      expect(scrim, key(spec)).toBeDefined();
      if (!scrim) continue;
      for (const size of ['Small', 'Medium', 'Large'] as const) {
        const t = typesetCaption(def, { facts: REFERENCE, gates: ALL_ON, ...TYPO, size }, captionWidthLu(def), measurer);
        const l = resolveLayout(def, 1.5, t.heightLu);
        const d = scrimDepth(def, t.heightLu);
        const W = l.canvas.w as number;
        const H = l.canvas.h as number;
        const c = l.captionBox;
        const cx = c.x as number;
        const cy = c.y as number;
        // 暗幕の内側の端（t=0）から辺（t=1）へ。文字の箱の、辺からいちばん遠い端で測る
        const at =
          spec.caption === 'below'
            ? (cy - (H - d)) / d
            : spec.caption === 'above'
              ? (d - (cy + (c.h as number))) / d
              : spec.caption === 'left'
                ? (d - (cx + (c.w as number))) / d
                : (cx - (W - d)) / d;
        const a = scrimAlphaAt(at, scrim.alpha, scrim.plateauAt);
        const g = 255 * (1 - a);
        const ratio = (inkL + 0.05) / (lum(g, g, g) + 0.05);
        expect(ratio, `${key(spec)} ${size}: 暗幕 ${a.toFixed(3)} → ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        checked++;
      }
    }
    expect(checked).toBe(8 * 4 * 4 * 3 * 3);
  });

});
