/**
 * 配置。比率・写真の位置・文字の位置。3行、それぞれ1本のセグメント。
 *
 * 「OR2」のような札から選ばせない。選択肢の名前がそのまま「何が変わるか」を言う。
 */
import { RATIO_IDS, RATIOS } from '../../core/styles/spec';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Segmented } from '../ui/Segmented';
import { CAPTION_PLACE_OPTIONS, PHOTO_PLACE_OPTIONS } from './constants';

const RATIO_OPTIONS = RATIO_IDS.map((id) => ({ value: id, label: RATIOS[id].label }));

export function PlacePanel(): React.ReactElement {
  const style = useDoc((s) => s.style);
  const setStyle = useDoc((s) => s.setStyle);
  const setHint = useUi((s) => s.setHint);

  /*
   * 元比では写真がキャンバスにぴったり収まるので、上下左右の寄せに意味が無い。
   * 押せない選択肢として見せる。押されたら理由を1行だけ出す。
   */
  const derived = style.ratio === 'OR';
  const photoOptions = PHOTO_PLACE_OPTIONS.map((o) =>
    derived && o.value !== 'center' && o.value !== 'bleed' ? { ...o, disabled: true } : o,
  );

  return (
    <div className="p-place">
      <div className="p-place__row">
        <span className="p-layout__lbl">比率</span>
        <Segmented label="キャンバスの比率" options={RATIO_OPTIONS} value={style.ratio} onChange={(v) => setStyle({ ratio: v })} />
      </div>
      <div className="p-place__row">
        <span className="p-layout__lbl">写真</span>
        <Segmented
          label="写真の位置"
          options={photoOptions}
          value={style.photo}
          onChange={(v) => setStyle({ photo: v })}
          onDisabledTap={() => setHint('元比では写真がぴったり収まるので、寄せる余地がありません')}
        />
      </div>
      <div className="p-place__row">
        <span className="p-layout__lbl">文字</span>
        <Segmented label="文字の位置" options={CAPTION_PLACE_OPTIONS} value={style.caption} onChange={(v) => setStyle({ caption: v })} />
      </div>
    </div>
  );
}
