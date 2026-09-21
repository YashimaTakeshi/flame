import { rgba, type Rgba } from '../../core/scene/ops';
import type { AlignKey, SizeKey, TrackKey } from '../state/doc';

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

export const SIZE_LU: Record<SizeKey, number> = { S: 13, M: 16, L: 20 };
export const TRACK_LU: Record<TrackKey, number> = {
  tight: -0.24,
  normal: 0,
  wide: 1.44,
  widest: 2.88,
};

export const ALIGN_OPTIONS: { value: AlignKey; label: string }[] = [
  { value: 'left', label: '左' },
  { value: 'center', label: '中' },
  { value: 'right', label: '右' },
];

export const TRACK_OPTIONS: { value: TrackKey; label: string }[] = [
  { value: 'tight', label: '狭' },
  { value: 'normal', label: '標' },
  { value: 'wide', label: '広' },
  { value: 'widest', label: '最広' },
];

export const SIZE_OPTIONS: { value: SizeKey; label: string }[] = [
  { value: 'S', label: '小' },
  { value: 'M', label: '中' },
  { value: 'L', label: '大' },
];

export const colorOf = (key: string): Rgba =>
  COLORS.find((c) => c.key === key)?.value ?? COLORS[0]!.value;
