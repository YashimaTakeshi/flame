/**
 * 撮影情報の書き戻し。
 * canvas から出た JPEG には EXIF が無い。元の写真から日時・カメラ・レンズ・露出だけを戻し、
 * GPS と MakerNote は戻さない（§11.8）。★戻したあと読み直して確かめる★
 */
import piexif from 'piexifjs';
import { describe, expect, it } from 'vitest';
import { parse } from 'exifr/dist/lite.esm.mjs';
import { dictFromMinimal, findExifSegment, reinjectExif } from '../../src/platform/exif-write';

/** 画素の無い JPEG。SOI・JFIF の APP0・空の SOS・EOI だけ（canvas の出力もこの並び） */
const BARE_JPEG =
  '\xff\xd8' +
  '\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00' +
  '\xff\xda\x00\x02' +
  '\xff\xd9';

const toBytes = (s: string): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};
const blobOf = (s: string): Blob => new Blob([toBytes(s)], { type: 'image/jpeg' });
const bytesOf = async (b: Blob): Promise<Uint8Array> => new Uint8Array(await b.arrayBuffer());

/** 撮った写真のつもり。GPS と MakerNote と向きも入れる */
function shot(): string {
  const exif = piexif.dump({
    '0th': {
      [piexif.ImageIFD.Make]: 'FUJIFILM',
      [piexif.ImageIFD.Model]: 'X-M5',
      [piexif.ImageIFD.Orientation]: 6,
      [piexif.ImageIFD.ImageWidth]: 6240,
      [piexif.ImageIFD.Software]: 'Digital Camera X-M5 Ver1.00',
    },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: '2026:09:20 10:00:00',
      [piexif.ExifIFD.LensModel]: 'XF27mmF2.8 R WR',
      [piexif.ExifIFD.FNumber]: [28, 10],
      [piexif.ExifIFD.ExposureTime]: [1, 250],
      [piexif.ExifIFD.ISOSpeedRatings]: 160,
      [piexif.ExifIFD.MakerNote]: 'FUJIFILM\x0c\x00\x00\x00\x00\x00',
      [piexif.ExifIFD.PixelXDimension]: 6240,
    },
    GPS: { 1: 'N', 2: [[34, 1], [17, 1], [45, 1]], 3: 'E', 4: [[132, 1], [19, 1], [11, 1]] },
  });
  return piexif.insert(exif, BARE_JPEG);
}

const OPTS = { software: 'flame 0.1.0 (test)', width: 4096, height: 5120 };

describe('撮影情報の書き戻し', () => {
  it('APP0 の後ろにある APP1（Exif）を見つける', () => {
    const seg = findExifSegment(toBytes(shot()));
    expect(seg).not.toBeNull();
    expect(seg![0]).toBe(0xff);
    expect(seg![1]).toBe(0xe1);
    expect(findExifSegment(toBytes(BARE_JPEG))).toBeNull();
  });

  it('★日時・カメラ・レンズ・露出は戻り、GPS と MakerNote は戻らない★', async () => {
    const r = await reinjectExif(blobOf(BARE_JPEG), blobOf(shot()), OPTS);
    expect(r.status).toBe('ok');
    const back = await parse(await bytesOf(r.blob), { reviveValues: false });
    expect(back?.['Make']).toBe('FUJIFILM');
    expect(back?.['Model']).toBe('X-M5');
    expect(back?.['DateTimeOriginal']).toBe('2026:09:20 10:00:00');
    expect(back?.['LensModel']).toBe('XF27mmF2.8 R WR');
    expect(back?.['FNumber']).toBe(2.8);
    expect(back?.['ExposureTime']).toBe(0.004);
    expect(back?.['ISO']).toBe(160);
    expect(back?.['latitude']).toBeUndefined();
    expect(back?.['GPSLatitude']).toBeUndefined();
    expect(back?.['makerNote']).toBeUndefined();
    expect(back?.['MakerNote']).toBeUndefined();
  });

  it('向きは 1、画素数は書き出した大きさ、Software はこのアプリ', async () => {
    const r = await reinjectExif(blobOf(BARE_JPEG), blobOf(shot()), OPTS);
    const back = await parse(await bytesOf(r.blob), { reviveValues: false, translateValues: false });
    expect(back?.['Orientation']).toBe(1);
    expect(back?.['Software']).toBe('flame 0.1.0 (test)');
    expect(back?.['ExifImageWidth']).toBe(4096);
    expect(back?.['ExifImageHeight']).toBe(5120);
    expect(back?.['ImageWidth']).toBeUndefined();
  });

  it('書き戻した JPEG は、SOI・APP0・APP1 の順で始まり、残りは元のまま', async () => {
    const r = await reinjectExif(blobOf(BARE_JPEG), blobOf(shot()), OPTS);
    const b = await bytesOf(r.blob);
    expect([b[0], b[1], b[2], b[3]]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    const app0End = 4 + 16;
    expect([b[app0End], b[app0End + 1]]).toEqual([0xff, 0xe1]);
    expect(Array.from(b.subarray(b.length - 6))).toEqual([0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
  });

  it('元に EXIF が無くても、読み取り済みの値から最小限を組める（HEIC の控え）', async () => {
    const r = await reinjectExif(blobOf(BARE_JPEG), blobOf(BARE_JPEG), {
      ...OPTS,
      fallback: { model: 'iPhone 16 Pro', dateTimeOriginal: '2026:09:21 13:05:00', fNumber: 1.78, exposureTime: 1 / 120, iso: 80, focalLength: 6.765 },
    });
    expect(r.status).toBe('ok');
    const back = await parse(await bytesOf(r.blob), { reviveValues: false });
    expect(back?.['Model']).toBe('iPhone 16 Pro');
    expect(back?.['DateTimeOriginal']).toBe('2026:09:21 13:05:00');
    expect(back?.['FNumber']).toBe(1.78);
    expect(back?.['ExposureTime']).toBeCloseTo(1 / 120, 6);
  });

  it('戻すものが何も無ければ skipped で、画像はそのまま', async () => {
    const jpeg = blobOf(BARE_JPEG);
    const r = await reinjectExif(jpeg, blobOf(BARE_JPEG), OPTS);
    expect(r.status).toBe('skipped');
    expect(r.blob).toBe(jpeg);
    expect(dictFromMinimal({})).toBeNull();
  });

  it('元が JPEG でなくても投げない（failed か skipped で、画像はそのまま）', async () => {
    const jpeg = blobOf(BARE_JPEG);
    const r = await reinjectExif(jpeg, new Blob([new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70])]), OPTS);
    expect(['skipped', 'failed']).toContain(r.status);
    expect(r.blob).toBe(jpeg);
  });
});
