import { rgba, type Rgba } from '../../core/scene/ops';
import type { MarginId } from '../../core/styles/layout';
import type { Align, CaptionPlace, LineCount, PhotoPlace, SizeId, TrackingId } from '../../core/styles/types';

/** 背景色。白・Warm White・Ivory は並べると見分けがつかないので、名前を必ず添える */
export const COLORS: { key: string; label: string; value: Rgba }[] = [
  { key: 'white', label: 'White', value: rgba(255, 255, 255) },
  { key: 'warm', label: 'Warm White', value: rgba(246, 244, 241) },
  { key: 'ivory', label: 'Ivory', value: rgba(240, 234, 220) },
  { key: 'silver', label: 'Silver Sand', value: rgba(196, 201, 199) },
  { key: 'gunmetal', label: 'Gunmetal', value: rgba(45, 52, 54) },
  { key: 'onyx', label: 'Onyx', value: rgba(24, 24, 24) },
  { key: 'black', label: 'Black', value: rgba(0, 0, 0) },
  { key: 'sakura', label: 'Sakura', value: rgba(244, 213, 218) },
  { key: 'sunny', label: 'Sunny Yellow', value: rgba(245, 224, 138) },
];

export const ALIGN_OPTIONS: { value: Align; label: string }[] = [
  { value: 'left', label: '左' },
  { value: 'center', label: '中' },
  { value: 'right', label: '右' },
];

export const TRACK_OPTIONS: { value: TrackingId; label: string }[] = [
  { value: 'Tight', label: '狭' },
  { value: 'Normal', label: '標' },
  { value: 'Wide', label: '広' },
  { value: 'Widest', label: '最広' },
];

export const SIZE_OPTIONS: { value: SizeId; label: string }[] = [
  { value: 'Small', label: '小' },
  { value: 'Medium', label: '中' },
  { value: 'Large', label: '大' },
];

export const colorOf = (key: string): Rgba =>
  COLORS.find((c) => c.key === key)?.value ?? COLORS[0]!.value;

export const MARGIN_OPTIONS: { value: MarginId; label: string }[] = [
  { value: 'narrow', label: '狭い' },
  { value: 'normal', label: '標準' },
  { value: 'wide', label: '広い' },
];

export const PHOTO_PLACE_OPTIONS: { value: PhotoPlace; label: string }[] = [
  { value: 'center', label: '中央' },
  { value: 'top', label: '上' },
  { value: 'bottom', label: '下' },
  { value: 'left', label: '左' },
  { value: 'right', label: '右' },
  { value: 'bleed', label: '全面' },
];

export const CAPTION_PLACE_OPTIONS: { value: CaptionPlace; label: string }[] = [
  { value: 'below', label: '下' },
  { value: 'above', label: '上' },
  { value: 'left', label: '左' },
  { value: 'right', label: '右' },
  { value: 'overlay', label: '重ね' },
];

export const LINE_OPTIONS: { value: LineCount; label: string }[] = [
  { value: 1, label: '1行' },
  { value: 2, label: '2行' },
  { value: 3, label: '3行' },
];
