// 同梱アセットの検査。npm run build のたびに走る。
//
// ここで捕まえたいのは、実測で分かっている「静かに壊れる」種類の事故:
//   * 可変フォントの wght を固定し忘れると、全ウェイトのデータが残って
//     和文が 442KB → 1,043KB に膨らむ。動作はするので気づけない。
//   * 地名データを差し替えたときに桁を間違える。
// どちらもサイズを見れば分かるので、上限を決めて超えたら止める。
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const errors = [];
const notes = [];

function check(label, actual, max) {
  if (actual > max) {
    errors.push(`${label}: ${kb(actual)} が上限 ${kb(max)} を超えています`);
  } else {
    notes.push(`  ${label.padEnd(34)} ${kb(actual).padStart(10)}  (上限 ${kb(max)})`);
  }
}

// --- フォント ---
const manifestPath = resolve(root, 'public/fonts/manifest.json');
if (!existsSync(manifestPath)) {
  errors.push('public/fonts/manifest.json がありません。npm run assets:fonts を実行してください');
} else {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));

  let latinTotal = 0;
  for (const [key, f] of Object.entries(m.latin)) {
    for (const style of ['regular', 'bold']) {
      const p = resolve(root, 'public', f[style].file);
      if (!existsSync(p)) { errors.push(`${f[style].file} がありません`); continue; }
      const size = statSync(p).size;
      if (size !== f[style].bytes) {
        errors.push(`${f[style].file}: 実サイズ ${size} が manifest の ${f[style].bytes} と違います`);
      }
      latinTotal += size;
      // 1書体1ウェイトが 60KB を超えるのは、サブセットが効いていない兆候
      check(`${f.family} ${style}`, size, 60 * 1024);
    }
  }
  check('欧文8書体 合計', latinTotal, 400 * 1024);

  // 和文。wght 固定を忘れると 1,043KB になる（実測・docs/poc/report-jp-subset.md）。
  // 実測値 442KB に対し 700KB を上限に置けば、固定忘れは必ず捕まる。
  const jp = resolve(root, 'public', m.jp.regular.file);
  if (!existsSync(jp)) {
    errors.push(`${m.jp.regular.file} がありません`);
  } else {
    check('和文 Regular', statSync(jp).size, 700 * 1024);
    if (m.jp.charCount < 3400) {
      errors.push(`和文の収録文字数が ${m.jp.charCount} 字しかありません（第一水準まで入っていない疑い）`);
    }
  }
  if (m.jp.bold) {
    errors.push('和文 Bold が同梱されています。設計では Regular のみと決めています（docs/design.md）');
  }
}

// --- 地名データ ---
for (const [file, max] of [['public/geo/jp-municipalities.json', 120 * 1024],
                           ['public/geo/world-cities.json', 2400 * 1024]]) {
  const p = resolve(root, file);
  if (!existsSync(p)) { errors.push(`${file} がありません。npm run assets:geo を実行してください`); continue; }
  check(file.replace('public/geo/', '地名 '), statSync(p).size, max);
}

// --- ライセンス本文 ---
// 同梱するフォントには OFL の本文を必ず添える（再配布の条件）。
const licenses = ['Arimo', 'Jost', 'Oswald', 'Cinzel', 'PlayfairDisplay',
                  'LibreBaskerville', 'PTSerif', 'Tinos', 'NotoSansJP'];
for (const f of licenses) {
  const p = resolve(root, `public/licenses/${f}-OFL.txt`);
  if (!existsSync(p) || statSync(p).size < 1000) {
    errors.push(`public/licenses/${f}-OFL.txt がないか、短すぎます`);
  }
}

if (notes.length) console.log('同梱アセット:\n' + notes.join('\n'));
if (errors.length) {
  console.error('\n検査に失敗しました:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log('\n検査に通りました。');
