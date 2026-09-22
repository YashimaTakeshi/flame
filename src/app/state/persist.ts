/**
 * 設定の保存と読み戻し。
 *
 * **保存するのは「好み」だけで、「その写真のこと」は保存しない。**
 * 書体・地色・配置・刻印の決め方は次に開いたときも同じであってほしい。
 * けれどタイトル・切り取りの位置・カメラ名の手入力は、その1枚に属する話で、
 * 別の写真に持ち越すと毎回消して回ることになる。
 *
 * 読み戻しは**1項目ずつ検証する**。版を上げて選択肢が消えても、
 * 壊れた1項目のために全部の設定を失わない（その項目だけ既定に戻る）。
 */
import { normalize } from '../../core/styles/spec';
import type { BadgeMode, BadgeSize } from '../../core/badge';
import type { BandSide } from '../../core/styles/layout';
import type {
  Align,
  CaptionAlign,
  CaptionPlace,
  FieldId,
  LineCount,
  MarginId,
  PhotoPlace,
  Ratio,
  SizeId,
  StyleSpec,
  TrackingId,
} from '../../core/styles/types';
import { DATE_FORMATS, type DateFormatId } from '../../core/wallclock';
import { LATIN_FONTS, type LatinFontKey } from '../fonts-catalog';
import { KEYS, safeStorage } from '../../platform/storage';

/** 保存する項目。DocState のうち「好み」だけ */
export interface Saved {
  readonly style: StyleSpec;
  readonly artist: string;
  readonly fontKey: LatinFontKey | 'jp';
  readonly colorKey: string;
  readonly align: Align;
  readonly tracking: TrackingId;
  readonly size: SizeId;
  readonly bordered: boolean;
  readonly fields: Readonly<Record<FieldId, boolean>>;
  readonly dateFormat: DateFormatId;
  readonly badge: BadgeMode;
  readonly badgePlace: BandSide;
  readonly badgeAlign: Align;
  readonly badgeValign: CaptionAlign;
  readonly badgeSize: BadgeSize;
  readonly badgeFramed: boolean;
}

/* ── 1項目ずつの検証 ───────────────────────────────────── */

const RATIOS = ['OR', 'SQ', 'TF', 'FF', 'NST', 'STN'] as const satisfies readonly Ratio[];
const PHOTOS = ['center', 'top', 'bottom', 'left', 'right'] as const satisfies readonly PhotoPlace[];
const CAPTIONS = ['above', 'below', 'left', 'right', 'overlay'] as const satisfies readonly CaptionPlace[];
const CAP_ALIGNS = ['start', 'center', 'end'] as const satisfies readonly CaptionAlign[];
const LINES = [1, 2, 3] as const satisfies readonly LineCount[];
const MARGINS = ['narrow', 'normal', 'wide', 'none'] as const satisfies readonly MarginId[];
const ALIGNS = ['left', 'center', 'right'] as const satisfies readonly Align[];
const TRACKS = ['Tight', 'Normal', 'Wide', 'Widest'] as const satisfies readonly TrackingId[];
const SIZES = ['Small', 'Medium', 'Large'] as const satisfies readonly SizeId[];
const BADGES = ['none', 'text', 'logo'] as const satisfies readonly BadgeMode[];
const BADGE_SIZES = ['S', 'M', 'L'] as const satisfies readonly BadgeSize[];
const SIDES = ['above', 'below', 'left', 'right'] as const satisfies readonly BandSide[];
/** 書体は目録が正。目録から消えた書体が保存に残っていても、既定に戻るだけで済む */
const FONT_KEYS: readonly (LatinFontKey | 'jp')[] = [...LATIN_FONTS.map((f) => f.key), 'jp'];

