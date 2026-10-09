/**
 * 自分のPC（Windows・Mac・Linux）で開発を始めるための一括準備。`npm run setup`
 *
 *   1. Node のバージョンを確かめる（古いと原因の分かりにくいエラーになる）
 *   2. 依存を入れる（npm ci。package-lock.json のとおりに入れる）
 *   3. テスト用の Chromium を入れる（実ブラウザ試験・shot.mjs が使う。数百MB）
 *   4. 型・lint・単体テストを流して、環境が整ったことを確かめる
 *
 * 何も書き換えない（コミット・push・公開はしない）。やり直しても安全。
 * 引数: --skip-browser … Chromium を入れない（実ブラウザ試験は動かせなくなる）
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const skipBrowser = process.argv.includes('--skip-browser');
const NODE_MIN = 20;

const run = (title, cmd, args) => {
  console.log(`\n▶ ${title}`);
  // Windows では npm / npx が .cmd なので shell 経由で呼ぶ
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\n✕ 失敗しました: ${title}\n  上のメッセージを、そのままClaudeに貼ってください。`);
    process.exit(r.status ?? 1);
  }
};

const major = Number(process.versions.node.split('.')[0]);
if (major < NODE_MIN) {
  console.error(`✕ Node ${NODE_MIN} 以上が必要です（いまは ${process.versions.node}）。https://nodejs.org から LTS を入れ直してください。`);
  process.exit(1);
}
if (!existsSync('package.json')) {
  console.error('✕ リポジトリの一番上のフォルダ（package.json がある所）で実行してください。');
  process.exit(1);
}

run('依存を入れる（npm ci）', 'npm', ['ci']);
if (!skipBrowser) run('テスト用の Chromium を入れる', 'npx', ['playwright', 'install', 'chromium']);
run('型・lint を確かめる（npm run verify）', 'npm', ['run', 'verify']);
run('単体テストを流す', 'npx', ['vitest', 'run']);

console.log(`
✔ 準備ができました。

  npm run dev                     画面を動かして確かめる（表示されたアドレスをブラウザで開く）
  npm run verify                  型・lint
  npx vitest run                  単体テスト
  npm run build && npm run test:browser    実ブラウザ試験
  npm run build && node scripts/shot.mjs   スマホ実寸の配置チェック

  公開する前に: 公開したくないコミットは件名に [skip ci] を付ける（CLAUDE.md を参照）。
`);
