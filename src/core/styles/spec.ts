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
  CaptionLineSpec,
  CaptionPlace,
  LineCount,
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
export const PHOTO_PLACES: readonly PhotoPlace[] = ['center', 'top', 'bottom', 'left', 'right', 'bleed'];
export const CAPTION_PLACES: readonly CaptionPlace[] = ['below', 'above', 'left', 'right', 'overlay'];
export const LINE_COUNTS: readonly LineCount[] = [1, 2, 3];

/** 左右に置く文字の段の幅。★余白の倍率は掛けない */
export const SIDE_BAND_LU = 300;

/**
 * 行数ごとの行構成。参考アプリの観測（1行: 全部カンマ区切り／3行: 2行目ボールド・3行目グレー）を基準にした。
 * 左右の段では折り返しを許す。段が狭いので折らないと入らない。
 */
function linesFor(n: LineCount, side: boolean): readonly CaptionLineSpec[] {
  const wrap = (k: number): { maxWrap?: number } => (side ? { maxWrap: k } : {});
  const alignSide = side ? ({ alignOverride: 'left' } as const) : {};
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
 * 組み合わせの整合。
 *
 * 「全面」と「重ね」は同じ状態の2つの入口である（写真が全面なら文字は重ねるしかなく、
 * 文字を重ねるなら写真は全面）。どちらから来ても同じ形に揃える。
 * ここで揃えるので、UI 側は片方だけ変えて渡してよい。
 */
export function normalize(spec: StyleSpec): StyleSpec {
  if (spec.photo === 'bleed' && spec.caption !== 'overlay') return { ...spec, caption: 'overlay' };
  if (spec.caption === 'overlay' && spec.photo !== 'bleed') return { ...spec, photo: 'bleed' };
  return spec;
}

/** 同じ組み合わせか */
export const sameSpec = (a: StyleSpec, b: StyleSpec): boolean =>
  a.ratio === b.ratio && a.photo === b.photo && a.caption === b.caption && a.lines === b.lines;

export function styleFor(raw: StyleSpec): StyleDef {
  const spec = normalize(raw);
  const r = RATIOS[spec.ratio];
  const base = r.insetLu;
  const side = spec.caption === 'left' || spec.caption === 'right';
  const overlay = spec.caption === 'overlay';

  return {
    spec,
    canvas: r.aspect ? { kind: 'fixed', aspect: r.aspect } : { kind: 'derived' },
    photo: {
      inset: spec.photo === 'bleed' ? ins(0, 0, 0, 0) : ins(base, base, base, base),
      place: spec.photo,
    },
    caption: {
      place: spec.caption,
      gapLu: lu(Math.round(base * 0.55)),
      sideInsetLu: lu(overlay ? Math.max(34, Math.round(base * 0.7)) : base),
      outerInsetLu: lu(overlay ? Math.max(34, Math.round(base * 0.7)) : Math.round(base * 1.1)),
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
export const FRMM_PRESETS: Readonly<Record<string, StyleSpec>> = {
  OR1: { ratio: 'OR', photo: 'center', caption: 'below', lines: 1 },
  OR2: { ratio: 'OR', photo: 'center', caption: 'below', lines: 3 },
  OR3: { ratio: 'OR', photo: 'center', caption: 'below', lines: 2 },
  SQ1: { ratio: 'SQ', photo: 'center', caption: 'below', lines: 1 },
  SQ2: { ratio: 'SQ', photo: 'center', caption: 'below', lines: 3 },
  SQ3: { ratio: 'SQ', photo: 'top', caption: 'below', lines: 2 },
  SQ4: { ratio: 'SQ', photo: 'bleed', caption: 'overlay', lines: 1 },
  TF1: { ratio: 'TF', photo: 'center', caption: 'below', lines: 2 },
  FF1: { ratio: 'FF', photo: 'center', caption: 'below', lines: 1 },
  FF2: { ratio: 'FF', photo: 'center', caption: 'above', lines: 2 },
  FF3: { ratio: 'FF', photo: 'center', caption: 'below', lines: 3 },
  NST1: { ratio: 'NST', photo: 'center', caption: 'below', lines: 2 },
  STN1: { ratio: 'STN', photo: 'center', caption: 'below', lines: 1 },
  STN2: { ratio: 'STN', photo: 'center', caption: 'right', lines: 3 },
  STN3: { ratio: 'STN', photo: 'bleed', caption: 'overlay', lines: 1 },
};

/** 全組み合わせ（整合後の重複を除く）。テストが総当たりに使う */
export function allSpecs(): StyleSpec[] {
  const seen = new Set<string>();
  const out: StyleSpec[] = [];
  for (const ratio of RATIO_IDS)
    for (const photo of PHOTO_PLACES)
      for (const caption of CAPTION_PLACES)
        for (const lines of LINE_COUNTS) {
          const s = normalize({ ratio, photo, caption, lines });
          const key = `${s.ratio}/${s.photo}/${s.caption}/${s.lines}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(s);
        }
  return out;
}

/** 既定。写真を真ん中に、下に1行 */
export const DEFAULT_SPEC: StyleSpec = { ratio: 'OR', photo: 'center', caption: 'below', lines: 1 };

// F は行構成を外から組むときに使う（tokens の再輸出）
export { F };
