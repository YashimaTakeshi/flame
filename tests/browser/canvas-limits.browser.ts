/**
 * 実ブラウザでの回帰テスト: キャンバスの「黙って失敗する」挙動。
 *
 * 単体テストの模擬が実物と合っているかを、ここで確かめる。
 * 模擬ごと間違えていたら、このテストが落ちる。
 */
import { createVerifiedCanvas, currentLimits, setMeasuredLimits } from '../../src/render/guards';
import { done, expectEqual, expectTrue, test } from './harness';

await test('実測した面積上限は 2^28 である（report-canvas.md の再現）', () => {
  const side = 16_384; // 16384^2 = 2^28 ちょうど
  const ok = createVerifiedCanvas(side, side);
  expectTrue(ok.ok, '2^28 ちょうどは確保できるはず');
  if (ok.ok) {
    ok.canvas.width = 0;
    ok.canvas.height = 0;
  }
});

await test('★上限を1px超えると、素の canvas は例外を投げずに透明な黒を返す★', () => {
  // 仕組みを通さず、素の canvas で実際の壊れ方を確かめる
  const c = new OffscreenCanvas(16_385, 16_384); // 2^28 + 16384
  const ctx = c.getContext('2d');
  expectTrue(ctx !== null, 'getContext は null を返さない（例外も投げない）');
  if (!ctx) return;
  ctx.fillStyle = 'rgb(1,2,3)';
  ctx.fillRect(0, 0, 1, 1); // 例外を投げない
  const d = ctx.getImageData(0, 0, 1, 1).data;
  expectTrue(
    d[0] === 0 && d[1] === 0 && d[2] === 0 && d[3] === 0,
    `書いたのに読み返すと透明な黒のはず（実際: ${d[0]},${d[1]},${d[2]},${d[3]}）`,
  );
});

await test('createVerifiedCanvas はその壊れ方を確保失敗として返す', () => {
  // 上限の事前照合を無効にして、読み戻し検証だけに判定させる
  setMeasuredLimits({ area: Number.MAX_SAFE_INTEGER, side: 1_000_000 });
  const r = createVerifiedCanvas(16_385, 16_384);
  setMeasuredLimits(null);
  expectTrue(!r.ok, '確保失敗として扱われるはず');
  if (!r.ok) expectEqual(r.reason, 'verify', '失敗の理由');
});

await test('既定の上限は実測値と一致している', () => {
  expectEqual(currentLimits().area, 268_435_456, '面積上限');
  expectEqual(currentLimits().side, 65_535, '辺長上限');
});

await test('辺長上限 65535 は確保でき、65536 はできない（report-canvas.md の再現）', () => {
  const ok = createVerifiedCanvas(65_535, 1);
  expectTrue(ok.ok, '65535x1 は確保できるはず');
  if (ok.ok) {
    ok.canvas.width = 0;
    ok.canvas.height = 0;
  }
  setMeasuredLimits({ area: Number.MAX_SAFE_INTEGER, side: 1_000_000 });
  const ng = createVerifiedCanvas(65_536, 1);
  setMeasuredLimits(null);
  expectTrue(!ng.ok, '65536x1 は確保できないはず');
});

await test('書き出し想定の 4096 長辺（4:5）は確保できる', () => {
  const r = createVerifiedCanvas(3277, 4096); // 4:5 で長辺4096
  expectTrue(r.ok, '既定の書き出し解像度は確保できなければならない');
  if (r.ok) {
    r.canvas.width = 0;
    r.canvas.height = 0;
  }
});

done();
