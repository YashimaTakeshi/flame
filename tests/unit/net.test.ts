import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { netFetch, readNetLog } from '../../src/platform/net';
import { safeStorage } from '../../src/platform/storage';

function useWorkingStorage(): void {
  const map = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    length: 0,
    clear: () => map.clear(),
    key: () => null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  });
  safeStorage.init();
}

beforeEach(() => {
  safeStorage.__resetForTest();
  useWorkingStorage();
});
afterEach(() => vi.unstubAllGlobals());

const res = (bytes: number, ok = true): Response =>
  ({ ok, headers: new Headers({ 'content-length': String(bytes) }) }) as Response;

describe('通信の記録', () => {
  it('成功した通信が記録に残る', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(9436)));
    await netFetch('https://fonts.gstatic.com/s/a.woff2', {}, { kind: 'font-fetch', sentText: '彅' });

    const log = readNetLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      host: 'fonts.gstatic.com',
      kind: 'font-fetch',
      sentText: '彅',
      bytes: 9436,
      ok: true,
    });
  });

  it('★失敗した通信も記録に残る★ 記録の抜けは棚卸しを嘘にする', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('オフライン')));
    await expect(
      netFetch('https://fonts.googleapis.com/css2', {}, { kind: 'font-fetch', sentText: '彅' }),
    ).rejects.toThrow('オフライン');

    const log = readNetLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.ok).toBe(false);
    expect(log[0]?.sentText).toBe('彅'); // 送ろうとした内容は残す
  });

  it('文字を送らない通信では sentText が null になる', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(986400)));
    await netFetch('/geo/world-cities.json', {}, { kind: 'geo-world' });
    expect(readNetLog()[0]?.sentText).toBeNull();
  });

  it('記録は直近100件で古いものから落ちる', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(1)));
    for (let i = 0; i < 105; i++) {
      await netFetch(`/a/${i}`, {}, { kind: 'app' });
    }
    const log = readNetLog();
    expect(log).toHaveLength(100);
    expect(log[0]?.host).toBe('localhost'); // 相対URLは自ドメイン扱い
  });

  it('保存が死んでいても通信は止まらない', async () => {
    safeStorage.__resetForTest();
    vi.stubGlobal('localStorage', {
      length: 0,
      clear: () => {},
      key: () => null,
      getItem: () => null,
      setItem: () => {
        throw new Error('保存できない');
      },
      removeItem: () => {},
    });
    safeStorage.init();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(100)));
    await expect(netFetch('/a', {}, { kind: 'app' })).resolves.toBeTruthy();
  });
});
