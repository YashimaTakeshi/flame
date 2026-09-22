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
import { FRMM_PRESETS } from '../../src/core/styles/spec';
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
 *                        正常系(20件)     壊したもの(3件)
 *   免責領域の外の最大色差    26〜104       208〜221      ← 主
 *   インクの総量の差       0.46〜4.84%   0.07〜26.08%   ← 補
 *
 * 正常系は15スタイル全部を含む。範囲は手元と CI の両方を合わせたもの。
 * 「文字の大きさ4%違い」はインクでは動かないが最大色差が 214 で捕まり、
 * 「書体違い」は最大色差が 88 のままだがインクが 26% 動いて捕まる。
 * **2つの指標は別のものを見ている。片方だけでは穴がある。**
 *
 * ★どちらの値も固定の閾値にはしない。★ 理由は下の「固定の閾値を書いてはならない」。
 *
 * 「免責領域の外」は文字とグレインを除いた部分。ここに大きな色差が出るのは
 * 写真や枠の位置が動いたときで、レイアウトのずれを直接捕まえる。
 * 「インクの総量」は文字の中身の指標。アンチエイリアスは隣の画素へインクを配り直すだけで
 * 総量を保つが、書体や大きさが変われば総量そのものが動く。
 */

/*
 * ★このテストで固定の閾値を書いてはならない★
 *
 * 同じ失敗を2度やった。どちらも「手元で測った値の少し上」を定数に書いた。
 *
 *   1度目: インクに 1.5% を置いた。CI のブラウザ版では正常系が 0.96〜1.70% で、
 *          手元の 0.17〜0.50% と 3〜6倍ずれていた。CI が3回続けて落ちた。
 *   2度目: 最大色差に 100 を置いた。手元の15スタイルが 26〜97 だったため。
 *          CI では SQ4 が 100、FF1 が 104。また落ちた。
 *          （手元では同じ2つが 26 と 47。暗幕の階調のディザが版で違うのが原因）
 *
 * **2つの環境で測って一致したから環境に依らない、とは言えない。**
 * 1度目のときに「最大色差は両環境で一致した」と書いたが、
 * それは1つのスタイルでの話で、15スタイルに広げたら崩れた。
 *
 * そこで**絶対の閾値で判定するのをやめた**。
 * 判定するのは「壊したものが、同じ実行の正常系の雑音から離れているか」だけにする。
 * 雑音の大きさはその実行の中で測る。これならどのブラウザ版でも意味が変わらない。
 *
 * 絶対値は「全部まとめて壊れた」場合の取りこぼしを防ぐ網としてだけ置き、
 * **観測値の 1.4 倍以上の余裕**を持たせる（調整するための値ではない）。
 */

/**
 * 取りこぼし防止の網。観測された正常系の最悪値（手元 97 / CI 104）に対し、
 * 十分な余裕を取る。壊したものは 208 以上なので、ここには触れない。
 * ★CI が落ちたからといって、この値を上げて済ませてはいけない。★
 */
const MAX_DELTA_BACKSTOP = 150;
const INK_BACKSTOP = 12;
/** 画素差は判別力が低いので、あからさまな破綻を拾う網としてだけ置く */
const PIXEL_GROSS_LIMIT = 3.0;

/**
 * 壊れたものが雑音から離れていると認める倍率。
 *
 * 観測された2つの母集団は「正常系 ≤104」と「壊れたもの ≥208」で、ちょうど 2.0 倍離れている。
 * 境目はその**対数的な中間**、つまり √2 ≒ 1.41 に置く。
 * 上に寄せると雑音が少し増えただけで落ち、下に寄せると小さな破綻を見逃す。
 * 通すために動かす値ではない（動かしたくなったら、まず何が変わったのかを調べること）。
 */
const SEPARATION = 1.41;

/** この実行で測った正常系。閾値はここから作る */
const normals: { label: string; d: Diff }[] = [];
const broken: { label: string; d: Diff }[] = [];
const worstNormal = (pick: (d: Diff) => number): number =>
  normals.reduce((a, n) => Math.max(a, pick(n.d)), 0);

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
/**
 * 写真の**縁だけ**を免責する幅（デバイスピクセル）。中身は免責しない。
 *
 * 塗り矩形の縁は、その縁が画素のどこに落ちるかで滲み方が変わる。
 * 余白 10lu のスタイルは 8.0px / 24.0px と整数に乗るが、26lu のスタイルは
 * 20.8px / 62.4px と端数に乗る。同じ描画でも縁の1〜2列だけ値が違い、
 * 実測で正常系の最大色差が 26〜131 とスタイルごとに散った（位置は合っている）。
 *
 * 文字の輪郭を免責するのと同じ理由で、**縁の数列も免責する**。
 * 中身は免責しないので、写真がずれれば中の目印が動いて必ず捕まる
 * （下の「2論理単位ずれる」で、検出力を毎回証明している）。
 */
