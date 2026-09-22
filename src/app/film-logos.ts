/**
 * 仕上がりの札（フィルムシミュレーションのロゴ画像）を読み込む。
 *
 * 札は EXIF から読み取った名前で引く。名前は目録が正で、コードにファイル名は書かない
 * （差し替えで名前も大きさも変わりうる）。
 *
 * **縦横比を先に知る。** 組み上がりの寸法は画像が届く前に決まるので、
 * 目録の w/h から比だけを取り出して core に渡す。画像そのものは描くときにだけ要る。
 *
 * 札を持たない名前（他社の「ビビッド」など、富士でも一部）は null を返す。
 * 呼ぶ側はそのとき文字の札に落とす。
 */
import { netFetch } from '../platform/net';

interface LogoEntry {
  readonly file: string;
  readonly w: number;
  readonly h: number;
}

interface FilmManifest {
  readonly logos: Readonly<Record<string, LogoEntry>>;
}

/** 描画命令に載せる識別子。実行層はこの前置きで札だと見分ける */
export const FILM_ID_PREFIX = 'film:';

let manifest: FilmManifest | null = null;
let manifestPromise: Promise<FilmManifest | null> | null = null;
const images = new Map<string, CanvasImageSource>();
const loading = new Map<string, Promise<boolean>>();

/** 「ACROS +R」→「ACROS」。フィルターの記号は札には無い */
const baseName = (name: string): string => name.replace(/\s\+\w+$/, '').trim();

async function loadManifest(): Promise<FilmManifest | null> {
  if (manifest) return manifest;
  manifestPromise ??= netFetch('film/manifest.json', {}, { kind: 'app' })
    .then(async (res) => {
      if (!res.ok) return null;
      const m = (await res.json()) as FilmManifest;
      manifest = m;
      return m;
    })
    .catch(() => null); // 札が無くても編集は続けられる。文字の札に落ちるだけ
  return manifestPromise;
}

/** 描ける札。識別子と縦横比だけ。絵そのものは実行層の籠の中 */
export interface FilmLogo {
  readonly id: string;
  readonly aspect: number;
}

/** 実行層が識別子から画像を引く */
export const filmLogoImage = (id: string): CanvasImageSource | null => images.get(id) ?? null;

function decodeImage(url: string): Promise<CanvasImageSource> {
  return new Promise((ok, ng) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => ok(img);
    img.onerror = () => ng(new Error(`札を読み込めませんでした: ${url}`));
    img.src = url;
  });
}

/**
 * その名前の札を用意して返す。札が無い名前・読めなかった名前は null。
 *
 * **読めているかどうかも含めて、返り値だけで分かるようにする。**
 * 呼ぶ側（画面）が籠の中を覗かずに済み、「籠は変わったのに描き直されない」が起きない。
 * 同じ名前を二重に取りに行かない。
 */
export async function ensureFilmLogo(name: string): Promise<FilmLogo | null> {
  const key = baseName(name);
  if (key === '') return null;
  const id = FILM_ID_PREFIX + key;

  const m = await loadManifest();
  const e = m?.logos[key];
  if (!e) return null;
  const logo: FilmLogo = { id, aspect: e.w / e.h };
  if (images.has(id)) return logo;

  // すでに取りに行っている最中なら、そちらの結果を待つ
  const inflight = loading.get(id);
  if (inflight) return (await inflight) ? logo : null;

  const job = decodeImage(new URL(e.file, document.baseURI).href)
    .then((img) => {
      images.set(id, img);
      return true;
    })
    .catch(() => false) // 読めなければ名前の札のまま。編集は止めない
    .finally(() => loading.delete(id));
  loading.set(id, job);
  return (await job) ? logo : null;
}

/** テスト用 */
export function __resetFilmLogosForTest(): void {
  manifest = null;
  manifestPromise = null;
  images.clear();
  loading.clear();
}
