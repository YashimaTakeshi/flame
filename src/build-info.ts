/**
 * この版の素性。
 *
 * 出口は3つある。
 *   1. 画面右下の小さな版表示（押すと自己診断へ）
 *   2. 書き出した画像の EXIF `Software`
 *   3. 自己診断のレポート
 *
 * 2 のおかげで、送られてきた画像 1 枚から版が分かる。
 * 不具合報告に「どの版ですか」と聞き返さずに済む。
 */
export interface BuildInfo {
  readonly version: string;
  readonly commit: string;
  /** 未コミットの変更が混じったビルドか。手元ビルドの取り違えを見分ける */
  readonly dirty: boolean;
  readonly buildTime: string;
  /** 同梱書体の版。書体だけ差し替えたときに変わる */
  readonly fontSetVersion: string;
  /** 地名データの版。データだけ差し替えたときに変わる */
  readonly geoDataVersion: string;
}

export const BUILD_INFO: BuildInfo = __BUILD__;

/** 画面に出す短い表記。例: `v0.1.0` / 未コミット混じりなら `v0.1.0+` */
export const shortVersion = (b: BuildInfo = BUILD_INFO): string =>
  `v${b.version}${b.dirty ? '+' : ''}`;

/** 書き出した画像の EXIF Software に入れる。例: `flame 0.1.0 (a4f2c9e)` */
export const softwareTag = (b: BuildInfo = BUILD_INFO): string =>
  `flame ${b.version}${b.dirty ? '+' : ''} (${b.commit})`;
