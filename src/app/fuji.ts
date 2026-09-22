/**
 * FUJIFILM の MakerNote からフィルムシミュレーションを読む。
 *
 * exifr は MakerNote を素のバイト列でしか返さない（各社独自形式のため）。
 * FUJIFILM の形式は単純で、先頭 8 バイトが "FUJIFILM"、続く 4 バイトが IFD への
 * オフセット（リトルエンディアン、MakerNote 先頭からの相対）。IFD は TIFF と同じ形。
 *
 * 見るタグは2つだけ:
 *   0x1401 FilmMode   … カラーのフィルムシミュレーション（PROVIA / Velvia / CLASSIC CHROME …）
 *   0x1003 Saturation … モノクロ系はこちらに入る（ACROS / モノクロ / セピア）
 * 値の対応は ExifTool の FujiFilm タグ表に従う。知らない値は null（推測で名前を出さない）。
 */

const FILM_MODE: Readonly<Record<number, string>> = {
  0x000: 'PROVIA',
  0x100: 'PROVIA',
  0x110: 'PROVIA', // F1 / Studio Portrait
  0x120: 'PROVIA',
  0x130: 'ASTIA', // F1b / Studio Portrait Smooth Skin Tone
  0x200: 'Velvia', // F2 / Fujichrome
  0x300: 'PROVIA',
  0x400: 'PROVIA',
  0x500: 'Velvia',
  0x501: 'PRO Neg. Std',
  0x502: 'PRO Neg. Hi',
  0x503: 'CLASSIC CHROME',
  0x600: 'ETERNA',
  0x700: 'ETERNA BLEACH BYPASS',
  0x800: 'CLASSIC Neg.',
  0x900: 'BLEACH BYPASS',
  0xa00: 'NOSTALGIC Neg.',
  0xb00: 'REALA ACE',
};

const MONO: Readonly<Record<number, string>> = {
  0x300: 'MONOCHROME',
  0x301: 'MONOCHROME +R',
  0x302: 'MONOCHROME +Ye',
  0x303: 'MONOCHROME +G',
  0x310: 'SEPIA',
  0x500: 'ACROS',
  0x501: 'ACROS +R',
  0x502: 'ACROS +Ye',
  0x503: 'ACROS +G',
};

/** 手入力の候補。FUJIFILM 以外のカメラでも、よく使う名前は選べるようにしておく */
export const FILM_SUGGESTIONS: readonly string[] = [
  'PROVIA',
  'Velvia',
  'ASTIA',
  'CLASSIC CHROME',
  'REALA ACE',
  'PRO Neg. Hi',
  'PRO Neg. Std',
  'CLASSIC Neg.',
  'NOSTALGIC Neg.',
  'ETERNA',
  'ETERNA BLEACH BYPASS',
  'ACROS',
  'MONOCHROME',
  'SEPIA',
];

const MAGIC = 'FUJIFILM';

export function parseFujiFilm(note: Uint8Array | ArrayBuffer | null | undefined): string | null {
  if (!note) return null;
  const b = note instanceof Uint8Array ? note : new Uint8Array(note);
  if (b.length < 14) return null;
  for (let i = 0; i < MAGIC.length; i++) if (b[i] !== MAGIC.charCodeAt(i)) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ifd = dv.getUint32(8, true);
  if (ifd + 2 > b.length) return null;
  const count = dv.getUint16(ifd, true);
  let film: string | null = null;
  let mono: string | null = null;
  for (let i = 0; i < count; i++) {
    const at = ifd + 2 + i * 12;
    if (at + 12 > b.length) break;
    const tag = dv.getUint16(at, true);
    const type = dv.getUint16(at + 2, true);
    if (type !== 3) continue; // SHORT だけ見る
    const value = dv.getUint16(at + 8, true);
    if (tag === 0x1401) film = FILM_MODE[value] ?? null;
    if (tag === 0x1003) mono = MONO[value] ?? null;
  }
  // モノクロ系が入っていればそちらが実体。FilmMode は既定値のまま残ることがある
  return mono ?? film;
}

/**
 * テストと検証用: 最小の FUJIFILM MakerNote を組み立てる。
 * 実機の写真を同梱できない（撮影者の個人情報を含む）ので、形式どおりに作って読めることを確かめる。
 */
export function buildFujiNote(entries: readonly { tag: number; value: number }[]): Uint8Array {
  const ifd = 12;
  const size = ifd + 2 + entries.length * 12 + 4;
  const b = new Uint8Array(size);
  const dv = new DataView(b.buffer);
  for (let i = 0; i < MAGIC.length; i++) b[i] = MAGIC.charCodeAt(i);
  dv.setUint32(8, ifd, true);
  dv.setUint16(ifd, entries.length, true);
  entries.forEach((e, i) => {
    const at = ifd + 2 + i * 12;
    dv.setUint16(at, e.tag, true);
    dv.setUint16(at + 2, 3, true);
    dv.setUint32(at + 4, 1, true);
    dv.setUint16(at + 8, e.value, true);
  });
  return b;
}
