/**
 * 外部への通信。**fetch を呼ぶのはこのファイルだけ**（eslint.config.js で強制）。
 *
 * このアプリは「写真を端末の外に出さない」と約束している。約束を守っていることを
 * 利用者が確かめられなければ、約束は言葉だけになる。だから通信は1箇所に集め、
 * 何をどこへ送ったかを必ず記録に残す。記録もこの端末の中だけに置き、外へは送らない。
 */
import { KEYS, pushRing, readRing, safeStorage } from './storage';

/** 通信の種類。記録を利用者に見せるときの言い換えもここで持つ */
export type NetKind =
  | 'app' //        アプリ本体・同梱アセット（自ドメイン）
  | 'geo-world' //  世界の地名データ（自ドメイン・要求時）
  | 'font-jp' //    和文フォント本体（自ドメイン・遅延ロード）
  | 'font-fetch' // 同梱外の文字の取り寄せ（★利用者の入力が外に出る唯一の経路★）
  | 'version'; //   更新確認（自ドメイン）

export interface NetMeta {
  readonly kind: NetKind;
  /** font-fetch のときだけ、実際に送った文字そのもの。記録に残して見せる */
  readonly sentText?: string;
}

export interface NetLogEntry {
  readonly at: string;
  readonly host: string;
  readonly kind: NetKind;
  /** 送った文字（font-fetch のみ）。それ以外は null */
  readonly sentText: string | null;
  readonly bytes: number;
  readonly ok: boolean;
}

const LOG_LIMIT = 100;

/**
 * 通信の記録。**この関数は必ず呼ばれる**（失敗しても記録する）。
 * 記録できなかった場合でも通信自体は止めない。
 */
function record(url: string, meta: NetMeta, res: Response | null): void {
  let host: string;
  try {
    host = new URL(url, 'https://localhost').host;
  } catch {
    host = '(解釈できないURL)';
  }
  const len = res?.headers.get('content-length');
  const entry: NetLogEntry = {
    at: new Date().toISOString(),
    host,
    kind: meta.kind,
    sentText: meta.sentText ?? null,
    bytes: len ? Number(len) || 0 : 0,
    ok: res?.ok ?? false,
  };
  try {
    pushRing(KEYS.netLog, entry, LOG_LIMIT);
  } catch {
    /* 記録できなくても通信は続ける */
  }
}

/**
 * 外部への通信の唯一の入口。
 *
 * meta を必須にしてあるのは、「何の通信か」を書かずには呼べないようにするため。
 * 記録に残らない通信を作れてしまうと、§12 の棚卸しがすぐ嘘になる。
 */
export async function netFetch(url: string, init: RequestInit, meta: NetMeta): Promise<Response> {
  let res: Response | null = null;
  try {
    res = await fetch(url, init);
    return res;
  } finally {
    // 例外で抜けるときも記録する。失敗したことも記録の一部
    record(url, meta, res);
  }
}

export function readNetLog(): NetLogEntry[] {
  return readRing<NetLogEntry>(KEYS.netLog);
}

export function clearNetLog(): void {
  safeStorage.remove(KEYS.netLog);
}
