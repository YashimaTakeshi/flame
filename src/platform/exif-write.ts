/**
 * 書き出した JPEG に撮影情報（EXIF）を書き戻す。
 *
 * canvas から出た JPEG には EXIF が無い。そのまま保存すると、写真アプリや Lightroom で
 * 「今日撮った写真」として並び、旅行の時系列が崩れる（実機で分かった）。
 * 元の写真の EXIF から、**撮影日時・カメラ・レンズ・露出だけ**を戻す（§11.8）。
 *
 *   - GPS は戻さない（既定）。SNS に出すと撮影場所が他人に分かる
 *   - MakerNote は戻さない。各社独自で壊れやすく、シリアル番号が入ることがある
 *   - サムネイルは戻さない。元の絵と違うものになる
 *   - Orientation は 1（描いた向きが正）、画素数は書き出した大きさ、Software はこのアプリ
 *
 * **書き戻しはおまけ。失敗しても写真は保存される。** ここで投げて書き出し全体を落とさない。
 * 元が HEIC などで EXIF のセグメントが取れないときは、読み取り済みの値から最小限を組む。
 */
import type { ExifDict, Ifd } from 'piexifjs';
import { parse } from 'exifr/dist/lite.esm.mjs';

export type ExifWriteStatus = 'ok' | 'skipped' | 'failed';

/** 元の JPEG から EXIF を取れないときに組む最小限。読み取り側（app/exif）の値をそのまま渡す */
export interface MinimalExif {
  readonly make?: string;
  readonly model?: string;
  readonly lens?: string;
  /** EXIF の表記 "2026:09:20 17:42:11" */
  readonly dateTimeOriginal?: string;
  readonly fNumber?: number;
  readonly exposureTime?: number;
  readonly iso?: number;
  readonly focalLength?: number;
  readonly focalLength35?: number;
}

export interface ReinjectOptions {
  /** Software タグ。加工済みであることを正直に示し、不具合報告で版が分かる */
  readonly software: string;
  /** 書き出した画素数。PixelXDimension / PixelYDimension に入れる */
  readonly width: number;
  readonly height: number;
  /** 元から EXIF が取れないときの控え */
  readonly fallback?: MinimalExif | null;
  /** GPS も戻す。既定は戻さない */
  readonly keepGps?: boolean;
}

export interface Reinjected {
  readonly blob: Blob;
  readonly status: ExifWriteStatus;
}

const SOI = 0xd8;
const APP0 = 0xe0;
const APP1 = 0xe1;
const SOS = 0xda;
const EOI = 0xd9;
/** 元の写真のうち先頭だけ読む。APP セグメントは 1 つ 64KB までなので、これだけあれば十分 */
const HEAD_BYTES = 2 * 1024 * 1024;
/** 書き戻したあと読み直す範囲 */
const VERIFY_BYTES = 256 * 1024;
/** APP1 の長さの上限（2 バイトの長さ欄） */
const MAX_APP1 = 0xffff - 2;

const T = {
  ImageWidth: 256,
  ImageLength: 257,
  Make: 271,
  Model: 272,
  Orientation: 274,
  Software: 305,
  ExposureTime: 33434,
  FNumber: 33437,
  ISOSpeedRatings: 34855,
  DateTimeOriginal: 36867,
  FocalLength: 37386,
  MakerNote: 37500,
  UserComment: 37510,
  PixelXDimension: 40962,
  PixelYDimension: 40963,
  FocalLengthIn35mmFilm: 41989,
  LensModel: 42036,
} as const;

const isExifApp1 = (b: Uint8Array, pos: number): boolean =>
  b[pos + 4] === 0x45 && b[pos + 5] === 0x78 && b[pos + 6] === 0x69 && b[pos + 7] === 0x66 && b[pos + 8] === 0 && b[pos + 9] === 0;

/** 先頭の APP1（Exif）セグメントを、マーカー込みで切り出す。無ければ null */
export function findExifSegment(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) return null;
    const marker = bytes[pos + 1];
    if (marker === SOS || marker === EOI) return null;
    const len = ((bytes[pos + 2] ?? 0) << 8) | (bytes[pos + 3] ?? 0);
    const end = pos + 2 + len;
    if (len < 2 || end > bytes.length) return null;
    if (marker === APP1 && isExifApp1(bytes, pos)) return bytes.subarray(pos, end);
    pos = end;
  }
  return null;
}

/** APP0（JFIF）があればその直後、無ければ SOI の直後。APP1 はここに差し込む */
function insertionPoint(head: Uint8Array): number {
  if (head[2] === 0xff && head[3] === APP0) return 4 + (((head[4] ?? 0) << 8) | (head[5] ?? 0));
  return 2;
}

function toBinaryString(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
  }
  return s;
}

