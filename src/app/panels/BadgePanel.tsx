/**
 * 刻印。仕上がり（PROVIA / ビビッド …）を額の帯の中、または写真の上に置く。
 * **文字と同じ部品**（置き場所の絵・3×3 の点・段つきスライダー）で操作する。
 * 以前は辺・横・縦・大・枠の6列を独自の並びで回していた。
 *
 * 余白なし（全面）には帯が無いので、辺は選べず写真の上に 3×3 で置く。
 * 仕上がり（何の名前を刻むか）もここで選べる。選んだ値は情報（手入力の仕上がり）と同じもの。
 * 以前は情報シートで仕上がりを入れてからでないと刻印が効かず、どこで何をすればよいか分からなかった。
 */
import type { BadgeMode, BadgeSize } from '../../core/badge';
import type { BandSide } from '../../core/styles/layout';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Anchor, Pics, Row, Stepper, Switch, type Opt } from '../ui/controls';
import { PlacePic } from '../ui/pics';
import { FILM_SUGGESTIONS } from '../fuji';
import { CAPTION_PLACE_JA, CAPTION_PLACES_UI } from './constants';

const MODE_OPTIONS: readonly Opt<BadgeMode>[] = [
  { value: 'none', label: 'なし' },
  { value: 'text', label: '文字' },
  { value: 'logo', label: 'ロゴ' },
];

const SIZE_OPTIONS: readonly Opt<BadgeSize>[] = [
  { value: 'XXS', label: '極小' },
  { value: 'XS', label: 'より小' },
  { value: 'S', label: '小' },
  { value: 'M', label: '中' },
  { value: 'L', label: '大' },
];

/** select の「その他」。候補の名前と衝突しない値 */
const OTHER = '__other__';

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
  const override = useDoc((s) => s.overrides.film);
  const setOverride = useDoc((s) => s.setOverride);
  const photoFilm = useUi((s) => s.photoFilm);
  const openInfo = useUi((s) => s.openInfo);
  const setHint = useUi((s) => s.setHint);
  /* 仕上がりが無ければ刻むものが無い。すぐ上の「仕上がり」で選べば、その場で効く */
  const noFilm = !useUi((s) => s.hasFilm);
  const off = mode === 'none' || noFilm;
  const why = (): void =>
    setHint(noFilm ? '先に「仕上がり」を選んでください' : '刻印を「文字」か「ロゴ」にしてください');
  // 手で入れた名前が候補に無い（他社の呼び名など）ときも、選んでいる値として見せる
  const custom = override !== null && !FILM_SUGGESTIONS.includes(override);

  return (
    <div className="pnl">
      <Row label="仕上がり">
        <select
          className="pselect"
          aria-label="仕上がり（刻む名前）"
          value={override === null ? '' : override}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTHER) {
              openInfo('film');
              return;
            }
            setOverride('film', v === '' ? null : v);
          }}
        >
          <option value="">{photoFilm ? `${photoFilm}（写真の値）` : '選んでください'}</option>
          {custom && <option value={override}>{override}</option>}
          {FILM_SUGGESTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          <option value={OTHER}>その他（手で入れる）…</option>
        </select>
      </Row>
      <Row label="刻印">
        <Pics label="刻印の見せ方" variant="text" options={MODE_OPTIONS} value={mode} onChange={(v) => set('badge', v)} />
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
