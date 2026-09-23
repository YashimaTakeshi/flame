/**
 * 編集中に動画を流す。
 *
 * 書き出す前に「動いたときにどう見えるか」を確かめたい（実機で頼まれた）。
 * 最初のコマだけでは、枠と文字が動きの上でどう見えるか分からない。
 *
 * 仕組み: 画面に置かない <video> で再生し、新しいコマが出るたびにプレビューを描き直す。
 * 描き直しはプレビューのいつもの経路（usePreview）で、写真の代わりにこの <video> を渡すだけ。
 * だから枠・文字・刻印の位置は、止まった1枚のときとも書き出しとも同じ。
 *
 * 決まりごと:
 *   - 音は消して始める（ブラウザは音付きの自動再生を許さない）。スピーカーの印で出し入れする
 *   - 書き出しの窓を開いている間・画面が隠れている間は止める（書き出しを遅くしない・勝手に鳴らない）
 *   - この端末の <video> で流せない形式（Windows の一部の HEVC など）は、最初のコマのまま（静止）
 *   - 向きの読み方が書き出し側と食い違ったら（縦横比が合わない）、流さずに最初のコマのまま
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type PlaybackState =
  /** 動画が無い */
  | 'idle'
  /** 読み込み中。最初のコマを見せている */
  | 'loading'
  | 'playing'
  /** 自動再生を止められた（iPhone の低電力モードなど）。押せば流れる */
  | 'blocked'
  /** この端末では流せない。最初のコマのまま */
  | 'failed';

export interface Playback {
  readonly state: PlaybackState;
  readonly muted: boolean;
  /** いまのコマを描ける <video>。描けないうちは null（描く側は最初のコマを使う） */
  readonly source: () => CanvasImageSource | null;
  /** 新しいコマが出るたびに呼ぶ。戻り値で外す */
  readonly subscribe: (onFrame: () => void) => () => void;
  /** 音を出す／消す。押された処理の中から呼ぶ（iPhone は操作の中でしか音を出させない） */
  readonly toggleMuted: () => void;
  /** 止められた再生を始める。押された処理の中から呼ぶ */
  readonly play: () => void;
}

/** 縦横比がこれ以上ずれたら、向きの読み方が食い違っているとみなす */
const ASPECT_TOLERANCE = 0.02;

type VideoWithFrames = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (h: number) => void;
};

