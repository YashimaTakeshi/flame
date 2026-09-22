/**
 * 組み合わせ（StyleSpec）から寸法（StyleDef）を生成する。
 *
 * 以前は15個のプリセットを手で書いていた。利用者から見ると
 * 「OR2」「中央・1行」のような札から選ぶことになり、何が変わるか見えなかった。
 * いまは 比率 × 写真の位置 × 文字の位置 × 行数 の4軸を利用者が直接選び、
 * ここで寸法に落とす。手で書いたプリセットの値は、比率ごとの基準としてだけ残っている。
 */
import { lu } from '../units';
import {
  F,
  ins,
  LINE_ALL_IN_ONE,
  LINE_CAMERA,
  LINE_LENS_TECH,
  LINE_TECH_PLACE,
  LINE_TITLE_DATE,
} from './tokens';
import type {
  CaptionAlign,
  CaptionLineSpec,
  CaptionPlace,
  LineCount,
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
  OR: { label: '元比', aspect: null, insetLu: 26, typeScale: 1.0 },
  SQ: { label: '1:1', aspect: [1, 1], insetLu: 56, typeScale: 1.0 },
  TF: { label: '3:4', aspect: [3, 4], insetLu: 64, typeScale: 1.0 },
  FF: { label: '4:5', aspect: [4, 5], insetLu: 64, typeScale: 1.0 },
  NST: { label: '9:16', aspect: [9, 16], insetLu: 56, typeScale: 1.05 },
  STN: { label: '16:9', aspect: [16, 9], insetLu: 40, typeScale: 0.88 },
};

export const RATIO_IDS = Object.keys(RATIOS) as readonly Ratio[];
export const PHOTO_PLACES: readonly PhotoPlace[] = ['center', 'top', 'bottom', 'left', 'right'];
export const CAPTION_PLACES: readonly CaptionPlace[] = ['above', 'below', 'left', 'right', 'overlay'];
export const LINE_COUNTS: readonly LineCount[] = [1, 2, 3];
export const MARGINS: readonly MarginId[] = ['narrow', 'normal', 'wide', 'none'];
export const CAPTION_ALIGNS: readonly CaptionAlign[] = ['start', 'center', 'end'];

/** 余白の倍率。比率ごとの基準（RATIOS.insetLu）に掛ける。none は全面 */
export const MARGIN_SCALE: Readonly<Record<MarginId, number>> = { narrow: 0.45, normal: 0.7, wide: 1.0, none: 0 };

/** 重ね文字の、キャンバス端からの距離。余白の倍率に**依らない**（余白なしでも文字は端に寄らない） */
export const OVERLAY_INSET_LU = 34;

const isSide = (p: PhotoPlace | CaptionPlace): boolean => p === 'left' || p === 'right';

/** 左右に置く文字の段の幅。★余白の倍率は掛けない */
export const SIDE_BAND_LU = 300;

/**
 * 行数ごとの行構成。参考アプリの観測（1行: 全部カンマ区切り／3行: 2行目ボールド・3行目グレー）を基準にした。
 * 左右の段では折り返しを許す。段が狭いので折らないと入らない。
 */
function linesFor(n: LineCount, side: boolean): readonly CaptionLineSpec[] {
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
        { id: 'l1', fields: LINE_ALL_IN_ONE, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.32, ...wrap(4), ...alignSide },
      ];
    case 2:
      return [
        { id: 'l1', fields: LINE_TITLE_DATE, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.42, ...wrap(2), ...alignSide },
        { id: 'l2', fields: LINE_TECH_PLACE, separator: 'comma', emphasis: 'muted', relSize: 0.9, leading: 1.42, ...wrap(3), ...alignSide },
      ];
    case 3:
      return [
        { id: 'l1', fields: LINE_TITLE_DATE, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.42, ...wrap(2), ...alignSide },
        { id: 'l2', fields: LINE_CAMERA, separator: 'comma', emphasis: 'bold', relSize: 1.0, leading: 1.42, ...wrap(2), ...alignSide },
        { id: 'l3', fields: LINE_LENS_TECH, separator: 'comma', emphasis: 'muted', relSize: 0.92, leading: 1.42, ...wrap(3), ...alignSide },
      ];
  }
}

