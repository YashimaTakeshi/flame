/**
 * 実ブラウザでの回帰テスト: Orientation とデコード経路。
 *
 * プレビュー用の縮小デコードと原寸デコードが別経路になると、Orientation の適用が
 * 食い違い、プレビューと書き出しでトリミング位置がずれる。
 * 縦位置の写真でしか出ないので気づきにくい。ここで固定する。
 */
import { decode } from '../../src/platform/decode';
import { done, expectEqual, expectTrue, test } from './harness';

async function fetchBlob(name: string): Promise<Blob> {
  const res = await fetch(`./fixtures/${name}`);
  if (!res.ok) throw new Error(`取得できません: ${name} (${res.status})`);
  return await res.blob();
}

await test('回転フラグ付きの画像は、デコード時点で回転済みの寸法を返す', async () => {
  // 元は 1200x900（横長）、Orientation=6（時計回り90度）→ 900x1200（縦長）になるはず
  const d = await decode(await fetchBlob('rotated-orient6.jpg'));
  expectEqual(d.natural.w, 900, '回転後の幅');
  expectEqual(d.natural.h, 1200, '回転後の高さ');
  expectEqual(d.orientationApplied, true, '回転済みの印');
  d.bitmap.close();
});

await test('★縮小デコードでも原寸は回転後の値を返す★', async () => {
  const full = await decode(await fetchBlob('rotated-orient6.jpg'));
  const small = await decode(await fetchBlob('rotated-orient6.jpg'), { resizeWidth: 300 });
  expectEqual(small.natural.w, full.natural.w, '原寸の幅が一致');
  expectEqual(small.natural.h, full.natural.h, '原寸の高さが一致');
  expectEqual(small.size.w, 300, '縮小後の幅');
  full.bitmap.close();
  small.bitmap.close();
});

await test('★縮小と原寸でアスペクト比が一致する★（ここが破れるとトリミングがずれる）', async () => {
  for (const name of ['rotated-orient6.jpg', 'iphone-portrait.jpg', 'mirrorless-landscape.jpg']) {
    const full = await decode(await fetchBlob(name));
    const small = await decode(await fetchBlob(name), { resizeWidth: 320 });
    const a = full.size.w / full.size.h;
    const b = small.size.w / small.size.h;
    expectTrue(Math.abs(a - b) < 0.01, `${name}: 比が一致するはず（原寸 ${a.toFixed(4)} / 縮小 ${b.toFixed(4)}）`);
    full.bitmap.close();
    small.bitmap.close();
  }
});

await test('縮小幅が原寸以上なら縮小しない（無駄な再デコードを避ける）', async () => {
  const d = await decode(await fetchBlob('iphone-portrait.jpg'), { resizeWidth: 99_999 });
  expectEqual(d.size.w, d.natural.w, '原寸のまま');
  d.bitmap.close();
});

await test('回転フラグ付き画像を描くと、実際に画素が回っている', async () => {
  // 元画像の左上は白。90度時計回りなら、回転後は右上に来る
  const d = await decode(await fetchBlob('rotated-orient6.jpg'));
  const c = new OffscreenCanvas(d.size.w, d.size.h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('context が取れません');
  ctx.drawImage(d.bitmap, 0, 0);
  const m = Math.max(8, Math.min(d.size.w, d.size.h) / 12);
  const topRight = ctx.getImageData(Math.round(d.size.w - m * 1.5), Math.round(m * 1.5), 1, 1).data;
  expectTrue(
    topRight[0]! > 200 && topRight[1]! > 200 && topRight[2]! > 200,
    `回転後の右上が白のはず（実際: ${topRight[0]},${topRight[1]},${topRight[2]}）`,
  );
  d.bitmap.close();
  c.width = 0;
  c.height = 0;
});

await test('EXIF の無い画像も普通に開ける', async () => {
  const d = await decode(await fetchBlob('no-exif.jpg'));
  expectEqual(d.natural.w, 900, '幅');
  expectEqual(d.natural.h, 1200, '高さ');
  d.bitmap.close();
});

done();
