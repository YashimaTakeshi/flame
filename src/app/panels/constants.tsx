import { rgba, type Rgba } from '../../core/scene/ops';
import { RATIO_IDS, RATIOS } from '../../core/styles/spec';
import type { CaptionPlace, LineCount, MarginId, PhotoPlace, Ratio, SizeId, TrackingId } from '../../core/styles/types';
import type { Opt } from '../ui/controls';
import { LinesPic, PhotoPic, RatioPic } from '../ui/pics';

/** 背景色。白・Warm White・Ivory は並べると見分けがつかないので、選んでいる色の名前を出す */
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

export const colorOf = (key: string): Rgba =>
  COLORS.find((c) => c.key === key)?.value ?? COLORS[0]!.value;

/** 比率は形で選ぶ。元比は写真の形なので破線 */
export const RATIO_OPTIONS: readonly Opt<Ratio>[] = RATIO_IDS.map((id) => ({
  value: id,
  label: id === 'OR' ? '元の比率' : `${RATIOS[id].label} の比率`,
  text: RATIOS[id].label,
  icon: <RatioPic aspect={RATIOS[id].aspect} />,
}));

/** 余白。なし→広 の順に、スライダーの左から右へ */
export const MARGIN_OPTIONS: readonly Opt<MarginId>[] = [
  { value: 'none', label: 'なし' },
  { value: 'narrow', label: '狭い' },
  { value: 'normal', label: '標準' },
  { value: 'wide', label: '広い' },
];

const PHOTO_LABEL: Record<PhotoPlace, string> = {
  center: '写真を中央に',
  top: '写真を上に寄せる',
  bottom: '写真を下に寄せる',
  left: '写真を左に寄せる',
  right: '写真を右に寄せる',
};
export const PHOTO_PLACES_UI: readonly PhotoPlace[] = ['center', 'top', 'bottom', 'left', 'right'];
export const photoOption = (p: PhotoPlace): Opt<PhotoPlace> => ({ value: p, label: PHOTO_LABEL[p], icon: <PhotoPic place={p} /> });

export const CAPTION_PLACES_UI: readonly CaptionPlace[] = ['above', 'below', 'left', 'right'];
export const CAPTION_PLACE_JA: Record<CaptionPlace, string> = { above: '上', below: '下', left: '左', right: '右' };

export const LINE_OPTIONS: readonly Opt<`${LineCount}`>[] = ([1, 2, 3] as const).map((n) => ({
  value: `${n}` as const,
  label: `${n}行`,
  icon: <LinesPic n={n} />,
}));

export const SIZE_OPTIONS: readonly Opt<SizeId>[] = [
  { value: 'Small', label: '小' },
  { value: 'Medium', label: '中' },
  { value: 'Large', label: '大' },
];

export const TRACK_OPTIONS: readonly Opt<TrackingId>[] = [
  { value: 'Tight', label: '狭い' },
  { value: 'Normal', label: '標準' },
  { value: 'Wide', label: '広い' },
  { value: 'Widest', label: '最も広い' },
];
