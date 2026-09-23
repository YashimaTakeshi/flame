/**
 * 組み合わせ（StyleSpec）から寸法（StyleDef）を生成する。
 *
 * 以前は15個のプリセットを手で書いていた。利用者から見ると
 * 「OR2」「中央・1行」のような札から選ぶことになり、何が変わるか見えなかった。
 * いまは 比率 × 写真の位置 × 文字の位置 × 行数 の4軸を利用者が直接選び、
 * ここで寸法に落とす。手で書いたプリセットの値は、比率ごとの基準としてだけ残っている。
 */
import { lu } from '../units';
import { DEFAULT_LINE_LAYOUT, F, groupsFor, ins, tokensOf } from './tokens';
import type {
  CaptionAlign,
  CaptionLineSpec,
  CaptionPlace,
  LineCount,
  LineLayout,
  MarginId,
  PhotoPlace,
  Ratio,
  StyleDef,
  StyleSpec,
} from './types';

/** 比率ごとの基準値。数値は以前のプリセット（docs/design.md §3.4）から引き継いだ推定値 */
export const RATIOS: Readonly<
  Record<
    Ratio,
    {
      readonly label: string;
      readonly aspect: readonly [number, number] | null; // null = 元比
      /** 余白の基準（lu）。余白の倍率はこれに掛かる */
      readonly insetLu: number;
      readonly typeScale: number;
    }
  >
> = {
  // 並びは選ぶ順。4:5（インスタの縦）がいちばん選ばれるので元比の隣に置く
  OR: { label: '元比', aspect: null, insetLu: 26, typeScale: 1.0 },
  FF: { label: '4:5', aspect: [4, 5], insetLu: 64, typeScale: 1.0 },
  TF: { label: '3:4', aspect: [3, 4], insetLu: 64, typeScale: 1.0 },
  TT: { label: '2:3', aspect: [2, 3], insetLu: 64, typeScale: 1.0 },
  SQ: { label: '1:1', aspect: [1, 1], insetLu: 56, typeScale: 1.0 },
  NST: { label: '9:16', aspect: [9, 16], insetLu: 56, typeScale: 1.05 },
  STN: { label: '16:9', aspect: [16, 9], insetLu: 40, typeScale: 0.88 },
  IGL: { label: '1.91:1', aspect: [191, 100], insetLu: 38, typeScale: 0.86 },
};

export const RATIO_IDS = Object.keys(RATIOS) as readonly Ratio[];
export const PHOTO_PLACES: readonly PhotoPlace[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];
export const CAPTION_PLACES: readonly CaptionPlace[] = ['above', 'below', 'left', 'right'];
export const LINE_COUNTS: readonly LineCount[] = [1, 2, 3, 4];
export const MARGINS: readonly MarginId[] = ['thin', 'narrow', 'normal', 'wide', 'none'];
export const CAPTION_ALIGNS: readonly CaptionAlign[] = ['start', 'center', 'end'];

/** 余白の倍率。比率ごとの基準（RATIOS.insetLu）に掛ける。none は全面 */
export const MARGIN_SCALE: Readonly<Record<MarginId, number>> = { thin: 0.22, narrow: 0.45, normal: 0.7, wide: 1.0, none: 0 };

/** 重ね文字の、キャンバス端からの距離。余白の倍率に**依らない**（余白なしでも文字は端に寄らない） */
export const OVERLAY_INSET_LU = 34;

const isSide = (p: CaptionPlace): boolean => p === 'left' || p === 'right';

/** 左右に置く文字の段の幅。★余白の倍率は掛けない */
export const SIDE_BAND_LU = 300;

/**
 * 行数ごとの行構成。参考アプリの観測（1行: 全部カンマ区切り／3行: 2行目ボールド・3行目グレー）を基準にした。
 * 左右の段では折り返しを許す。段が狭いので折らないと入らない。
 */
