/**
 * StyleDef と写真の比から、キャンバス・写真・キャプション帯の矩形を決める。
 *
 * 純粋関数。分岐は `canvas.kind` と `caption.place` の2つだけに閉じている。
 * ここに解像度は出てこない（出てきたらそれは設計の誤り）。
 */
import { CANVAS_WIDTH_LU, lu, rect, size, type RectLu, type SizeLu } from '../units';
import type { CaptionPlace, StyleDef } from './types';

export interface SrcNorm {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ResolvedLayout {
  readonly canvas: SizeLu;
  readonly photo: RectLu;
  /** 元画像側の切り出し。**0..1 の正規化座標**なので原寸と縮小版で同一になる */
  readonly photoSrcNorm: SrcNorm;
  readonly captionBox: RectLu;
  readonly captionVAlign: 'start' | 'center' | 'end';
  /** 帯がキャプションに押し広げられたとき、元の値と広げた値 */
  readonly bandExpanded: { readonly fromLu: number; readonly toLu: number } | null;
}

const FULL: SrcNorm = { x: 0, y: 0, w: 1, h: 1 };

/** 比 src の画像から、比 target の領域を中央で切り出す正規化矩形 */
function centerCrop(src: number, target: number): SrcNorm {
  if (!Number.isFinite(src) || src <= 0 || !Number.isFinite(target) || target <= 0) return FULL;
  if (src > target) {
    const w = target / src;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = src / target;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

/** 比 aspect の矩形を box に収め、anchor で縦に寄せる */
function fitInto(box: RectLu, aspect: number, anchor: 'top' | 'center' | 'bottom'): RectLu {
  const byWidth = box.w / aspect;
  const w = byWidth <= box.h ? box.w : box.h * aspect;
  const h = byWidth <= box.h ? byWidth : box.h;
  const x = box.x + (box.w - w) / 2;
  const y =
    anchor === 'top' ? box.y : anchor === 'bottom' ? box.y + box.h - h : box.y + (box.h - h) / 2;
  return rect(x, y, w, h);
}

/**
 * キャプションを流し込める横幅。
 * **キャプションの高さを測る前に決まる**ので、
 * 「幅を知るために高さが要る」という循環が起きない。
 */
export function captionWidthLu(def: StyleDef): number {
  const c = def.caption;
  if (c.place === 'right-of-photo') return c.bandLu ?? 300;
  return CANVAS_WIDTH_LU - c.sideInsetLu * 2;
}

export function resolveLayout(
  def: StyleDef,
  /** ★Orientation 適用後の w/h（platform/decode.ts の契約） */
  photoAspect: number,
  captionHeightLu: number,
): ResolvedLayout {
  const W = CANVAS_WIDTH_LU as number;
  const c = def.caption;
  const p = def.photo;
  const inset = p.bleed ? { top: 0, right: 0, bottom: 0, left: 0 } : p.inset;
  const hasCaption = captionHeightLu > 0;
  const gap = hasCaption ? (c.gapLu as number) : 0;

  let bandExpanded: ResolvedLayout['bandExpanded'] = null;

  /* 1. キャンバスの高さ */
  let canvasH: number;
  if (def.canvas.kind === 'fixed') {
    const [aw, ah] = def.canvas.aspect;
    canvasH = (W * ah) / aw;
  } else {
    const pw = W - inset.left - inset.right;
    const ph = pw / (photoAspect > 0 ? photoAspect : 1);
    canvasH = inset.top + ph + gap + captionHeightLu + (c.outerInsetLu as number);
  }

  /* 2. 内容領域 */
  const content = rect(inset.left, inset.top, W - inset.left - inset.right, canvasH - inset.top - inset.bottom);

  /* 3. キャプション帯を差し引く */
  let photoBox = content;
  let captionBox: RectLu;
  let vAlign: ResolvedLayout['captionVAlign'] = 'start';
  const side = c.sideInsetLu as number;
  const outer = c.outerInsetLu as number;

  const place: CaptionPlace = c.place;
  switch (place) {
    case 'below-photo': {
      const top = canvasH - outer - captionHeightLu;
      captionBox = rect(side, top, W - side * 2, captionHeightLu);
      photoBox = rect(content.x, content.y, content.w, Math.max(0, top - gap - content.y));
      break;
    }
    case 'above-photo': {
      captionBox = rect(side, outer, W - side * 2, captionHeightLu);
      const photoTop = outer + captionHeightLu + gap;
      photoBox = rect(content.x, photoTop, content.w, Math.max(0, content.y + content.h - photoTop));
      break;
    }
    case 'bottom-band': {
      const declared = (c.bandLu ?? 0) as number;
      // キャプションが帯に入りきらないときは帯を広げる。切るより広げるほうが必ず良い
      const band = Math.max(declared, captionHeightLu + side);
      if (band > declared) bandExpanded = { fromLu: declared, toLu: band };
      const bandTop = canvasH - band;
      const rest = band - captionHeightLu;
      const align = c.bandAlign ?? 'center';
      const y =
        align === 'start' ? bandTop : align === 'end' ? bandTop + rest : bandTop + rest / 2;
      captionBox = rect(side, y, W - side * 2, captionHeightLu);
      photoBox = rect(content.x, content.y, content.w, Math.max(0, bandTop - content.y));
      break;
    }
    case 'right-of-photo': {
      const band = (c.bandLu ?? 300) as number;
      const x = W - outer - band;
      const avail = canvasH - inset.top - inset.bottom;
      const align = c.bandAlign ?? 'center';
      const rest = Math.max(0, avail - captionHeightLu);
      const y =
        align === 'start' ? inset.top : align === 'end' ? inset.top + rest : inset.top + rest / 2;
      captionBox = rect(x, y, band, captionHeightLu);
      vAlign = align;
      photoBox = rect(content.x, content.y, Math.max(0, x - gap - content.x), content.h);
      break;
    }
    case 'overlay-bottom': {
      // 差し引かない。写真の上に重なる
      captionBox = rect(side, canvasH - outer - captionHeightLu, W - side * 2, captionHeightLu);
      photoBox = rect(0, 0, W, canvasH);
      break;
    }
  }

  /* 4. 写真を収める */
  let srcNorm: SrcNorm = FULL;
  let effAspect = photoAspect > 0 ? photoAspect : 1;
  if (p.crop === 'square') {
    srcNorm = centerCrop(effAspect, 1);
    effAspect = 1;
  } else if (p.crop === 'toCanvas') {
    const target = photoBox.h > 0 ? photoBox.w / photoBox.h : 1;
    srcNorm = centerCrop(effAspect, target);
    effAspect = target;
  }
  const photo = p.bleed ? rect(0, 0, W, canvasH) : fitInto(photoBox, effAspect, p.anchor);

  return {
    canvas: size(W, canvasH),
    photo,
    photoSrcNorm: srcNorm,
    captionBox,
    captionVAlign: vAlign,
    bandExpanded,
  };
}

/** §14.2 の不変条件。テストとデバッグビルドから呼ぶ */
export function layoutViolations(l: ResolvedLayout, place: CaptionPlace): string[] {
  const bad: string[] = [];
  const eps = 0.01;
  const { photo, canvas, captionBox } = l;
  if (photo.x < -eps || photo.y < -eps) bad.push('写真がキャンバスの外に出ている');
  if (photo.x + photo.w > canvas.w + eps || photo.y + photo.h > canvas.h + eps) {
    bad.push('写真がキャンバスをはみ出している');
  }
  if (captionBox.h > 0 && place !== 'overlay-bottom') {
    const overlapX = photo.x < captionBox.x + captionBox.w - eps && captionBox.x < photo.x + photo.w - eps;
    const overlapY = photo.y < captionBox.y + captionBox.h - eps && captionBox.y < photo.y + photo.h - eps;
    if (overlapX && overlapY) bad.push('写真とキャプションが重なっている');
  }
  if (canvas.h <= 0) bad.push('キャンバスの高さが0以下');
  return bad;
}

export const luOf = (n: number): number => lu(n);