export function useVideoPlayback(
  file: File | null,
  /** 書き出し側（mediabunny）が読んだ向き反映後の大きさ。<video> の読み方と照らす */
  natural: { readonly w: number; readonly h: number } | null,
  /** 流してよいか（書き出しの窓が閉じていて、画面が見えている） */
  active: boolean,
): Playback {
  const videoRef = useRef<VideoWithFrames | null>(null);
  const drawable = useRef(false);
  const listeners = useRef(new Set<() => void>());
  const activeRef = useRef(active);
  // どの動画についての状態かを一緒に持つ。動画を替えた直後に前の状態を見せないため
  const [st, setSt] = useState<{ file: File | null; state: PlaybackState; muted: boolean }>({
    file: null,
    state: 'idle',
    muted: true,
  });

  const w = natural?.w ?? 0;
  const h = natural?.h ?? 0;

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!file || !w || !h) return;
    const v: VideoWithFrames = document.createElement('video');
    // iPhone は属性でも消音・その場再生を求める
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.loop = true;
    v.preload = 'auto';
    const url = URL.createObjectURL(file);
    let alive = true;
    let frameHandle = 0;
    let rafHandle = 0;
    drawable.current = false;

    const notify = (): void => {
      for (const l of listeners.current) l();
    };
    const set = (state: PlaybackState): void => {
      if (alive) setSt((s) => (s.file === file && s.state === state ? s : { file, state, muted: v.muted }));
    };
    const fail = (): void => {
      drawable.current = false;
      set('failed');
      notify(); // 最初のコマに戻して描く
    };

    /*
     * 新しいコマの合図。requestVideoFrameCallback があればそれ（コマが出たときだけ呼ばれる）、
     * 無ければ毎フレーム時刻を見て、進んでいたら描く
     */
    let lastTime = -1;
    const onVideoFrame = (): void => {
      if (!alive) return;
      notify();
      frameHandle = v.requestVideoFrameCallback!(onVideoFrame);
    };
    const onRaf = (): void => {
      if (!alive) return;
      if (v.currentTime !== lastTime) {
        lastTime = v.currentTime;
        notify();
      }
      rafHandle = requestAnimationFrame(onRaf);
    };

    v.addEventListener('error', fail);
    v.addEventListener('loadedmetadata', () => {
      if (!alive) return;
      const ok = v.videoWidth > 0 && v.videoHeight > 0 && Math.abs(v.videoWidth / v.videoHeight / (w / h) - 1) <= ASPECT_TOLERANCE;
      if (!ok) return fail();
      // 描き手は width / height から切り出し範囲を計算する。<video> では属性の値なので、実寸を入れておく
      v.width = v.videoWidth;
      v.height = v.videoHeight;
    });
    v.addEventListener('loadeddata', () => {
      if (!alive || !v.width) return;
      drawable.current = true;
      if (typeof v.requestVideoFrameCallback === 'function') frameHandle = v.requestVideoFrameCallback(onVideoFrame);
      else rafHandle = requestAnimationFrame(onRaf);
      notify();
    });
    v.addEventListener('playing', () => set('playing'));

    v.src = url;
    videoRef.current = v;
    if (activeRef.current) {
      v.play().catch((e: unknown) => {
        // 自動再生を止められた（低電力モードなど）。形式が駄目なら error が先に来る
        if (alive && e instanceof Error && e.name === 'NotAllowedError') set('blocked');
      });
    }

    return () => {
      alive = false;
      drawable.current = false;
      if (frameHandle && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(frameHandle);
      if (rafHandle) cancelAnimationFrame(rafHandle);
      v.pause();
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
      if (videoRef.current === v) videoRef.current = null;
    };
  }, [file, w, h]);

  // 書き出しの窓・画面の出入りに合わせて止める／流す
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !file) return;
    if (!active) {
      v.pause();
      return;
    }
    v.play().catch((e: unknown) => {
      if (!(e instanceof Error) || e.name !== 'NotAllowedError') return;
      // 操作の外から音付きで流すことは許されない（iPhone）。音を消して流し直し、印で知らせる
      if (!v.muted) {
        v.muted = true;
        setSt((s) => (s.file === file ? { ...s, muted: true } : s));
        v.play().catch(() => setSt((s) => (s.file === file ? { ...s, state: 'blocked' } : s)));
      } else {
        setSt((s) => (s.file === file ? { ...s, state: 'blocked' } : s));
      }
    });
  }, [active, file]);

  const source = useCallback((): CanvasImageSource | null => {
    const v = videoRef.current;
    // コマが無い瞬間（繰り返しの頭出しなど）は最初のコマに任せる。透明のまま描かない
    return v && drawable.current && v.readyState >= 2 ? v : null;
  }, []);

  const subscribe = useCallback((onFrame: () => void): (() => void) => {
    listeners.current.add(onFrame);
    return () => listeners.current.delete(onFrame);
  }, []);

  const toggleMuted = useCallback((): void => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setSt((s) => ({ ...s, muted: v.muted }));
    if (v.paused) void v.play().catch(() => {});
  }, []);

  const play = useCallback((): void => {
    const v = videoRef.current;
    if (!v) return;
    void v.play().then(
      () => setSt((s) => ({ ...s, state: 'playing' })),
      () => {},
    );
  }, []);

  const current = st.file === file;
  return {
    state: !file ? 'idle' : current ? st.state : 'loading',
    muted: current ? st.muted : true,
    source,
    subscribe,
    toggleMuted,
    play,
  };
}

/** 画面が見えているか。隠れている間は動画を止める */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const on = (): void => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}
