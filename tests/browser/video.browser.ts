/**
 * 実ブラウザでの回帰テスト: 動画。
 *
 * 動画の読み書きは WebCodecs に頼るので、模擬では確かめたことにならない。
 * 試験用の動画（tests/fixtures/clip-portrait.webm）は 720×1280・3秒・30fps・音声（Opus）付きで、
 * 赤い四角が左から右へ動く（コマごとに描き直されていることが分かる）。
 *
 * 通る経路は Chromium の版しだい。H.264 を書ける版（CI）は MP4、書けない版は WebM（VP9）。
 * どちらでも同じ期待（大きさ・長さ・枠）で確かめ、音声だけは形式に応じて期待を変える。
 */
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  EncodedAudioPacketSource,
  EncodedPacket,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny';
import { evenSize, exportVideo, openVideo, planExport, VideoError, type EncodeCaps } from '../../src/platform/video';
import { createVerifiedCanvas } from '../../src/render/guards';
import { done, expectEqual, expectTrue, test } from './harness';

const clip = async (): Promise<Blob> => {
  const res = await fetch('./fixtures/clip-portrait.webm');
  if (!res.ok) throw new Error(`取得できません (${res.status})`);
  return await res.blob();
};

/** 枠のつもり: 全体を白で塗り、内側 80% に1コマを置く */
const frameInWhite = (w: number, h: number) => (frame: CanvasImageSource, ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D): void => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(frame, w * 0.1, h * 0.1, w * 0.8, h * 0.8);
};

const capsHere = async (w: number, h: number): Promise<EncodeCaps> => ({
  avc: await canEncodeVideo('avc', { width: w, height: h }),
  vp9: await canEncodeVideo('vp9', { width: w, height: h }),
  aac: await canEncodeAudio('aac'),
  opus: await canEncodeAudio('opus'),
});

/**
 * iPhone に近い試験用の動画を作る: 映像（VP9）＋ AAC ＋ Opus の音声 2 本。
 * AAC はこの環境では作れないので、無音の AAC-LC のコマ（hls.js が使うもの）を直接並べる。
 * そのまま写すだけなら中身を読まないので、これで「AAC をそのまま写す」経路を確かめられる
 */
async function multiAudioClip(): Promise<Blob> {
  const w = 320;
  const h = 568;
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const video = new CanvasSource(canvas, { codec: 'vp9', bitrate: QUALITY_HIGH });
  output.addVideoTrack(video, { frameRate: 30 });
  const aacSource = new EncodedAudioPacketSource('aac');
  output.addAudioTrack(aacSource);
  const opusSource = new AudioBufferSource({ codec: 'opus', bitrate: QUALITY_HIGH });
  output.addAudioTrack(opusSource);
  await output.start();
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `hsl(${i * 6},60%,50%)`;
    ctx.fillRect(0, 0, w, h);
    await video.add(i / 30, 1 / 30);
  }
  video.close();
  const silent = new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]);
  const frameDur = 1024 / 48000;
  for (let i = 0; i * frameDur < 2; i++) {
    await aacSource.add(
      new EncodedPacket(silent, 'key', i * frameDur, frameDur),
      i === 0
        ? { decoderConfig: { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, description: new Uint8Array([0x11, 0x90]) } }
        : undefined,
    );
  }
  aacSource.close();
  const ac = new OfflineAudioContext(2, 48000 * 2, 48000);
  const osc = ac.createOscillator();
  osc.connect(ac.destination);
  osc.start();
  await opusSource.add(await ac.startRendering());
  opusSource.close();
  await output.finalize();
  return new Blob([(output.target as BufferTarget).buffer!], { type: 'video/mp4' });
}

await test('動画を開くと、最初のコマ・長さ・音声の有無が取れる', async () => {
  const v = await openVideo(await clip());
  expectEqual(v.poster.natural.w, 720, '幅');
  expectEqual(v.poster.natural.h, 1280, '高さ');
  expectTrue(Math.abs(v.duration - 3) < 0.1, `長さが約3秒: ${v.duration}`);
  expectTrue(v.hasAudio, '音声がある');
  expectTrue(v.meta.dateTaken !== null, '撮影日時（入れ物の作成日時）が取れる');
  v.poster.bitmap.close();
});

await test('縮めて開いても、原寸は元の大きさのまま', async () => {
  const v = await openVideo(await clip(), { posterWidth: 360 });
  expectEqual(v.poster.size.w, 360, '縮めた幅');
  expectEqual(v.poster.natural.w, 720, '原寸の幅');
  v.poster.bitmap.close();
});

