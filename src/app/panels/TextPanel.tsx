/**
 * 文字。置き場所（4辺）・帯の中の位置（3×3）・行数・大きさ・字間。
 *
 * 余白があるときは額の帯に、余白が「なし」のときは写真の上のその辺に重ねる。
 * 以前は「重ね」が5つ目の置き場所で、しかも下にしか置けなかった。
 * 「揃え（左右）」と「寄せ（上下）」は別々のタブにあったのを、3×3 の点1つにまとめた。
 * 文字は写真に揃える（上下の帯は写真の幅、左右の段は写真の高さの範囲）。
 * 先頭のスイッチで文字そのものを切れる。
 */
import type { CaptionPlace } from '../../core/styles/types';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Anchor, Pics, Row, Stepper, Switch, type Opt } from '../ui/controls';
import { PlacePic } from '../ui/pics';
import { CAPTION_PLACE_JA, CAPTION_PLACES_UI, SIZE_OPTIONS, TRACK_OPTIONS } from './constants';
import { LinesPicker } from './LinesPicker';

export function TextPanel(): React.ReactElement {
  const style = useDoc((s) => s.style);
  const setStyle = useDoc((s) => s.setStyle);
  const align = useDoc((s) => s.align);
  const size = useDoc((s) => s.size);
  const tracking = useDoc((s) => s.tracking);
  const set = useDoc((s) => s.set);
  const setCaptionPos = useDoc((s) => s.setCaptionPos);
  const on = useDoc((s) => s.captionOn);
  const setHint = useUi((s) => s.setHint);
  const textY = useUi((s) => s.freedom.textY);
  const off = (): void => setHint('「文字を入れる」をオンにしてください');

  const overlay = style.margin === 'none';
  const places: readonly Opt<CaptionPlace>[] = CAPTION_PLACES_UI.map((p) => ({
    value: p,
    label: overlay ? `写真の${CAPTION_PLACE_JA[p]}に重ねる` : `文字を${CAPTION_PLACE_JA[p]}の余白に`,
    icon: <PlacePic place={p} overlay={overlay} />,
  }));
  // 写真の上辺・下辺に重ねるときは、上下は辺で決まる。左右だけが選べる
  const lockV = overlay && style.caption === 'above' ? 'start' : overlay && style.caption === 'below' ? 'end' : undefined;

  return (
    <div className="pnl">
      {/* 文字を入れない写真もある。切ると帯ごと消え、設定は薄く残る（入れ直せば元どおり） */}
      <Row label="文字">
        <div className="pair">
          <Switch label="文字を入れる" on={on} onChange={(v) => set('captionOn', v)} />
          <span className="pair__note">{on ? '入れる' : '入れない'}</span>
        </div>
      </Row>
      <Row label="置き場所" dim={!on}>
        <Pics label="文字の置き場所" options={places} value={style.caption} onChange={(v) => setStyle({ caption: v })} disabled={!on} onDisabledPick={off} />
      </Row>
      <Row label="位置" dim={!on}>
        <div className="pair">
          <Anchor
            label="帯の中の文字の位置"
            h={align}
            v={style.captionAlign}
            lockV={lockV}
            activeV={textY}
            onChange={(h, v) => setCaptionPos(h, v)}
            disabled={!on}
            onDisabledPick={(why) =>
              why === 'all' ? off() : setHint('文字の上下に余りがありません（写真を上下に寄せると動かせます）')
            }
          />
          <LinesPicker disabled={!on} onDisabledPick={off} />
        </div>
      </Row>
      <Row label="大きさ" dim={!on}>
        <Stepper label="文字の大きさ" options={SIZE_OPTIONS} value={size} defaultValue="Medium" onChange={(v) => set('size', v)} disabled={!on} onDisabledPick={off} />
      </Row>
      <Row label="字間" dim={!on}>
        <Stepper label="字間" options={TRACK_OPTIONS} value={tracking} defaultValue="Normal" onChange={(v) => set('tracking', v)} disabled={!on} onDisabledPick={off} />
      </Row>
    </div>
  );
}
