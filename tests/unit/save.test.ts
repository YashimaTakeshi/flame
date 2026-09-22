/**
 * 保存の経路。PC では保存先を選ぶ窓（エクスプローラー / Finder）が第一。
 * PC の Chromium も共有にファイルを渡せるので、区別しないと Windows の共有パネルが開く（実機で指摘された）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canPickLocation, inAppBrowser, makeFilename, saveImage } from '../../src/platform/save';

const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

function setup(o: {
  picker?: (opts: unknown) => Promise<unknown>;
  share?: (d: unknown) => Promise<void>;
  canShare?: boolean;
}): { shared: unknown[]; clicked: string[] } {
  const shared: unknown[] = [];
  const clicked: string[] = [];
  const anchor = {
    href: '',
    download: '',
    rel: '',
    click: () => clicked.push(anchor.download),
    remove: () => {},
  };
  vi.stubGlobal('window', {
    self: 1,
    top: 1,
    ...(o.picker ? { showSaveFilePicker: o.picker } : {}),
  });
  vi.stubGlobal('document', {
    createElement: () => anchor,
    body: { appendChild: () => {} },
  });
  vi.stubGlobal('navigator', {
    ...(o.share ? { share: (d: unknown) => { shared.push(d); return o.share!(d); } } : {}),
    ...(o.canShare !== undefined ? { canShare: () => o.canShare } : {}),
  });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
  vi.stubGlobal(
    'File',
    class {
      name: string;
      constructor(_parts: unknown[], name: string) {
        this.name = name;
      }
    },
  );
  return { shared, clicked };
}

afterEach(() => vi.unstubAllGlobals());

describe('ファイル名とアプリ内ブラウザ', () => {
  it('名前は撮影日時の壁時計から。端末のタイムゾーンに触らない', () => {
    expect(makeFilename({ y: 2026, m: 9, d: 21, hh: 8, mm: 45, ss: 12 })).toBe('fuchidori-20260921-084512.jpg');
  });

  it('LINE / Instagram の中のブラウザは UA の印で見分ける', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1 Line/14.0.0' });
    expect(inAppBrowser()).toBe(true);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 Instagram 300.0' });
    expect(inAppBrowser()).toBe(true);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' });
    expect(inAppBrowser()).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(inAppBrowser()).toBe(false);
  });
});

describe('保存先を選ぶ窓', () => {
  it('窓があれば canPickLocation は真、無ければ偽', () => {
    setup({ picker: () => Promise.resolve() });
    expect(canPickLocation()).toBe(true);
    setup({});
    expect(canPickLocation()).toBe(false);
  });

  it('★picker を頼まれたら、共有できる端末でも窓を開く★', async () => {
    const written: Blob[] = [];
    const handle = { createWritable: () => Promise.resolve({ write: (b: Blob) => { written.push(b); return Promise.resolve(); }, close: () => Promise.resolve() }) };
    const picker = vi.fn(() => Promise.resolve(handle));
    const { shared } = setup({ picker, share: () => Promise.resolve(), canShare: true });
    const r = await saveImage(blob, 'a.jpg', 'picker');
    expect(r).toEqual({ method: 'picker', ok: true, detail: '保存しました' });
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'a.jpg' }));
    expect(written).toHaveLength(1);
    expect(shared).toHaveLength(0);
  });

  it('窓を閉じただけなら取りやめ。共有やダウンロードに勝手に落ちない', async () => {
    const abort = Object.assign(new Error('closed'), { name: 'AbortError' });
    const { shared, clicked } = setup({ picker: () => Promise.reject(abort), share: () => Promise.resolve(), canShare: true });
    const r = await saveImage(blob, 'a.jpg', 'picker');
    expect(r.method).toBe('picker');
    expect(r.ok).toBe(false);
    expect(shared).toHaveLength(0);
    expect(clicked).toHaveLength(0);
  });

  it('窓を開けない（権限なし）ならダウンロードに落ちる', async () => {
    const denied = Object.assign(new Error('no'), { name: 'SecurityError' });
    const { clicked } = setup({ picker: () => Promise.reject(denied) });
    const r = await saveImage(blob, 'a.jpg', 'picker');
    expect(r.method).toBe('download');
    expect(clicked).toEqual(['a.jpg']);
  });

  it('download を頼まれたら、共有できる端末でも共有に行かない', async () => {
    const { shared, clicked } = setup({ share: () => Promise.resolve(), canShare: true });
    const r = await saveImage(blob, 'a.jpg', 'download');
    expect(r.method).toBe('download');
    expect(shared).toHaveLength(0);
    expect(clicked).toEqual(['a.jpg']);
  });

  it('auto はこれまでどおり共有シートが先（スマホの写真アプリに入る）', async () => {
    const { shared } = setup({ share: () => Promise.resolve(), canShare: true });
    const r = await saveImage(blob, 'a.jpg');
    expect(r.method).toBe('share');
    expect(shared).toHaveLength(1);
  });
});
