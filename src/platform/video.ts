/**
 * 動画。読み込み（最初のコマ・撮影情報）と、1コマずつ枠を描いて書き出すところ。
 *
 * 仕組みは写真と同じ。**1コマ＝1枚の写真**として、写真と同じ Scene を同じ描き手で描く。
 * だから枠・文字・刻印の位置は写真のときと一致し、プレビュー（最初のコマ）とも一致する。
 * 動画の読み書きは mediabunny（WebCodecs の上に載る。端末の中だけで完結し、どこにも送らない）。
 *
 * 書き出しの形式は端末が書けるものから選ぶ:
 *   1. MP4（H.264 ＋ AAC）… iPhone の Safari・PC の Chrome/Edge/Safari。写真アプリにもそのまま入る
 *   2. WebM（VP9 ＋ Opus）… H.264 を書けない環境（一部の Chromium・Firefox）
 * 音声はそのまま写せるときは写し（iPhone の AAC は写せる）、写せず作り直せもしないときは落として知らせる。
 *
 * 長さの上限は MAX_VIDEO_SECONDS。書き出しは端末のメモリに溜めるので、長すぎると iPhone で落ちる。
 * 上限より長い動画は先頭から上限までを書き出し、そのことを告げる。
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type InputVideoTrack,
  type MetadataTags,
} from 'mediabunny';
import { parseWallClock, wallClockFromDate, type WallClock } from '../core/wallclock';
import { createVerifiedCanvas, release, type Ctx } from '../render/guards';
import { decodeSource, type DecodedPhoto } from './decode';

/** 書き出せる長さの上限（秒）。書き出しは端末のメモリに溜まる（1分で 60〜90MB） */
export const MAX_VIDEO_SECONDS = 60;
/** 書き出しの長辺。SNS の縦動画（1080×1920）に合わせる */
export const VIDEO_LONG_EDGE = 1920;

export class VideoError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'VideoError';
  }
}


/** 動画に入っている撮影情報。写真の EXIF ほど揃わない（露出は入っていない） */
export interface VideoMeta {
  readonly camera: string | null;
  readonly lens: string | null;
  readonly dateTaken: WallClock | null;
  readonly gps: { readonly lat: number; readonly lng: number } | null;
}

export interface OpenedVideo {
  /** 最初のコマ。プレビューと編集はこの1枚で行う（写真と同じ扱い） */
  readonly poster: DecodedPhoto;
  /** 長さ（秒） */
  readonly duration: number;
  readonly frameRate: number | null;
  readonly hasAudio: boolean;
  readonly meta: VideoMeta;
}

const textOf = (v: unknown): string | null => {
  if (typeof v === 'string') return v.trim() || null;
  if (v instanceof Uint8Array && v.length > 4) {
    // QuickTime の udta の文字（先頭 2 バイトが長さ、次の 2 バイトが言語）
    const len = (v[0]! << 8) | v[1]!;
    const body = len > 0 && len + 4 <= v.length ? v.subarray(4, 4 + len) : v;
    const s = new TextDecoder().decode(body).replace(/\0/g, '').trim();
    // 制御文字が混じるなら文字ではない（中身の形式が違う）
    return s && ![...s].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f) ? s : null;
  }
  return null;
};