/**
 * 組み合わせの整合。ここで揃えるので、UI 側は1つの軸だけ変えて渡してよい。
 *
 * 1. 「余白なし」と「重ね」は同じ状態の2つの入口である（写真が端まで届くなら文字は
 *    重ねるしかなく、文字を重ねるなら写真は端まで届く）。どちらから来ても同じ形に揃える。
 * 2. 文字を左右の段に置くとき、写真も同じ側に寄せる指定は意味を持たない
 *    （段を差し引いた残りに置くので、寄せる先が無い）。写真は中央に戻す。
 */
export function normalize(spec: StyleSpec): StyleSpec {
  let s = spec;
  if (s.margin === 'none' && s.caption !== 'overlay') s = { ...s, caption: 'overlay' };
  if (s.caption === 'overlay' && s.margin !== 'none') s = { ...s, margin: 'none' };
  if (isSide(s.caption) && isSide(s.photo)) s = { ...s, photo: 'center' };
  // 重ねでは帯が無いので寄せは効かない。全面では切り取りの中心は指で決めるので写真の位置は効かない
  if (s.caption === 'overlay' && s.captionAlign !== 'center') s = { ...s, captionAlign: 'center' };
  if (s.margin === 'none' && s.photo !== 'center') s = { ...s, photo: 'center' };
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

export function styleFor(raw: StyleSpec): StyleDef {
  const spec = normalize(raw);
  const r = RATIOS[spec.ratio];
  const base = Math.round(r.insetLu * MARGIN_SCALE[spec.margin]);
  const side = isSide(spec.caption);
  const overlay = spec.caption === 'overlay';

  return {
    spec,
    canvas: r.aspect ? { kind: 'fixed', aspect: r.aspect } : { kind: 'derived' },
    photo: { inset: ins(base, base, base, base), place: spec.photo },
    caption: {
      place: spec.caption,
      gapLu: lu(Math.round(base * 0.55)),
      sideInsetLu: lu(overlay ? OVERLAY_INSET_LU : base),
      outerInsetLu: lu(overlay ? OVERLAY_INSET_LU : Math.round(base * 1.1)),
      bandLu: lu(SIDE_BAND_LU),
      lines: linesFor(spec.lines, side),
      ...(overlay
        ? {
            // 0.58 は「白い写真の上でも本文コントラストが 4.5:1 を超える」最小の濃さ（§4.6）
            scrim: { heightLu: lu(spec.ratio === 'STN' ? 230 : 320), alpha: 0.58 },
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
  SQ4: { ratio: 'SQ', photo: 'center', caption: 'overlay', lines: 1, captionAlign: C, margin: 'none' },
  TF1: { ratio: 'TF', photo: 'center', caption: 'below', lines: 2, captionAlign: C, margin: N },
  FF1: { ratio: 'FF', photo: 'center', caption: 'below', lines: 1, captionAlign: C, margin: N },
  FF2: { ratio: 'FF', photo: 'center', caption: 'above', lines: 2, captionAlign: C, margin: N },
  FF3: { ratio: 'FF', photo: 'center', caption: 'below', lines: 3, captionAlign: C, margin: N },
  NST1: { ratio: 'NST', photo: 'center', caption: 'below', lines: 2, captionAlign: C, margin: N },
  STN1: { ratio: 'STN', photo: 'center', caption: 'below', lines: 1, captionAlign: C, margin: N },
  STN2: { ratio: 'STN', photo: 'center', caption: 'right', lines: 3, captionAlign: C, margin: N },
  STN3: { ratio: 'STN', photo: 'center', caption: 'overlay', lines: 1, captionAlign: C, margin: 'none' },
};

export const specKey = (s: StyleSpec): string =>
  `${s.ratio}/${s.photo}/${s.caption}/${s.captionAlign}/${s.lines}/${s.margin}`;

/** 全組み合わせ（整合後の重複を除く）。テストが総当たりに使う */
export function allSpecs(): StyleSpec[] {
  const seen = new Set<string>();
  const out: StyleSpec[] = [];
  for (const ratio of RATIO_IDS)
    for (const margin of MARGINS)
      for (const photo of PHOTO_PLACES)
        for (const caption of CAPTION_PLACES)
          for (const captionAlign of CAPTION_ALIGNS)
            for (const lines of LINE_COUNTS) {
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
