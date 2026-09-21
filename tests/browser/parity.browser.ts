/**
 * L4 パリティテスト。**このアプリで最も重要なテスト。**
 *
 * 「プレビューと書き出しが一致する」を、運用規律ではなく自動テストで守る。
 * 同じ Scene を2つの倍率で描き、大きいほうを縮小して比べる。
 * 基準画像を外部に持たないので、ブラウザの更新で字形が変わっても壊れない
 * （比べているのは「自分自身の別解像度」）。
 *
 * ── 閾値の根拠（この環境での実測）──
 *
 * 単色の写真・キャプションなしでも画素差は 0.911% 出る。原因は**矩形の縁の
 * アンチエイリアス**で、写真の解像度とは無関係（1200px でも 6000px でも同じ値）。
 * k=6 では写真の縁が整数ピクセルに乗り、k=0.8 では 19.2px のような端数に乗るため、
 * 縁の1列だけ滲み方が違う。位置はずれていない（144/7.5 = 19.2 で一致）。
 * キャプションを足すと 1.239%。増えぶんは文字の輪郭で、これも原理的にぶれる。
 *
 * つまり **1.3% 前後が雑音の床**。パリティが本当に壊れる原因
 * （解像度で分岐する描画、グレインを t.k で作る、書体の取り違え、レイアウトのずれ）は
 * どれも桁違いに大きな差を出すので、床の倍を上限に置けば十分に捕まる。
 *
 * **そして、その「捕まる」ことを同じテストで証明する**（最後のテスト）。
 * 閾値だけ決めて検出力を確かめないテストは、緑のまま壊れる。
 */
import { buildScene, INK, WHITE, type SceneInput } from '../../src/core/compose';
import type { Scene } from '../../src/core/scene/scene';
import { renderScene } from '../../src/render/executor';
import { createVerifiedCanvas, release, type AnyCanvas } from '../../src/render/guards';
import { canvasMeasurer } from '../../src/render/measure';
import { ensureFont } from '../../src/render/resources/fonts';
import type { RenderResources } from '../../src/render/resources/types';
import { makeTarget } from '../../src/render/target';
import { done, expectTrue, test } from './harness';

/*
 * ── 判定に使う指標と、その根拠（この環境での実測）──
 *
 * 最初は「差のある画素の割合」で判定しようとしたが、**実測で判別力がないことが分かった**。
 * 正常系が 1.19〜1.89% なのに対し、書体を完全に入れ替えても 2.11% にしかならず、
 * 写真の比を変えた場合は 1.66% で正常系より低い。縁のアンチエイリアスが支配的で、
 * 本物の壊れが埋もれる。この指標で閾値を決めていたら、壊れた描画が緑で通っていた。
 *
 * 代わりに次の2つを使う。実測値は下の表のとおり。
 *
 *                        正常系(4件)      壊したもの(3件)
 *   免責領域の外の最大色差    61〜66        154〜205      ← 主
 *   インクの総量の差       0.17〜0.50%   0.70〜21.97%   ← 補
 *
 * 「免責領域の外」は文字とグレインを除いた部分。ここに大きな色差が出るのは
 * 写真や枠の位置が動いたときで、レイアウトのずれを直接捕まえる。
 * 「インクの総量」は文字の中身の指標。アンチエイリアスは隣の画素へインクを配り直すだけで
 * 総量を保つが、書体や大きさが変われば総量そのものが動く。
 */

/*
 * ★指標を1つのブラウザ版に合わせて決めてはならない★
 *
 * 最初は「インクの総量」に固定の閾値（1.5%）を置いたが、CI で落ちた。
 * CI と手元でブラウザの版が違うと、同じ場面でもインクの値が 3〜6倍ずれる。
 *
 *                       手元（正常 / 壊れ）    CI（正常 / 壊れ）
 *   免責外の最大色差      61〜66 / 154〜205     61〜66 / 154〜205   ← 一致する
 *   インクの総量          0.17〜0.50% / 0.70〜  0.96〜1.70% / 2.29〜 ← ずれる
 *
 * そこで**環境に依らない「免責外の最大色差」を主**にし、
 * インクは**同じ実行の中で測った正常値を基準に自己校正**して補助に使う。
 * 固定値を残すと、また別のブラウザ版で落ちる。
 */

