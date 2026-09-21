import { describe, expect, it } from 'vitest';
import { shortVersion, softwareTag, type BuildInfo } from '../../src/build-info';

const clean: BuildInfo = {
  version: '1.3.0',
  commit: 'a4f2c9e',
  dirty: false,
  buildTime: '2026-09-21T08:00:00.000Z',
  fontSetVersion: 'fontset-ca7e7267',
  geoDataVersion: 'geo-2026-09-21',
};

describe('版の表記', () => {
  it('画面に出す短い表記', () => {
    expect(shortVersion(clean)).toBe('v1.3.0');
  });

  it('EXIF に焼き込む表記。画像1枚から版が分かる', () => {
    expect(softwareTag(clean)).toBe('flame 1.3.0 (a4f2c9e)');
  });

  it('未コミットの変更が混じったビルドには印がつく', () => {
    const dirty = { ...clean, dirty: true };
    expect(shortVersion(dirty)).toBe('v1.3.0+');
    expect(softwareTag(dirty)).toBe('flame 1.3.0+ (a4f2c9e)');
  });
});

describe('同梱データの版', () => {
  it('アプリの版とは別に持つ。データだけ差し替えたときに追える', () => {
    // 地名データだけを作り直した状況
    const after: BuildInfo = { ...clean, geoDataVersion: 'geo-2026-10-01' };
    expect(after.version).toBe(clean.version); // アプリの版は変わらない
    expect(after.geoDataVersion).not.toBe(clean.geoDataVersion); // データの版は変わる
  });
});
