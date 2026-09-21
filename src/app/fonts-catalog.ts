/**
 * 同梱書体の目録を読んで、書体を読み込む。
 *
 * ファイル名をコードに直書きしない。サブセットを作り直すとサイズもファイル名も
 * 変わりうるので、public/fonts/manifest.json を正とする。
 */
import { netFetch } from '../platform/net';
import { ensureFont, type FontRef } from '../render/resources/fonts';

interface FontFile {
  readonly file: string;
  readonly bytes: number;
  readonly sha256?: string;
}

interface Manifest {
  readonly latin: Record<string, { family: string; regular: FontFile; bold: FontFile }>;
  readonly jp: { family: string; regular: FontFile; charCount: number };
}

let manifest: Manifest | null = null;

export async function loadManifest(): Promise<Manifest> {
  if (manifest) return manifest;
  const res = await netFetch('fonts/manifest.json', {}, { kind: 'app' });
  if (!res.ok) throw new Error(`書体の目録を読めません (${res.status})`);
  manifest = (await res.json()) as Manifest;
  return manifest;
}

/** 同梱している欧文の書体ファミリ8つ。各ファミリに Regular と Bold がある */
const FAMILIES = [
  { slot: 'helvetica', family: 'Arimo' },
  { slot: 'futura', family: 'Jost' },
  { slot: 'din', family: 'Oswald' },
  { slot: 'copperplate', family: 'Cinzel' },
  { slot: 'didot', family: 'PlayfairDisplay' },
  { slot: 'georgia', family: 'PTSerif' },
  { slot: 'times', family: 'Tinos' },
  { slot: 'baskerville', family: 'LibreBaskerville' },
] as const;

const familyOf = (slot: string): string =>
  FAMILIES.find((f) => f.slot === slot)?.family ?? 'Arimo';

/**
 * 選べる書体。参考アプリの動画で確認できた13項目に和文を足した14。
 *
 * **Bold は「太字にする設定」ではなく、独立した1つの書体として並べる。**
 * 参考アプリがそうしているし、Helvetica と Helvetica Bold は
 * 見た目の性格が別物なので、選ぶ側にとっても別の書体である。
 */
export const LATIN_FONTS = [
  { key: 'helvetica', label: 'Helvetica', family: familyOf('helvetica'), weight: 400 },
  { key: 'helvetica-b', label: 'Helvetica Bold', family: familyOf('helvetica'), weight: 700 },
  { key: 'futura', label: 'Futura', family: familyOf('futura'), weight: 400 },
  { key: 'futura-b', label: 'Futura Bold', family: familyOf('futura'), weight: 700 },
  { key: 'din', label: 'DIN', family: familyOf('din'), weight: 400 },
  { key: 'copperplate', label: 'Copperplate', family: familyOf('copperplate'), weight: 400 },
  { key: 'copperplate-b', label: 'Copperplate Bold', family: familyOf('copperplate'), weight: 700 },
  { key: 'didot', label: 'Didot', family: familyOf('didot'), weight: 400 },
  { key: 'georgia-b', label: 'Georgia Bold', family: familyOf('georgia'), weight: 700 },
  { key: 'times', label: 'Times', family: familyOf('times'), weight: 400 },
  { key: 'times-b', label: 'Times Bold', family: familyOf('times'), weight: 700 },
  { key: 'baskerville', label: 'Baskerville', family: familyOf('baskerville'), weight: 400 },
  { key: 'baskerville-b', label: 'Baskerville SemiBold', family: familyOf('baskerville'), weight: 700 },
] as const satisfies readonly { key: string; label: string; family: string; weight: 400 | 700 }[];

export type LatinFontKey = (typeof LATIN_FONTS)[number]['key'];

/**
 * 欧文8書体をまとめて読み込む。
 * 遅延にすると、書体を切り替えた瞬間に読み込み待ちが起き、
 * 趣味の選択に過ぎない操作のためにブロッキングの確認を出す羽目になる。
 */
export async function preloadLatinFonts(): Promise<void> {
  const m = await loadManifest();
  await Promise.all(
    FAMILIES.flatMap((f) => {
      const entry = m.latin[f.slot];
      if (!entry) return [];
      return [
        ensureFont({ family: entry.family, weight: 400 }, { kind: 'url', url: entry.regular.file }),
        ensureFont({ family: entry.family, weight: 700 }, { kind: 'url', url: entry.bold.file }),
      ];
    }),
  );
}

export const JP_FAMILY = 'NotoSansJP';

/**
 * 和文書体。442KB あるので初回ロードには含めず、選ばれた時点で取りに行く。
 * 欧文だけで使う人には1バイトも転送しない。
 */
export async function ensureJapaneseFont(): Promise<void> {
  const m = await loadManifest();
  await ensureFont({ family: JP_FAMILY, weight: 400 }, { kind: 'url', url: m.jp.regular.file });
}

export function fontRefFor(key: LatinFontKey | 'jp'): FontRef {
  if (key === 'jp') return { family: JP_FAMILY, weight: 400 };
  const f = LATIN_FONTS.find((x) => x.key === key) ?? LATIN_FONTS[0];
  return { family: f.family, weight: f.weight };
}