function linesFor(n: LineCount, side: boolean, layout: LineLayout): readonly CaptionLineSpec[] {
  // どの項目を何行目に置くかは利用者の割り振り（既定は以前の固定の組みと同じ）
  const g = groupsFor(layout, n).map(tokensOf);
  const wrap = (k: number): { maxWrap?: number } => (side ? { maxWrap: k } : {});
  /*
   * 左右の段でも揃えは利用者の選択に従う。
   * 以前は段では左揃えに固定していた（参考アプリの段のスタイルが左揃えのため）。
   * 縦位置の写真で右の余白が広いとき「余白の中央に置けない」と指摘され、固定をやめた。
   * 段の幅（300lu）で組んだ行を、余り全部の幅の中で左・中・右に揃える（layout.ts）。
   */
  const alignSide = {};
  switch (n) {
    case 1:
      return [
        { id: 'l1', fields: g[0]!, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.32, ...wrap(4), ...alignSide },
      ];
    case 2:
      return [
        { id: 'l1', fields: g[0]!, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.42, ...wrap(2), ...alignSide },
        { id: 'l2', fields: g[1]!, separator: 'comma', emphasis: 'muted', relSize: 0.9, leading: 1.42, ...wrap(3), ...alignSide },
      ];
    case 3:
      return [
        { id: 'l1', fields: g[0]!, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.42, ...wrap(2), ...alignSide },
        { id: 'l2', fields: g[1]!, separator: 'comma', emphasis: 'bold', relSize: 1.0, leading: 1.42, ...wrap(2), ...alignSide },
        { id: 'l3', fields: g[2]!, separator: 'comma', emphasis: 'muted', relSize: 0.92, leading: 1.42, ...wrap(3), ...alignSide },
      ];
    case 4:
      // 3行の組みに、小さく薄い行をもう1つ。行が増えるぶん行間は少し詰める
      return [
        { id: 'l1', fields: g[0]!, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.38, ...wrap(2), ...alignSide },
        { id: 'l2', fields: g[1]!, separator: 'comma', emphasis: 'bold', relSize: 1.0, leading: 1.38, ...wrap(2), ...alignSide },
        { id: 'l3', fields: g[2]!, separator: 'comma', emphasis: 'muted', relSize: 0.92, leading: 1.38, ...wrap(2), ...alignSide },
        { id: 'l4', fields: g[3]!, separator: 'comma', emphasis: 'muted', relSize: 0.92, leading: 1.38, ...wrap(2), ...alignSide },
      ];
  }
}

/** 左右の辺に重ねるときの暗幕の奥行き。文字の段（端から OVERLAY_INSET_LU＋SIDE_BAND_LU）を平らな濃さで覆う */
export const SIDE_SCRIM_LU = 520;

/**
 * 組み合わせの整合。**利用者の選んだ値は書き換えない**（触った軸以外が勝手に動くと混乱する）。
 * 効かない組み合わせ（全面での写真の位置、余りの無い軸への寄せ）は、描くときに効かないだけで、値は覚えておく。
 * ここで直すのは旧い保存の読み替えだけ。
 */
export function normalize(spec: StyleSpec): StyleSpec {
  let s = spec;
  // 旧い保存（'overlay'）を読んだら、下に重ねる（以前の見た目のまま）
  if ((s.caption as string) === 'overlay') s = { ...s, caption: 'below', margin: 'none' };
  return s;
}

/** 同じ組み合わせか */
export const sameSpec = (a: StyleSpec, b: StyleSpec): boolean =>
  a.ratio === b.ratio &&
  a.photo === b.photo &&
  a.caption === b.caption &&
  a.captionAlign === b.captionAlign &&
  a.lines === b.lines &&
  a.margin === b.margin;

export function styleFor(raw: StyleSpec, layout: LineLayout = DEFAULT_LINE_LAYOUT): StyleDef {
  const spec = normalize(raw);
  const r = RATIOS[spec.ratio];
  const base = Math.round(r.insetLu * MARGIN_SCALE[spec.margin]);
  const side = isSide(spec.caption);
  const overlay = spec.margin === 'none';

  return {
    spec,
    canvas: r.aspect ? { kind: 'fixed', aspect: r.aspect } : { kind: 'derived' },
    photo: { inset: ins(base, base, base, base), place: spec.photo },
    caption: {
      place: spec.caption,
      overlay,
      gapLu: lu(Math.round(base * 0.55)),
      sideInsetLu: lu(overlay ? OVERLAY_INSET_LU : base),
      outerInsetLu: lu(overlay ? OVERLAY_INSET_LU : Math.round(base * 1.1)),
      bandLu: lu(SIDE_BAND_LU),
      lines: linesFor(spec.lines, side, layout),
      ...(overlay
        ? {
            // 0.58 は「白い写真の上でも本文コントラストが 4.5:1 を超える」最小の濃さ（§4.6）
            scrim: side
              ? // 左右: 段（端から 34＋300lu）が平らな濃さに入るよう、立ち上がりを短くする
                { depthLu: lu(SIDE_SCRIM_LU), alpha: 0.58, plateauAt: 0.35 }
              : { depthLu: lu(spec.ratio === 'STN' ? 230 : 320), alpha: 0.58, plateauAt: 0.5 },
          }
        : {}),
    },
    typeScale: r.typeScale,
  };
}