const PHOTO_EDGE_EXEMPT_PX = 3;

interface Masks {
  /** インクを数える領域＝文字とグレインだけ。写真は入れない */
  readonly ink: Uint8Array;
  /** 最大色差の判定から外す領域＝文字・グレイン ＋ 写真の縁 */
  readonly skip: Uint8Array;
}

function exemptMask(scene: Scene, w: number, h: number): Masks {
  const ink = new Uint8Array(w * h);
  const skip = new Uint8Array(w * h);
  const sx = w / scene.canvas.widthLu;
  const sy = h / scene.canvas.heightLu;
  const fill = (m: Uint8Array, x0: number, y0: number, x1: number, y1: number): void => {
    const ax = Math.max(0, Math.floor(x0));
    const ay = Math.max(0, Math.floor(y0));
    const bx = Math.min(w, Math.ceil(x1));
    const by = Math.min(h, Math.ceil(y1));
    for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) m[y * w + x] = 1;
  };
  for (const r of scene.meta.exactnessExempt) {
    const box = [r.x * sx - 2, r.y * sy - 2, (r.x + r.w) * sx + 2, (r.y + r.h) * sy + 2] as const;
    fill(ink, ...box);
    fill(skip, ...box);
  }
  /*
   * 写真の縁は skip にだけ入れる。ink に入れると写真の明るさがインクとして
   * 数えられ、文字の指標が写真に埋もれる（実測で書体を入れ替えても
   * インクの差が 1.47% までしか動かず、検出力が消えた）。
   */
  const e = PHOTO_EDGE_EXEMPT_PX;
  for (const op of scene.ops) {
    if (op.op !== 'photo') continue;
    const x0 = op.dst.x * sx;
    const y0 = op.dst.y * sy;
    const x1 = (op.dst.x + op.dst.w) * sx;
    const y1 = (op.dst.y + op.dst.h) * sy;
    fill(skip, x0 - e, y0 - e, x1 + e, y0 + e); // 上辺
    fill(skip, x0 - e, y1 - e, x1 + e, y1 + e); // 下辺
    fill(skip, x0 - e, y0 - e, x0 + e, y1 + e); // 左辺
    fill(skip, x1 - e, y0 - e, x1 + e, y1 + e); // 右辺
  }
  return { ink, skip };
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

