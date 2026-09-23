/**
 * 刻印。仕上がり（PROVIA / ビビッド …）を額の帯の中、または写真の上に置く。
 * **文字と同じ部品**（置き場所の絵・3×3 の点・段つきスライダー）で操作する。
 * 以前は辺・横・縦・大・枠の6列を独自の並びで回していた。
 *
 * 余白なし（全面）には帯が無いので、辺は選べず写真の上に 3×3 で置く。
 * 仕上がりの記録が無い写真（iPhone など）では刻印は出せない。すべて止めて理由を出す。
 */
import type { BadgeMode, BadgeSize } from '../../core/badge';
import type { BandSide } from '../../core/styles/layout';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Anchor, Pics, Row, Stepper, Switch, type Opt } from '../ui/controls';
import { PlacePic } from '../ui/pics';
import { CAPTION_PLACE_JA, CAPTION_PLACES_UI } from './constants';

const MODE_OPTIONS: readonly Opt<BadgeMode>[] = [
  { value: 'none', label: 'なし' },
  { value: 'text', label: '文字' },
  { value: 'logo', label: 'ロゴ' },
];

const SIZE_OPTIONS: readonly Opt<BadgeSize>[] = [
  { value: 'S', label: '小' },
  { value: 'M', label: '中' },
  { value: 'L', label: '大' },
];

const PLACES: readonly Opt<BandSide>[] = CAPTION_PLACES_UI.map((p) => ({
  value: p,
  label: `刻印を${CAPTION_PLACE_JA[p]}の余白に`,
  icon: <PlacePic place={p} overlay={false} />,
}));

export function BadgePanel(): React.ReactElement {
  const mode = useDoc((s) => s.badge);
  const place = useDoc((s) => s.badgePlace);
  const align = useDoc((s) => s.badgeAlign);
  const valign = useDoc((s) => s.badgeValign);
  const size = useDoc((s) => s.badgeSize);
  const framed = useDoc((s) => s.badgeFramed);
  const bleed = useDoc((s) => s.style.margin === 'none');
  const set = useDoc((s) => s.set);
  const setBadgePos = useDoc((s) => s.setBadgePos);
  const setHint = useUi((s) => s.setHint);
  /*
   * 仕上がりの記録が無い写真（iPhone など）では刻印は出せない。
   * 以前は押せる見た目のまま何も起きず、タブごと壊れて見えた
   */
  const noFilm = !useUi((s) => s.hasFilm);
  const off = mode === 'none' || noFilm;
  const why = (): void =>
    setHint(noFilm ? '仕上がりの記録がない写真です（✎で選べます）' : '刻印を「文字」か「ロゴ」にしてください');

  return (
    <div className="pnl">
      <Row label="刻印" dim={noFilm}>
        <Pics label="刻印の見せ方" variant="text" options={MODE_OPTIONS} value={mode} onChange={(v) => set('badge', v)} disabled={noFilm} onDisabledPick={why} />
      </Row>
      <Row label="置き場所" dim={off || bleed}>
        <div className="pair">
          <Pics
            label="刻印を置く辺"
            options={PLACES}
            value={place}
            onChange={(v) => set('badgePlace', v)}
            disabled={off || bleed}
            onDisabledPick={off ? why : () => setHint('余白なしでは写真の上に置きます。辺は選べません')}
          />
        </div>
      </Row>
      <Row label="位置" dim={off}>
        <Anchor label="刻印の位置" h={align} v={valign} onChange={setBadgePos} disabled={off} onDisabledPick={why} />
      </Row>
      <Row label="大きさ" dim={off}>
        <Stepper label="刻印の大きさ" options={SIZE_OPTIONS} value={size} defaultValue="M" onChange={(v) => set('badgeSize', v)} disabled={off} onDisabledPick={why} />
      </Row>
      <Row label="枠線" dim={off}>
        <Switch label="刻印の枠線" on={framed} onChange={(on) => set('badgeFramed', on)} disabled={off} onDisabledPick={why} />
      </Row>
    </div>
  );
}
