/**
 * 撮影情報を「項目ごとの文字列」に直す。
 *
 * 並べ方・区切り・折り返しは core の仕事（core/caption.ts）。
 * ここは EXIF の値を人が読む表記に直すだけに徹する。
 *
 * **「（不明）」のような文字列は作らない。** 値が無い項目はキーごと入れない。
 */
import type { Facts, Gates } from '../core/caption';
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
    readonly film: string | null;
  };
}

export function collectFacts(exif: ExifFacts, parts: CaptionParts): Facts {
  const out: Partial<Record<FieldId, string>> = {};
  const put = (id: FieldId, v: string | null | undefined): void => {
    if (v && v.trim() !== '') out[id] = v.trim();
  };

  put('title', parts.title);
  put('artist', parts.artist);

  const date = parts.overrides.date ?? exif.dateTaken;
  if (date) put('date', formatDate(date));

  put('camera', parts.overrides.camera ?? exif.camera);
  put('lens', parts.overrides.lens ?? exif.lens);
  put('film', parts.overrides.film ?? exif.film);

  const mm = exif.focalLength35 ?? exif.focalLength;
  if (mm) put('focalLength', formatFocal(mm));

  const ex: string[] = [];
  if (exif.fNumber) ex.push(formatAperture(exif.fNumber));
  if (exif.exposureTime) ex.push(formatShutter(exif.exposureTime));
  if (exif.iso) ex.push(formatIso(exif.iso));
  if (ex.length) put('exposure', ex.join(' '));

  // 撮影地は未実装（段階7）。GPS があっても地名には直せないので入れない
  return out;
}

/**
 * 情報タブのオン／オフを core のゲートに直す。
 * 「値が無い」（Facts に入っていない）と「利用者が切った」（ゲートが false）は
 * 別の事象なので、型の上でも分けて渡す。
 */
export const gatesFrom = (fields: Readonly<Record<FieldId, boolean>>): Gates => ({
  exposureEnabled: fields.exposure,
  focalEnabled: fields.focalLength,
  placeEnabled: fields.place,
  artistEnabled: fields.artist,
});

/**
 * 情報タブで切られた項目を Facts から落とす。
 * ゲートを持たない項目（タイトル・日付・カメラ・レンズ）はこちらで落とす。
 */
export function applyFieldSwitches(
  facts: Facts,
  fields: Readonly<Record<FieldId, boolean>>,
): Facts {
  const out: Partial<Record<FieldId, string>> = {};
  for (const [k, v] of Object.entries(facts)) {
    if (fields[k as FieldId] && v !== undefined) out[k as FieldId] = v;
  }
  return out;
}

/** どの項目が取れなかったか。画面で「手で入れる」導線を出すために使う */
export function missingFields(exif: ExifFacts): string[] {
  const missing: string[] = [];
  if (!exif.camera) missing.push('カメラ');
  if (!exif.lens) missing.push('レンズ');
  if (!exif.dateTaken) missing.push('撮影日');
  return missing;
}
