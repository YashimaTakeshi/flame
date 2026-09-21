import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createVerifiedCanvas,
  DEFAULT_LIMITS,
  release,
  resizeIfNeeded,
  setMeasuredLimits,
} from '../../src/render/guards';

/**
 * 実ブラウザの壊れ方を模した OffscreenCanvas。
 *
 * silentAbove を超える面積では「例外を投げず、すべて成功したように振る舞い、
 * getImageData だけが透明な黒を返す」——実測で確認した壊れ方（report-canvas.md）。
 */
function installCanvas(opts: { silentAbove?: number; nullContext?: boolean } = {}): void {
  class FakeCanvas {
    width: number;
    height: number;
    readonly pixels = new Map<string, number[]>();
    fill: number[] = [0, 0, 0, 255];

    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }

    get silent(): boolean {
      return opts.silentAbove != null && this.width * this.height > opts.silentAbove;
    }

    getContext(): unknown {
      if (opts.nullContext) return null;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const c: FakeCanvas = this;
      return {
        set fillStyle(v: string) {
          const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(v.replace(/\s/g, ''));
          if (m) c.fill = [Number(m[1]), Number(m[2]), Number(m[3]), 255];
        },
        fillRect(x: number, y: number) {
          if (c.silent) return; // 黙って何もしない
          c.pixels.set(`${x},${y}`, [...c.fill]);
        },
        getImageData(x: number, y: number) {
          return { data: c.silent ? [0, 0, 0, 0] : (c.pixels.get(`${x},${y}`) ?? [0, 0, 0, 0]) };
        },
        clearRect() {},
      };
    }
  }
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
}

beforeEach(() => setMeasuredLimits(null));
afterEach(() => {
  setMeasuredLimits(null);
  vi.unstubAllGlobals();
});

describe('確保できる場合', () => {
  it('書いて読み返せたキャンバスだけを返す', () => {
    installCanvas();
    expect(createVerifiedCanvas(800, 533).ok).toBe(true);
  });

  it('小数は切り捨てる', () => {
    installCanvas();
    const r = createVerifiedCanvas(800.7, 533.2);
    expect(r.ok && r.canvas.width).toBe(800);
    expect(r.ok && r.canvas.height).toBe(533);
  });
});

describe('既知の上限との事前照合', () => {
  it('面積が上限を超えたら確保せずに断る', () => {
    installCanvas();
    const side = Math.ceil(Math.sqrt(DEFAULT_LIMITS.area)) + 1;
    const r = createVerifiedCanvas(side, side);
    expect(!r.ok && r.reason).toBe('area');
  });

  it('辺の長さが上限を超えたら断る', () => {
    installCanvas();
    const r = createVerifiedCanvas(DEFAULT_LIMITS.side + 1, 1);
    expect(!r.ok && r.reason).toBe('side');
  });

  it('端末で実測した上限があればそちらを使う（iOS は Chromium より小さい見込み）', () => {
    installCanvas();
    setMeasuredLimits({ area: 16_777_216, side: 8192 });
    // 6000x4000 = 24,000,000px。Chromium の上限 2^28 なら通るが、この端末では通らない
    const r = createVerifiedCanvas(6000, 4000);
    expect(!r.ok && r.reason).toBe('area');
  });

  it('辺と面積の両方を超える場合は、先に辺で断る（確保を試さずに済む）', () => {
    installCanvas();
    setMeasuredLimits({ area: 16_777_216, side: 4096 });
    const r = createVerifiedCanvas(6000, 4000);
    expect(!r.ok && r.reason).toBe('side');
  });
});

describe('★黙って失敗する場合★（この仕組みの存在理由）', () => {
  it('例外を投げず透明な黒を返すキャンバスを、確保失敗として扱う', () => {
    installCanvas({ silentAbove: 1000 }); // 上限照合は通るが実際には描けない
    const r = createVerifiedCanvas(100, 100);
    expect(!r.ok && r.reason).toBe('verify');
  });

  it('getContext が null を返す場合も失敗として扱う', () => {
    installCanvas({ nullContext: true });
    const r = createVerifiedCanvas(100, 100);
    expect(!r.ok && r.reason).toBe('context');
  });
});

describe('使い回し', () => {
  it('同じ大きさなら確保し直さない。検証は確保のたびに1回だけ', () => {
    installCanvas();
    const first = createVerifiedCanvas(800, 600);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = resizeIfNeeded({ canvas: first.canvas, ctx: first.ctx }, 800, 600);
    expect(again.ok && again.canvas).toBe(first.canvas);
  });

  it('大きさが変わったら確保し直し、古いほうを手放す', () => {
    installCanvas();
    const first = createVerifiedCanvas(800, 600);
    if (!first.ok) return;
    const next = resizeIfNeeded({ canvas: first.canvas, ctx: first.ctx }, 400, 300);
    expect(next.ok && next.canvas).not.toBe(first.canvas);
    expect(first.canvas.width).toBe(0);
  });
});

describe('手放し', () => {
  it('0x0 にしてから捨てる。GC を待たずにピクセルを解放する', () => {
    installCanvas();
    const r = createVerifiedCanvas(800, 600);
    if (!r.ok) return;
    release(r.canvas);
    expect(r.canvas.width).toBe(0);
    expect(r.canvas.height).toBe(0);
  });
});
