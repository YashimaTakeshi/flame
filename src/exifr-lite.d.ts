/**
 * exifr の lite ビルドには型定義が付いていない。
 * mini ビルドは Make/Model が取れず使えないため（実測 docs/poc/report-exif.md）、
 * lite を使う。必要な形だけをここで宣言する。
 */
declare module 'exifr/dist/lite.esm.mjs' {
  /** EXIF が無ければ undefined を返す。例外は投げない */
  export function parse(input: Blob | ArrayBuffer | Uint8Array): Promise<Record<string, unknown> | undefined>;
}
