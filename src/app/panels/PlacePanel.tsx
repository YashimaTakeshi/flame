/**
 * 配置。比率・写真・文字・余白の4行。各行は「見出し ＋ 同じ幅の升」。
 *
 * 押せない選択肢は薄く見せるだけ。理由の文章は出さない。
 *   - 元比では写真の上下左右の寄せに意味が無い（キャンバスが写真にぴったり付く）
 *   - 文字を左右の段に置いているとき、写真を同じ側に寄せる先が無い（逆も同じ）
 * 「全面」は写真の位置ではなく**余白「なし」**。そのとき写真の上下左右は切り取りの寄せになる。
 */
import { RATIO_IDS, RATIOS } from '../../core/styles/spec';
import { useDoc } from '../state/doc';
import { Segmented } from '../ui/Segmented';
import { CAPTION_PLACE_OPTIONS, MARGIN_OPTIONS, PHOTO_PLACE_OPTIONS } from './constants';

const RATIO_OPTIONS = RATIO_IDS.map((id) => ({ value: id, label: RATIOS[id].label }));
const side = (v: string): boolean => v === 'left' || v === 'right';

export function PlacePanel(): React.ReactElement {
  const style = useDoc((s) => s.style);
  const setStyle = useDoc((s) => s.setStyle);

  const derived = style.ratio === 'OR';
  const photoOptions = PHOTO_PLACE_OPTIONS.map((o) => {
    const dead = o.value !== 'center' && (derived || (side(o.value) && side(style.caption)));
    return dead ? { ...o, disabled: true } : o;
  });
  const captionOptions = CAPTION_PLACE_OPTIONS.map((o) =>
    side(o.value) && side(style.photo) ? { ...o, disabled: true } : o,
  );

  return (
    <div className="p-place">
      <div className="p-place__row">
        <span className="p-layout__lbl">比率</span>
        <Segmented label="キャンバスの比率" options={RATIO_OPTIONS} value={style.ratio} onChange={(v) => setStyle({ ratio: v })} />
      </div>
      <div className="p-place__row">
        <span className="p-layout__lbl">写真</span>
        <Segmented label="写真の位置" options={photoOptions} value={style.photo} onChange={(v) => setStyle({ photo: v })} />
      </div>
      <div className="p-place__row">
        <span className="p-layout__lbl">文字</span>
        <Segmented label="文字の位置" options={captionOptions} value={style.caption} onChange={(v) => setStyle({ caption: v })} />
      </div>
      <div className="p-place__row">
        <span className="p-layout__lbl">余白</span>
        <Segmented label="余白の広さ" options={MARGIN_OPTIONS} value={style.margin} onChange={(v) => setStyle({ margin: v })} />
      </div>
    </div>
  );
}
