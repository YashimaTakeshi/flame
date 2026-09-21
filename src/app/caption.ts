/** 撮影情報からキャプションの文字列を組み立てる */
import type { FieldId } from '../core/styles/types';
import {
  formatAperture,
  formatDate,
  formatFocal,
  formatIso,
  formatShutter,
  type ExifFacts,
} from './exif';

export interface CaptionParts {
  readonly title: string;
  readonly artist: string;
  /** キャプションに載せる項目。利用者が情報タブで決める */
  readonly fields: Readonly<Record<FieldId, boolean>>;
  /** 写真に無かった情報の手入力。写真の値より優先する */
  readonly overrides: {
    readonly camera: string | null;
    readonly lens: string | null;
    readonly date: Date | null;
  };
}

/**
 * 欠けている項目は詰める。
 * **「（不明）」のような文字列を焼き込むことは絶対にしない。** 空なら行ごと省く。
 */
export function composeCaption(exif: ExifFacts, parts: CaptionParts): string {
  const items: string[] = [];
  const on = (id: FieldId): boolean => parts.fields[id];

  if (on('title') && parts.title.trim()) items.push(parts.title.trim());
  if (on('artist') && parts.artist.trim()) items.push(parts.artist.trim());

  const date = parts.overrides.date ?? exif.dateTaken;
  if (on('date') && date) items.push(formatDate(date));

  const camera = parts.overrides.camera ?? exif.camera;
  if (on('camera') && camera) items.push(camera);

  const lens = parts.overrides.lens ?? exif.lens;
  if (on('lens') && lens) items.push(lens);

  if (on('focalLength')) {
    const mm = exif.focalLength35 ?? exif.focalLength;
    if (mm) items.push(formatFocal(mm));
  }
  if (on('exposure')) {
    const ex: string[] = [];
    if (exif.fNumber) ex.push(formatAperture(exif.fNumber));
    if (exif.exposureTime) ex.push(formatShutter(exif.exposureTime));
    if (exif.iso) ex.push(formatIso(exif.iso));
    if (ex.length) items.push(ex.join(' '));
  }
  return items.join(', ');
}

/** どの項目が取れなかったか。画面で「手で入れる」導線を出すために使う */
export function missingFields(exif: ExifFacts): string[] {
  const missing: string[] = [];
  if (!exif.camera) missing.push('カメラ');
  if (!exif.lens) missing.push('レンズ');
  if (!exif.dateTaken) missing.push('撮影日');
  return missing;
}