/** 免責領域の外で許す最大の色差。両環境とも正常 66 以下・壊れ 154 以上で、間を取る */
const MAX_DELTA_OUTSIDE_EXEMPT = 100;
/** 画素差は判別力が低いので、あからさまな破綻を拾う網としてだけ置く */
const PIXEL_GROSS_LIMIT = 3.0;
/** インクの上限は「この実行の正常値 × この倍率」。下限は置く */
const INK_FACTOR = 2.0;
const INK_FLOOR = 2.2;

/** 正常系を1度測って基準にする。実行のたびに測り直すので、ブラウザの版に依らない */
let inkBaseline: number | null = null;
const inkLimit = (): number => Math.max(INK_FLOOR, (inkBaseline ?? 0) * INK_FACTOR);

let photo: CanvasImageSource | null = null;

function makePhoto(w: number, h: number): AnyCanvas {
  const r = createVerifiedCanvas(w, h);
  if (!r.ok) throw new Error('テスト用の写真を作れません');
  const g = r.ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, 'rgb(40,45,70)');
  g.addColorStop(0.5, 'rgb(180,90,50)');
  g.addColorStop(1, 'rgb(230,200,120)');
  r.ctx.fillStyle = g;
  r.ctx.fillRect(0, 0, w, h);
  // 位置のずれが分かる目印。縦横どちらのずれにも反応する
  r.ctx.fillStyle = 'rgb(255,255,255)';
  r.ctx.fillRect(w * 0.1, h * 0.1, w * 0.12, h * 0.12);
  r.ctx.fillStyle = 'rgb(0,0,0)';
  r.ctx.fillRect(w * 0.7, h * 0.6, w * 0.15, h * 0.2);
  return r.canvas;
}

const resources = (): RenderResources => ({
  photo: () => photo,
  grainTile: () => null,
  verticalText: () => null,
});

/**
 * 幅を揃えて描く。
 * 長辺で揃えると縦長のシーンだけ幅が縮み、文字の実寸が小さくなって比較条件が変わる
 * （縦位置のケースで実際に踏んだ）。倍率 k は幅で決まるので、幅で揃えるのが正しい。
 */
function renderAtWidth(scene: Scene, widthPx: number, kExport: number, kind: 'preview' | 'export'): AnyCanvas {
  const aspect = scene.canvas.heightLu / scene.canvas.widthLu;
  const longEdge = aspect >= 1 ? widthPx * aspect : widthPx;
  const t = makeTarget(scene, longEdge, kind, kExport);
  const r = createVerifiedCanvas(t.widthPx, t.heightPx);
  if (!r.ok) throw new Error(`キャンバスを確保できません: ${r.reason} (${r.w}x${r.h})`);
  renderScene(scene, r.ctx, t, resources());
  return r.canvas;
}

function dataOf(c: AnyCanvas): ImageData {
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('context が取れません');
  return ctx.getImageData(0, 0, c.width, c.height);
}

function downscaleTo(src: AnyCanvas, w: number, h: number): ImageData {
  const r = createVerifiedCanvas(w, h);
  if (!r.ok) throw new Error('縮小用のキャンバスを確保できません');
  r.ctx.imageSmoothingEnabled = true;
  r.ctx.imageSmoothingQuality = 'high';
  r.ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  const d = r.ctx.getImageData(0, 0, w, h);
  release(r.canvas);
  return d;
}

/** 免責領域のマスク。true の画素は厳密な一致を求めない */
function exemptMask(scene: Scene, w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const sx = w / scene.canvas.widthLu;
  const sy = h / scene.canvas.heightLu;
  for (const r of scene.meta.exactnessExempt) {
    const x0 = Math.max(0, Math.floor(r.x * sx) - 2);
    const y0 = Math.max(0, Math.floor(r.y * sy) - 2);
    const x1 = Math.min(w, Math.ceil((r.x + r.w) * sx) + 2);
    const y1 = Math.min(h, Math.ceil((r.y + r.h) * sy) + 2);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * w + x] = 1;
  }
  return mask;
}

