/**
 * 動画。読み込み（最初のコマ・撮影情報）と、1コマずつ枠を描いて書き出すところ。
 *
 * 仕組みは写真と同じ。**1コマ＝1枚の写真**として、写真と同じ Scene を同じ描き手で描く。
 * だから枠・文字・刻印の位置は写真のときと一致し、プレビューとも一致する。
 * 動画の読み書きは mediabunny（WebCodecs の上に載る。端末の中だけで完結し、どこにも送らない）。
 *
 * 書き出しの入れ物と音声の扱いは planExport が決める（端末が書けるものと、元の音声の形式から）:
 *   - MP4（H.264）… 第一。iPhone の Safari・PC の Chrome/Edge/Safari。写真アプリにそのまま入る
 *       音声が AAC（iPhone・多くのカメラ）なら **作り直さずそのまま写す**。それ以外は AAC に作り直す
 *   - MOV（H.264 ＋ 非圧縮音声）… 音声が非圧縮（富士の MOV など）で、AAC に作り直せない端末のとき
 *   - WebM（VP9 ＋ Opus）… H.264 を書けない環境、または MP4 では音声を残せないが WebM なら残せる環境
 * 音声が複数入っていることがある（iPhone 16 の空間オーディオは、読めない形式の音声を別に持つ）。
 * **読めて入れられる音声を選ぶ**。どれも入れられなければ落として、そう告げる。
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
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type ConversionAudioOptions,
  type InputAudioTrack,
  type InputVideoTrack,
  type MetadataTags,
} from 'mediabunny';
import { parseWallClock, wallClockFromDate, type WallClock } from '../core/wallclock';
import { createVerifiedCanvas, encodeCanvas, release, type AnyCanvas, type Ctx } from '../render/guards';
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
    const [end, first, tags, audios, stats] = await Promise.all([
      input.computeDuration([track]),
      track.getFirstTimestamp(),
      input.getMetadataTags().catch(() => ({}) as MetadataTags),
      input.getAudioTracks(),
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
      // computeDuration は「終わりの時刻」。始まりが 0 でない動画もあるので差を取る
      duration: Math.max(0, end - Math.max(0, first)),
      frameRate: stats && stats.averagePacketRate > 0 ? stats.averagePacketRate : null,
      hasAudio: audios.length > 0,
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

/* ── 書き出しの計画 ─────────────────────────────────────────── */

/** 元の音声1本。codec は分からなければ null（iPhone 16 の空間オーディオ APAC など） */
export interface AudioCandidate {
  readonly id: number;
  readonly codec: string | null;
  /** この端末で読める（作り直すなら必要。そのまま写すだけなら要らない） */
  readonly decodable: boolean;
}

/** この端末が作れる形式 */
export interface EncodeCaps {
  readonly avc: boolean;
  readonly vp9: boolean;
  readonly aac: boolean;
  readonly opus: boolean;
}

export type Container = 'mp4' | 'mov' | 'webm';

export interface ExportPlan {
  readonly container: Container;
  readonly video: 'avc' | 'vp9';
  /** 入れる音声。null なら映像だけ */
  readonly audio: { readonly id: number; readonly mode: 'copy' | 'transcode'; readonly codec: string } | null;
}

const isPcm = (c: string | null): boolean => c !== null && c.startsWith('pcm-');

/**
 * 入れ物と音声の扱いを決める。純粋な関数（端末の能力と元の音声の形式だけを見る）。
 *
 * 優先の順:
 *   1. MP4 に AAC をそのまま写す（iPhone・多くのカメラ。作り直さないので端末を選ばず、音も変わらない）
 *   2. MP4 に AAC を作り直して入れる（読める音声があり、AAC を作れる端末）
 *   3. MOV に非圧縮音声をそのまま写す（富士の MOV など。AAC を作れない端末でも Apple の写真アプリで鳴る）
 *   4. WebM に Opus（そのまま／作り直し）（MP4 では音声を残せないが WebM なら残せる環境）
 *   5. MP4 で映像だけ（音声は落として告げる）
 * H.264 を書けなければ WebM（VP9）。どちらも書けなければ null（書き出せない）。
 */
