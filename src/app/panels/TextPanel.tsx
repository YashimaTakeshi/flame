/**
 * 文字。置き場所（4辺）・帯の中の位置（3×3）・行数・大きさ・字間。
 *
 * 余白があるときは額の帯に、余白が「なし」のときは写真の上のその辺に重ねる。
 * 以前は「重ね」が5つ目の置き場所で、しかも下にしか置けなかった。
 * 「揃え（左右）」と「寄せ（上下）」は別々のタブにあったのを、3×3 の点1つにまとめた。
 */
import type { CaptionPlace, LineCount } from '../../core/styles/types';
import { useDoc } from '../state/doc';
import { Anchor, Pics, Row, Stepper, type Opt } from '../ui/controls';
import { PlacePic } from '../ui/pics';
import { CAPTION_PLACE_JA, CAPTION_PLACES_UI, LINE_OPTIONS, SIZE_OPTIONS, TRACK_OPTIONS } from './constants';

export function TextPanel(): React.ReactElement {
  const style = useDoc((s) => s.style);
  const setStyle = useDoc((s) => s.setStyle);
  const align = useDoc((s) => s.align);
  const size = useDoc((s) => s.size);
  const tracking = useDoc((s) => s.tracking);
  const set = useDoc((s) => s.set);
  const setCaptionPos = useDoc((s) => s.setCaptionPos);

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
      <Row label="置き場所">
        <Pics label="文字の置き場所" options={places} value={style.caption} onChange={(v) => setStyle({ caption: v })} />
      </Row>
      <Row label="位置">
        <div className="pair">
          <Anchor
            label="帯の中の文字の位置"
            h={align}
            v={style.captionAlign}
            lockV={lockV}
            onChange={(h, v) => setCaptionPos(h, v)}
          />
          <Pics
            label="行数"
            options={LINE_OPTIONS}
            value={`${style.lines}`}
            onChange={(v) => setStyle({ lines: Number(v) as LineCount })}
          />
        </div>
      </Row>
      <Row label="大きさ">
        <Stepper label="文字の大きさ" options={SIZE_OPTIONS} value={size} defaultValue="Medium" onChange={(v) => set('size', v)} />
      </Row>
      <Row label="字間">
        <Stepper label="字間" options={TRACK_OPTIONS} value={tracking} defaultValue="Normal" onChange={(v) => set('tracking', v)} />
      </Row>
    </div>
  );
}