await test('★1コマずつ描いて書き出す。大きさ・長さ・音声が保たれ、枠が入る★', async () => {
  const src = await clip();
  const { w, h } = evenSize(720 / 1280, 960);
  expectTrue(w % 2 === 0 && h % 2 === 0, `偶数: ${w}×${h}`);
  let frames = 0;
  let last = -1;
  const draw = frameInWhite(w, h);
  const out = await exportVideo(src, {
    width: w,
    height: h,
    render: (f, ctx) => {
      frames++;
      draw(f, ctx);
    },
    onProgress: (p) => {
      if (p < last) throw new Error('進み具合が戻った');
      last = p;
    },
  });
  expectTrue(frames >= 85 && frames <= 95, `コマ数が約90: ${frames}`);
  /*
   * 入れ物と音声は、この端末の能力と元の音声から planExport が決める。その通りになったかを見る。
   * 元は Opus なので、MP4 で AAC を作れない環境（CI の Chromium）でも WebM に写して音を残す
   */
  const plan = planExport([{ id: 0, codec: 'opus', decodable: true }], await capsHere(w, h));
  const expectAudio = plan?.audio ? 'kept' : 'dropped';
  console.log(`  （形式 ${out.ext}・音声 ${out.audio}／計画 ${plan?.container}・${plan?.audio?.mode ?? 'なし'}）`);
  expectEqual(out.ext, plan?.container, '入れ物');
  expectEqual(out.audio, expectAudio, `音声（${out.ext}）`);
  expectTrue(out.poster !== null && out.poster.type === 'image/jpeg' && out.poster.size > 1000, '表紙（最初のコマ）がある');
  expectEqual(out.trimmed, false, '切っていない');
  expectTrue(out.blob.size > 10_000, `中身がある: ${out.blob.size}`);

  const back = await openVideo(out.blob);
  expectEqual(back.poster.natural.w, w, '書き出した幅');
  expectEqual(back.poster.natural.h, h, '書き出した高さ');
  expectTrue(Math.abs(back.duration - 3) < 0.15, `書き出した長さ: ${back.duration}`);
  expectEqual(back.hasAudio, expectAudio === 'kept', '書き出した動画に音声がある（入れたときだけ）');
  // 枠（白）が入っているか。四隅の近くを読む
  const c = createVerifiedCanvas(w, h);
  if (!c.ok) throw new Error('キャンバスを作れない');
  c.ctx.drawImage(back.poster.bitmap, 0, 0);
  const px = c.ctx.getImageData(4, 4, 1, 1).data;
  expectTrue(px[0]! > 240 && px[1]! > 240 && px[2]! > 240, `隅が白: ${Array.from(px).join(',')}`);
  back.poster.bitmap.close();
});

await test('★音声が複数あっても、写せる音声を選んで音を残す（iPhone の AAC ＋ 別の音声）★', async () => {
  const src = await multiAudioClip();
  const { w, h } = evenSize(320 / 568, 568);
  const out = await exportVideo(src, { width: w, height: h, render: frameInWhite(w, h) });
  /*
   * AAC を読めない環境（この Chromium）は AAC を写せないので Opus の方を選ぶ（WebM）。
   * H.264 を書ける環境（CI）は AAC を作り直さずそのまま写す（MP4）＝ iPhone と同じ経路
   */
  const caps = await capsHere(w, h);
  const plan = planExport(
    [
      { id: 1, codec: 'aac', decodable: false },
      { id: 2, codec: 'opus', decodable: true },
    ],
    caps,
  );
  console.log(`  （形式 ${out.ext}・音声 ${out.audio}／計画 ${plan?.container}・${plan?.audio?.codec ?? 'なし'} ${plan?.audio?.mode ?? ''}）`);
  expectEqual(out.ext, plan?.container, '入れ物');
  expectEqual(out.audio, 'kept', '音声が残る');
  const back = await openVideo(out.blob);
  expectTrue(back.hasAudio, '書き出した動画に音声がある');
  back.poster.bitmap.close();
});

await test('上限より長ければ先頭から上限までを書き出し、そう告げる', async () => {
  const { w, h } = evenSize(720 / 1280, 480);
  const out = await exportVideo(await clip(), { width: w, height: h, render: frameInWhite(w, h), maxSeconds: 1 });
  expectEqual(out.trimmed, true, '切った');
  expectTrue(Math.abs(out.seconds - 1) < 0.05, `書き出した長さ: ${out.seconds}`);
  const back = await openVideo(out.blob);
  expectTrue(Math.abs(back.duration - 1) < 0.15, `実際の長さ: ${back.duration}`);
  back.poster.bitmap.close();
});

await test('閉じたら（取りやめ）途中で止まり、取りやめとして伝わる', async () => {
  const { w, h } = evenSize(720 / 1280, 480);
  const ac = new AbortController();
  let err: unknown = null;
  try {
    await exportVideo(await clip(), {
      width: w,
      height: h,
      render: frameInWhite(w, h),
      signal: ac.signal,
      onProgress: (p) => {
        if (p > 0.1) ac.abort();
      },
    });
  } catch (e) {
    err = e;
  }
  expectTrue(err instanceof VideoError, `VideoError になる: ${String(err)}`);
  expectTrue(String((err as Error).message).includes('取りやめ'), `取りやめと伝わる: ${String(err)}`);
});

await test('動画でないものを開くと、分かる言葉で断る', async () => {
  let err: unknown = null;
  try {
    await openVideo(new Blob([new Uint8Array(4096)]));
  } catch (e) {
    err = e;
  }
  expectTrue(err instanceof VideoError, `VideoError になる: ${String(err)}`);
});

done();
