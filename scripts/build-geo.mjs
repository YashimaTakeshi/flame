// 撮影地の地名を引くためのデータを作る。
//
// 設計原則「写真も位置情報も端末の外に出さない」を守るため、逆ジオコーディング API は使わず、
// 代表点の一覧を同梱して最近傍で引く。精度は市区町村レベルで、行政境界の付近では
// 隣の自治体名が出ることがある（docs/poc/report-geo-batch.md の実測）。
// その誤りを「断定しない」ための自信度は、引く側（src/）で計算する。
//
// 出来上がった JSON はリポジトリにコミットする。通常のビルドではこのスクリプトは走らない。
//
// 出典（成果物に表示する義務がある）:
//   日本   : Geolonia 住所データ（CC BY 4.0）https://github.com/geolonia/japanese-addresses
//   世界   : GeoNames（CC BY 4.0）https://www.geonames.org/ ※ npm all-the-cities 経由
import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/geo');
const work = resolve(root, '.geowork');
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });

const JP_CSV = 'https://raw.githubusercontent.com/geolonia/japanese-addresses/master/data/latest.csv';
const WORLD_MIN_POPULATION = 15000;

async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`  キャッシュを使います: ${dest} (${(statSync(dest).size / 1e6).toFixed(1)} MB)`);
    return dest;
  }
  console.log(`  取得中: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`取得に失敗しました (${res.status}): ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`  取得しました: ${(statSync(dest).size / 1e6).toFixed(1)} MB`);
  return dest;
}

// --- 日本: 大字町丁目の座標を市区町村ごとに平均して代表点にする ---
async function buildJapan() {
  console.log('日本の市区町村:');
  const csv = await download(JP_CSV, resolve(work, 'japanese-addresses.csv'));
  const text = readFileSync(csv, 'utf8');
  const lines = text.split('\n');
  // このCSVは各フィールドが引用符で囲まれている。剥がさないと地名に " が混じる。
  const unquote = (s) => s.replace(/^"(.*)"$/s, '$1').trim();
  const header = lines[0].split(',').map(unquote);
  const col = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`列が見つかりません: ${name}（実際の列: ${header.join(', ')}）`);
    return i;
  };
  const iPref = col('都道府県名');
  const iCity = col('市区町村名');
  const iLat = col('緯度');
  const iLng = col('経度');

  const acc = new Map();
  for (let n = 1; n < lines.length; n++) {
    const line = lines[n];
    if (!line) continue;
    const f = line.split(',');
    const rawLat = unquote(f[iLat] ?? '');
    const rawLng = unquote(f[iLng] ?? '');
    // 座標が空の行がある。Number('') は 0 になり、弾かないと平均が海の彼方へ引きずられる
    // （大分市の代表点が中国大陸の沖に出た）。空欄と日本の範囲外はここで捨てる。
    if (rawLat === '' || rawLng === '') continue;
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < 20 || lat > 46 || lng < 122 || lng > 154) continue;
    const pref = unquote(f[iPref] ?? '');
    const city = unquote(f[iCity] ?? '');
    if (!pref || !city) continue;
    const key = `${pref}\u0000${city}`;
    let a = acc.get(key);
    if (!a) { a = { pref, city, lat: 0, lng: 0, n: 0 }; acc.set(key, a); }
    a.lat += lat; a.lng += lng; a.n++;
  }

  // 小数4桁（約11m）あれば市区町村の代表点としては十分。桁を削るとファイルが目に見えて縮む。
  const rows = [...acc.values()]
    .map((a) => [a.pref, a.city, +(a.lat / a.n).toFixed(4), +(a.lng / a.n).toFixed(4)])
    .sort((x, y) => (x[0] === y[0] ? x[1].localeCompare(y[1]) : x[0].localeCompare(y[0])));

  const data = {
    source: 'Geolonia 住所データ',
    license: 'CC BY 4.0',
    url: 'https://github.com/geolonia/japanese-addresses',
    attribution: '「Geolonia 住所データ」（Geolonia）を加工して作成',
    builtAt: new Date().toISOString().slice(0, 10),
    fields: ['pref', 'city', 'lat', 'lng'],
    rows,
  };
  const p = resolve(out, 'jp-municipalities.json');
  writeFileSync(p, JSON.stringify(data));
  console.log(`  ${rows.length.toLocaleString()} 件 → ${(statSync(p).size / 1024).toFixed(1)} KB`);
  return rows.length;
}

// --- 世界: GeoNames の都市から人口 15,000 以上を抜く ---
async function buildWorld() {
  console.log('世界の主要都市:');
  const { default: cities } = await import('all-the-cities');
  const rows = cities
    .filter((c) => c.population >= WORLD_MIN_POPULATION)
    .map((c) => [c.name, c.country, +c.loc.coordinates[1].toFixed(4),
                 +c.loc.coordinates[0].toFixed(4), c.population])
    .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1].localeCompare(b[1])));

  const data = {
    source: 'GeoNames',
    license: 'CC BY 4.0',
    url: 'https://www.geonames.org/',
    attribution: 'Data from GeoNames (https://www.geonames.org/), licensed under CC BY 4.0',
    builtAt: new Date().toISOString().slice(0, 10),
    minPopulation: WORLD_MIN_POPULATION,
    fields: ['name', 'country', 'lat', 'lng', 'population'],
    rows,
  };
  const p = resolve(out, 'world-cities.json');
  writeFileSync(p, JSON.stringify(data));
  console.log(`  ${rows.length.toLocaleString()} 件 → ${(statSync(p).size / 1024).toFixed(1)} KB`);
  return rows.length;
}

const jp = await buildJapan();
const world = await buildWorld();
{
  const jpData = JSON.parse(readFileSync(resolve(out, 'jp-municipalities.json'), 'utf8'));
  const dirty = jpData.rows.filter((r) => /["\r\n]/.test(r[0]) || /["\r\n]/.test(r[1]));
  if (dirty.length) {
    throw new Error(`地名に引用符や改行が混じっています（${dirty.length} 件）例: ${JSON.stringify(dirty[0])}`);
  }
  const outOfJapan = jpData.rows.filter((r) => r[2] < 20 || r[2] > 46 || r[3] < 122 || r[3] > 154);
  if (outOfJapan.length) {
    throw new Error(`日本の範囲外の座標があります（${outOfJapan.length} 件）例: ${JSON.stringify(outOfJapan[0])}`);
  }
}
if (jp < 1500) throw new Error(`日本の市区町村が ${jp} 件しかありません（1,700 件前後のはず）`);
if (world < 20000) throw new Error(`世界の都市が ${world} 件しかありません（24,000 件前後のはず）`);
console.log('\n地名データを作りました。');
