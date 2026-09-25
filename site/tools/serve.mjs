/**
 * 手元で紹介ページを配る（本番と同じ CSP を付ける）。試作は /proto/<名前>/ に出る。
 *
 *   node site/tools/serve.mjs [ポート]            # 既定 8787
 *
 *   /                 … site/public（本番の中身。/fuchidori/img/ の作例もここ）
 *   /proto/<名前>/    … site/tools/work/proto/<名前>/（試作。リポジトリには入らない）
 *   PREVIEW_SERIF=… を付けると、手元に無い明朝体の代わりに Noto Serif JP を 'Noto Serif JP' として全 CSS の頭に差し込む
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(HERE, '../public');
const PROTO = resolve(HERE, 'work/proto');
const PORT = Number(process.argv[2] ?? 8787);
const CSP = readFileSync(resolve(PUB, '_headers'), 'utf8').match(/Content-Security-Policy: (.*)/)[1];
const SERIF = process.env.PREVIEW_SERIF;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p === '/__serif.woff2' && SERIF) return void res.writeHead(200, { 'content-type': 'font/woff2' }).end(readFileSync(SERIF));
  if (p === '/__serif.css') {
    // 明朝の代わり。ページ側で <link rel="stylesheet" href="/__serif.css"> を足したときだけ効く（本番には無い）
    return void res.writeHead(200, { 'content-type': 'text/css' }).end(SERIF ? "@font-face{font-family:'Noto Serif JP';src:url(/__serif.woff2);font-weight:100 900}" : '');
  }
  const root = p.startsWith('/proto/') ? PROTO : PUB;
  let f = resolve(root, '.' + (p.startsWith('/proto/') ? p.slice('/proto'.length) : p));
  if (existsSync(f) && statSync(f).isDirectory()) f = resolve(f, 'index.html');
  if (!f.startsWith(root) || !existsSync(f)) return void res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream', 'content-security-policy': CSP });
  // 手元確認用: CSS の頭に明朝の代わりを差し込む（ページ側は何も変えなくてよい）
  if (SERIF && extname(f) === '.css') return void res.end("@font-face{font-family:'Noto Serif JP';src:url(/__serif.woff2);font-weight:100 900}\n" + readFileSync(f));
  res.end(readFileSync(f));
}).listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}/`));
