/**
 * この端末を調べる。
 *
 * 仕様には「実機でしか確かめられないこと」が並んでいる。HEIC がどう届くか、
 * キャンバスの上限がいくつか、保存が共有シートを通るか——どれも開発機では
 * 分からない。ここで実際に測り、結果をそのまま読めるようにする。
 *
 * **結果を外部に送る手段は用意していない。** 端末の中で見て、必要なら手で写す。
 */
import { useCallback, useMemo, useState } from 'react';
import { BUILD_INFO } from '../build-info';
import { decode } from '../platform/decode';
import { readExif } from './exif';
import { saveCapabilities } from '../platform/save';
import { KEYS, safeStorage } from '../platform/storage';
import { readNetLog } from '../platform/net';
import { createVerifiedCanvas, currentLimits, release } from '../render/guards';
import './theme.css';
import './App.css';

interface Row {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}

/** キャンバスの面積上限を二分探索で測る。iOS は Chromium より小さい見込み */
function measureCanvasArea(): { area: number; side: number } {
  const works = (w: number, h: number): boolean => {
    const r = createVerifiedCanvas(w, h);
    if (r.ok) {
      release(r.canvas);
      return true;
    }
    return false;
  };
  // 正方形で面積の上限を探す
  let lo = 1024;
  let hi = 32768;
  while (lo < hi - 64) {
    const mid = Math.floor((lo + hi) / 2);
    if (works(mid, mid)) lo = mid;
    else hi = mid;
  }
  // 辺の長さの上限を探す（高さ1で横に伸ばす）
  let slo = 1024;
  let shi = 131072;
  while (slo < shi - 64) {
    const mid = Math.floor((slo + shi) / 2);
    if (works(mid, 1)) slo = mid;
    else shi = mid;
  }
  return { area: lo * lo, side: slo };
}

export function Diagnostics({ onBack }: { onBack: () => void }): React.ReactElement {
  const [measured, setMeasured] = useState<Row | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [heic, setHeic] = useState<string>('未確認');

  // 端末の素性は描画のたびに変わらないので、最初の描画時に1度だけ集める
  const rows = useMemo<Row[]>(() => {
    const caps = saveCapabilities();
    const store = safeStorage.state();
    const log = readNetLog();
    return [
      { label: '版', value: `${BUILD_INFO.version} (${BUILD_INFO.commit})` },
      { label: 'ビルド日時', value: BUILD_INFO.buildTime },
      { label: '同梱書体の版', value: BUILD_INFO.fontSetVersion },
      { label: '地名データの版', value: BUILD_INFO.geoDataVersion },
      { label: 'ブラウザ', value: navigator.userAgent },
      { label: '画面', value: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x` },
      {
        label: '設定の保存',
        value: store.mode === 'persistent' ? '使える' : '使えない（この端末では設定が残りません）',
      },
      { label: '共有シート', value: caps.hasShare ? 'ある' : 'ない' },
      {
        label: 'ファイルの共有',
        value: caps.canShareFiles ? 'できる' : 'できない',
        note: 'これが「できる」なら、書き出した画像を写真アプリに直接渡せます',
      },
      { label: 'ダウンロード保存', value: caps.hasDownloadAttribute ? 'できる' : 'できない' },
      { label: 'OffscreenCanvas', value: typeof OffscreenCanvas !== 'undefined' ? 'ある' : 'ない' },
      {
        label: 'キャンバス上限（既定値）',
        value: `面積 ${currentLimits().area.toLocaleString()} / 辺 ${currentLimits().side.toLocaleString()}`,
        note: '開発機（Chromium）で実測した値。この端末の実際の上限は下で測れます',
      },
      { label: '外部への通信', value: `${log.length} 件の記録` },
    ];
  }, []);

  const allRows = measured ? [...rows, measured] : rows;

  const measure = useCallback(() => {
    setMeasuring(true);
    // 描画を1フレーム進めてから測る（「測っています」を見せるため）
    requestAnimationFrame(() => {
      setTimeout(() => {
        const m = measureCanvasArea();
        const longEdge = Math.floor(Math.sqrt((m.area * 4) / 5)); // 4:5 のときの長辺
        setMeasured({
          label: 'この端末のキャンバス上限',
          value: `面積 ${m.area.toLocaleString()} / 辺 ${m.side.toLocaleString()}`,
          note: `4:5 なら長辺 ${longEdge.toLocaleString()}px まで書き出せます`,
        });
        safeStorage.set(KEYS.caps, JSON.stringify(m));
        setMeasuring(false);
      }, 50);
    });
  }, []);

  const tryHeic = useCallback(async (file: File) => {
    setHeic('確かめています…');
    const notes: string[] = [`ファイル名: ${file.name}`, `形式: ${file.type || '（不明）'}`];
    try {
      const d = await decode(file);
      notes.push(`画像として開けた: ${d.natural.w}×${d.natural.h}`);
      d.bitmap.close();
    } catch (e) {
      notes.push(`画像として開けない: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      // 上で静的に import 済み
      const exif = await readExif(file);
      notes.push(exif.camera ? `撮影情報が読めた: ${exif.camera}` : '撮影情報は読めなかった');
    } catch {
      notes.push('撮影情報の読み取りで例外');
    }
    setHeic(notes.join(' / '));
  }, []);

  const report = [
    ...allRows.map((r) => `${r.label}: ${r.value}`),
    `写真の受け取り方: ${heic}`,
  ].join('\n');

  return (
    <div className="diag">
      <button className="chip" onClick={onBack}>
        ← もどる
      </button>

      <h2>この端末について</h2>
      <table>
        <tbody>
          {allRows.map((r) => (
            <tr key={r.label}>
              <th>
                {r.label}
                {r.note && (
                  <div style={{ fontWeight: 400, color: 'var(--ink-muted)', fontSize: 'var(--t-xs)' }}>
                    {r.note}
                  </div>
                )}
              </th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>キャンバスの上限をいま測る</h2>
      <p className="note">
        書き出せる最大の大きさを調べます。数秒かかり、その間は画面が止まります。
      </p>
      <button className="btn" onClick={measure} disabled={measuring}>
        {measuring ? '測っています…' : '測る'}
      </button>

      <h2>写真がどう届くか確かめる</h2>
      <p className="note">
        iPhone で撮った写真を選んでください。iOS が HEIC のまま渡すのか、
        JPEG に変換して渡すのかを確かめます。ここが分かると、変換の仕組みを
        積むかどうかを決められます。
      </p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void tryHeic(f);
        }}
      />
      <p className="note">{heic}</p>

      <h2>この内容を写す</h2>
      <textarea
        readOnly
        value={report}
        style={{
          width: '100%',
          minHeight: '12rem',
          font: 'var(--t-xs)/1.5 var(--mono-font)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          background: 'var(--surface)',
          padding: 'var(--s1)',
        }}
      />
      <p className="note">
        この内容はどこにも送られません。必要なら選んでコピーしてください。
      </p>
    </div>
  );
}
