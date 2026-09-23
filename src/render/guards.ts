/**
 * キャンバスの確保。**canvas を作るのはこのファイルだけ**（eslint.config.js で強制）。
 *
 * ここを1箇所に集めているのは、実測で分かった次の挙動のため。
 *
 *   面積上限（Chromium で 2^28 = 268,435,456px）を 1px でも超えると、
 *   width の代入も getContext も fillRect も **例外を投げない**。
 *   すべて成功したように振る舞い、getImageData だけが [0,0,0,0] を返す。
 *
 * つまり素直に書くと「真っ黒な画像が保存されて誰も気づかない」。
 * 確保のたびに書いて読み返し、本当に描けるキャンバスかを確かめる。
 *
 * 根拠: docs/poc/report-canvas.md
 */

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export type CanvasFailure = 'area' | 'side' | 'context' | 'verify';

export type CanvasResult =
  | { readonly ok: true; readonly canvas: AnyCanvas; readonly ctx: Ctx }
  | { readonly ok: false; readonly reason: CanvasFailure; readonly w: number; readonly h: number };

export interface CanvasLimits {
  readonly area: number;
  readonly side: number;
}

/** Chromium / Linux で実測した値（docs/poc/report-canvas.md）。端末の実測値があればそちらを使う */
export const DEFAULT_LIMITS: CanvasLimits = { area: 268_435_456, side: 65_535 };

let limits: CanvasLimits = DEFAULT_LIMITS;

/**
 * 端末で実測した上限を入れる。自己診断の［いま測る］が保存した値を起動時に流し込む。
 * iOS Safari は Chromium より小さい可能性が高い（未実測・report-canvas.md の宿題）。
 */
export function setMeasuredLimits(next: CanvasLimits | null): void {
  limits = next ?? DEFAULT_LIMITS;
}

export function currentLimits(): CanvasLimits {
  return limits;
}

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * 本当に描けるキャンバスを確保する。駄目なら理由を返す（例外は投げない）。
 *
 * 呼び出し側が理由を見て段階的に解像度を下げられるよう、Result を返す形にしてある。
 * 例外にすると try/catch が散り、「とりあえず握りつぶす」経路ができてしまう。
 */
export function createVerifiedCanvas(w: number, h: number): CanvasResult {
  const cw = Math.floor(w);
  const ch = Math.floor(h);

  if (cw <= 0 || ch <= 0) return { ok: false, reason: 'area', w: cw, h: ch };
  // 既知の上限と先に照らす。確保してから失敗するより安い
  if (cw > limits.side || ch > limits.side) return { ok: false, reason: 'side', w: cw, h: ch };
  if (cw * ch > limits.area) return { ok: false, reason: 'area', w: cw, h: ch };

  const canvas = makeCanvas(cw, ch);
  const ctx = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb' }) as Ctx | null;
  if (!ctx) return { ok: false, reason: 'context', w: cw, h: ch };

  // 書いて読み返す。★左上だけでは足りない。右下も見る★
  // 部分的にしか確保されていない病的な場合を拾うため
  if (!probePixel(ctx, 0, 0) || !probePixel(ctx, cw - 1, ch - 1)) {
    release(canvas);
    return { ok: false, reason: 'verify', w: cw, h: ch };
  }

  ctx.clearRect(0, 0, cw, ch);
  return { ok: true, canvas, ctx };
}

function probePixel(ctx: Ctx, x: number, y: number): boolean {
  try {
    ctx.fillStyle = 'rgb(1,2,3)';
    ctx.fillRect(x, y, 1, 1);
    const d = ctx.getImageData(x, y, 1, 1).data;
    return d[0] === 1 && d[1] === 2 && d[2] === 3 && d[3] === 255;
  } catch {
    // getImageData が投げる環境（汚染など）。確保できたとは言えない
    return false;
  }
}

/**
 * キャンバスの中身を画像のファイルにする。OffscreenCanvas と <canvas> の違いをここで吸収する。
 * 中身は呼んだ時点のものが写る（あとで描き変えても変わらない）。作れなければ null。
 */
export function encodeCanvas(c: AnyCanvas, type: string, quality?: number): Promise<Blob | null> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, ...(quality !== undefined ? { quality } : {}) }).catch(() => null);
  return new Promise((ok) => {
    try {
      c.toBlob(ok, type, quality);
    } catch {
      ok(null);
    }
  });
}

/**
 * 使い終わったキャンバスを手放す。
 * 0x0 にしてから捨てることで、GC を待たずにピクセルの領域が解放される。
 * 画像1枚で約100MB を消費し、その消費は performance.memory に現れない
 * （docs/poc/report-geo-batch.md）ので、放っておくと実機で落ちる。
 */
export function release(c: AnyCanvas): void {
  c.width = 0;
  c.height = 0;
}

/**
 * 既存のキャンバスを目的のサイズに合わせる。
 *
 * 検証は確保のたびに1回だけ。getImageData は GPU から CPU への読み戻しを強制するので、
 * 毎フレーム走らせてはならない。プレビューはこの関数で使い回し、
 * サイズが変わったときだけ確保し直して検証する。
 */
export function resizeIfNeeded(
  current: { canvas: AnyCanvas; ctx: Ctx } | null,
  w: number,
  h: number,
): CanvasResult {
  const cw = Math.floor(w);
  const ch = Math.floor(h);
  if (current && current.canvas.width === cw && current.canvas.height === ch) {
    return { ok: true, canvas: current.canvas, ctx: current.ctx };
  }
  if (current) release(current.canvas);
  return createVerifiedCanvas(cw, ch);
}
