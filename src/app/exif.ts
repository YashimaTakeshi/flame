/**
 * 写真から撮影情報を読む。
 *
 * EXIF が無い画像は必ず来る（スクリーンショット、加工済み、書き出し直後のもの）。
 * exifr は例外を投げず undefined を返すので、そのまま「情報なし」として扱う。
 */
import { parse } from 'exifr/dist/lite.esm.mjs';
import { parseWallClock, toExifDateTime, type WallClock } from '../core/wallclock';
import type { MinimalExif } from '../platform/exif-write';
import { parseFujiFilm } from './fuji';

export interface ExifFacts {
  readonly camera: string | null;
  readonly lens: string | null;
  /** 撮った土地の壁時計。タイムゾーンを持たない（§4.4） */
  readonly dateTaken: WallClock | null;
  readonly fNumber: number | null;
  readonly exposureTime: number | null;
  readonly iso: number | null;
  readonly focalLength: number | null;
  readonly focalLength35: number | null;
  readonly gps: { readonly lat: number; readonly lng: number } | null;
  /** フィルムシミュレーション（FUJIFILM の MakerNote から）。読めなければ null */
  readonly film: string | null;
}

export const EMPTY_EXIF: ExifFacts = {
  camera: null,
  lens: null,
  dateTaken: null,
  fNumber: null,
  exposureTime: null,
  iso: null,
  focalLength: null,
  focalLength35: null,
  gps: null,
  film: null,
};

interface RawExif {
  Make?: string;
  Model?: string;
  LensModel?: string;
  DateTimeOriginal?: string;
  FNumber?: number;
  ExposureTime?: number;
  ISO?: number;
  FocalLength?: number;
  FocalLengthIn35mmFormat?: number;
  latitude?: number;
  longitude?: number;
  makerNote?: Uint8Array;
}

/** 「Apple iPhone 16 Pro」のような重複を畳む */
function cameraName(make?: string, model?: string): string | null {
  if (!model) return make ?? null;
  if (!make) return model;
  return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`;
}

export async function readExif(file: Blob): Promise<ExifFacts> {
  // reviveValues: false … 日時を Date にしない。Date にすると端末のタイムゾーンで読み替えられ、
  // 海外で撮った写真の日付が1日ずれる（§4.4）。文字列のまま受けて壁時計として読む
  const raw = (await parse(file, { makerNote: true, reviveValues: false }).catch(() => undefined)) as
    | RawExif
    | undefined;
  if (!raw) return EMPTY_EXIF;
  return {
    camera: cameraName(raw.Make, raw.Model),
    lens: raw.LensModel ?? null,
    dateTaken: parseWallClock(raw.DateTimeOriginal),
    fNumber: raw.FNumber ?? null,
    exposureTime: raw.ExposureTime ?? null,
    iso: raw.ISO ?? null,
    focalLength: raw.FocalLength ?? null,
    focalLength35: raw.FocalLengthIn35mmFormat ?? null,
    gps:
      typeof raw.latitude === 'number' && typeof raw.longitude === 'number'
        ? { lat: raw.latitude, lng: raw.longitude }
        : null,
    // FUJIFILM 以外の MakerNote は形式が違う。先頭の "FUJIFILM" で見分けるので Make は見なくてよい
    film: parseFujiFilm(raw.makerNote),
  };
}

/** 1/250 のような表記にする。浮動小数の誤差があるので必ず丸める */
export function formatShutter(sec: number): string {
  if (sec >= 1) return `${Number(sec.toFixed(1))}s`;
  return `1/${Math.round(1 / sec)}s`;
}

export const formatAperture = (f: number): string => `F${Number(f.toFixed(1))}`;
export const formatIso = (iso: number): string => `ISO${iso}`;
export const formatFocal = (mm: number): string => `${Math.round(mm)}mm`;

/**
 * 書き戻し（platform/exif-write）の控え。元が HEIC などで EXIF のセグメントを取れないとき、
 * ここで読めた値から最小限の EXIF を組む。カメラ名は Make と Model を畳んであるので Model に入れる
 */
export function minimalExifOf(f: ExifFacts): MinimalExif {
  const out: {
    -readonly [K in keyof MinimalExif]: MinimalExif[K];
  } = {};
  if (f.camera) out.model = f.camera;
  if (f.lens) out.lens = f.lens;
  if (f.dateTaken) out.dateTimeOriginal = toExifDateTime(f.dateTaken);
  if (f.fNumber) out.fNumber = f.fNumber;
  if (f.exposureTime) out.exposureTime = f.exposureTime;
  if (f.iso) out.iso = f.iso;
  if (f.focalLength) out.focalLength = f.focalLength;
  if (f.focalLength35) out.focalLength35 = f.focalLength35;
  return out;
}
