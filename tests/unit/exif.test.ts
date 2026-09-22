/**
 * EXIF 読み取りの端から端まで。
 * FUJIFILM の実写真は同梱できないので、最小の JPEG（SOI と EOI だけ）に FUJIFILM 形式の
 * MakerNote を書き込んだものを作り、exifr（lite）が本当に MakerNote のバイト列を返すことを確かめる。
 * これが通らないと fuji.ts の単体テストが通っていてもアプリでは読めない。
 */
import piexif from 'piexifjs';
import { describe, expect, it } from 'vitest';
import { parse } from 'exifr/dist/lite.esm.mjs';
import { buildFujiNote, parseFujiFilm } from '../../src/app/fuji';

/**
 * 画素の無い JPEG。SOI・JFIF の APP0・空の SOS・EOI だけ。
 * piexif は SOI の次にセグメント長を読むので、EOI だけでは通らない。
 */
const BARE_JPEG =
  '\xff\xd8' +
  '\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00' +
  '\xff\xda\x00\x02' +
  '\xff\xd9';

const toBytes = (binary: string): Uint8Array => Uint8Array.from(binary, (c) => c.charCodeAt(0));

function fujiJpeg(entries: readonly { tag: number; value: number }[]): Uint8Array {
  const note = buildFujiNote(entries);
  let noteStr = '';
  for (const b of note) noteStr += String.fromCharCode(b);
  const exif = piexif.dump({
    '0th': { [piexif.ImageIFD.Make]: 'FUJIFILM', [piexif.ImageIFD.Model]: 'X-M5' },
    Exif: { [piexif.ExifIFD.MakerNote]: noteStr, [piexif.ExifIFD.DateTimeOriginal]: '2026:09:20 10:00:00' },
  });
  return toBytes(piexif.insert(exif, BARE_JPEG));
}

describe('exifr（lite）と FUJIFILM MakerNote', () => {
  it('makerNote: true で素のバイト列が返り、フィルム名に直せる', async () => {
    const raw = await parse(fujiJpeg([{ tag: 0x1401, value: 0x503 }]), { makerNote: true });
    expect(raw?.['Make']).toBe('FUJIFILM');
    expect(raw?.['makerNote']).toBeInstanceOf(Uint8Array);
    expect(parseFujiFilm(raw?.['makerNote'] as Uint8Array)).toBe('CLASSIC CHROME');
  });

  it('オプション無しでは makerNote は返らない（既定を頼ってはいけない）', async () => {
    const raw = await parse(fujiJpeg([{ tag: 0x1401, value: 0x503 }]));
    expect(raw?.['makerNote']).toBeUndefined();
  });

  it('EXIF の無い写真からは何も出ない', async () => {
    const raw = await parse(toBytes(BARE_JPEG), { makerNote: true });
    expect(parseFujiFilm(raw?.['makerNote'] as Uint8Array | undefined)).toBeNull();
  });
});