export function planExport(audios: readonly AudioCandidate[], caps: EncodeCaps): ExportPlan | null {
  const known = audios.filter((a) => a.codec !== null);
  const first = <T>(xs: readonly T[]): T | undefined => xs[0];

  const opusPlan = (): ExportPlan | null => {
    const copy = first(known.filter((a) => a.codec === 'opus'));
    if (copy) return { container: 'webm', video: 'vp9', audio: { id: copy.id, mode: 'copy', codec: 'opus' } };
    const tr = caps.opus ? first(known.filter((a) => a.decodable)) : undefined;
    if (tr) return { container: 'webm', video: 'vp9', audio: { id: tr.id, mode: 'transcode', codec: 'opus' } };
    return null;
  };

  if (caps.avc) {
    const aac = first(known.filter((a) => a.codec === 'aac'));
    if (aac) return { container: 'mp4', video: 'avc', audio: { id: aac.id, mode: 'copy', codec: 'aac' } };
    const tr = caps.aac ? first(known.filter((a) => a.decodable)) : undefined;
    if (tr) return { container: 'mp4', video: 'avc', audio: { id: tr.id, mode: 'transcode', codec: 'aac' } };
    const pcm = first(known.filter((a) => isPcm(a.codec)));
    if (pcm) return { container: 'mov', video: 'avc', audio: { id: pcm.id, mode: 'copy', codec: pcm.codec! } };
    if (caps.vp9) {
      const webm = opusPlan();
      if (webm) return webm;
    }
    return { container: 'mp4', video: 'avc', audio: null };
  }
  if (caps.vp9) return opusPlan() ?? { container: 'webm', video: 'vp9', audio: null };
  return null;
}

const FORMAT: Record<Container, { mime: string; make: () => Mp4OutputFormat | MovOutputFormat | WebMOutputFormat }> = {
  mp4: { mime: 'video/mp4', make: () => new Mp4OutputFormat({ fastStart: 'in-memory' }) },
  mov: { mime: 'video/quicktime', make: () => new MovOutputFormat({ fastStart: 'in-memory' }) },
  webm: { mime: 'video/webm', make: () => new WebMOutputFormat() },
};

export interface VideoExport {
  readonly blob: Blob;
  readonly ext: Container;
  /** 音声: 入れた／入れられなかった／元から無い */
  readonly audio: 'kept' | 'dropped' | 'none';
  /** 書き出した長さ（秒） */
  readonly seconds: number;
  /** 上限で切ったか */
  readonly trimmed: boolean;
  /** 書き出した最初のコマ（JPEG）。結果の画面で、再生する前に見せる */
  readonly poster: Blob | null;
}

