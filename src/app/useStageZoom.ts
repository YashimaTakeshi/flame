/**
 * 写真（プレビュー）だけを指で拡大する。**ページそのものは拡大させない**（依頼者の指摘:
 * 設定の欄をピンチすると画面ごと拡大されて配置が崩れた。拡大できるのは写真の部分だけにしてほしい）。
 *
 *   2本指      … 広げて拡大・つまんで縮小（1〜5倍）。指の間の点を中心に、2本指のまま動かせば見回せる
 *   1本指      … 拡大している間は見回し（拡大していないときは何もしない。余白なしの切り取りは usePan）
 *   ダブルタップ … 1倍 ⇄ 2.5倍（押した所を中心に）
 *   長押し     … onLongPress（編集画面では全画面表示を開く。依頼者の要望。以前は長押しで端末のコピーの網掛けが出て操作しづらかった）
 *
 * 指で動かしている間は canvas の transform だけを書き換える（描き直さない。軽い）。
 * 指を離したら、その倍率を level として返す。呼ぶ側は level に合う細かさで描き直す（文字がにじまない）。
 *
 * 見回せる範囲は写真の欄（stage）いっぱい。拡大した写真の縁が欄の内側に入り込まないように押さえる。
 * 欄より小さいうちは真ん中に置く。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX = 5;
const TAP_MS = 250;
const DOUBLE_MS = 320;
const DOUBLE_PX = 30;
/** 長押しと見なす時間と、その間に指がずれてもよい量 */
const HOLD_MS = 480;
const HOLD_PX = 8;
/** ダブルタップで寄る倍率（以前の固定の拡大と同じ） */
export const DOUBLE_TAP_ZOOM = 2.5;

type View = { s: number; tx: number; ty: number };
type Pt = { x: number; y: number };
type Gesture = { kind: 'pinch'; d0: number; m0: Pt; s0: number; tx0: number; ty0: number } | { kind: 'pan'; p0: Pt; tx0: number; ty0: number };

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export interface StageZoom {
  /** 指を離したときの倍率（1 は拡大していない）。描き直しの細かさと、倍率の表示に使う */
  level: number;
  /** 1倍に戻す */
  reset(): void;
  /** 直前（0.35 秒以内）に指の操作があったか。全画面表示で「押したら閉じる」と区別する */
  justGestured(): boolean;
}

