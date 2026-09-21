import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** git の情報。CI でも手元でも同じ形で取れるようにし、取れなければ不明として続ける */
function git(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * 同梱データの版は、アプリの版とは別に持つ。
 * 地名データや書体だけを差し替えたときアプリの版が変わらないと、
 * 「なぜ地名の出方が変わったのか」を後から追えなくなる。
 */
const fontManifest = readJson('public/fonts/manifest.json');
const geoJp = readJson('public/geo/jp-municipalities.json');

// 書体の版は manifest 全体の指紋にする。1書体でも作り直せば変わる
const fontSetVersion = (() => {
  const jp = (fontManifest['jp'] as { regular?: { sha256?: string } } | undefined)?.regular?.sha256;
  return jp ? `fontset-${jp.slice(0, 8)}` : 'fontset-unknown';
})();
const geoDataVersion = typeof geoJp['builtAt'] === 'string' ? `geo-${geoJp['builtAt']}` : 'geo-unknown';

const pkg = readJson('package.json');

const BUILD = {
  version: String(pkg['version'] ?? '0.0.0'),
  commit: (process.env['GITHUB_SHA'] ?? git('git rev-parse HEAD')).slice(0, 7) || 'unknown',
  // 手元のビルドで未コミットの変更が混じっていたら印をつける。
  // 不具合報告の画像に焼き込まれるので、再現に使った版が本当に共有されているか分かる
  dirty: git('git status --porcelain').length > 0,
  buildTime: new Date().toISOString(),
  fontSetVersion,
  geoDataVersion,
};

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD__: JSON.stringify(BUILD),
  },
  build: {
    target: 'es2022',
    // 和文フォントと世界の地名は別チャンクのまま遅延で読ませる。
    // インライン化されると初回ロードに載ってしまう
    assetsInlineLimit: 4096,
  },
  worker: { format: 'es' },
});