export interface VideoExportOptions {
  /** 書き出す大きさ（偶数）。evenSize で決める */
  readonly width: number;
  readonly height: number;
  /** 1コマ描く。frame は向きを反映した1コマ（写真の代わりに Scene の photo に渡す） */
  readonly render: (frame: CanvasImageSource, ctx: Ctx) => void;
  readonly onProgress?: (ratio: number) => void;
  /** 描き上がったコマ。書き出しの最中に映像を見せるため（受け取った側で間引く） */
  readonly onFrame?: (frame: AnyCanvas) => void;
  readonly signal?: AbortSignal;
  readonly maxSeconds?: number;
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

async function candidatesOf(tracks: readonly InputAudioTrack[]): Promise<AudioCandidate[]> {
  return Promise.all(
    tracks.map(async (t) => ({
      id: t.id,
      codec: await t.getCodec().catch(() => null),
      decodable: await t.canDecode().catch(() => false),
    })),
  );
}

export async function exportVideo(file: Blob, o: VideoExportOptions): Promise<VideoExport> {
  const max = o.maxSeconds ?? MAX_VIDEO_SECONDS;
  const input = openInput(file);
  const out = createVerifiedCanvas(o.width, o.height);
  if (!out.ok) throw new VideoError(`この大きさの動画を作れませんでした（${o.width}×${o.height}）`);
  let frameCanvas: ReturnType<typeof createVerifiedCanvas> | null = null;
  try {
    const track = await primaryVideo(input);
    const audioTracks = await input.getAudioTracks();
    const [caps, candidates] = await Promise.all([
      (async (): Promise<EncodeCaps> => ({
        avc: await canEncodeVideo('avc', { width: o.width, height: o.height }),
        vp9: await canEncodeVideo('vp9', { width: o.width, height: o.height }),
        aac: await canEncodeAudio('aac'),
        opus: await canEncodeAudio('opus'),
      }))(),
      candidatesOf(audioTracks),
    ]);
    const plan = planExport(candidates, caps);
    if (!plan) throw new VideoError('この端末では動画を書き出せません（動画を作る機能に対応していません）');
    const chosen = plan.audio ? audioTracks.find((t) => t.id === plan.audio!.id) ?? null : null;

    // 長さは、使う映像と音声で測る（使わない音声が長いこともある）
    const used = chosen ? [track, chosen] : [track];
    const [endTs, firstTs] = await Promise.all([input.computeDuration(used), input.getFirstTimestamp(used)]);
    const start = Math.max(0, firstTs);
    const length = Math.max(0, endTs - start);
    const trimmed = length > max + 0.05;

    const fw = track.displayWidth;
    const fh = track.displayHeight;
    frameCanvas = createVerifiedCanvas(fw, fh);
    if (!frameCanvas.ok) throw new VideoError(`動画のコマを扱えませんでした（${fw}×${fh}）`);
    const fctx = frameCanvas.ctx;
    const fcanvas = frameCanvas.canvas;

    const fmt = FORMAT[plan.container];
    const output = new Output({ format: fmt.make(), target: new BufferTarget() });
    let poster: Promise<Blob | null> | null = null;
    const audioOptions = (t: InputAudioTrack): ConversionAudioOptions => {
      if (!plan.audio || t.id !== plan.audio.id) return { discard: true };
      /*
       * ★品質を指定しない。★ 指定すると mediabunny は必ず作り直す（写せる AAC も作り直し、
       * AAC を作れない端末では音声ごと落ちる。実機で「音が出ない」の原因になった）。
       * そのまま写すときは何も指定しない。作り直すときも既定の品質（高）で作られる
       */
      return plan.audio.mode === 'copy' ? {} : { codec: plan.audio.codec as 'aac' | 'opus' };
    };
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'all',
      showWarnings: false,
      ...(trimmed ? { trim: { start, end: start + max } } : {}),
      tags: keepTags,
      video: (t) =>
        t.id !== track.id
          ? { discard: true }
          : {
              codec: plan.video,
              quality: QUALITY_HIGH,
              forceTranscode: true,
              // 向きは描く側で反映する（下の sample.draw）。出力には回転の印を付けない
              allowTransformationMetadata: false,
              processedWidth: o.width,
              processedHeight: o.height,
              process: async (sample) => {
                // 1コマを向きどおりに描き、写真の代わりにして枠ごと描く
                fctx.clearRect(0, 0, fw, fh);
                sample.draw(fctx, 0, 0, fw, fh);
                o.render(fcanvas, out.ctx);
                // 最初のコマを結果の画面の表紙にする（中身は呼んだ時点のものが写る）
                if (!poster) {
                  poster = encodeCanvas(out.canvas, 'image/jpeg', 0.85);
                  await poster;
                }
                o.onFrame?.(out.canvas);
                return out.canvas;
              },
            },
      audio: audioOptions,
    });
    if (!conversion.isValid) throw new VideoError('この動画は書き出せませんでした（形式の組み合わせに対応していません）');
    const audioKept = conversion.utilizedTracks.some((t) => t.type === 'audio');

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
      ext: plan.container,
      audio: audioTracks.length === 0 ? 'none' : audioKept ? 'kept' : 'dropped',
      seconds: trimmed ? max : length,
      trimmed,
      poster: poster ? await (poster as Promise<Blob | null>).catch(() => null) : null,
    };
  } catch (e) {
    throw e instanceof VideoError ? e : new VideoError(`動画を書き出せませんでした: ${e instanceof Error ? e.message : String(e)}`, e);
  } finally {
    release(out.canvas);
    if (frameCanvas?.ok) release(frameCanvas.canvas);
    input.dispose();
  }
}
