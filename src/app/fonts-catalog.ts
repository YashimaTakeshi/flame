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

/** 参考アプリの書体に対応する欧文8書体。表示名は参考アプリの呼び名に寄せる */
export const LATIN_FONTS = [
  { key: 'helvetica', label: 'Helvetica', family: 'Arimo' },
  { key: 'futura', label: 'Futura', family: 'Jost' },
  { key: 'din', label: 'DIN', family: 'Oswald' },
  { key: 'copperplate', label: 'Copperplate', family: 'Cinzel' },
  { key: 'didot', label: 'Didot', family: 'PlayfairDisplay' },
  { key: 'georgia', label: 'Georgia', family: 'PTSerif' },
  { key: 'times', label: 'Times', family: 'Tinos' },
  { key: 'baskerville', label: 'Baskerville', family: 'LibreBaskerville' },
] as const;

export type LatinFontKey = (typeof LATIN_FONTS)[number]['key'];

/**
 * 欧文8書体をまとめて読み込む。
 * 遅延にすると、書体を切り替えた瞬間に読み込み待ちが起き、
 * 趣味の選択に過ぎない操作のためにブロッキングの確認を出す羽目になる。
 */
export async function preloadLatinFonts(): Promise<void> {
  const m = await loadManifest();
  await Promise.all(
    LATIN_FONTS.flatMap((f) => {
      const entry = m.latin[f.key];
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

export function fontRefFor(key: LatinFontKey | 'jp', weight: 400 | 700 = 400): FontRef {
  if (key === 'jp') return { family: JP_FAMILY, weight: 400 };
  const f = LATIN_FONTS.find((x) => x.key === key) ?? LATIN_FONTS[0];
  return { family: f.family, weight };
}