/**
 * 参考アプリの15スタイルを、この4軸で言い直したもの。
 * 画面には出さない。テストが「参考アプリの組み合わせが全部成立する」ことを確かめるのに使う。
 */
const N: MarginId = 'normal';
const C: CaptionAlign = 'center';
export const FRMM_PRESETS: Readonly<Record<string, StyleSpec>> = {
  OR1: { ratio: 'OR', photo: 'center', caption: 'below', lines: 1, captionAlign: C, margin: 'narrow' },
  OR2: { ratio: 'OR', photo: 'center', caption: 'below', lines: 3, captionAlign: C, margin: N },
  OR3: { ratio: 'OR', photo: 'center', caption: 'below', lines: 2, captionAlign: C, margin: 'wide' },
  SQ1: { ratio: 'SQ', photo: 'center', caption: 'below', lines: 1, captionAlign: C, margin: N },
  SQ2: { ratio: 'SQ', photo: 'center', caption: 'below', lines: 3, captionAlign: C, margin: N },
  SQ3: { ratio: 'SQ', photo: 'top', caption: 'below', lines: 2, captionAlign: C, margin: N },
  SQ4: { ratio: 'SQ', photo: 'center', caption: 'below', lines: 1, captionAlign: C, margin: 'none' },
  TF1: { ratio: 'TF', photo: 'center', caption: 'below', lines: 2, captionAlign: C, margin: N },
  FF1: { ratio: 'FF', photo: 'center', caption: 'below', lines: 1, captionAlign: C, margin: N },
  FF2: { ratio: 'FF', photo: 'center', caption: 'above', lines: 2, captionAlign: C, margin: N },
  FF3: { ratio: 'FF', photo: 'center', caption: 'below', lines: 3, captionAlign: C, margin: N },
  NST1: { ratio: 'NST', photo: 'center', caption: 'below', lines: 2, captionAlign: C, margin: N },
  STN1: { ratio: 'STN', photo: 'center', caption: 'below', lines: 1, captionAlign: C, margin: N },
  STN2: { ratio: 'STN', photo: 'center', caption: 'right', lines: 3, captionAlign: C, margin: N },
  STN3: { ratio: 'STN', photo: 'center', caption: 'below', lines: 1, captionAlign: C, margin: 'none' },
};

export const specKey = (s: StyleSpec): string =>
  `${s.ratio}/${s.photo}/${s.caption}/${s.captionAlign}/${s.lines}/${s.margin}`;

/**
 * 全組み合わせ（重複を除く）。テストが総当たりに使う。
 * 全面では写真の位置は描くときに効かない（値は覚えているだけ）ので、中央の1通りだけ数える
 */
export function allSpecs(): StyleSpec[] {
  const seen = new Set<string>();
  const out: StyleSpec[] = [];
  for (const ratio of RATIO_IDS)
    for (const margin of MARGINS)
      for (const photo of PHOTO_PLACES)
        for (const caption of CAPTION_PLACES)
          for (const captionAlign of CAPTION_ALIGNS)
            for (const lines of LINE_COUNTS) {
              if (margin === 'none' && photo !== 'center') continue;
              const s = normalize({ ratio, photo, caption, captionAlign, lines, margin });
              const key = specKey(s);
              if (seen.has(key)) continue;
              seen.add(key);
              out.push(s);
            }
  return out;
}

/** 既定。写真を真ん中に、下に1行 */
export const DEFAULT_SPEC: StyleSpec = { ratio: 'OR', photo: 'center', caption: 'below', lines: 1, captionAlign: C, margin: 'normal' };

// F は行構成を外から組むときに使う（tokens の再輸出）
export { F };
