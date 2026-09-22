/** アプリそのものを人に渡す。共有シート → クリップボード → 手渡し の順に落ちる */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appUrl, shareApp } from '../../src/app/share';

/* LINE で受け取っても Safari / Chrome で開くように、LINE の約束事の印を付ける */
const URL_ = 'https://example.test/flame/?openExternalBrowser=1';

function setup(o: {
  share?: (d: ShareData) => Promise<void>;
  clipboard?: (t: string) => Promise<void>;
  href?: string;
}): void {
  vi.stubGlobal('window', { location: { origin: 'https://example.test', pathname: o.href ?? '/flame/' } });
  vi.stubGlobal('navigator', {
    ...(o.share ? { share: o.share } : {}),
    clipboard: { writeText: o.clipboard ?? (() => Promise.reject(new Error('だめ'))) },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('アプリの共有', () => {
  it('配るのは入口だけ。検索語や現在地は落とし、LINE の外で開く印だけ付ける', () => {
    setup({});
    expect(appUrl()).toBe(URL_);
  });

  it('共有シートが使えればそれを使う', async () => {
    const share = vi.fn(() => Promise.resolve());
    setup({ share });
    expect(await shareApp()).toEqual({ kind: 'shared' });
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: URL_ }));
  });

  it('★やめたときは失敗にしない。勝手にコピーもしない★', async () => {
    const abort = Object.assign(new Error('やめた'), { name: 'AbortError' });
    const copy = vi.fn(() => Promise.resolve());
    setup({ share: () => Promise.reject(abort), clipboard: copy });
    expect(await shareApp()).toEqual({ kind: 'cancelled' });
    expect(copy).not.toHaveBeenCalled();
  });

  it('共有シートが無ければコピーに落ちる', async () => {
    const copy = vi.fn(() => Promise.resolve());
    setup({ clipboard: copy });
    expect(await shareApp()).toEqual({ kind: 'copied', url: URL_ });
    expect(copy).toHaveBeenCalledWith(URL_);
  });

  it('共有シートが壊れていてもコピーに落ちる', async () => {
    const copy = vi.fn(() => Promise.resolve());
    setup({ share: () => Promise.reject(new Error('壊れている')), clipboard: copy });
    expect(await shareApp()).toEqual({ kind: 'copied', url: URL_ });
  });

  it('どちらも駄目なら URL を見せて手で渡してもらう', async () => {
    setup({});
    expect(await shareApp()).toEqual({ kind: 'manual', url: URL_ });
  });
});
