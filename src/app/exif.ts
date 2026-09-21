/**
 * 写真から撮影情報を読む。
 *
 * EXIF が無い画像は必ず来る（スクリーンショット、加工済み、書き出し直後のもの）。
 * exifr は例外を投げず undefined を返すので、そのまま「情報なし」として扱う。
 */
import { parse } from 'exifr/dist/lite.esm.mjs';

export interface ExifFacts {
  readonly camera: string | null;
  readonly lens: string | null;
  readonly dateTaken: Date | null;
  readonly fNumber: number | null;
  readonly exposureTime: number | null;
  readonly iso: number | null;
  readonly focalLength: number | null;
  readonly focalLength35: number | null;
  readonly gps: { readonly lat: number; readonly lng: number } | null;
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
};

interface RawExif {
  Make?: string;
  Model?: string;
  LensModel?: string;
  DateTimeOriginal?: Date | string;
  FNumber?: number;
  ExposureTime?: number;
  ISO?: number;
  FocalLength?: number;
  FocalLengthIn35mmFormat?: number;
  latitude?: number;
  longitude?: number;
}

/** 「Apple iPhone 16 Pro」のような重複を畳む */
function cameraName(make?: string, model?: string): string | null {
  if (!model) return make ?? null;
  if (!make) return model;
  return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`;
}

export async function readExif(file: Blob): Promise<ExifFacts> {
  const raw = (await parse(file).catch(() => undefined)) as RawExif | undefined;
  if (!raw) return EMPTY_EXIF;
  const d = raw.DateTimeOriginal;
  return {
    camera: cameraName(raw.Make, raw.Model),
    lens: raw.LensModel ?? null,
    dateTaken: d instanceof Date ? d : typeof d === 'string' ? new Date(d) : null,
    fNumber: raw.FNumber ?? null,
    exposureTime: raw.ExposureTime ?? null,
    iso: raw.ISO ?? null,
    focalLength: raw.FocalLength ?? null,
    focalLength35: raw.FocalLengthIn35mmFormat ?? null,
    gps:
      typeof raw.latitude === 'number' && typeof raw.longitude === 'number'
        ? { lat: raw.latitude, lng: raw.longitude }
        : null,
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

export function formatDate(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
