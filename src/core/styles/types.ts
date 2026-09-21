/** スタイルの識別子。15種の値は registry.ts で定義する（段階5） */
export type StyleId =
  | 'OR1' | 'OR2' | 'OR3'
  | 'SQ1' | 'SQ2' | 'SQ3' | 'SQ4'
  | 'TF1'
  | 'FF1' | 'FF2' | 'FF3'
  | 'NST1'
  | 'STN1' | 'STN2' | 'STN3';

/** キャプションに載りうる項目 */
export type FieldId =
  | 'title'
  | 'artist'
  | 'date'
  | 'camera'
  | 'lens'
  | 'exposure'
  | 'focalLength'
  | 'place';
