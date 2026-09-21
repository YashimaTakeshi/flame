/** 撮影情報からキャプションの文字列を組み立てる */
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
  readonly showExposure: boolean;
  readonly showFocal: boolean;
}

/** 欠けている項目は詰める。EXIF が無い写真でも空白だらけにならないように */
export function composeCaption(exif: ExifFacts, parts: CaptionParts): string {
  const items: string[] = [];
  if (parts.title.trim()) items.push(parts.title.trim());
  if (parts.artist.trim()) items.push(parts.artist.trim());
  if (exif.dateTaken) items.push(formatDate(exif.dateTaken));
  if (exif.camera) items.push(exif.camera);
  if (exif.lens) items.push(exif.lens);

  if (parts.showFocal) {
    const mm = exif.focalLength35 ?? exif.focalLength;
    if (mm) items.push(formatFocal(mm));
  }
  if (parts.showExposure) {
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
