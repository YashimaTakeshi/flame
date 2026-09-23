/**
 * 画面で使う印。すべて 24×24 の線画、色は currentColor。
 *
 * 文字の代わりに置くものなので、**意味が一目で決まる形**だけを使う。
 * 迷う形（抽象的な記号）は採らない。使う側は必ず aria-label を添える。
 */
type P = { readonly size?: number };
const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

/** 写真（山と太陽の入った枠）。写真を選ぶ／変える */
export const IconPhoto = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M21 16l-5.5-5.5L7 19" />
  </svg>
);

/** 共有（箱から上へ矢印）。書き出す・保存する */
export const IconShare = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M12 15V4M8 8l4-4 4 4" />
    <path d="M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" />
  </svg>
);

/** 配置（枠の中の写真と、その下の文字列） */
export const IconPlace = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <rect x="6.5" y="6.5" width="11" height="8" />
    <path d="M7.5 17.5h9" />
  </svg>
);

/** 組み（長さの違う行） */
export const IconType = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M4 7h16M4 12h11M4 17h14" />
  </svg>
);

/** 地色（半分塗った円） */
export const IconSwatch = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 010 16z" fill="currentColor" stroke="none" />
  </svg>
);

/** 書体。文字そのものがいちばん分かる */
export const IconFont = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)} stroke="none" fill="currentColor">
    <text x="12" y="17" textAnchor="middle" fontSize="15" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="600">
      Aa
    </text>
  </svg>
);

/** 情報 */
export const IconInfo = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r="0.6" fill="currentColor" />
  </svg>
);

/** 共有（鎖の輪。リンクを渡す） */
export const IconLink = ({ size = 18 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M10 13.5a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1.2 1.2" />
    <path d="M14 10.5a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1.2-1.2" />
  </svg>
);

/** 刻印（札。上に小さな帯、下に太い帯） */
export const IconStamp = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <rect x="4" y="4" width="16" height="16" />
    <path d="M4 9h9" />
    <rect x="4" y="15" width="16" height="5" fill="currentColor" stroke="none" opacity="0.35" />
  </svg>
);

/** 初期値に戻す（反時計回りの矢印） */
export const IconReset = ({ size = 20 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M4 12a8 8 0 108-8H9" />
    <path d="M9 1.5L6.5 4 9 6.5" />
  </svg>
);

/** 取り消す（左へ戻る曲がった矢印） */
export const IconUndo = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </svg>
);

/** やり直す（右へ進む曲がった矢印） */
export const IconRedo = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 000 11H13" />
  </svg>
);

/** 編集（鉛筆） */
export const IconEdit = ({ size = 20 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" />
    <path d="M13.5 7.5l3 3" />
  </svg>
);

/** 揃え。線の寄り方がそのまま意味 */
export const IconAlignLeft = ({ size = 18 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M4 7h16M4 12h10M4 17h13" />
  </svg>
);
export const IconAlignCenter = ({ size = 18 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M4 7h16M7 12h10M5.5 17h13" />
  </svg>
);
export const IconAlignRight = ({ size = 18 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M4 7h16M10 12h10M7 17h13" />
  </svg>
);

/** 組み方向。横に並ぶ行／縦に並ぶ行 */
export const IconHorizontal = ({ size = 18 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M5 7h14M5 12h14M5 17h9" />
  </svg>
);
export const IconVertical = ({ size = 18 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M17 5v14M12 5v14M7 5v9" />
  </svg>
);

/** 枠線なし／あり。写真の外側に線が有るか無いか */
export const IconBorderOff = ({ size = 18 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" opacity="0.35" />
  </svg>
);
export const IconBorderOn = ({ size = 18 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <rect x="3.5" y="3.5" width="17" height="17" />
    <rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" opacity="0.35" />
  </svg>
);

/** 音あり（スピーカーと音の波）。いま音が出ている */
export const IconSound = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />
  </svg>
);

/** 音なし（スピーカーに ×）。いま音が消えている */
export const IconMuted = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </svg>
);

/** 再生（右向きの三角） */
export const IconPlay = ({ size = 22 }: P): React.ReactElement => (
  <svg {...base(size)}>
    <path d="M8 5.5v13l10.5-6.5z" />
  </svg>
);