/** 決まった選択肢のどれかなら採り、違えば既定に戻す */
const one = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** 書体と地色の名前は目録が正。ここでは形だけ見て、知らない名前は読み手が既定に落とす */
const text = (v: unknown, fallback: string, max: number): string =>
  typeof v === 'string' && v.length <= max ? v : fallback;

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function readStyle(v: unknown, fallback: StyleSpec): StyleSpec {
  const o = asRecord(v);
  // 6軸は互いに縛り合う（余白なしなら重ね、など）。読んだあと必ず正規化する
  return normalize({
    ratio: one(o['ratio'], RATIOS, fallback.ratio),
    photo: one(o['photo'], PHOTOS, fallback.photo),
    caption: one(o['caption'], CAPTIONS, fallback.caption),
    captionAlign: one(o['captionAlign'], CAP_ALIGNS, fallback.captionAlign),
    lines: one(o['lines'], LINES, fallback.lines),
    margin: one(o['margin'], MARGINS, fallback.margin),
  });
}

function readFields(
  v: unknown,
  fallback: Readonly<Record<FieldId, boolean>>,
): Readonly<Record<FieldId, boolean>> {
  const o = asRecord(v);
  const out: Record<string, boolean> = {};
  // 既定にある項目だけを読む。将来増えた項目は既定のまま（保存に無くても消えない）
  for (const [k, def] of Object.entries(fallback)) out[k] = bool(o[k], def);
  return out as Record<FieldId, boolean>;
}

export function readSaved(raw: string | null, defaults: Saved): Saved {
  if (!raw) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults; // 壊れていたら既定から始める。起動を止めない
  }
  const o = asRecord(parsed);
  return {
    style: readStyle(o['style'], defaults.style),
    artist: text(o['artist'], defaults.artist, 120),
    fontKey: one(o['fontKey'], FONT_KEYS, defaults.fontKey),
    colorKey: text(o['colorKey'], defaults.colorKey, 40),
    align: one(o['align'], ALIGNS, defaults.align),
    tracking: one(o['tracking'], TRACKS, defaults.tracking),
    size: one(o['size'], SIZES, defaults.size),
    bordered: bool(o['bordered'], defaults.bordered),
    fields: readFields(o['fields'], defaults.fields),
    dateFormat: one(o['dateFormat'], DATE_FORMATS, defaults.dateFormat),
    badge: one(o['badge'], BADGES, defaults.badge),
    badgePlace: one(o['badgePlace'], SIDES, defaults.badgePlace),
    badgeAlign: one(o['badgeAlign'], ALIGNS, defaults.badgeAlign),
    badgeValign: one(o['badgeValign'], CAP_ALIGNS, defaults.badgeValign),
    badgeSize: one(o['badgeSize'], BADGE_SIZES, defaults.badgeSize),
    badgeFramed: bool(o['badgeFramed'], defaults.badgeFramed),
  };
}

export const loadSettings = (defaults: Saved): Saved =>
  readSaved(safeStorage.get(KEYS.settings), defaults);

/**
 * 書き込みはまとめる。ホイールを回すと1回の操作で何度も値が変わるので、
 * そのたびに localStorage へ書くと指に引っかかる。
 *
 * ★同じ中身で待ち時間を延ばしてはいけない。★
 * 見張っているのは設定そのものではなく store 全体なので、写真を指で動かしている間も
 * 呼ばれ続ける。そのたびに待ち直すと、指を離すまで一度も保存されない
 * （全面で構図を決めている最中に閉じると設定が消える）。
 * だから「いま待っている中身」と同じ呼び出しは何もしない。
 */
const WRITE_DELAY_MS = 400;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: string | null = null;
let lastWritten: string | null = null;

function write(json: string): void {
  timer = null;
  pending = null;
  lastWritten = json;
  safeStorage.set(KEYS.settings, json);
}

export function saveSettings(s: Saved): void {
  const json = JSON.stringify(s);
  if (json === lastWritten || json === pending) return; // 書いた／待っている中身と同じ
  if (timer) clearTimeout(timer);
  pending = json;
  timer = setTimeout(() => write(json), WRITE_DELAY_MS);
}

/**
 * 待っている書き込みを今すぐ済ませる。
 * 画面が隠れるときに呼ぶ。iOS は裏に回った頁を黙って終わらせるので、
 * 待ち時間の 400ms が返ってこないことがある。
 */
export function flushSettings(): void {
  if (!timer || pending === null) return;
  clearTimeout(timer);
  write(pending);
}

/** テスト用。溜めている書き込みを捨てる */
export function __resetSaveForTest(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  lastWritten = null;
}
