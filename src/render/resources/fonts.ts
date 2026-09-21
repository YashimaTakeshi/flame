/**
 * 書体の台帳。
 *
 * 実測で分かっていること（docs/poc/report-fonts.md §4）:
 *
 *   読み込みを待たずに fillText すると、**警告も例外も出ないまま**フォールバック書体で
 *   描かれる。measureText().width がフォールバック基準値と 1 の位まで完全一致した。
 *   しかも `document.fonts.check()` は描画後には true を返すので、事後検知に使えない。
 *
 * だから判定に `document.fonts.check()` は一切使わない（lint で禁止）。
 * 「**自分が await face.load() を resolve させて台帳に入れたか**」という自分の記録だけで判定する。
 *
 * 取得元を呼び出し側から受け取るのは、依存の向きを守るため。
 * render は platform を知らないので、通信の記録が要る取り寄せ（和文の同梱外文字）は
 * app 側が net.ts を通してバイト列にしてから渡す。
 */

/** 書体の指定。core の FontRef と同じ形（core を import しないために再掲） */
export interface FontRef {
  readonly family: string;
  readonly weight: 400 | 700;
}

/** 書体の取得元。同梱書体は URL、取り寄せたものはバイト列で渡す */
export type FontSource =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'bytes'; readonly bytes: ArrayBuffer };

export class FontLoadError extends Error {
  readonly key: string;
  constructor(key: string, cause?: unknown) {
    super(`書体を読み込めませんでした: ${key}`);
    this.name = 'FontLoadError';
    this.key = key;
    this.cause = cause;
  }
}

export class FontNotReadyError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`書体がまだ読み込まれていません: ${key}（読み込みを待たずに描こうとしました）`);
    this.name = 'FontNotReadyError';
    this.key = key;
  }
}

export const fontKey = (ref: FontRef): string => `${ref.family}/${ref.weight}`;

interface Entry {
  readonly face: FontFace;
  readonly ref: FontRef;
}

const ledger = new Map<string, Entry>();
const inFlight = new Map<string, Promise<Entry>>();

/** 書体が使える場所（Worker では self.fonts、メインスレッドでは document.fonts） */
function fontSet(): FontFaceSet | null {
  const g = globalThis as unknown as { fonts?: FontFaceSet; document?: { fonts?: FontFaceSet } };
  return g.fonts ?? g.document?.fonts ?? null;
}

/**
 * 書体を読み込んで台帳に載せる。
 * 同じ書体を同時に要求されても、読み込みは1回にまとめる。
 */
export async function ensureFont(ref: FontRef, source: FontSource): Promise<void> {
  const key = fontKey(ref);
  if (ledger.has(key)) return;

  const running = inFlight.get(key);
  if (running) {
    await running;
    return;
  }

  const job = (async (): Promise<Entry> => {
    const descriptor = source.kind === 'url' ? `url(${source.url}) format('woff2')` : source.bytes;
    const face = new FontFace(ref.family, descriptor as string, { weight: String(ref.weight) });
    try {
      await face.load();
    } catch (e) {
      throw new FontLoadError(key, e);
    }
    // load() が resolve しても status を見る。ここが唯一の真実
    if (face.status !== 'loaded') throw new FontLoadError(key);
    fontSet()?.add(face);
    const entry: Entry = { face, ref };
    ledger.set(key, entry);
    return entry;
  })();

  inFlight.set(key, job);
  try {
    await job;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * 描いてよい書体かどうか。**台帳に無ければ描かせない。**
 * ここで false を返すものを描くと、フォールバック書体で保存される。
 */
export const isReady = (ref: FontRef): boolean => ledger.has(fontKey(ref));

/** 描画の直前に使う。台帳に無ければ例外を投げて、フォールバックでの描画を止める */
export function assertReady(ref: FontRef): void {
  if (!ledger.has(fontKey(ref))) throw new FontNotReadyError(fontKey(ref));
}

export const loadedFonts = (): FontRef[] => [...ledger.values()].map((e) => e.ref);

/**
 * 別人確認。読み込んだつもりの書体が、実はフォールバックで描かれていないか。
 *
 * 台帳があれば普通は起きないが、書体ファイルが壊れていた・同名の別書体が
 * 先に登録されていた、といった場合に効く。
 *
 * **確実な判定だけを採る。** ビルド時に測った幅との ±2% 照合は入れない。
 * OS によって 2% 程度はぶれるので、曖昧な判定で書き出しを止めてはならない。
 * ここで見るのは「フォールバックと完全一致するか」だけ（実測で一致したのはこの形）。
 */
const PROBE = 'HAMBURGEFONTSIV 0123';

export function verifyFontIdentity(
  measure: (font: string, text: string) => number,
  ref: FontRef,
): 'ok' | 'fallback-suspected' {
  const mine = measure(`${ref.weight} 100px "${ref.family}"`, PROBE);
  const fallback = measure(`${ref.weight} 100px sans-serif`, PROBE);
  return Math.abs(mine - fallback) < 0.01 ? 'fallback-suspected' : 'ok';
}

/** テスト用 */
export function __resetForTest(): void {
  ledger.clear();
  inFlight.clear();
}
