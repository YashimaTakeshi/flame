/** 枠線の太さ。極細はヘアライン（どの大きさでも1画素以上）。doc と persist の両方が使うので分けてある */
export type BorderWeight = 'hair' | 'thin' | 'medium' | 'thick';
export const BORDER_LU: Readonly<Record<BorderWeight, number>> = { hair: 1.2, thin: 3, medium: 6, thick: 12 };
