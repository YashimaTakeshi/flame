import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS, pushRing, readRing, safeStorage } from '../../src/platform/storage';

/** localStorage の差し替え。実ブラウザの壊れ方を再現する */
function install(impl: Partial<Storage>): void {
  const base: Storage = {
    length: 0,
    clear: () => {},
    getItem: () => null,
    key: () => null,
    removeItem: () => {},
    setItem: () => {},
  };
  vi.stubGlobal('localStorage', { ...base, ...impl });
}

function working(): Map<string, string> {
  const map = new Map<string, string>();
  install({
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  });
  return map;
}

beforeEach(() => safeStorage.__resetForTest());
afterEach(() => vi.unstubAllGlobals());

describe('使える環境', () => {
  it('書いたものが読める', () => {
    working();
    expect(safeStorage.init().mode).toBe('persistent');
    expect(safeStorage.set('a', '1')).toBe(true);
    expect(safeStorage.get('a')).toBe('1');
  });
});

describe('プライベートモード（存在するが setItem が投げる）', () => {
  it('存在確認では分からないので、書いて読み返して検知する', () => {
    install({
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    });
    expect(safeStorage.init().mode).toBe('memory');
    expect(safeStorage.state().degradedBy).toBe('probe');
  });

  it('保存できなくてもセッション中は読み書きできる', () => {
    install({
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    });
    safeStorage.init();
    expect(safeStorage.set('a', '1')).toBe(false); // 保存は失敗
    expect(safeStorage.get('a')).toBe('1'); //         でも読める
  });
});

describe('書き込めるが読めない、書いても残らない環境', () => {
  it('setItem が成功したように見えて残らない場合も memory に落ちる', () => {
    install({ getItem: () => null, setItem: () => {} });
    expect(safeStorage.init().mode).toBe('memory');
  });

  it('途中で getItem が投げ始めたら memory に落ちて読み続けられる', () => {
    const map = working();
    safeStorage.init();
    safeStorage.set('a', '1');
    install({
      getItem: () => {
        throw new Error('gone');
      },
      setItem: (k: string, v: string) => void map.set(k, v),
    });
    expect(safeStorage.get('a')).toBe('1'); // メモリから返る
    expect(safeStorage.state().mode).toBe('memory');
  });
});

describe('容量が尽きたとき', () => {
  it('ログを捨ててから書き直す。利用者の設定は守られる', () => {
    const map = new Map<string, string>();
    let rejectOnce = true;
    install({
      getItem: (k: string) => map.get(k) ?? null,
      removeItem: (k: string) => void map.delete(k),
      setItem: (k: string, v: string) => {
        // 設定の保存は1度だけ容量不足で失敗する。ログを削ったあとの再試行は通る
        if (rejectOnce && k === KEYS.settings) {
          rejectOnce = false;
          throw new DOMException('full', 'QuotaExceededError');
        }
        map.set(k, v);
      },
    });
    safeStorage.init();
    map.set(KEYS.netLog, JSON.stringify(Array.from({ length: 100 }, (_, i) => i)));
    map.set(KEYS.caps, '{}');

    expect(safeStorage.set(KEYS.settings, '{"mode":"kodawaru"}')).toBe(true);
    expect(map.get(KEYS.settings)).toBe('{"mode":"kodawaru"}');
    expect(readRing<number>(KEYS.netLog)).toHaveLength(20); // 100 → 20 に削られた
    expect(map.has(KEYS.caps)).toBe(false); //                測り直せるので捨てられた
    expect(safeStorage.state().mode).toBe('persistent'); //   落とさずに済んでいる
  });

  it('ログを捨てても入らなければ memory に落ちる', () => {
    // probe（書いて読み返す）は通るが、設定の保存だけは何度やっても容量不足になる環境
    const map = new Map<string, string>();
    install({
      getItem: (k: string) => map.get(k) ?? null,
      removeItem: (k: string) => void map.delete(k),
      setItem: (k: string, v: string) => {
        if (k === KEYS.settings) throw new DOMException('full', 'QuotaExceededError');
        map.set(k, v);
      },
    });
    safeStorage.init();
    expect(safeStorage.set(KEYS.settings, '{}')).toBe(false);
    expect(safeStorage.state().degradedBy).toBe('write');
  });
});

describe('記録（リング）', () => {
  it('上限を超えたら古いものから落ちる', () => {
    working();
    safeStorage.init();
    for (let i = 0; i < 25; i++) pushRing(KEYS.errLog, { i }, 20);
    const list = readRing<{ i: number }>(KEYS.errLog);
    expect(list).toHaveLength(20);
    expect(list[0]?.i).toBe(5);
    expect(list.at(-1)?.i).toBe(24);
  });

  it('中身が壊れていたら捨てて続ける。ログのために起動を止めない', () => {
    const map = working();
    safeStorage.init();
    map.set(KEYS.errLog, 'これはJSONではない');
    pushRing(KEYS.errLog, { i: 1 }, 20);
    expect(readRing<{ i: number }>(KEYS.errLog)).toEqual([{ i: 1 }]);
  });
});

describe('知らせ', () => {
  it('保存が使えなくなったら購読者に伝わる', () => {
    install({
      setItem: () => {
        throw new Error('no');
      },
    });
    const seen: string[] = [];
    safeStorage.subscribe((s) => seen.push(s.mode));
    safeStorage.init();
    expect(seen).toEqual(['memory']);
  });
});
