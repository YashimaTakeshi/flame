/**
 * 設定の保存と読み戻し。
 *
 * ここで守りたいのは「壊れた1項目のせいで全部の設定を失わない」こと。
 * 版を上げて選択肢を減らしたとき、古い保存を読んで全部が既定に戻ると、
 * 利用者から見れば設定が消えたのと同じになる。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSaveForTest,
  flushSettings,
  readSaved,
  saveSettings,
  type Saved,
} from '../../src/app/state/persist';
import { DEFAULT_SPEC } from '../../src/core/styles/spec';
import { KEYS, safeStorage } from '../../src/platform/storage';

const DEFAULTS: Saved = {
  style: DEFAULT_SPEC,
  artist: '',
  fontKey: 'helvetica',
  colorKey: 'white',
  align: 'center',
  tracking: 'Normal',
  size: 'Medium',
  bordered: false,
  fields: { title: true, artist: true, date: true, camera: true, lens: true, exposure: true, focalLength: true, film: true, place: false },
  badge: 'logo',
  badgePlace: 'below',
  badgeAlign: 'center',
  badgeValign: 'center',
  badgeSize: 'M',
  badgeFramed: false,
};

const saved = (o: unknown): Saved => readSaved(JSON.stringify(o), DEFAULTS);

describe('設定の読み戻し', () => {
  it('保存が無い・壊れているときは既定から始める', () => {
    expect(readSaved(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(readSaved('{壊れた', DEFAULTS)).toEqual(DEFAULTS);
    expect(readSaved('[]', DEFAULTS)).toEqual(DEFAULTS);
    expect(readSaved('"文字列"', DEFAULTS)).toEqual(DEFAULTS);
  });

  it('保存したものがそのまま戻る', () => {
    const mine: Saved = {
      ...DEFAULTS,
      style: { ratio: 'SQ', photo: 'top', caption: 'below', captionAlign: 'end', lines: 3, margin: 'wide' },
      artist: 'T. Yashima',
      fontKey: 'didot',
      colorKey: 'ivory',
      align: 'right',
      tracking: 'Wide',
      size: 'Large',
      bordered: true,
      badge: 'text',
      badgePlace: 'right',
      badgeAlign: 'left',
      badgeValign: 'start',
      badgeSize: 'L',
      badgeFramed: true,
    };
    expect(saved(mine)).toEqual(mine);
  });

  it('★壊れた1項目だけが既定に戻り、ほかは残る★', () => {
    const got = saved({ ...DEFAULTS, fontKey: 'もう無い書体', size: 'Huge', align: 'right', bordered: true });
    expect(got.fontKey).toBe(DEFAULTS.fontKey);
    expect(got.size).toBe(DEFAULTS.size);
    expect(got.align).toBe('right');
    expect(got.bordered).toBe(true);
  });

  it('6軸の縛りは読み戻しでも効く（余白なしなら重ね）', () => {
    const got = saved({ ...DEFAULTS, style: { ...DEFAULTS.style, margin: 'none', caption: 'below', photo: 'top' } });
    expect(got.style.caption).toBe('overlay');
    expect(got.style.photo).toBe('center');
  });

  it('項目のオンオフは、保存に無い項目を既定のまま残す（版を上げて項目が増えても消えない）', () => {
    const got = saved({ ...DEFAULTS, fields: { title: false, place: true } });
    expect(got.fields.title).toBe(false);
    expect(got.fields.place).toBe(true);
    expect(got.fields.camera).toBe(true); // 保存に無い項目は既定のまま
    expect(Object.keys(got.fields).sort()).toEqual(Object.keys(DEFAULTS.fields).sort());
  });

  it('型の違うものを入れても落ちない', () => {
    const got = saved({ style: 7, artist: 42, fields: 'x', bordered: 'yes', badge: null, badgeSize: ['L'] });
    expect(got).toEqual(DEFAULTS);
  });

  it('長すぎる作者名は採らない（保存が膨らむのを防ぐ）', () => {
    expect(saved({ ...DEFAULTS, artist: 'あ'.repeat(200) }).artist).toBe(DEFAULTS.artist);
    expect(saved({ ...DEFAULTS, artist: 'あ'.repeat(120) }).artist).toBe('あ'.repeat(120));
  });
});

describe('設定のまとめ書き', () => {
  const store = (): Map<string, string> => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      length: 0,
      clear: () => {},
      key: () => null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    });
    return map;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    safeStorage.__resetForTest();
    __resetSaveForTest();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('続けて変えても書き込みは1回にまとまる', () => {
    const map = store();
    saveSettings({ ...DEFAULTS, size: 'Small' });
    saveSettings({ ...DEFAULTS, size: 'Large' });
    expect(map.get(KEYS.settings)).toBeUndefined();
    vi.advanceTimersByTime(500);
    expect(readSaved(map.get(KEYS.settings) ?? null, DEFAULTS).size).toBe('Large');
  });

  it('★同じ中身で呼び続けても待たされない★（指で構図を決めている間も保存される）', () => {
    const map = store();
    const mine: Saved = { ...DEFAULTS, colorKey: 'ivory' };
    saveSettings(mine);
    // 写真を指で動かしている間、設定は変わらないまま何度も呼ばれる
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(100);
      saveSettings(mine);
    }
    expect(readSaved(map.get(KEYS.settings) ?? null, DEFAULTS).colorKey).toBe('ivory');
  });

  it('画面が隠れるときは待たずに書き切る', () => {
    const map = store();
    saveSettings({ ...DEFAULTS, bordered: true });
    expect(map.get(KEYS.settings)).toBeUndefined();
    flushSettings();
    expect(readSaved(map.get(KEYS.settings) ?? null, DEFAULTS).bordered).toBe(true);
    flushSettings(); // 2度目は何もしない
  });

  it('保存が使えない端末でも落ちない', () => {
    vi.stubGlobal('localStorage', {
      length: 0, clear: () => {}, key: () => null, getItem: () => null, removeItem: () => {},
      setItem: () => { throw new Error('プライベートモード'); },
    });
    safeStorage.init();
    expect(() => {
      saveSettings({ ...DEFAULTS, bordered: true });
      vi.advanceTimersByTime(500);
    }).not.toThrow();
  });
});