interface Diff {
  pixelPct: number;
  maxOutsideExempt: number;
  avgDelta: number;
  /** 免責領域の中の「インクの量」の差（%）。アンチエイリアスは量を保つが、書体や大きさが変われば動く */
  inkPct: number;
  /** 免責領域の外の平均色差 */
  avgOutside: number;
}

function compare(a: ImageData, b: ImageData, mask: Uint8Array): Diff {
  const n = a.width * a.height;
  let diff = 0;
  let maxOutside = 0;
  let sum = 0;
  let sumOutside = 0;
  let countOutside = 0;
  let inkA = 0;
  let inkB = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = Math.max(
      Math.abs(a.data[o]! - b.data[o]!),
      Math.abs(a.data[o + 1]! - b.data[o + 1]!),
      Math.abs(a.data[o + 2]! - b.data[o + 2]!),
    );
    sum += d;
    if (d > 2) diff++;
    if (mask[i]) {
      // 免責領域＝文字やグレイン。個々の画素ではなく「インクの総量」で見る。
      // アンチエイリアスは隣の画素へインクを配り直すだけで、総量は保つ
      const la = a.data[o]! * 0.299 + a.data[o + 1]! * 0.587 + a.data[o + 2]! * 0.114;
      const lb = b.data[o]! * 0.299 + b.data[o + 1]! * 0.587 + b.data[o + 2]! * 0.114;
      inkA += 255 - la;
      inkB += 255 - lb;
    } else {
      countOutside++;
      sumOutside += d;
      if (d > maxOutside) maxOutside = d;
    }
  }
  const inkBase = Math.max(1, Math.max(inkA, inkB));
  return {
    pixelPct: (diff / n) * 100,
    maxOutsideExempt: maxOutside,
    avgDelta: sum / n,
    inkPct: (Math.abs(inkA - inkB) / inkBase) * 100,
    avgOutside: sumOutside / Math.max(1, countOutside),
  };
}

const CAPTION = 'Untitled, 2026.09.20, FUJIFILM X-M5, SIGMA 18-50mm F2.8 DC DN';

function sceneFor(over: Partial<SceneInput> = {}): Scene {
  return buildScene(
    {
      styleId: 'OR1',
      photo: { id: 'p', aspect: 1.5 },
      caption: {
        text: CAPTION,
        font: { family: 'Arimo', weight: 400 },
        sizeLu: 16,
        letterSpacingLu: 0,
        align: 'left',
      },
      background: WHITE,
      ink: INK,
      ...over,
    },
    canvasMeasurer,
  );
}

/** プレビューと書き出しを描いて比べる。scene を2つ渡すと「わざと違うもの」を比べられる */
function parityOf(previewScene: Scene, exportScene: Scene = previewScene): Diff {
  const kExport = 6;
  const preview = renderAtWidth(previewScene, 800, kExport, 'preview');
  const exported = renderAtWidth(exportScene, 6000, kExport, 'export');
  const a = dataOf(preview);
  const b = downscaleTo(exported, preview.width, preview.height);
  const d = compare(a, b, exemptMask(previewScene, a.width, a.height));
  release(preview);
  release(exported);
  return d;
}

await test('準備: 書体を読み込む', async () => {
  await ensureFont(
    { family: 'Arimo', weight: 400 },
    { kind: 'url', url: '/public/fonts/Arimo-regular.woff2' },
  );
  photo = makePhoto(2400, 1600) as CanvasImageSource;
});

function report(label: string, d: Diff): void {
  console.log(
    `  [${label.padEnd(16)}] 免責外の最大色差 ${String(d.maxOutsideExempt).padStart(3)} / ` +
      `インク ${d.inkPct.toFixed(3)}%（上限 ${inkLimit().toFixed(2)}%） / 画素 ${d.pixelPct.toFixed(3)}%`,
  );
}

