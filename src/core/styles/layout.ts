/**
 * StyleDef と写真の比から、キャンバス・写真・キャプション帯の矩形を決める。
 *
 * 純粋関数。分岐は `canvas.kind` と `caption.place` と `photo.place` だけに閉じている。
 * ここに解像度は出てこない（出てきたらそれは設計の誤り）。
 */
import { CANVAS_WIDTH_LU, rect, size, type RectLu, type SizeLu } from '../units';
import { MARGIN_SCALE } from './spec';
import { CENTER_FOCUS, type CaptionAlign, type CaptionPlace, type Focus, type PhotoPlace, type StyleDef } from './types';

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
}

export { MARGIN_SCALE };
export type { MarginId } from './types';

const FULL: SrcNorm = { x: 0, y: 0, w: 1, h: 1 };

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * 比 src の画像から、比 target の領域を切り出す正規化矩形。
 * 余る軸だけが動き、focus（0..1）がその軸のどこを見せるかを決める。
 * 0 で左端／上端、0.5 で中央、1 で右端／下端。余らない軸の focus は効かない。
 */
export function focusCrop(src: number, target: number, focus: Focus): SrcNorm {
  if (!Number.isFinite(src) || src <= 0 || !Number.isFinite(target) || target <= 0) return FULL;
  if (src > target) {
    const w = target / src;
    return { x: (1 - w) * clamp01(focus.x), y: 0, w, h: 1 };
  }
  const h = src / target;
  return { x: 0, y: (1 - h) * clamp01(focus.y), w: 1, h };
}

/** 帯の中で、文字を上・中・下のどこに置くか */
function alignIn(bandTop: number, bandH: number, h: number, a: CaptionAlign): number {
  const slack = Math.max(0, bandH - h);
  return a === 'start' ? bandTop : a === 'end' ? bandTop + slack : bandTop + slack / 2;
}

/** 比 aspect の矩形を box に収め、place の向きに寄せる */
function fitInto(box: RectLu, aspect: number, place: PhotoPlace): RectLu {
  const byWidth = box.w / aspect;
  const w = byWidth <= box.h ? box.w : box.h * aspect;
  const h = byWidth <= box.h ? byWidth : box.h;
  const x =
    place === 'left' ? box.x : place === 'right' ? box.x + box.w - w : box.x + (box.w - w) / 2;
  const y =
    place === 'top' ? box.y : place === 'bottom' ? box.y + box.h - h : box.y + (box.h - h) / 2;
  return rect(x, y, w, h);
}

/**
 * キャプションを流し込める横幅。
 * **キャプションの高さを測る前に決まる**ので、
 * 「幅を知るために高さが要る」という循環が起きない。
 */
export function captionWidthLu(def: StyleDef): number {
  const c = def.caption;
  /*
   * ★左右の段は余白ではなく本文の幅。縮めない。★
   * 下の余白は縮めてよいが、段は本文が流れる幅である。縮めると字が入らなくなり、
   * はしごを降りて項目が落ちる（実測: 余白「狭い」で 300→135lu になり、
   * レンズ名と撮影地が消えた）。余白の好みで情報が減るのは筋が違う。
   */
  if (c.place === 'left' || c.place === 'right') return c.bandLu;
  return CANVAS_WIDTH_LU - c.sideInsetLu * 2;
}

