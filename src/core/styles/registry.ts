/**
 * 15スタイルの実データ。
 *
 * ★参考アプリとの見た目の完全一致は保証しない。★
 * 動画・スクリーンショットから読み取れたのは**比率・写真の寄せ・キャプションの
 * 配置と行構成**だけで、余白・字送り・行送りの数値は15スタイルすべてで推定値である。
 * どれが未確認かは `confidence` と `note` から引ける（docs/design.md §3.3）。
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
import type { StyleDef, StyleGroup, StyleId } from './types';

export const STYLES: Readonly<Record<StyleId, StyleDef>> = {
  /* ── OR: 元写真の比率をそのまま使う ───────────────────── */
  OR1: {
    id: 'OR1', group: 'OR', label: '元比・細枠・1行', ratioLabel: '元の比率',
    canvas: { kind: 'derived' },
    photo: { fit: 'contain', crop: 'none', inset: ins(10, 10, 10, 10), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(11), sideInsetLu: lu(12), outerInsetLu: lu(13),
      lines: [
        { id: 'l1', fields: LINE_ALL_IN_ONE, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.30 },
      ],
    },
    typeScale: 0.95,
    defaults: { align: 'left', tracking: 'Normal', size: 'Small' },
    visibleIn: ['kodawaru', 'otegaru'],
    confidence: 'partly-observed',
    note: '観測: 余白ごく細・1行にカンマ区切りで全部。寸法は推定。',
  },

  OR2: {
    id: 'OR2', group: 'OR', label: '元比・3行', ratioLabel: '元の比率',
    canvas: { kind: 'derived' },
    photo: { fit: 'contain', crop: 'none', inset: ins(26, 26, 26, 26), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(19), sideInsetLu: lu(26), outerInsetLu: lu(30),
      lines: [
        { id: 'l1', fields: LINE_TITLE_DATE, separator: 'comma', emphasis: 'normal', relSize: 1.00, leading: 1.42 },
        { id: 'l2', fields: LINE_CAMERA, separator: 'comma', emphasis: 'bold', relSize: 1.00, leading: 1.42 },
        { id: 'l3', fields: LINE_LENS_TECH, separator: 'comma', emphasis: 'muted', relSize: 0.92, leading: 1.42 },
      ],
    },
    typeScale: 1.00,
    defaults: { align: 'center', tracking: 'Normal', size: 'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'partly-observed',
    note: '観測: 3行／2行目ボールド／3行目グレー。寸法は推定。こだわるモードの既定。',
  },

  OR3: {
    id: 'OR3', group: 'OR', label: '元比・余白広め・タイトル主役', ratioLabel: '元の比率',
    canvas: { kind: 'derived' },
    photo: { fit: 'contain', crop: 'none', inset: ins(44, 44, 44, 44), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(24), sideInsetLu: lu(44), outerInsetLu: lu(48),
      lines: [
        { id: 'l1', fields: [F('title')], separator: 'none', emphasis: 'normal', relSize: 1.15, leading: 1.50 },
        { id: 'l2', fields: LINE_TECH_PLACE, separator: 'middot', emphasis: 'muted', relSize: 0.88, leading: 1.50 },
      ],
    },
    typeScale: 1.05,
    defaults: { align: 'center', tracking: 'Wide', size: 'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
  },

  /* ── SQ: 1:1 ──────────────────────────────────────────── */
  SQ1: {
    id: 'SQ1', group: 'SQ', label: '正方形・中央・1行', ratioLabel: '1:1',
    canvas: { kind: 'fixed', aspect: [1, 1] },
    photo: { fit: 'contain', crop: 'none', inset: ins(64, 64, 56, 64), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(24), sideInsetLu: lu(64), outerInsetLu: lu(44),
      lines: [
        { id: 'l1', fields: LINE_ALL_IN_ONE, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.32 },
      ],
    },
    typeScale: 1.00,
    defaults: { align: 'center', tracking: 'Normal', size: 'Medium' },
    visibleIn: ['kodawaru', 'otegaru'],
    confidence: 'partly-observed',
    note: '観測: 正方形キャンバス中央に写真、直下に1行。寸法は推定。',
  },

  SQ2: {
    id: 'SQ2', group: 'SQ', label: '正方形・3行', ratioLabel: '1:1',
    canvas: { kind: 'fixed', aspect: [1, 1] },
    photo: { fit: 'contain', crop: 'none', inset: ins(56, 56, 56, 56), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(22), sideInsetLu: lu(56), outerInsetLu: lu(40),
      lines: [
        { id: 'l1', fields: LINE_TITLE_DATE, separator: 'comma', emphasis: 'normal', relSize: 1.00, leading: 1.40 },
        { id: 'l2', fields: LINE_CAMERA, separator: 'comma', emphasis: 'bold', relSize: 1.00, leading: 1.40 },
        { id: 'l3', fields: LINE_LENS_TECH, separator: 'comma', emphasis: 'muted', relSize: 0.92, leading: 1.40 },
      ],
    },
    typeScale: 1.00,
    defaults: { align: 'center', tracking: 'Normal', size: 'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
  },

  SQ3: {
    id: 'SQ3', group: 'SQ', label: '正方形・ポラロイド', ratioLabel: '1:1',
    canvas: { kind: 'fixed', aspect: [1, 1] },
    photo: { fit: 'contain', crop: 'none', inset: ins(52, 52, 196, 52), anchor: 'top', bleed: false },
    caption: {
      place: 'bottom-band', gapLu: lu(0), sideInsetLu: lu(52), outerInsetLu: lu(0),
      bandLu: lu(196), bandAlign: 'center',
      lines: [
        { id: 'l1', fields: [F('title'), F('artist', 'artistEnabled')], separator: 'emdash', emphasis: 'normal', relSize: 1.10, leading: 1.55 },
        { id: 'l2', fields: [F('date'), F('camera'), F('lens'), F('place', 'placeEnabled')], separator: 'comma', emphasis: 'muted', relSize: 0.86, leading: 1.55 },
      ],
    },
    typeScale: 1.05,
    defaults: { align: 'center', tracking: 'Wide', size: 'Medium' },
    visibleIn: ['kodawaru', 'otegaru'],
    confidence: 'partly-observed',
    note: '観測: 上寄せ・下に大きな余白。帯の高さ196luは推定。お手軽モードの既定。',
  },

  SQ4: {
    id: 'SQ4', group: 'SQ', label: '正方形・全面・重ね文字', ratioLabel: '1:1',
    canvas: { kind: 'fixed', aspect: [1, 1] },
    photo: { fit: 'cover', crop: 'toCanvas', inset: ins(0, 0, 0, 0), anchor: 'center', bleed: true },
    caption: {
      place: 'overlay-bottom', gapLu: lu(0), sideInsetLu: lu(40), outerInsetLu: lu(40),
      // 0.58 は「白い写真の上でも本文コントラストが 4.5:1 を超える」最小の濃さ。
      // 設計時の見込み（0.42）では 2.7:1 で、明るい空や雪の上で読めなかった。
      scrim: { heightLu: lu(320), alpha: 0.58 },
      lines: [
        { id: 'l1', fields: LINE_ALL_IN_ONE, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.32 },
      ],
    },
    typeScale: 1.00,
    defaults: { align: 'left', tracking: 'Wide', size: 'Small' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
    note: '推定: 全面ブリード＋下部オーバーレイ。文字は暗幕の上なので明色で置く。',
  },

  /* ── TF: 3:4 ──────────────────────────────────────────── */
  TF1: {
    id: 'TF1', group: 'TF', label: '3:4・中央やや上', ratioLabel: '3:4',
    canvas: { kind: 'fixed', aspect: [3, 4] },
    photo: { fit: 'contain', crop: 'none', inset: ins(66, 66, 132, 66), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(28), sideInsetLu: lu(66), outerInsetLu: lu(54),
      lines: [
        { id: 'l1', fields: LINE_TITLE_DATE, separator: 'comma', emphasis: 'normal', relSize: 1.00, leading: 1.42 },
        { id: 'l2', fields: LINE_TECH_PLACE, separator: 'comma', emphasis: 'muted', relSize: 0.90, leading: 1.42 },
      ],
    },
    typeScale: 1.00,
    defaults: { align: 'center', tracking: 'Normal', size: 'Medium' },
    visibleIn: ['kodawaru', 'otegaru'],
    confidence: 'partly-observed',
    note: '観測: 写真中央やや上、下に余白。inset.bottom を大きめに取って実現。',
  },

  /* ── FF: 4:5 ──────────────────────────────────────────── */
  FF1: {
    id: 'FF1', group: 'FF', label: '4:5・標準', ratioLabel: '4:5',
    canvas: { kind: 'fixed', aspect: [4, 5] },
    photo: { fit: 'contain', crop: 'none', inset: ins(70, 70, 104, 70), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(26), sideInsetLu: lu(70), outerInsetLu: lu(60),
      lines: [
        { id: 'l1', fields: LINE_ALL_IN_ONE, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.32 },
      ],
    },
    typeScale: 1.00,
    defaults: { align: 'center', tracking: 'Normal', size: 'Medium' },
    visibleIn: ['kodawaru', 'otegaru'],
    confidence: 'estimated',
  },

  FF2: {
    id: 'FF2', group: 'FF', label: '4:5・文字が上', ratioLabel: '4:5',
    canvas: { kind: 'fixed', aspect: [4, 5] },
    photo: { fit: 'contain', crop: 'none', inset: ins(108, 70, 70, 70), anchor: 'center', bleed: false },
    caption: {
      place: 'above-photo', gapLu: lu(26), sideInsetLu: lu(70), outerInsetLu: lu(62),
      lines: [
        { id: 'l1', fields: [F('title'), F('artist', 'artistEnabled')], separator: 'emdash', emphasis: 'normal', relSize: 1.05, leading: 1.40 },
        { id: 'l2', fields: [F('date'), F('camera'), F('lens'), F('exposure', 'exposureEnabled')], separator: 'comma', emphasis: 'muted', relSize: 0.88, leading: 1.40 },
      ],
    },
    typeScale: 1.00,
    defaults: { align: 'center', tracking: 'Wide', size: 'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'partly-observed',
    note: '観測: キャプションが写真の「上」。place:above-photo で表現。寸法は推定。',
  },

  FF3: {
    id: 'FF3', group: 'FF', label: '4:5・3行', ratioLabel: '4:5',
    canvas: { kind: 'fixed', aspect: [4, 5] },
    photo: { fit: 'contain', crop: 'none', inset: ins(64, 64, 170, 64), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(30), sideInsetLu: lu(64), outerInsetLu: lu(62),
      lines: [
        { id: 'l1', fields: LINE_TITLE_DATE, separator: 'comma', emphasis: 'normal', relSize: 1.05, leading: 1.45 },
        { id: 'l2', fields: LINE_CAMERA, separator: 'comma', emphasis: 'bold', relSize: 0.95, leading: 1.45 },
        { id: 'l3', fields: LINE_LENS_TECH, separator: 'comma', emphasis: 'muted', relSize: 0.88, leading: 1.45 },
      ],
    },
    typeScale: 1.05,
    defaults: { align: 'center', tracking: 'Normal', size: 'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
  },

  /* ── NST: 9:16 ────────────────────────────────────────── */
  NST1: {
    id: 'NST1', group: 'NST', label: '9:16・ストーリー', ratioLabel: '9:16',
    canvas: { kind: 'fixed', aspect: [9, 16] },
    photo: { fit: 'contain', crop: 'none', inset: ins(180, 56, 180, 56), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(44), sideInsetLu: lu(56), outerInsetLu: lu(120),
      lines: [
        { id: 'l1', fields: LINE_TITLE_DATE, separator: 'comma', emphasis: 'normal', relSize: 1.05, leading: 1.48 },
        { id: 'l2', fields: LINE_TECH_PLACE, separator: 'comma', emphasis: 'muted', relSize: 0.90, leading: 1.48 },
      ],
    },
    typeScale: 1.05,
    defaults: { align: 'center', tracking: 'Wide', size: 'Medium' },
    visibleIn: ['kodawaru', 'otegaru'],
    confidence: 'partly-observed',
    note: '観測: 9:16 に拡張して配置。上下に大きな余白。寸法は推定。',
  },

  /* ── STN: 16:9 ────────────────────────────────────────── */
  STN1: {
    id: 'STN1', group: 'STN', label: '16:9・1行', ratioLabel: '16:9',
    canvas: { kind: 'fixed', aspect: [16, 9] },
    photo: { fit: 'contain', crop: 'none', inset: ins(38, 38, 74, 38), anchor: 'center', bleed: false },
    caption: {
      place: 'below-photo', gapLu: lu(20), sideInsetLu: lu(38), outerInsetLu: lu(30),
      lines: [
        { id: 'l1', fields: LINE_ALL_IN_ONE, separator: 'comma', emphasis: 'normal', relSize: 1.0, leading: 1.30 },
      ],
    },
    typeScale: 0.88,
    defaults: { align: 'center', tracking: 'Normal', size: 'Small' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
  },

  STN2: {
    id: 'STN2', group: 'STN', label: '16:9・右に文字', ratioLabel: '16:9',
    canvas: { kind: 'fixed', aspect: [16, 9] },
    photo: { fit: 'contain', crop: 'none', inset: ins(38, 360, 38, 38), anchor: 'center', bleed: false },
    caption: {
      place: 'right-of-photo', gapLu: lu(30), sideInsetLu: lu(38), outerInsetLu: lu(38),
      bandLu: lu(300), bandAlign: 'center',
      lines: [
        { id: 'l1', fields: [F('title')], separator: 'none', emphasis: 'normal', relSize: 1.10, leading: 1.60, alignOverride: 'left', maxWrap: 2 },
        { id: 'l2', fields: LINE_CAMERA, separator: 'comma', emphasis: 'bold', relSize: 0.92, leading: 1.60, alignOverride: 'left', maxWrap: 2 },
        { id: 'l3', fields: [F('lens'), F('exposure', 'exposureEnabled'), F('date'), F('place', 'placeEnabled')], separator: 'comma', emphasis: 'muted', relSize: 0.84, leading: 1.45, alignOverride: 'left', maxWrap: 3 },
      ],
    },
    typeScale: 0.88,
    defaults: { align: 'left', tracking: 'Normal', size: 'Medium' },
    visibleIn: ['kodawaru'],
    confidence: 'partly-observed',
    note: '右帯300luに長いレンズ名が収まるかは tests/unit/styles/stn2-fits で固定している。',
  },

  STN3: {
    id: 'STN3', group: 'STN', label: '16:9・全面・重ね文字', ratioLabel: '16:9',
    canvas: { kind: 'fixed', aspect: [16, 9] },
    photo: { fit: 'cover', crop: 'toCanvas', inset: ins(0, 0, 0, 0), anchor: 'center', bleed: true },
    caption: {
      place: 'overlay-bottom', gapLu: lu(0), sideInsetLu: lu(34), outerInsetLu: lu(34),
      scrim: { heightLu: lu(230), alpha: 0.58 }, // SQ4 と同じ根拠（§4.6 のコントラスト）
      lines: [
        { id: 'l1', fields: LINE_ALL_IN_ONE, separator: 'middot', emphasis: 'normal', relSize: 1.0, leading: 1.30 },
      ],
    },
    typeScale: 0.88,
    defaults: { align: 'left', tracking: 'Wide', size: 'Small' },
    visibleIn: ['kodawaru'],
    confidence: 'estimated',
  },
};

export const STYLE_IDS: readonly StyleId[] = Object.keys(STYLES) as StyleId[];

/** 比率ごとの並び。スタイルタブの2段構成がこれをそのまま使う */
export const GROUPS: readonly { id: StyleGroup; label: string; styles: readonly StyleDef[] }[] = [
  { id: 'OR', label: '元比' },
  { id: 'SQ', label: '1:1' },
  { id: 'TF', label: '3:4' },
  { id: 'FF', label: '4:5' },
  { id: 'NST', label: '9:16' },
  { id: 'STN', label: '16:9' },
].map((g) => ({
  id: g.id as StyleGroup,
  label: g.label,
  styles: STYLE_IDS.map((id) => STYLES[id]).filter((s) => s.group === g.id),
}));

export const styleOf = (id: StyleId): StyleDef => STYLES[id];
