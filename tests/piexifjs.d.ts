/** piexifjs には型定義が無い。テストで EXIF を書き込むのに使う最小限だけ宣言する */
declare module 'piexifjs' {
  type Ifd = Record<number, string | number>;
  interface ExifObj {
    '0th'?: Ifd;
    Exif?: Ifd;
  }
  const piexif: {
    readonly ImageIFD: { readonly Make: number; readonly Model: number };
    readonly ExifIFD: { readonly MakerNote: number; readonly DateTimeOriginal: number };
    dump(obj: ExifObj): string;
    insert(exifBytes: string, jpegBinaryString: string): string;
  };
  export default piexif;
}
