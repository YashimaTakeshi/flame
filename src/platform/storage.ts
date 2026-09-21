/**
 * 設定の保存。
 *
 * ここで気をつけるのは2つ。
 *
 * 1. **Safari のプライベートモードでは localStorage が「存在するのに setItem が投げる」。**
 *    `if (window.localStorage)` では検知できない。書いて読み返すまでやって初めて分かる。
 * 2. **保存が死んでいてもアプリは動き続けなければならない。** 設定が残らないのは不便だが、
 *    起動できないのは壊れている。失敗しても必ずメモリに持ち、セッション中は完全に動く。
 */

type Mode = 'persistent' | 'memory';

/** 保存が使えないと分かったときに呼ばれる。UI 層が購読して知らせる */
export type StorageListener = (state: StorageState) => void;

export interface StorageState {
  readonly mode: Mode;
  /** 'probe' = 最初から使えなかった / 'read' | 'write' = 途中で落ちた */
  readonly degradedBy: 'probe' | 'read' | 'write' | null;
}

const PROBE_KEY = '__flame_probe__';

let mode: Mode = 'persistent';
let degradedBy: StorageState['degradedBy'] = null;
let initialized = false;
const memory = new Map<string, string>();
const listeners = new Set<StorageListener>();

function notify(): void {
  const state: StorageState = { mode, degradedBy };
  for (const l of listeners) l(state);
}

function degrade(by: 'probe' | 'read' | 'write'): void {
  if (mode === 'memory') return; // 一度落としたら以降は試さない。毎回投げさせない
  mode = 'memory';
  degradedBy = by;
  notify();
}

/**
 * quota 超過かどうか。ブラウザによって名前もコードも違う。
 * Firefox は名前が空で code だけ、Safari は独自の例外名を使うことがある。
 */
function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = e.name;
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    (e as DOMException).code === 22 ||
    (e as DOMException).code === 1014
  );
}

function probe(): Mode {
  try {
    localStorage.setItem(PROBE_KEY, '1');
    const ok = localStorage.getItem(PROBE_KEY) === '1';
    localStorage.removeItem(PROBE_KEY);
    return ok ? 'persistent' : 'memory';
  } catch {
    return 'memory';
  }
}

/**
 * quota が尽きたときに最初に捨てるもの（優先度の低い順）。
 * 利用者が作ったもの（設定・プリセット）は最後まで守る。ログと測定結果は捨ててよい。
 */
function evictLowPriority(): void {
  trimRing(KEYS.netLog, 20);
  trimRing(KEYS.errLog, 5);
  removeRaw(KEYS.caps); // 能力測定は測り直せる
}

function removeRaw(key: string): void {
  memory.delete(key);
  if (mode === 'memory') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* 消せないなら放っておく。ここで落とすほうが害が大きい */
  }
}

export const safeStorage = {
  /** 起動時に1度だけ呼ぶ。書いて読み返すところまでやる */
  init(): StorageState {
    if (!initialized) {
      initialized = true;
      if (probe() === 'memory') degrade('probe');
    }
    return { mode, degradedBy };
  },

  subscribe(fn: StorageListener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  state(): StorageState {
    return { mode, degradedBy };
  },

  get(key: string): string | null {
    if (mode === 'memory') return memory.get(key) ?? null;
    try {
      return localStorage.getItem(key);
    } catch {
      degrade('read');
      return memory.get(key) ?? null;
    }
  },

  /** 保存できたら true。false でもメモリには入っているので、セッション中は読める */
  set(key: string, value: string): boolean {
    memory.set(key, value); // ★保存の成否によらず必ずメモリに入れる★
    if (mode === 'memory') return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (isQuotaError(e)) {
        evictLowPriority();
        try {
          localStorage.setItem(key, value);
          return true;
        } catch {
          /* 捨てても入らなかった。下の degrade に落ちる */
        }
      }
      degrade('write');
      return false;
    }
  },

  remove(key: string): void {
    removeRaw(key);
  },

  /** テスト用。モジュールの状態を初期化する */
  __resetForTest(): void {
    mode = 'persistent';
    degradedBy = null;
    initialized = false;
    memory.clear();
    listeners.clear();
  },
};

/** 保存するもののキー。**版を含める**ことで、将来の非互換を安全に切り替えられる */
export const KEYS = {
  settings: 'flame:v1:settings',
  presets: 'flame:v1:presets',
  caps: 'flame:v1:caps',
  netLog: 'flame:v1:netlog',
  errLog: 'flame:v1:errlog',
  flags: 'flame:v1:flags',
} as const;

/** 壊れて読めなかった中身の退避先。不具合報告に使えるよう捨てずに取っておく */
export const brokenKey = (key: string): string => `${key}.broken`;

/**
 * 末尾に足して上限で切る記録。通信ログとエラーログに使う。
 * 読めなかったら空から始める。ログのために起動を止めない。
 */
export function pushRing<T>(key: string, entry: T, limit: number): void {
  let list: unknown[] = [];
  const raw = safeStorage.get(key);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      /* 壊れていたら捨てて新しく始める */
    }
  }
  list.push(entry);
  if (list.length > limit) list = list.slice(list.length - limit);
  safeStorage.set(key, JSON.stringify(list));
}

export function readRing<T>(key: string): T[] {
  const raw = safeStorage.get(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function trimRing(key: string, keep: number): void {
  const list = readRing<unknown>(key);
  if (list.length <= keep) return;
  safeStorage.set(key, JSON.stringify(list.slice(list.length - keep)));
}
