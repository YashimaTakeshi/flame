/**
 * フレーム（額）。比率・余白・写真の位置・地色・枠線。
 * 以前は「配置」と「地色」に分かれていた。どれも額の性質なので1つにした。
 *
 * 余白を「なし」にすると写真がキャンバスの端まで届き、文字は写真の上に重なる（文字タブで辺を選ぶ）。
 * そのとき写真の位置と地色は効かない。薄く残し、押したら理由を出す。
 */
import { cssColor } from '../../core/scene/ops';
import { DEFAULT_SPEC } from '../../core/styles/spec';
import type { PhotoPlace } from '../../core/styles/types';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Pics, Row, Stepper, Swatches, Switch } from '../ui/controls';
import { COLORS, MARGIN_OPTIONS, PHOTO_PLACES_UI, RATIO_OPTIONS, photoOption } from './constants';

const SWATCHES = COLORS.map((c) => ({ key: c.key, label: c.label, css: cssColor(c.value) }));
const side = (v: string): boolean => v === 'left' || v === 'right';

export function FramePanel(): React.ReactElement {
  const style = useDoc((s) => s.style);
  const setStyle = useDoc((s) => s.setStyle);
  const colorKey = useDoc((s) => s.colorKey);
  const bordered = useDoc((s) => s.bordered);
  const set = useDoc((s) => s.set);
  const setHint = useUi((s) => s.setHint);

  const bleed = style.margin === 'none';
  const derived = style.ratio === 'OR';
  const photoOptions = PHOTO_PLACES_UI.map((p) => {
    const o = photoOption(p);
    return p !== 'center' && derived ? { ...o, disabled: true } : o;
  });
  const photoWhy = (p: PhotoPlace): void => {
    if (bleed) setHint('余白なしでは、写真を指で動かして切り取ります');
    else if (derived && p !== 'center') setHint('元比では写真の周りに余りが無く、寄せられません');
  };
  const colorName = COLORS.find((c) => c.key === colorKey)?.label ?? '';

  return (
    <div className="pnl">
      <Row label="比率">
        <Pics label="キャンバスの比率" variant="shape" options={RATIO_OPTIONS} value={style.ratio} onChange={(v) => setStyle({ ratio: v })} />
      </Row>
      <Row label="余白">
        <Stepper
          label="余白の広さ"
          options={MARGIN_OPTIONS}
          value={style.margin}
          defaultValue={DEFAULT_SPEC.margin}
          ends={['なし', '広い']}
          onChange={(v) => setStyle({ margin: v })}
        />
      </Row>
      <Row label="写真" dim={bleed}>
        <Pics
          label="写真の位置"
          options={photoOptions}
          value={style.photo}
          onChange={(v) => {
            // 写真を左右に寄せると、左右の段にあった文字は下へ移る（doc.setStyle）。黙って動かさない
            if (side(v) && side(style.caption)) setHint('文字は下に移しました');
            setStyle({ photo: v });
          }}
          disabled={bleed}
          onDisabledPick={photoWhy}
        />
      </Row>
      <Row label="地色" note={bleed ? undefined : colorName} dim={bleed}>
        <Swatches
          label="地色"
          options={SWATCHES}
          value={colorKey}
          onChange={(k) => set('colorKey', k)}
          disabled={bleed}
          onDisabledPick={() => setHint('余白なしでは地色は見えません')}
        />
      </Row>
      <Row label="枠線">
        <Switch label="写真の枠線" on={bordered} onChange={(on) => set('bordered', on)} />
      </Row>
    </div>
  );
}