/** "+34.2959+132.3197+003.000/" のような ISO 6709 */
function parseIso6709(v: string | null): { lat: number; lng: number } | null {
  const m = v ? /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(v) : null;
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** 「Apple iPhone 16 Pro」のような重複を畳む（写真の EXIF と同じ規則） */
function cameraName(make: string | null, model: string | null): string | null {
  if (!model) return make;
  if (!make) return model;
  return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`;
}

/**
 * 撮影情報を拾う。iPhone は 'com.apple.quicktime.*' の鍵に入れる。
 * 撮影日時は iPhone の creationdate（"2026-09-21T13:05:00+0900"）なら**壁時計のまま**読む（§4.4）。
 * それが無ければ入れ物の作成日時（世界時）を端末の時刻に直す（これは近似）。
 */
export function metaFromTags(tags: MetadataTags): VideoMeta {
  const raw = tags.raw ?? {};
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const t = textOf(raw[k]);
      if (t) return t;
    }
    return null;
  };
  const make = pick('com.apple.quicktime.make', '©mak');
  const model = pick('com.apple.quicktime.model', '©mod');
  const lens = pick('com.apple.quicktime.camera.lens_model');
  const created = pick('com.apple.quicktime.creationdate');
  const date = parseWallClock(created) ?? (tags.date && !Number.isNaN(tags.date.getTime()) ? wallClockFromDate(tags.date) : null);
  return {
    camera: cameraName(make, model),
    lens,
    dateTaken: date,
    gps: parseIso6709(pick('com.apple.quicktime.location.ISO6709', '©xyz')),
  };
}

async function primaryVideo(input: Input): Promise<InputVideoTrack> {
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new VideoError('この動画には映像が入っていません');
  if (!(await track.canDecode())) {
    throw new VideoError('この端末ではこの動画を読めません（圧縮の形式に対応していません）');
  }
  return track;
}

const openInput = (file: Blob): Input => new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

export async function openVideo(file: Blob, opt?: { readonly posterWidth?: number }): Promise<OpenedVideo> {
  const input = openInput(file);
  try {
    if (!(await input.canRead().catch(() => false))) throw new VideoError('この動画を開けませんでした');
    const track = await primaryVideo(input);
    const [duration, first, tags, audio, stats] = await Promise.all([
      input.computeDuration(),
      track.getFirstTimestamp(),
      input.getMetadataTags().catch(() => ({}) as MetadataTags),
      input.getPrimaryAudioTrack(),
      track.computePacketStats(60).catch(() => null),
    ]);
    // 最初のコマ。向き（回転）は CanvasSink が反映する
    const sink = new CanvasSink(track, { poolSize: 1 });
    const frame = await sink.getCanvas(first);
    if (!frame) throw new VideoError('動画の最初のコマを取り出せませんでした');
    const natural = { w: track.displayWidth, h: track.displayHeight };
    const poster = await decodeSource(frame.canvas, natural, opt?.posterWidth ? { resizeWidth: opt.posterWidth } : undefined);
    return {
      poster,
      duration: Math.max(0, duration - Math.max(0, first)),
      frameRate: stats && stats.averagePacketRate > 0 ? stats.averagePacketRate : null,
      hasAudio: audio !== null,
      meta: metaFromTags(tags),
    };
  } catch (e) {
    throw e instanceof VideoError ? e : new VideoError('この動画を開けませんでした', e);
  } finally {
    input.dispose();
  }
}

/** 長辺が longEdge 以下で、縦横とも偶数になる大きさ（H.264 は奇数を受けない） */
export function evenSize(aspect: number, longEdge: number): { w: number; h: number } {
  for (let L = Math.floor(longEdge / 2) * 2; L >= 16; L -= 2) {
    const w = aspect >= 1 ? L : Math.round(L * aspect);
    const h = aspect >= 1 ? Math.round(L / aspect) : L;
    if (w % 2 === 0 && h % 2 === 0) return { w, h };
  }
  return { w: 16, h: 16 };
}

export interface VideoExport {
  readonly blob: Blob;
  readonly ext: 'mp4' | 'webm';
  /** 音声: 入れた／入れられなかった／元から無い */
  readonly audio: 'kept' | 'dropped' | 'none';
  /** 書き出した長さ（秒） */
  readonly seconds: number;
  /** 上限で切ったか */
  readonly trimmed: boolean;
}

export interface VideoExportOptions {
  /** 書き出す大きさ（偶数）。evenSize で決める */
  readonly width: number;
  readonly height: number;
  /** 1コマ描く。frame は向きを反映した1コマ（写真の代わりに Scene の photo に渡す） */
  readonly render: (frame: CanvasImageSource, ctx: Ctx) => void;
  readonly onProgress?: (ratio: number) => void;
  readonly signal?: AbortSignal;
  readonly maxSeconds?: number;
}

async function pickFormat(w: number, h: number): Promise<{
  format: Mp4OutputFormat | WebMOutputFormat;
  video: 'avc' | 'vp9';
  audio: 'aac' | 'opus';
  ext: 'mp4' | 'webm';
  mime: string;
}> {
  if (await canEncodeVideo('avc', { width: w, height: h })) {
    return { format: new Mp4OutputFormat({ fastStart: 'in-memory' }), video: 'avc', audio: 'aac', ext: 'mp4', mime: 'video/mp4' };
  }
  if (await canEncodeVideo('vp9', { width: w, height: h })) {
    return { format: new WebMOutputFormat(), video: 'vp9', audio: 'opus', ext: 'webm', mime: 'video/webm' };
  }
  throw new VideoError('この端末では動画を書き出せません（動画を作る機能に対応していません）');
}

/**
 * 写す撮影情報。位置は写さない（写真の書き戻しと同じ。§11.8）。
 * 撮影日時・機種は残す（写真アプリで撮った日の位置に並ぶ）
 */
function keepTags(t: MetadataTags): MetadataTags {
  const raw = t.raw ?? {};
  const keep: Record<string, string> = {};
  for (const k of ['com.apple.quicktime.make', 'com.apple.quicktime.model', 'com.apple.quicktime.creationdate']) {
    const v = raw[k];
    if (typeof v === 'string') keep[k] = v;
  }
  return { ...(t.date ? { date: t.date } : {}), ...(Object.keys(keep).length ? { raw: keep } : {}) };
}

export async function exportVideo(file: Blob, o: VideoExportOptions): Promise<VideoExport> {
  const max = o.maxSeconds ?? MAX_VIDEO_SECONDS;
  const input = openInput(file);
  const out = createVerifiedCanvas(o.width, o.height);
  if (!out.ok) throw new VideoError(`この大きさの動画を作れませんでした（${o.width}×${o.height}）`);
  let frameCanvas: ReturnType<typeof createVerifiedCanvas> | null = null;
  try {
    const track = await primaryVideo(input);
    const [duration, first, audioTrack] = await Promise.all([
      input.computeDuration(),
      input.getFirstTimestamp(),
      input.getPrimaryAudioTrack(),
    ]);
    const fmt = await pickFormat(o.width, o.height);
    // 音声は写せるなら写す。作り直しが要るのに作れない端末なら落とす（下で知らせる）
    const audioOk = audioTrack ? (audioTrack.codec === fmt.audio || (await canEncodeAudio(fmt.audio))) : false;

    const fw = track.displayWidth;
    const fh = track.displayHeight;
    frameCanvas = createVerifiedCanvas(fw, fh);
    if (!frameCanvas.ok) throw new VideoError(`動画のコマを扱えませんでした（${fw}×${fh}）`);
    const fctx = frameCanvas.ctx;
    const fcanvas = frameCanvas.canvas;

    const start = Math.max(0, first);
    const end = Math.min(first + duration, start + max);
    const trimmed = start + duration > end + 0.05;
    const output = new Output({ format: fmt.format, target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      showWarnings: false,
      trim: { start, end },
      tags: keepTags,
      video: {
        codec: fmt.video,
        quality: QUALITY_HIGH,
        forceTranscode: true,
        // 向きは描く側で反映する（下の sample.draw）。出力には回転の印を付けない
        allowTransformationMetadata: false,
        processedWidth: o.width,
        processedHeight: o.height,
        process: (sample) => {
          // 1コマを向きどおりに描き、写真の代わりにして枠ごと描く
          fctx.clearRect(0, 0, fw, fh);
          sample.draw(fctx, 0, 0, fw, fh);
          o.render(fcanvas, out.ctx);
          return out.canvas;
        },
      },
      audio: audioOk ? { codec: fmt.audio, quality: QUALITY_HIGH } : { discard: true },
    });
    if (!conversion.isValid) throw new VideoError('この動画は書き出せませんでした（形式の組み合わせに対応していません）');
    const audioKept = audioTrack !== null && conversion.utilizedTracks.some((t) => t.type === 'audio');

    if (o.onProgress) conversion.onProgress = (p) => o.onProgress?.(Math.min(1, Math.max(0, p)));
    const onAbort = (): void => void conversion.cancel();
    o.signal?.addEventListener('abort', onAbort);
    try {
      await conversion.execute();
    } catch (e) {
      // 取りやめの例外は途中の段によって種類が違う（出力側が先に止まることもある）。合図そのものを見る
      if (e instanceof ConversionCanceledError || o.signal?.aborted) throw new VideoError('書き出しを取りやめました', e);
      throw e;
    } finally {
      o.signal?.removeEventListener('abort', onAbort);
    }
    const buf = (output.target as BufferTarget).buffer;
    if (!buf) throw new VideoError('動画を書き出せませんでした');
    return {
      blob: new Blob([buf], { type: fmt.mime }),
      ext: fmt.ext,
      audio: audioTrack === null ? 'none' : audioKept ? 'kept' : 'dropped',
      seconds: end - start,
      trimmed,
    };
  } catch (e) {
    throw e instanceof VideoError ? e : new VideoError(`動画を書き出せませんでした: ${e instanceof Error ? e.message : String(e)}`, e);
  } finally {
    release(out.canvas);
    if (frameCanvas?.ok) release(frameCanvas.canvas);
    input.dispose();
  }
}
