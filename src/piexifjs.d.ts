/** piexifjs には型定義が無い。使う形だけを宣言する（書き戻しとテスト） */
declare module 'piexifjs' {
  export type IfdValue = string | number | number[] | [number, number] | [number, number][];
  export type Ifd = Record<number, IfdValue>;
  export interface ExifDict {
    '0th': Ifd;
    Exif: Ifd;
    GPS: Ifd;
    Interop: Ifd;
    '1st': Ifd;
    thumbnail: string | null;
  }
  const piexif: {
    readonly ImageIFD: {
      readonly Make: number;
      readonly Model: number;
      readonly Orientation: number;
      readonly Software: number;
      readonly ImageWidth: number;
      readonly ImageLength: number;
    };
    readonly ExifIFD: {
      readonly MakerNote: number;
      readonly DateTimeOriginal: number;
      readonly LensModel: number;
      readonly FNumber: number;
      readonly ExposureTime: number;
      readonly ISOSpeedRatings: number;
      readonly FocalLength: number;
      readonly FocalLengthIn35mmFilm: number;
      readonly PixelXDimension: number;
      readonly PixelYDimension: number;
      readonly UserComment: number;
    };
    /** JPEG（先頭から SOS まであれば足りる）を読んで辞書にする。EXIF が無ければ空の辞書 */
    load(jpegBinaryString: string): ExifDict;
    /** 辞書を "Exif\0\0" から始まる APP1 の中身にする（マーカーと長さは含まない） */
    dump(dict: Partial<ExifDict>): string;
    insert(exifBytes: string, jpegBinaryString: string): string;
    remove(jpegBinaryString: string): string;
  };
  export default piexif;
}
