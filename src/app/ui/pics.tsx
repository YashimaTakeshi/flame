/**
 * 絵のボタンの絵。28×28 の線画、色は currentColor。
 * **額（外枠）・写真（塗り）・文字（太い線）**の3つだけで描き、どの絵も同じ読み方にする。
 */
import type { CaptionPlace, LineCount, PhotoPlace } from '../../core/styles/types';

const svg = (children: React.ReactNode): React.ReactElement => (
  <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
    {children}
  </svg>
);
const PHOTO = { fill: 'currentColor', fillOpacity: 0.28 } as const;

/** 文字の置き場所。余白があるときは額の帯に、無いときは写真の上に */
export function PlacePic({ place, overlay }: { place: CaptionPlace; overlay: boolean }): React.ReactElement {
  if (overlay) {
    const line =
      place === 'above' ? 'M8 7.5h12' : place === 'below' ? 'M8 20.5h12' : place === 'left' ? 'M7.5 9v10' : 'M20.5 9v10';
    return svg(
      <>
        <rect x="4" y="4" width="20" height="20" rx="1.5" {...PHOTO} />
        <path d={line} strokeWidth="1.8" />
      </>,
    );
  }
  switch (place) {
    case 'above':
      return svg(<><rect x="4" y="3" width="20" height="22" rx="1.5" /><rect x="7" y="10" width="14" height="12" {...PHOTO} /><path d="M8 6.5h12" strokeWidth="1.8" /></>);
    case 'below':
      return svg(<><rect x="4" y="3" width="20" height="22" rx="1.5" /><rect x="7" y="6" width="14" height="12" {...PHOTO} /><path d="M8 21.5h12" strokeWidth="1.8" /></>);
    case 'left':
      return svg(<><rect x="3" y="4" width="22" height="20" rx="1.5" /><rect x="11" y="7" width="11" height="14" {...PHOTO} /><path d="M7 9v10" strokeWidth="1.8" /></>);
    case 'right':
      return svg(<><rect x="3" y="4" width="22" height="20" rx="1.5" /><rect x="6" y="7" width="11" height="14" {...PHOTO} /><path d="M21 9v10" strokeWidth="1.8" /></>);
  }
}

/** 写真の位置（額の中でどちらに寄せるか） */
export function PhotoPic({ place }: { place: PhotoPlace }): React.ReactElement {
  const at: Record<PhotoPlace, [number, number]> = {
    center: [8, 8],
    top: [8, 5.5],
    bottom: [8, 10.5],
    left: [6.5, 8],
    right: [9.5, 8],
  };
  const [x, y] = at[place];
  return svg(
    <>
      <rect x="4" y="3" width="20" height="22" rx="1.5" />
      <rect x={x} y={y} width="12" height="12" {...PHOTO} />
    </>,
  );
}

/** 行数 */
export function LinesPic({ n }: { n: LineCount }): React.ReactElement {
  const d = n === 1 ? 'M6 14h16' : n === 2 ? 'M6 11h16M9 17h10' : 'M6 8.5h16M8 14h12M10 19.5h8';
  return svg(<path d={d} strokeWidth="1.8" />);
}

/** 比率の形。元比は写真の形なので破線 */
export function RatioPic({ aspect }: { aspect: readonly [number, number] | null }): React.ReactElement {
  const [aw, ah] = aspect ?? [4, 5];
  const k = 20 / Math.max(aw, ah);
  const w = aw * k;
  const h = ah * k;
  return svg(
    <rect
      x={14 - w / 2}
      y={14 - h / 2}
      width={w}
      height={h}
      rx="1.5"
      strokeWidth="1.5"
      className="pic__shape"
      {...(aspect ? {} : { strokeDasharray: '2.5 2' })}
    />,
  );
}
