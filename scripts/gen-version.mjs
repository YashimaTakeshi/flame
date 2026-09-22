/**
 * dist/version.json を作る。配信後の確認（この版が届いているか）と、
 * 将来の「新しい版があります」の検知に使う（§15.2）。vite.config.ts と同じ値。
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const git = (cmd) => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};
if (!existsSync('dist')) {
  console.error('dist が無い。先に vite build を');
  process.exit(1);
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const out = {
  version: String(pkg.version ?? '0.0.0'),
  commit: (process.env.GITHUB_SHA ?? git('git rev-parse HEAD')).slice(0, 7) || 'unknown',
  buildTime: new Date().toISOString(),
};
writeFileSync('dist/version.json', JSON.stringify(out) + '\n');
console.log('version.json:', JSON.stringify(out));
