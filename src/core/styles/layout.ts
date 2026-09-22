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

/** 帯を置ける4辺。重ねには帯が無い */
export type BandSide = 'above' | 'below' | 'left' | 'right';

/**
 * キャプションとは別の辺に取る帯（刻印を置く）。
 * above / below では高さ、left / right では幅を lu で渡す。
 */
export interface ExtraBand {
  readonly place: BandSide;
  readonly sizeLu: number;
}

export interface ResolvedLayout {
  readonly canvas: SizeLu;
  readonly photo: RectLu;
  /** 元画像側の切り出し。**0..1 の正規化座標**なので原寸と縮小版で同一になる */
  readonly photoSrcNorm: SrcNorm;
  readonly captionBox: RectLu;
  /**
   * キャプションの帯そのもの。写真の端＋隙間からキャンバスの端−余白まで。
   * captionBox はこの中で寄せた箱。帯の余りに別の塊（刻印）を置くときはこちらを見る。
   * 重ねでは captionBox と同じ。
   */
  readonly band: RectLu;
  /** 別の辺に取った帯。頼まなければ null */
  readonly extraBand: RectLu | null;
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
  /** キャプションと別の辺に取る帯。同じ辺を頼まれたら無視する（呼ぶ側が1つの帯に畳む） */
  extra: ExtraBand | null = null,
): ResolvedLayout {
  const W = CANVAS_WIDTH_LU as number;
  const c = def.caption;
  const p = def.photo;
  // 余白の倍率は styleFor() が寸法に織り込み済み。ここでは掛けない
  const bleed = def.spec.margin === 'none';
  const aspect = photoAspect > 0 && Number.isFinite(photoAspect) ? photoAspect : 1;
  const inset = p.inset;
  const hasCaption = captionHeightLu > 0;
  const gap = c.gapLu as number;
  const side = c.sideInsetLu as number;
  const outer = c.outerInsetLu as number;
  const band = c.bandLu as number;
  const place: CaptionPlace = c.place;
  const align = def.spec.captionAlign;
  const overlay = place === 'overlay';
  const x2 = extra && !overlay && extra.place !== place && extra.sizeLu > 0 ? extra : null;

  /*
   * 1. 4辺それぞれに帯があるかと、その厚み。
   * キャプションの帯は place の辺、刻印の帯は extra の辺。帯が無い辺は写真の余白だけ。
   * 帯がある辺は「余白 outer ＋ 帯 ＋ 隙間 gap」ぶん写真から遠ざかる。
   */
  const thick = (s: BandSide): number => {
    if (!overlay && hasCaption && place === s) return (s === 'left' || s === 'right' ? band : captionHeightLu) + outer + gap;
    if (x2 && x2.place === s) return x2.sizeLu + outer + gap;
    return -1;
  };
  const t = { above: thick('above'), below: thick('below'), left: thick('left'), right: thick('right') };
  const top = t.above >= 0 ? t.above : (inset.top as number);
  const bottom = t.below >= 0 ? t.below : (inset.bottom as number);
  const left = t.left >= 0 ? t.left : (inset.left as number);
  const right = t.right >= 0 ? t.right : (inset.right as number);

  /* 2. キャンバスの高さ */
  let canvasH: number;
  if (def.canvas.kind === 'fixed') {
    const [aw, ah] = def.canvas.aspect;
    canvasH = (W * ah) / aw;
  } else if (bleed) {
    canvasH = W / aspect;
  } else {
    // 帯のぶんだけ写真の幅が減る。高さは写真に従う
    const pw = W - left - right;
    canvasH = top + pw / aspect + bottom;
  }

  /* 3. 帯ぶんを差し引いて、写真の箱を決める */
  const photoBox = overlay
    ? rect(0, 0, W, canvasH) // 差し引かない。写真の上に重なる
    : rect(left, top, Math.max(0, W - left - right), Math.max(0, canvasH - top - bottom));

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
   * 5. 帯。写真が決まったあとに残る領域。
   * 上下の帯は「写真の端＋隙間」から「キャンバスの端−余白」まで、横は side の内側。
   * 左右の帯は写真の箱と同じ高さ。刻印の帯も同じ規則で取る。
   */
  /*
   * 左右の帯の縦の範囲。上下にも帯があるときは**写真そのもの**の高さに限る。
   * 写真が箱いっぱいでないとき、上下の帯は写真の端から始まるので、
   * 左右の帯を箱の高さで取ると、写真の下で上下の帯と重なる（実測: 16:9・写真上・文字下に
   * 左の刻印を置くと3行目と重なった）。上下に帯が無ければ従来どおり箱の高さ。
   */
  const vertical = t.above >= 0 || t.below >= 0;
  const colY = vertical ? photo.y : photoBox.y;
  const colH = vertical ? photo.h : photoBox.h;
  const bandRect = (s: BandSide, w: number): RectLu => {
    switch (s) {
      case 'below': {
        const y = photo.y + photo.h + gap;
        return rect(side, y, W - side * 2, Math.max(0, canvasH - outer - y));
      }
      case 'above':
        return rect(side, outer, W - side * 2, Math.max(0, photo.y - gap - outer));
      case 'left':
        return rect(outer, colY, w, colH);
      case 'right':
        return rect(W - outer - w, colY, w, colH);
    }
  };

  /*
   * 6. 文字を、帯の中で寄せる。
   * 写真を上に寄せると下に帯が余る。以前は文字を必ずキャンバスの端に置いていたので、
   * 帯の真ん中に置けなかった（実機で指摘された）。寄せは帯の中で効く。
   */
  let captionBand: RectLu;
  let captionBox: RectLu;
  if (overlay) {
    captionBox = rect(side, canvasH - outer - captionHeightLu, W - side * 2, captionHeightLu);
    captionBand = captionBox;
  } else {
    captionBand = bandRect(place, hasCaption ? band : 0);
    captionBox = rect(captionBand.x, alignIn(captionBand.y, captionBand.h, captionHeightLu, align), captionBand.w, captionHeightLu);
  }
  const extraBand = x2 ? bandRect(x2.place, x2.sizeLu) : null;

  return { canvas: size(W, canvasH), photo, photoSrcNorm: srcNorm, captionBox, band: captionBand, extraBand };
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
