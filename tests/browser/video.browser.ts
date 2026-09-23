/**
 * 実ブラウザでの回帰テスト: 動画。
 *
 * 動画の読み書きは WebCodecs に頼るので、模擬では確かめたことにならない。
 * 試験用の動画（tests/fixtures/clip-portrait.webm）は 720×1280・3秒・30fps・音声（Opus）付きで、
 * 赤い四角が左から右へ動く（コマごとに描き直されていることが分かる）。
 *
 * この Chromium は H.264 を書けないので、ここで通るのは WebM（VP9）の経路。
 * MP4（H.264）の経路は iPhone の Safari・PC の Chrome で通る（形式の選び方は同じ関数）。
 */
import { evenSize, exportVideo, openVideo, VideoError } from '../../src/platform/video';
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
  expectEqual(out.audio, 'kept', '音声');
  expectEqual(out.trimmed, false, '切っていない');
  expectTrue(out.blob.size > 10_000, `中身がある: ${out.blob.size}`);

  const back = await openVideo(out.blob);
  expectEqual(back.poster.natural.w, w, '書き出した幅');
  expectEqual(back.poster.natural.h, h, '書き出した高さ');
  expectTrue(Math.abs(back.duration - 3) < 0.15, `書き出した長さ: ${back.duration}`);
  expectTrue(back.hasAudio, '書き出した動画に音声がある');
  // 枠（白）が入っているか。四隅の近くを読む
  const c = createVerifiedCanvas(w, h);
  if (!c.ok) throw new Error('キャンバスを作れない');
  c.ctx.drawImage(back.poster.bitmap, 0, 0);
  const px = c.ctx.getImageData(4, 4, 1, 1).data;
  expectTrue(px[0]! > 240 && px[1]! > 240 && px[2]! > 240, `隅が白: ${Array.from(px).join(',')}`);
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
