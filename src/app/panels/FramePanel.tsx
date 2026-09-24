/**
 * フレーム（額）。比率・余白・写真の位置・地色・枠線。
 * 以前は「配置」と「地色」に分かれていた。どれも額の性質なので1つにした。
 *
 * 余白を「なし」にすると写真がキャンバスの端まで届き、文字は写真の上に重なる（文字タブで辺を選ぶ）。
 * そのとき写真の位置と地色は効かない。薄く残し、押したら理由を出す。
 *
 * 写真の位置は 3×3 の点。写真は額の余りの中に収まるので、動けるのは横か縦のどちらかだけ。
 * **その時に動ける方向の点だけを生かす**（比率・写真の形・文字の辺で変わる）。
 * 以前は5つの絵のボタンで、半分が押しても何も起きず、避けるために文字の辺まで勝手に変えていた。
 */
import { cssColor } from '../../core/scene/ops';
import { DEFAULT_SPEC } from '../../core/styles/spec';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Anchor, Pics, Row, Stepper, Swatches, type Opt } from '../ui/controls';
import type { BorderWeight } from '../state/doc';
import { COLORS, MARGIN_OPTIONS, RATIO_OPTIONS, hvOfPhoto, photoOfHv } from './constants';

const BORDER_OPTIONS: readonly Opt<BorderWeight | 'none'>[] = [
  { value: 'none', label: 'なし' },
  { value: 'hair', label: '極細' },
  { value: 'thin', label: '細い' },
  { value: 'medium', label: '中' },
  { value: 'thick', label: '太い' },
];

const SWATCHES = COLORS.map((c) => ({ key: c.key, label: c.label, css: cssColor(c.value) }));

export function FramePanel(): React.ReactElement {
  const style = useDoc((s) => s.style);
  const setStyle = useDoc((s) => s.setStyle);
  const colorKey = useDoc((s) => s.colorKey);
  const bordered = useDoc((s) => s.bordered);
  const borderWeight = useDoc((s) => s.borderWeight);
  const setBorder = useDoc((s) => s.setBorder);
  const set = useDoc((s) => s.set);
  const setHint = useUi((s) => s.setHint);
  const freedom = useUi((s) => s.freedom);

  const bleed = style.margin === 'none';
  const { h, v } = hvOfPhoto(style.photo);
  const photoWhy = (why: 'all' | 'h' | 'v'): void => {
    if (why === 'all') setHint('余白なしでは、写真を指で動かして切り取ります');
    else if (style.ratio === 'OR') setHint('元比では写真の周りに余りが無く、寄せられません');
    else setHint(why === 'h' ? 'いまの形では写真を左右に寄せられません' : 'いまの形では写真を上下に寄せられません');
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
        <div className="pair">
          <Anchor
            label="額の中の写真の位置"
            h={h}
            v={v}
            activeH={freedom.photoX}
            activeV={freedom.photoY}
            onChange={(hh, vv) => setStyle({ photo: photoOfHv(hh, vv) })}
            disabled={bleed}
            onDisabledPick={photoWhy}
          />
          {!bleed && !freedom.photoX && !freedom.photoY && <span className="pair__note">余りなし</span>}
        </div>
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
        {/* 入り切りと太さを1本で（依頼者の要望で太さを選べるようにした） */}
        <Stepper
          label="写真の枠線の太さ"
          options={BORDER_OPTIONS}
          value={bordered ? borderWeight : 'none'}
          defaultValue="none"
          onChange={(v) => setBorder(v === 'none' ? null : v)}
        />
      </Row>
    </div>
  );
}
