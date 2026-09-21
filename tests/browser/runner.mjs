/**
 * 実ブラウザでのテスト。
 *
 * 単体テストは模擬に対するもので、模擬が実物と合っている保証がない。
 * 「例外を投げずに透明な黒を返す」のような挙動は、実際の Chromium で確かめないと
 * 模擬ごと間違えたまま緑になる。ここはそのための場所。
 *
 * 使い方: node tests/browser/runner.mjs [ファイル名の一部]
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readdirSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const outDir = resolve(root, 'node_modules/.tmp/browser-tests');

// この環境にプリインストールされた Chromium は playwright の既定 revision とズレているため、
// 実体を直接指す。CI など playwright が自分で入れた版がある環境では、
// FLAME_CHROMIUM を空にして playwright の既定に任せる。
const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROMIUM = process.env.FLAME_CHROMIUM === '' ? undefined
               : (process.env.FLAME_CHROMIUM ?? (existsSync(PREINSTALLED) ? PREINSTALLED : undefined));

const filter = process.argv[2] ?? '';
const files = readdirSync(here)
  .filter((f) => f.endsWith('.browser.ts'))
  .filter((f) => f.includes(filter));

if (files.length === 0) {
  console.error(`実行するファイルがありません（filter: "${filter}"）`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: files.map((f) => resolve(here, f)),
  outdir: outDir,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  sourcemap: 'inline',
});

/**
 * 簡易サーバー。file:// から ES モジュールを読むと Chromium が CORS で拒否するため、
 * HTTP で配る必要がある（これを踏んで、器そのものが動かなかった）。
 */
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.map': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json',
};
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const name = basename(path);
  // テスト画像と同梱アセットも配る（実物で試せないと意味がない）
  const dir = path.startsWith('/fixtures/') ? resolve(root, 'tests/fixtures')
            : path.startsWith('/public/')   ? resolve(root, 'public')
            : outDir;
  try {
    const body = readFileSync(resolve(dir, name));
    res.writeHead(200, { 'content-type': TYPES[extname(name)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  // 巨大なキャンバスを確保するテストがあるので、共有メモリの制限を外す
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
let failed = 0;
let passed = 0;

for (const file of files) {
  const js = resolve(outDir, basename(file).replace(/\.ts$/, '.js'));
  const html = resolve(outDir, basename(file).replace(/\.ts$/, '.html'));
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script type="module" src="./${basename(js)}"></script></body>`);

  const page = await browser.newPage();
  const consoleErrors = [];
  // 失敗の原因が見えないと直しようがない。例外もコンソールも即座に出す
  page.on('pageerror', (e) => {
    consoleErrors.push(String(e));
    console.log(`  [ページ内例外] ${e}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`  [${m.type()}] ${m.text()}`);
  });
  page.on('crash', () => console.log('  [ページがクラッシュしました（メモリ不足の可能性）]'));

  await page.goto(`${origin}/${basename(html)}`);
  let results;
  try {
    await page.waitForFunction(() => window.__RESULTS__ !== undefined, null, { timeout: 120_000 });
    results = await page.evaluate(() => window.__RESULTS__);
  } catch (e) {
    // 途中まででも結果を拾う。どのテストで止まったかが分かる
    results = await page.evaluate(() => window.__PARTIAL__ ?? []).catch(() => []);
    console.log(`  [中断] ${e.message.split('\n')[0]}`);
    console.log(`  → ${results.length} 件まで進んでいました`);
    failed++;
  }

  console.log(`\n${basename(file)}`);
  for (const r of results) {
    if (r.ok) {
      passed++;
      console.log(`  ✓ ${r.name}`);
    } else {
      failed++;
      console.log(`  ✗ ${r.name}`);
      console.log(`      ${r.detail}`);
    }
  }
  for (const e of consoleErrors) {
    failed++;
    console.log(`  ✗ ページ内で例外: ${e}`);
  }
  await page.close();
}

await browser.close();
server.close();
console.log(`\n実ブラウザ: ${passed} 件通過, ${failed} 件失敗`);
process.exit(failed > 0 ? 1 : 0);