function compare(a: ImageData, b: ImageData, masks: Masks): Diff {
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
    if (masks.ink[i]) {
      // 文字やグレイン。個々の画素ではなく「インクの総量」で見る。
      // アンチエイリアスは隣の画素へインクを配り直すだけで、総量は保つ
      const la = a.data[o]! * 0.299 + a.data[o + 1]! * 0.587 + a.data[o + 2]! * 0.114;
      const lb = b.data[o]! * 0.299 + b.data[o + 1]! * 0.587 + b.data[o + 2]! * 0.114;
      inkA += 255 - la;
      inkB += 255 - lb;
    }
    if (!masks.skip[i]) {
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

/** OR1 は1行にこの順で全部並べる。組み上がる文字列は下の CAPTION と同じ */
const FACTS = {
  title: 'Untitled',
  date: '2026.09.20',
  camera: 'FUJIFILM X-M5',
  lens: 'SIGMA 18-50mm F2.8 DC DN',
} as const;
const GATES = {
  exposureEnabled: false,
  focalEnabled: false,
  placeEnabled: false,
  artistEnabled: false,
} as const;

function sceneFor(over: Partial<SceneInput> = {}): Scene {
  return buildScene(
    {
      style: { ratio: 'OR', photo: 'center', caption: 'below', captionAlign: 'center', lines: 1, margin: 'normal' },
      photo: { id: 'p', aspect: 1.5 },
      facts: FACTS,
      gates: GATES,
      family: 'Arimo',
      weight: 400,
      hasBold: true,
      align: 'left',
      tracking: 'Normal',
      size: 'Medium',
      bordered: false,
      background: WHITE,
      ink: INK,
      ...over,
    },
    canvasMeasurer,
  );
}

/**
 * わざと壊すための細工。**Scene を直接いじる。**
 *
 * 入力の側から壊そうとすると、はしご（縮小・項目落とし）が働いて
 * 「壊れた入力」が「正しく組まれた別の絵」になってしまい、
 * 差が大きくなりすぎてテストの感度が分からなくなる。
 * 4% だけずらしたいのだから、出来上がった命令列を 4% ずらすのが正しい。
 */
function withTextOps(scene: Scene, f: (op: Extract<Scene['ops'][number], { op: 'text' }>) => Scene['ops'][number]): Scene {
  return { ...scene, ops: scene.ops.map((op) => (op.op === 'text' ? f(op) : op)) };
}

/** プレビューと書き出しを描いて比べる。scene を2つ渡すと「わざと違うもの」を比べられる */
function parityOf(previewScene: Scene, exportScene: Scene = previewScene, ratio = 7.5): Diff {
  const kExport = 6;
  const preview = renderAtWidth(previewScene, 800, kExport, 'preview');
  const exported = renderAtWidth(exportScene, 800 * ratio, kExport, 'export');
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
  // 3行組みのスタイルは2行目を Bold で置く。台帳に無ければ描画は止まる（黙って代用しない）
  await ensureFont(
    { family: 'Arimo', weight: 700 },
    { kind: 'url', url: '/public/fonts/Arimo-bold.woff2' },
  );
  // 刻印のロゴは書体の選択によらず Tinos / Oswald の Bold を使う
  await ensureFont(
    { family: 'Tinos', weight: 700 },
    { kind: 'url', url: '/public/fonts/Tinos-bold.woff2' },
  );
  await ensureFont(
    { family: 'Tinos', weight: 400 },
    { kind: 'url', url: '/public/fonts/Tinos-regular.woff2' },
  );
  await ensureFont(
    { family: 'Oswald', weight: 700 },
    { kind: 'url', url: '/public/fonts/Oswald-bold.woff2' },
  );
  photo = makePhoto(2400, 1600) as CanvasImageSource;
});

function report(label: string, d: Diff): void {
  console.log(
    `  [${label.padEnd(16)}] 免責外の最大色差 ${String(d.maxOutsideExempt).padStart(3)} / ` +
      `インク ${d.inkPct.toFixed(3)}% / 画素 ${d.pixelPct.toFixed(3)}%`,
  );
}

/**
 * 一致していること。
 * ここで見るのは「網に触れていないか」だけ。本当の判定は最後の検出力テストが行う。
 */
function expectParity(label: string, d: Diff): void {
  report(label, d);
  normals.push({ label, d });
  expectTrue(
    d.maxOutsideExempt <= MAX_DELTA_BACKSTOP,
    `${label}: 免責領域の外の最大色差 ${d.maxOutsideExempt} が網 ${MAX_DELTA_BACKSTOP} を超えた（写真や枠の位置がずれている疑い）`,
  );
  expectTrue(
    d.inkPct <= INK_BACKSTOP,
    `${label}: 文字のインク総量の差 ${d.inkPct.toFixed(3)}% が網 ${INK_BACKSTOP}% を超えた（書体か文字の大きさが違う疑い）`,
  );
  expectTrue(
    d.pixelPct <= PIXEL_GROSS_LIMIT,
    `${label}: 画素差 ${d.pixelPct.toFixed(3)}% が上限 ${PIXEL_GROSS_LIMIT}% を超えた`,
  );
}

/** わざと壊したものを記録する。判定は最後にまとめて行う */
function recordBroken(label: string, d: Diff): void {
  report(label, d);
  broken.push({ label, d });
}

await test('★プレビュー(800px)と書き出し(6000px)が一致する★', () => {
  expectParity('正常', parityOf(sceneFor()));
});

await test('縦位置の写真でも一致する', () => {
  expectParity('縦位置', parityOf(sceneFor({ photo: { id: 'p', aspect: 0.75 } })));
});

await test('字間を広げても一致する（letterSpacing がスケールに比例する）', () => {
  expectParity('字間あり', parityOf(sceneFor({ tracking: 'Widest' })));
});

await test('整列を変えても一致する', () => {
  for (const align of ['center', 'right'] as const) {
    expectParity(`整列 ${align}`, parityOf(sceneFor({ align })));
  }
});

await test('仕上がりの刻印を置いても一致する（文字・ロゴ・段の中）', () => {
  expectParity('刻印 文字', parityOf(sceneFor({ badge: { text: 'CLASSIC CHROME', mode: 'text' } })));
  expectParity('刻印 ロゴ', parityOf(sceneFor({ badge: { text: 'PROVIA', mode: 'logo' } })));
  expectParity('刻印 ロゴ 段', parityOf(sceneFor({ badge: { text: 'CLASSIC Neg.', mode: 'logo' }, style: { ratio: 'STN', photo: 'center', caption: 'right', captionAlign: 'center', lines: 2, margin: 'normal' } })));
});

/*
 * 15スタイル全部。
 *
 * プレビューは 800px のまま動かさない。免責外の最大色差は写真の縁の
 * アンチエイリアスで決まるので、プレビューの寸法を変えると床が動いて
 * 校正した上限が意味を失う（360px に落としたら正常系が 110 まで上がった）。
 * 代わりに書き出し側の倍率を 7.5 → 3 に落とす。9:16 を 6000px で描くと
 * 256MB の画素を2枚抱えることになり、端末では確保できない。
 * 見ているのは「2つの倍率が一致するか」なので、倍率の絶対値は判定に効かない。
 */
await test('参考アプリの15組み合わせすべてで一致する', () => {
  for (const [name, style] of Object.entries(FRMM_PRESETS)) {
    expectParity(name, parityOf(sceneFor({ style }), undefined, 3));
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
  const bad = withTextOps(good, (op) => ({
    ...op,
    sizeLu: (op.sizeLu * 1.04) as typeof op.sizeLu,
    measuredWidthLu: (op.measuredWidthLu * 1.04) as typeof op.measuredWidthLu,
  }));
  recordBroken('文字4%違い', parityOf(good, bad));
});

/*
 * 写真の矩形を直接ずらす。
 *
 * 入力（写真の比）を変える手では**検出できない**ことが実測で分かった。
 * OR群はキャンバスの高さを写真の比から決めるので、比を 1% 変えると
 * キャンバスも一緒に伸び、写真がキャンバスに占める割合はほとんど変わらない。
 * 縮小して重ねると差が消える（免責外の最大色差 93、正常系 88 と区別できない）。
 * ずれを見るテストなのだから、ずらすのは矩形そのものでなければならない。
 */
await test('★わざと壊すと検出できる★ 写真の位置が 2 論理単位ずれる', () => {
  const good = sceneFor();
  const bad: Scene = {
    ...good,
    ops: good.ops.map((op) =>
      op.op === 'photo'
        ? { ...op, dst: { ...op.dst, y: (op.dst.y + 2) as typeof op.dst.y } }
        : op,
    ),
  };
  recordBroken('写真が2lu下', parityOf(good, bad));
});

await test('★わざと壊すと検出できる★ 書体が違う', async () => {
  await ensureFont(
    { family: 'PlayfairDisplay', weight: 400 },
    { kind: 'url', url: '/public/fonts/PlayfairDisplay-regular.woff2' },
  );
  const good = sceneFor();
  const bad = withTextOps(good, (op) => ({
    ...op,
    font: { family: 'PlayfairDisplay', weight: 400 },
  }));
  recordBroken('書体違い', parityOf(good, bad));
});

/**
 * ★このテストの検出力を、毎回この実行の中で証明する★
 *
 * 閾値を外から与えないので、「手元では通るが CI では落ちる」が起きない。
 * 見ているのは **壊したものが、同じ実行の正常系の最悪値から離れているか** だけ。
 */
await test('★検出力の証明★ 壊したものは正常系の雑音から離れている', () => {
  const dMax = worstNormal((d) => d.maxOutsideExempt);
  const iMax = worstNormal((d) => d.inkPct);
  const dGate = dMax * SEPARATION;
  const iGate = iMax * SEPARATION;
  console.log(
    `  正常系 ${normals.length} 件の最悪値: 最大色差 ${dMax} / インク ${iMax.toFixed(3)}%` +
      ` → 検出の境目 ${dGate.toFixed(0)} / ${iGate.toFixed(2)}%`,
  );
  expectTrue(normals.length >= 20, `正常系が ${normals.length} 件しか測れていない`);
  expectTrue(broken.length === 3, `壊したものが ${broken.length} 件しか測れていない`);

  for (const { label, d } of broken) {
    const byDelta = d.maxOutsideExempt >= dGate;
    const byInk = d.inkPct >= iGate;
    expectTrue(
      byDelta || byInk,
      `${label}: 正常系の雑音（最大色差 ${dMax} / インク ${iMax.toFixed(3)}%）から離れていない` +
        `（この件は ${d.maxOutsideExempt} / ${d.inkPct.toFixed(3)}%）。このテストには検出力がない`,
    );
  }
});

done();