/** 一致していること。壊れていたら、どの指標でどれだけ外れたかを言う */
function expectParity(label: string, d: Diff): void {
  report(label, d);
  expectTrue(
    d.maxOutsideExempt <= MAX_DELTA_OUTSIDE_EXEMPT,
    `${label}: 免責領域の外の最大色差 ${d.maxOutsideExempt} が上限 ${MAX_DELTA_OUTSIDE_EXEMPT} を超えた（写真や枠の位置がずれている疑い）`,
  );
  expectTrue(
    d.inkPct <= inkLimit(),
    `${label}: 文字のインク総量の差 ${d.inkPct.toFixed(3)}% が上限 ${inkLimit().toFixed(2)}% を超えた（書体か文字の大きさが違う疑い）`,
  );
  expectTrue(
    d.pixelPct <= PIXEL_GROSS_LIMIT,
    `${label}: 画素差 ${d.pixelPct.toFixed(3)}% が上限 ${PIXEL_GROSS_LIMIT}% を超えた`,
  );
}

/** わざと壊したものが、確かに検出されること */
function expectDetected(label: string, d: Diff): void {
  report(label, d);
  const caught =
    d.maxOutsideExempt > MAX_DELTA_OUTSIDE_EXEMPT ||
    d.inkPct > inkLimit() ||
    d.pixelPct > PIXEL_GROSS_LIMIT;
  expectTrue(
    caught,
    `${label}: どの指標も反応しなかった（免責外の最大色差 ${d.maxOutsideExempt} / インク ${d.inkPct.toFixed(3)}%）。` +
      `このテストには検出力がない`,
  );
}

await test('★プレビュー(800px)と書き出し(6000px)が一致する★', () => {
  const d = parityOf(sceneFor());
  // この実行でのインクの基準。以降の判定はこれを基に決まる
  inkBaseline = d.inkPct;
  expectParity('正常', d);
});

await test('縦位置の写真でも一致する', () => {
  expectParity('縦位置', parityOf(sceneFor({ photo: { id: 'p', aspect: 0.75 } })));
});

await test('字間を広げても一致する（letterSpacing がスケールに比例する）', () => {
  const d = parityOf(
    sceneFor({
      caption: {
        text: 'FUJIFILM X-M5',
        font: { family: 'Arimo', weight: 400 },
        sizeLu: 16,
        letterSpacingLu: 1.8,
        align: 'left',
      },
    }),
  );
  expectParity('字間あり', d);
});

await test('整列を変えても一致する', () => {
  for (const align of ['center', 'right'] as const) {
    const d = parityOf(
      sceneFor({
        caption: {
          text: CAPTION,
          font: { family: 'Arimo', weight: 400 },
          sizeLu: 16,
          letterSpacingLu: 0,
          align,
        },
      }),
    );
    expectParity(`整列 ${align}`, d);
  }
});

/**
 * ★このテストの検出力の証明★
 *
 * 閾値だけ決めて検出力を確かめないテストは、緑のまま壊れる。
 * わざと壊したものを比べて、確かに落ちることを示す。
 */
await test('★わざと壊すと検出できる★ 文字の大きさが 4% 違う', () => {
  const good = sceneFor();
  const bad = sceneFor({
    caption: {
      text: CAPTION,
      font: { family: 'Arimo', weight: 400 },
      sizeLu: 16.64, // 4% 大きい
      letterSpacingLu: 0,
      align: 'left',
    },
  });
  const d = parityOf(good, bad);
  expectDetected('文字4%違い', d);
});

await test('★わざと壊すと検出できる★ 写真の位置が 1 論理単位ずれる', () => {
  const good = sceneFor();
  const bad = sceneFor({ photo: { id: 'p', aspect: 1.515 } }); // 比が 1% 違う＝写真の高さがずれる
  const d = parityOf(good, bad);
  expectDetected('写真の比1%違い', d);
});

await test('★わざと壊すと検出できる★ 書体が違う', async () => {
  await ensureFont(
    { family: 'PlayfairDisplay', weight: 400 },
    { kind: 'url', url: '/public/fonts/PlayfairDisplay-regular.woff2' },
  );
  const good = sceneFor();
  const bad = sceneFor({
    caption: {
      text: CAPTION,
      font: { family: 'PlayfairDisplay', weight: 400 },
      sizeLu: 16,
      letterSpacingLu: 0,
      align: 'left',
    },
  });
  const d = parityOf(good, bad);
  expectDetected('書体違い', d);
});

done();
