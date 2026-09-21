/** 実ブラウザ内で走る、ごく小さなテストの器 */
export interface Result {
  name: string;
  ok: boolean;
  detail: string;
}

declare global {
  interface Window {
    __RESULTS__?: Result[];
    /** 途中で止まったときに、どこまで進んだかを外から読めるようにする */
    __PARTIAL__?: Result[];
  }
}

const results: Result[] = [];
if (typeof window !== 'undefined') window.__PARTIAL__ = results;

export async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true, detail: '' });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}

export function expectEqual<T>(actual: T, expected: T, what: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${what}: 期待 ${String(expected)} / 実際 ${String(actual)}`);
  }
}

export function expectTrue(cond: boolean, what: string): void {
  if (!cond) throw new Error(what);
}

export function done(): void {
  window.__RESULTS__ = results;
}
