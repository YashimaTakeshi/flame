/**
 * exifr の lite ビルドには型定義が付いていない。
 * mini ビルドは Make/Model が取れず使えないため（実測 docs/poc/report-exif.md）、
 * lite を使う。必要な形だけをここで宣言する。
 */
declare module 'exifr/dist/lite.esm.mjs' {
  export interface ParseOptions {
    /** MakerNote（各社独自の塊）を素のバイト列で返す。既定は false */
    readonly makerNote?: boolean;
    /**
     * 日付などを生の文字列のまま返す。既定は true（Date にする）。
     * EXIF の日時はタイムゾーンを持たないので、Date にすると端末の時刻に読み替えられて1日ずれる
     */
    readonly reviveValues?: boolean;
    /** 向きや露出モードを "Horizontal (normal)" のような言葉にしない。既定は true */
    readonly translateValues?: boolean;
  }
  /** EXIF が無ければ undefined を返す。例外は投げない */
  export function parse(
    input: Blob | ArrayBuffer | Uint8Array,
    options?: ParseOptions,
  ): Promise<Record<string, unknown> | undefined>;
}
