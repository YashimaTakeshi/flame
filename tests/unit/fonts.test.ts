import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetForTest,
  assertReady,
  ensureFont,
  FontLoadError,
  FontNotReadyError,
  isReady,
  loadedFonts,
  verifyFontIdentity,
  type FontRef,
} from '../../src/render/resources/fonts';

const ARIMO: FontRef = { family: 'Arimo', weight: 400 };

/** FontFace の差し替え。load() の成否と status を操れるようにする */
function installFontFace(behavior: {
  fail?: boolean;
  statusAfterLoad?: FontFace['status'];
  onLoad?: () => void;
}): { added: FontFace[] } {
  const added: FontFace[] = [];
  class FakeFontFace {
    status: FontFace['status'] = 'unloaded';
    family: string;
    constructor(family: string, _source: unknown, _descriptors?: unknown) {
      this.family = family;
    }
    async load(): Promise<this> {
      behavior.onLoad?.();
      if (behavior.fail) throw new Error('取得できません');
      this.status = behavior.statusAfterLoad ?? 'loaded';
      return this;
    }
  }
  vi.stubGlobal('FontFace', FakeFontFace);
  vi.stubGlobal('fonts', { add: (f: FontFace) => void added.push(f) });
  return { added };
}

beforeEach(() => __resetForTest());
afterEach(() => vi.unstubAllGlobals());

describe('読み込み', () => {
  it('読み込めた書体だけが台帳に載る', async () => {
    const { added } = installFontFace({});
    expect(isReady(ARIMO)).toBe(false);
    await ensureFont(ARIMO, { kind: 'url', url: '/fonts/Arimo-regular.woff2' });
    expect(isReady(ARIMO)).toBe(true);
    expect(added).toHaveLength(1);
    expect(loadedFonts()).toEqual([ARIMO]);
  });

  it('バイト列からも読み込める（取り寄せた和文はこちら）', async () => {
    installFontFace({});
    await ensureFont({ family: 'NotoSansJP', weight: 400 }, { kind: 'bytes', bytes: new ArrayBuffer(8) });
    expect(isReady({ family: 'NotoSansJP', weight: 400 })).toBe(true);
  });

  it('取得に失敗したら台帳に載らない', async () => {
    installFontFace({ fail: true });
    await expect(ensureFont(ARIMO, { kind: 'url', url: '/x.woff2' })).rejects.toThrow(FontLoadError);
    expect(isReady(ARIMO)).toBe(false);
  });

  it('★load() が resolve しても status が loaded でなければ載せない★', async () => {
    // これを見ないと「読み込んだつもり」で描いてしまう
    installFontFace({ statusAfterLoad: 'error' });
    await expect(ensureFont(ARIMO, { kind: 'url', url: '/x.woff2' })).rejects.toThrow(FontLoadError);
    expect(isReady(ARIMO)).toBe(false);
  });

  it('同じ書体を同時に要求しても読み込みは1回にまとめる', async () => {
    let loads = 0;
    installFontFace({ onLoad: () => loads++ });
    await Promise.all([
      ensureFont(ARIMO, { kind: 'url', url: '/a.woff2' }),
      ensureFont(ARIMO, { kind: 'url', url: '/a.woff2' }),
      ensureFont(ARIMO, { kind: 'url', url: '/a.woff2' }),
    ]);
    expect(loads).toBe(1);
  });

  it('太さが違えば別の書体として扱う', async () => {
    installFontFace({});
    await ensureFont(ARIMO, { kind: 'url', url: '/a.woff2' });
    expect(isReady({ family: 'Arimo', weight: 700 })).toBe(false);
  });
});

describe('★描く直前の確認★（この仕組みの存在理由）', () => {
  it('台帳に無い書体で描こうとしたら止める', () => {
    expect(() => assertReady(ARIMO)).toThrow(FontNotReadyError);
  });

  it('台帳にあれば通す', async () => {
    installFontFace({});
    await ensureFont(ARIMO, { kind: 'url', url: '/a.woff2' });
    expect(() => assertReady(ARIMO)).not.toThrow();
  });
});

describe('別人確認', () => {
  it('フォールバックと幅が完全一致したら疑う', () => {
    // 実測では、待たずに描いたときの幅がフォールバック基準値と 1 の位まで一致した
    const measure = (): number => 554.625;
    expect(verifyFontIdentity(measure, ARIMO)).toBe('fallback-suspected');
  });

  it('幅が違えば正しく読み込まれている', () => {
    const measure = (font: string): number => (font.includes('Arimo') ? 608.641 : 554.625);
    expect(verifyFontIdentity(measure, ARIMO)).toBe('ok');
  });

  it('わずかな差では疑わない。OS 差で数%ぶれるため曖昧な判定で止めない', () => {
    const measure = (font: string): number => (font.includes('Arimo') ? 560.0 : 554.625);
    expect(verifyFontIdentity(measure, ARIMO)).toBe('ok');
  });
});
