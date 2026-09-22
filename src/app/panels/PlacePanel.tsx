/**
 * 配置。比率・写真・文字・寄せ・余白の5本のホイール。
 *
 * 押せない値は薄く残す（元比では写真の寄せに意味が無い／文字が左右の段なら写真の左右に寄せる先が無い）。
 * 「全面」は写真の位置ではなく余白「なし」。そのときは写真の列ごと止め、
 * 切り取りの位置はプレビューを指で動かして決める。
 * 「寄せ」は文字を帯の中で上下どこに置くか。重ねでは帯が無いので止める。
 */
import { RATIO_IDS, RATIOS } from '../../core/styles/spec';
import { useDoc } from '../state/doc';
import { Wheel } from '../ui/Wheel';
import { CAPTION_ALIGN_OPTIONS, CAPTION_PLACE_OPTIONS, MARGIN_OPTIONS, PHOTO_PLACE_OPTIONS } from './constants';

const RATIO_OPTIONS = RATIO_IDS.map((id) => ({ value: id, label: RATIOS[id].label }));
const side = (v: string): boolean => v === 'left' || v === 'right';

export function PlacePanel(): React.ReactElement {
  const style = useDoc((s) => s.style);
  const setStyle = useDoc((s) => s.setStyle);

  const derived = style.ratio === 'OR';
  const bleed = style.margin === 'none';
  const overlay = style.caption === 'overlay';
  const photoOptions = PHOTO_PLACE_OPTIONS.map((o) => {
    const dead = o.value !== 'center' && (derived || (side(o.value) && side(style.caption)));
    return dead ? { ...o, disabled: true } : o;
  });
  const captionOptions = CAPTION_PLACE_OPTIONS.map((o) =>
    side(o.value) && side(style.photo) ? { ...o, disabled: true } : o,
  );

  return (
    <div className="wheels">
      <Wheel caption="比率" label="キャンバスの比率" options={RATIO_OPTIONS} value={style.ratio} onChange={(v) => setStyle({ ratio: v })} />
      <Wheel caption="写真" label="写真の位置" options={photoOptions} value={style.photo} onChange={(v) => setStyle({ photo: v })} disabled={bleed} />
      <Wheel caption="文字" label="文字の位置" options={captionOptions} value={style.caption} onChange={(v) => setStyle({ caption: v })} />
      <Wheel caption="寄せ" label="文字の寄せ" options={CAPTION_ALIGN_OPTIONS} value={style.captionAlign} onChange={(v) => setStyle({ captionAlign: v })} disabled={overlay} />
      <Wheel caption="余白" label="余白の広さ" options={MARGIN_OPTIONS} value={style.margin} onChange={(v) => setStyle({ margin: v })} />
    </div>
  );
}