function fromBinaryString(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

const rational = (v: number, den: number): [number, number] => [Math.round(v * den), den];
const shutter = (t: number): [number, number] => (t >= 1 ? rational(t, 10) : [1, Math.round(1 / t)]);

/** 読み取り済みの値から辞書を組む（元が HEIC などで EXIF のセグメントが無いとき） */
export function dictFromMinimal(f: MinimalExif): ExifDict | null {
  const zeroth: Ifd = {};
  const exif: Ifd = {};
  if (f.make) zeroth[T.Make] = f.make;
  if (f.model) zeroth[T.Model] = f.model;
  if (f.dateTimeOriginal) exif[T.DateTimeOriginal] = f.dateTimeOriginal;
  if (f.lens) exif[T.LensModel] = f.lens;
  if (f.fNumber && f.fNumber > 0) exif[T.FNumber] = rational(f.fNumber, 100);
  if (f.exposureTime && f.exposureTime > 0) exif[T.ExposureTime] = shutter(f.exposureTime);
  if (f.iso && f.iso > 0) exif[T.ISOSpeedRatings] = Math.round(f.iso);
  if (f.focalLength && f.focalLength > 0) exif[T.FocalLength] = rational(f.focalLength, 100);
  if (f.focalLength35 && f.focalLength35 > 0) exif[T.FocalLengthIn35mmFilm] = Math.round(f.focalLength35);
  if (Object.keys(zeroth).length === 0 && Object.keys(exif).length === 0) return null;
  return { '0th': zeroth, Exif: exif, GPS: {}, Interop: {}, '1st': {}, thumbnail: null };
}

/** 戻すものと戻さないものを分ける。元の辞書は変えない */
export function sanitize(src: ExifDict, o: ReinjectOptions): ExifDict {
  const zeroth: Ifd = { ...src['0th'] };
  const exif: Ifd = { ...src.Exif };
  // 元の画素数と向きは、描き直した絵には当てはまらない
  delete zeroth[T.ImageWidth];
  delete zeroth[T.ImageLength];
  zeroth[T.Orientation] = 1;
  zeroth[T.Software] = o.software;
  delete exif[T.MakerNote];
  exif[T.PixelXDimension] = Math.round(o.width);
  exif[T.PixelYDimension] = Math.round(o.height);
  return {
    '0th': zeroth,
    Exif: exif,
    GPS: o.keepGps ? { ...src.GPS } : {},
    Interop: { ...src.Interop },
    '1st': {},
    thumbnail: null,
  };
}

const headOf = async (b: Blob, n: number): Promise<Uint8Array> => new Uint8Array(await b.slice(0, n).arrayBuffer());

/**
 * 元の写真（original）の EXIF を、書き出した JPEG（jpeg）に書き戻す。
 * 何も戻せるものが無ければ skipped、途中で駄目なら failed。どちらも jpeg をそのまま返す。
 */
export async function reinjectExif(jpeg: Blob, original: Blob, o: ReinjectOptions): Promise<Reinjected> {
  try {
    const { default: piexif } = await import('piexifjs');

    let dict: ExifDict | null = null;
    const seg = findExifSegment(await headOf(original, HEAD_BYTES));
    if (seg) {
      try {
        // piexif は JPEG の頭から SOS までを歩く。APP1 だけを挟んだ最小の形を渡す
        dict = piexif.load('\xff\xd8' + toBinaryString(seg) + '\xff\xda');
      } catch {
        dict = null;
      }
    }
    if (!dict && o.fallback) dict = dictFromMinimal(o.fallback);
    if (!dict) return { blob: jpeg, status: 'skipped' };

    const clean = sanitize(dict, o);
    let body = piexif.dump(clean);
    if (body.length > MAX_APP1) {
      // 大きすぎるときは、かさばりがちな注釈と相互運用の情報を落として詰める
      delete clean.Exif[T.UserComment];
      body = piexif.dump({ ...clean, Interop: {} });
      if (body.length > MAX_APP1) return { blob: jpeg, status: 'failed' };
    }
    const len = body.length + 2;
    const app1 = new Uint8Array(4 + body.length);
    app1.set([0xff, APP1, (len >> 8) & 0xff, len & 0xff], 0);
    app1.set(fromBinaryString(body), 4);

    const head = await headOf(jpeg, 64);
    if (head[0] !== 0xff || head[1] !== SOI) return { blob: jpeg, status: 'failed' };
    const cut = insertionPoint(head);
    const out = new Blob([jpeg.slice(0, cut), app1, jpeg.slice(cut)], { type: 'image/jpeg' });

    // ★読み戻して確かめる。挿入が成功した「つもり」で終わらせない★
    const back = (await parse(await headOf(out, VERIFY_BYTES), { reviveValues: false }).catch(() => undefined)) as
      | Record<string, unknown>
      | undefined;
    const want = clean['0th'][T.Model] ?? clean.Exif[T.DateTimeOriginal];
    const got = back?.['Model'] ?? back?.['DateTimeOriginal'];
    if (want !== undefined && got !== want) return { blob: jpeg, status: 'failed' };
    return { blob: out, status: 'ok' };
  } catch {
    return { blob: jpeg, status: 'failed' };
  }
}