export function useStageZoom(
  stageRef: React.RefObject<HTMLElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  {
    enabled,
    doubleTap = true,
    resetKey,
    onLongPress,
  }: {
    enabled: boolean;
    /** 1本指で動かさずに押し続けたとき（拡大していないときだけ） */
    onLongPress?: (() => void) | undefined;
    /** ダブルタップで拡大するか（全画面表示では、1回押すと閉じるので使わない） */
    doubleTap?: boolean;
    /** これが変わったら1倍に戻す（写真を替えた・組み方が変わった） */
    resetKey: unknown;
  },
): StageZoom {
  const view = useRef<View>({ s: 1, tx: 0, ty: 0 });
  /* 決まった倍率は、どの写真・組み方のときのものかと対で持つ（替わったら 1 に見なす） */
  const [committed, setCommitted] = useState<{ level: number; key: unknown }>({ level: 1, key: resetKey });
  const level = committed.key === resetKey ? committed.level : 1;
  const lastGesture = useRef(0);
  const longPressRef = useRef(onLongPress);
  useEffect(() => {
    longPressRef.current = onLongPress;
  }, [onLongPress]);

  /** 拡大した写真の縁が欄の内側に入らないように押さえる。欄より小さい向きは真ん中に */
  const clamp = useCallback(
    (v: View): View => {
      const st = stageRef.current;
      const c = canvasRef.current;
      if (!st || !c) return v;
      const sw = st.clientWidth;
      const sh = st.clientHeight;
      const bx = c.offsetLeft;
      const by = c.offsetTop;
      const w = c.offsetWidth * v.s;
      const h = c.offsetHeight * v.s;
      const axis = (t: number, b: number, size: number, room: number): number =>
        size <= room ? (room - size) / 2 - b : Math.min(-b, Math.max(room - size - b, t));
      return { s: v.s, tx: axis(v.tx, bx, w, sw), ty: axis(v.ty, by, h, sh) };
    },
    [stageRef, canvasRef],
  );

  const apply = useCallback(
    (animate: boolean): void => {
      const c = canvasRef.current;
      if (!c) return;
      const { s, tx, ty } = view.current;
      c.style.transition = animate ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' : '';
      c.style.transformOrigin = '0 0';
      c.style.transform = s === 1 && tx === 0 && ty === 0 ? '' : `translate(${tx}px, ${ty}px) scale(${s})`;
      if (s > 1.001) c.dataset['zoomed'] = 'true';
      else delete c.dataset['zoomed'];
    },
    [canvasRef],
  );

  const commit = useCallback((): void => {
    const s = view.current.s;
    setCommitted({ level: s <= 1.01 ? 1 : Math.round(s * 10) / 10, key: resetKey });
  }, [resetKey]);

  const reset = useCallback((): void => {
    view.current = { s: 1, tx: 0, ty: 0 };
    apply(true);
    commit();
  }, [apply, commit]);

  // 写真・組み方が変わったら1倍に戻す（覚えた拡大は、その写真・その組み方のときだけ効く）
  useEffect(() => {
    view.current = { s: 1, tx: 0, ty: 0 };
    apply(false);
  }, [resetKey, apply]);

  // 写真の欄や写真の大きさが変わったら（比率を変えた・画面を回した）、今の倍率のまま見回せる範囲に収め直す
  useEffect(() => {
    const st = stageRef.current;
    const c = canvasRef.current;
    if (!st || !c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (view.current.s === 1) return;
      view.current = clamp(view.current);
      apply(false);
    });
    ro.observe(st);
    ro.observe(c);
    return () => ro.disconnect();
  }, [stageRef, canvasRef, clamp, apply, resetKey]);

  useEffect(() => {
    const st = stageRef.current;
    if (!st || !enabled) return;

    const pts = new Map<number, Pt>();
    let g: Gesture | null = null;
    let downAt = { t: 0, x: 0, y: 0 };
    let lastTap = { t: 0, x: 0, y: 0 };
    let moved = false;
    let hold: ReturnType<typeof setTimeout> | null = null;
    /** 長押しで全画面を開いたあとの指の離れは、タップとして数えない */
    let held = false;
    const stopHold = (): void => {
      if (hold) clearTimeout(hold);
      hold = null;
    };
    /*
     * 長押しで開いた全画面の上に、指を離したときの click が落ちる（端末は離した所の一番上の物に送る）。
     * そのままだと開いた全画面が「押したら閉じる」で即座に閉じるので、直後の1回だけ捨てる。
     */
    const swallowClick = (): void => {
      const eat = (ev: Event): void => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 500);
    };

    const local = (e: PointerEvent): Pt => {
      const r = st.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    /** いまの指の数で、つまむか見回すかを決め直す（指が増えた・減ったとき） */
    const begin = (): void => {
      const v = view.current;
      const list = [...pts.values()];
      if (list.length >= 2) {
        const [a, b] = list as [Pt, Pt];
        g = { kind: 'pinch', d0: Math.max(1, dist(a, b)), m0: mid(a, b), s0: v.s, tx0: v.tx, ty0: v.ty };
      } else if (list.length === 1 && v.s > 1.001) {
        g = { kind: 'pan', p0: list[0]!, tx0: v.tx, ty0: v.ty };
      } else {
        g = null;
      }
    };

    const down = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // 写真の上の ✕ や音の印などのボタンは、そのボタンの仕事をさせる
      if ((e.target as Element | null)?.closest('button')) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pts.size === 1) {
        downAt = { t: e.timeStamp, x: p.x, y: p.y };
        moved = false;
        held = false;
        stopHold();
        if (longPressRef.current && view.current.s <= 1.001) {
          hold = setTimeout(() => {
            hold = null;
            if (moved || pts.size !== 1) return;
            held = true;
            lastGesture.current = performance.now();
            longPressRef.current?.();
          }, HOLD_MS);
        }
      } else {
        moved = true; // 2本目が来たら、もうタップではない
        stopHold();
      }
      begin();
    };

    const move = (e: PointerEvent): void => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      const far = Math.hypot(p.x - downAt.x, p.y - downAt.y);
      if (pts.size === 1 && far > HOLD_PX) stopHold();
      if (pts.size === 1 && far > 10) moved = true;
      if (!g) return;
      const c = canvasRef.current;
      if (!c) return;
      if (g.kind === 'pinch' && pts.size >= 2) {
        const [a, b] = [...pts.values()] as [Pt, Pt];
        const m = mid(a, b);
        // 端で少しだけ行き過ぎられる（離すと戻る）。つまみすぎ・広げすぎが手応えで分かる
        const s = Math.min(MAX * 1.15, Math.max(0.8, (g.s0 * dist(a, b)) / g.d0));
        // 指の間にあった写真の点が、指の間に付いてくるように
        const px = (g.m0.x - c.offsetLeft - g.tx0) / g.s0;
        const py = (g.m0.y - c.offsetTop - g.ty0) / g.s0;
        view.current = clamp({ s, tx: m.x - c.offsetLeft - px * s, ty: m.y - c.offsetTop - py * s });
        apply(false);
        lastGesture.current = e.timeStamp;
      } else if (g.kind === 'pan') {
        view.current = clamp({ s: view.current.s, tx: g.tx0 + p.x - g.p0.x, ty: g.ty0 + p.y - g.p0.y });
        apply(false);
        lastGesture.current = e.timeStamp;
      }
    };

    /** 指が全部離れたら、行き過ぎを戻して倍率を決める */
    const settle = (animate: boolean): void => {
      const v = view.current;
      if (v.s < 1.02) {
        view.current = { s: 1, tx: 0, ty: 0 };
      } else if (v.s > MAX) {
        const c = canvasRef.current;
        const cx = (c?.offsetWidth ?? 0) / 2;
        const cy = (c?.offsetHeight ?? 0) / 2;
        // 画面の真ん中に見えている点を保ったまま MAX まで戻す
        const px = (cx - v.tx) / v.s;
        const py = (cy - v.ty) / v.s;
        view.current = clamp({ s: MAX, tx: cx - px * MAX, ty: cy - py * MAX });
      }
      apply(animate);
      commit();
    };

    const up = (e: PointerEvent): void => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      stopHold();
      if (held) {
        held = false;
        pts.clear();
        g = null;
        swallowClick();
        return;
      }
      if (pts.size > 0) {
        begin(); // 残った指で続ける（拡大中なら見回し）
        return;
      }
      g = null;
      const tap = e.type === 'pointerup' && !moved && e.timeStamp - downAt.t < TAP_MS;
      if (tap && doubleTap) {
        const again = e.timeStamp - lastTap.t < DOUBLE_MS && Math.hypot(downAt.x - lastTap.x, downAt.y - lastTap.y) < DOUBLE_PX;
        if (again) {
          lastTap = { t: 0, x: 0, y: 0 };
          lastGesture.current = e.timeStamp;
          const c = canvasRef.current;
          if (view.current.s > 1.01 || !c) {
            view.current = { s: 1, tx: 0, ty: 0 };
          } else {
            // 押した所を中心に寄る
            const s = DOUBLE_TAP_ZOOM;
            const px = downAt.x - c.offsetLeft;
            const py = downAt.y - c.offsetTop;
            view.current = clamp({ s, tx: px - px * s, ty: py - py * s });
          }
          apply(true);
          commit();
          return;
        }
        lastTap = { t: e.timeStamp, x: downAt.x, y: downAt.y };
      }
      settle(true);
    };

    st.addEventListener('pointerdown', down);
    st.addEventListener('pointermove', move);
    st.addEventListener('pointerup', up);
    st.addEventListener('pointercancel', up);
    // 長押しで出る端末の選択メニュー（画像のコピーなど）を出さない
    const noMenu = (e: Event): void => e.preventDefault();
    st.addEventListener('contextmenu', noMenu);
    return () => {
      stopHold();
      st.removeEventListener('contextmenu', noMenu);
      st.removeEventListener('pointerdown', down);
      st.removeEventListener('pointermove', move);
      st.removeEventListener('pointerup', up);
      st.removeEventListener('pointercancel', up);
    };
  }, [stageRef, canvasRef, enabled, doubleTap, clamp, apply, commit]);

  const justGestured = useCallback((): boolean => performance.now() - lastGesture.current < 350, []);

  return { level, reset, justGestured };
}

/**
 * ページそのものの拡大（2本指・ダブルタップ）を止める。起動時に1度。
 * CSS の touch-action だけでは、iPhone の Safari が2本指の拡大を止めないことがあるため、
 * Safari 独自の gesture 系と、2本指の touchmove の既定の動きも止める。
 * 写真の上の拡大は pointer 系で自前で行うので、これらを止めても影響しない。
 */
export function preventPageZoom(): () => void {
  const stop = (e: Event): void => e.preventDefault();
  const multi = (e: TouchEvent): void => {
    if (e.touches.length > 1) e.preventDefault();
  };
  const opts: AddEventListenerOptions = { passive: false };
  document.addEventListener('gesturestart', stop, opts);
  document.addEventListener('gesturechange', stop, opts);
  document.addEventListener('touchmove', multi, opts);
  return () => {
    document.removeEventListener('gesturestart', stop, opts);
    document.removeEventListener('gesturechange', stop, opts);
    document.removeEventListener('touchmove', multi, opts);
  };
}
