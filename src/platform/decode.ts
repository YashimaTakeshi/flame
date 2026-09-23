/**
 * 画像のデコード。**createImageBitmap を呼ぶのはこのファイルだけ**（eslint.config.js で強制）。
 *
 * なぜ1箇所に集めるか。
 *
 * 実測では Chromium が EXIF の Orientation を自動適用する（docs/poc/report-exif.md §4）。
 * しかし **プレビュー用の縮小デコードと原寸デコードが別経路になると、Orientation の
 * 適用が食い違い、プレビューと書き出しでトリミング位置がずれる**。
 * これは「プレビュー＝書き出し」という原則の破れで、しかも縦位置の写真でしか出ないため
 * 気づきにくい。
 *
 * 契約はひとつ:
 *   すべてのデコードはここを通し、常に imageOrientation: 'from-image' を渡し、
 *   **Orientation 適用後の寸法**を返す。アプリはこの寸法しか見ない。
 */

export interface DecodedPhoto {
  readonly bitmap: ImageBitmap;
  /** この bitmap の寸法（Orientation 適用後） */
  readonly size: { readonly w: number; readonly h: number };
  /** 元画像の寸法（Orientation 適用後）。縮小デコードでも必ず返す */
  readonly natural: { readonly w: number; readonly h: number };
  readonly orientationApplied: true;
}

export class DecodeError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'DecodeError';
  }
}

/**
 * 回転の指定を必ず明示する。
 *
 * 現行の Chromium は既定でも from-image として扱うが、これは比較的最近の仕様変更で、
 * 他のブラウザや将来の版で既定が変わりうる。明示しておけば挙動が固定される。
 */
const OPTS = {
  imageOrientation: 'from-image',
  colorSpaceConversion: 'default',
} as const satisfies ImageBitmapOptions;

export async function decode(
  blob: Blob,
  opt?: { readonly resizeWidth?: number },
): Promise<DecodedPhoto> {
  // 1) 原寸（Orientation 適用後）を先に確定させる。★縮小デコードより前に★
  //    ここを後回しにすると、縮小版から原寸を逆算することになり、必ずずれる。
  let probe: ImageBitmap;
  try {
    probe = await createImageBitmap(blob, OPTS);
  } catch (e) {
    throw new DecodeError('この画像を開けませんでした', e);
  }
  const natural = { w: probe.width, h: probe.height };

  const want = opt?.resizeWidth;
  if (!want || want >= natural.w) {
    return { bitmap: probe, size: natural, natural, orientationApplied: true };
  }

  // 2) 縮小デコードにも同じ指定を渡す。ここで指定が抜けると経路が食い違う
  probe.close();
  const resizeHeight = Math.max(1, Math.round((want * natural.h) / natural.w));
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(blob, {
      ...OPTS,
      resizeWidth: Math.max(1, Math.round(want)),
      resizeHeight,
      resizeQuality: 'high',
    });
  } catch (e) {
    throw new DecodeError('この画像を縮小できませんでした', e);
  }
  return {
    bitmap: bmp,
    size: { w: bmp.width, h: bmp.height },
    natural,
    orientationApplied: true,
  };
}

/**
 * 描かれたもの（動画の1コマを描いたキャンバスなど）から、写真と同じ形の DecodedPhoto を作る。
 * 動画の1コマは向き（回転）を描く側で反映済みなので、ここでは縮めるだけ。
 * createImageBitmap はこのファイルでしか呼ばない約束なので、ここに置く。
 */
export async function decodeSource(
  source: ImageBitmapSource,
  natural: { readonly w: number; readonly h: number },
  opt?: { readonly resizeWidth?: number },
): Promise<DecodedPhoto> {
  const want = opt?.resizeWidth;
  const w = want && want < natural.w ? Math.max(1, Math.round(want)) : natural.w;
  const h = Math.max(1, Math.round((w * natural.h) / natural.w));
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(source, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
  } catch (e) {
    throw new DecodeError('動画のコマを取り出せませんでした', e);
  }
  return { bitmap: bmp, size: { w: bmp.width, h: bmp.height }, natural, orientationApplied: true };
}

/** 使い終わったら必ず閉じる。画像1枚で約100MB を占め、その消費は performance.memory に現れない */
export function closeDecoded(d: DecodedPhoto): void {
  d.bitmap.close();
}