export function resolveLayout(
  def: StyleDef,
  /** ★Orientation 適用後の w/h（platform/decode.ts の契約） */
  photoAspect: number,
  captionHeightLu: number,
  /** 全面のときの切り取りの中心。余白があるときは使わない */
  focus: Focus = CENTER_FOCUS,
): ResolvedLayout {
  const W = CANVAS_WIDTH_LU as number;
  const c = def.caption;
  const p = def.photo;
  // 余白の倍率は styleFor() が寸法に織り込み済み。ここでは掛けない
  const bleed = def.spec.margin === 'none';
  const aspect = photoAspect > 0 && Number.isFinite(photoAspect) ? photoAspect : 1;
  const inset = p.inset;
  const hasCaption = captionHeightLu > 0;
  const gap = hasCaption ? (c.gapLu as number) : 0;
  const side = c.sideInsetLu as number;
  const outer = c.outerInsetLu as number;
  const band = c.bandLu as number;
  const place: CaptionPlace = c.place;
  const sideways = (place === 'left' || place === 'right') && hasCaption;
  const align = def.spec.captionAlign;

  /* 1. キャンバスの高さ */
  let canvasH: number;
  if (def.canvas.kind === 'fixed') {
    const [aw, ah] = def.canvas.aspect;
    canvasH = (W * ah) / aw;
  } else if (bleed) {
    canvasH = W / aspect;
  } else if (sideways) {
    // 段のぶんだけ写真の幅が減る。高さは写真に従う
    const pw = W - inset.left - inset.right - band - gap;
    canvasH = inset.top + pw / aspect + inset.bottom;
  } else {
    const pw = W - inset.left - inset.right;
    canvasH = inset.top + pw / aspect + (hasCaption ? gap + captionHeightLu + outer : inset.bottom);
  }

  /* 2. 内容領域 */
  const content = rect(inset.left, inset.top, W - inset.left - inset.right, canvasH - inset.top - inset.bottom);

  /* 3. 文字の帯ぶんを差し引いて、写真の箱を決める */
  let photoBox = content;
  switch (place) {
    case 'below':
      photoBox = hasCaption
        ? rect(content.x, content.y, content.w, Math.max(0, canvasH - outer - captionHeightLu - gap - content.y))
        : content;
      break;
    case 'above': {
      const photoTop = hasCaption ? outer + captionHeightLu + gap : content.y;
      photoBox = rect(content.x, photoTop, content.w, Math.max(0, content.y + content.h - photoTop));
      break;
    }
    case 'left':
      photoBox = hasCaption
        ? rect(outer + band + gap, content.y, Math.max(0, content.x + content.w - (outer + band + gap)), content.h)
        : content;
      break;
    case 'right':
      photoBox = hasCaption
        ? rect(content.x, content.y, Math.max(0, W - outer - band - gap - content.x), content.h)
        : content;
      break;
    case 'overlay':
      photoBox = rect(0, 0, W, canvasH); // 差し引かない。写真の上に重なる
      break;
  }

  /* 4. 写真を収める */
  let srcNorm: SrcNorm = FULL;
  let photo: RectLu;
  if (bleed) {
    // 全面では切り取りの中心を指で決める（focus）。写真の位置は使わない
    const target = photoBox.h > 0 ? photoBox.w / photoBox.h : 1;
    srcNorm = focusCrop(aspect, target, focus);
    photo = rect(0, 0, W, canvasH);
  } else {
    photo = fitInto(photoBox, aspect, p.place);
  }

  /*
   * 5. 文字を、写真が決まったあとに残る帯の中で寄せる。
   * 写真を上に寄せると下に帯が余る。以前は文字を必ずキャンバスの端に置いていたので、
   * 帯の真ん中に置けなかった（実機で指摘された）。帯は「写真の端＋隙間」から
   * 「キャンバスの端−余白」まで。寄せはこの中で効く。
   */
  let captionBox: RectLu;
  switch (place) {
    case 'below': {
      const top = photo.y + photo.h + gap;
      const bottom = canvasH - outer;
      captionBox = rect(side, alignIn(top, bottom - top, captionHeightLu, align), W - side * 2, captionHeightLu);
      break;
    }
    case 'above': {
      const top = outer;
      const bottom = photo.y - gap;
      captionBox = rect(side, alignIn(top, bottom - top, captionHeightLu, align), W - side * 2, captionHeightLu);
      break;
    }
    case 'left':
    case 'right': {
      const x = place === 'right' ? W - outer - band : outer;
      captionBox = rect(x, alignIn(content.y, content.h, captionHeightLu, align), hasCaption ? band : 0, captionHeightLu);
      break;
    }
    case 'overlay':
      captionBox = rect(side, canvasH - outer - captionHeightLu, W - side * 2, captionHeightLu);
      break;
  }

  return { canvas: size(W, canvasH), photo, photoSrcNorm: srcNorm, captionBox };
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
  if (captionBox.h > 0 && place !== 'overlay') {
    const overlapX = photo.x < captionBox.x + captionBox.w - eps && captionBox.x < photo.x + photo.w - eps;
    const overlapY = photo.y < captionBox.y + captionBox.h - eps && captionBox.y < photo.y + photo.h - eps;
    if (overlapX && overlapY) bad.push('写真とキャプションが重なっている');
    if (captionBox.x < -eps || captionBox.x + captionBox.w > canvas.w + eps) bad.push('キャプションが横にはみ出している');
    if (captionBox.y < -eps || captionBox.y + captionBox.h > canvas.h + eps) bad.push('キャプションが縦にはみ出している');
  }
  if (canvas.h <= 0) bad.push('キャンバスの高さが0以下');
  return bad;
}
