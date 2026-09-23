/**
 * 動画かどうか。これだけは最初から要るので、動画の本体（mediabunny を含む。約 600KB）とは分けておく。
 * 本体は動画を選んだときだけ読み込む（写真だけの人の最初の読み込みを重くしない）。
 */
const VIDEO_EXT = /\.(mov|mp4|m4v|webm|mkv|3gp)$/i;
export const isVideoFile = (f: File): boolean => f.type.startsWith('video/') || VIDEO_EXT.test(f.name);
