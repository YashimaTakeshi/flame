import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildScene, INK, type SceneInput } from '../core/compose';
import { rgba, type Rgba } from '../core/scene/ops';
import type { Focus } from '../core/styles/types';
import type { RenderTarget, Scene } from '../core/scene/scene';
import { wallClockFromDate } from '../core/wallclock';
import { softwareTag } from '../build-info';
import { closeDecoded, decode, type DecodedPhoto } from '../platform/decode';
import { reinjectExif } from '../platform/exif-write';
import { isVideoFile } from '../platform/video-kind';
/** 動画の本体は動画を選んだときだけ読む（mediabunny を含み重い） */
const videoModule = () => import('../platform/video');
import { inAppBrowser, makeFilename, nowWallClock } from '../platform/save';
import { safeStorage } from '../platform/storage';
import { renderScene } from '../render/executor';
import { createVerifiedCanvas, encodeCanvas, release } from '../render/guards';
import { canvasMeasurer } from '../render/measure';
import { makeExportTarget } from '../render/target';
import { applyFieldSwitches, collectFacts, effectiveFields, gatesFrom } from './caption';
import { Diagnostics } from './Diagnostics';
import { Band } from './editor/Band';
import { OptionRow } from './editor/OptionRow';
import { TabBar } from './editor/TabBar';
import { EMPTY_EXIF, minimalExifOf, readExif, type ExifFacts } from './exif';
import { ShareApp } from './ui/ShareApp';
import { Side } from './editor/Side';
import { useLayoutMode } from './layout';
import { ensureFilmLogo, filmLogoImage } from './film-logos';
import type { BadgeImage } from '../core/badge';
import { flushSettings } from './state/persist';
import { fontRefFor, preloadLatinFonts } from './fonts-catalog';
import { colorOf } from './panels/constants';
import { ExportSheet, type Render } from './sheets/ExportSheet';
import { BORDER_LU, useDoc } from './state/doc';
import { bindSheetHistory, useUi } from './state/ui';
import { IconExpand, IconMuted, IconPhoto, IconPlay, IconRedo, IconShare, IconSound, IconUndo } from './ui/icons';
import { Viewer } from './Viewer';
import { Sheet } from './ui/Sheet';
import { usePan } from './usePan';
import { usePreview } from './usePreview';
import { usePageVisible, useVideoPlayback } from './useVideoPlayback';
import { useViewportHeight } from './useViewportHeight';
import './theme.css';
import './editor.css';

const EXPORT_LONG_EDGE = 4096;

/**
 * 背景の明るさから文字色を決める。
 * 白と黒のコントラストが釣り合う明度で切り替える。
 */
const INK_CROSSOVER = 0.1791287847;

function relativeLuminance(c: Rgba): number {
  const ch = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

const inkFor = (bg: Rgba): Rgba =>
  relativeLuminance(bg) > INK_CROSSOVER ? INK : rgba(236, 233, 228);

/** いまの切り取りの中心。指で動かし始めた瞬間に1回読む */
const readFocus = (): Focus => useDoc.getState().focus;

interface Loaded {
  readonly file: File;
  /** 写真はその1枚、動画は最初のコマ。編集とプレビューはこれで行う */
  readonly decoded: DecodedPhoto;
  readonly exif: ExifFacts;
  /** 動画のときだけ。書き出しは元の動画から1コマずつ描く */
  readonly video: { readonly duration: number; readonly hasAudio: boolean } | null;
}

const fmtSec = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export function App(): React.ReactElement {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bandDismissed, setBandDismissed] = useState(false);
  /** 写真を窓に落とそうとしている最中。縁を光らせて「ここに落とせる」と伝える */
  const [dragging, setDragging] = useState(false);

  const doc = useDoc();
  const tab = useUi((s) => s.tab);
  const sheet = useUi((s) => s.sheet);
  const openSheet = useUi((s) => s.openSheet);
  const closeSheet = useUi((s) => s.closeSheet);
  const hint = useUi((s) => s.hint);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useViewportHeight();

  /*
   * 面（情報・書き出し・自己診断）は URL の印と対にして履歴に載せる（state/ui.ts）。
   * iPhone の戻るスワイプやブラウザの戻るで、アプリごと離れて写真を失うのではなく、面が1段閉じる。
   * 自己診断は画面から入口を外してある（利用者には意味が分からない）。URL の末尾に #diag を足すと開く。
   * 写真が無いのに #info / #export で開かれたら、面は出さず印だけ消す。
   */
  const loadedRef = useRef(false);
  useEffect(() => {
    loadedRef.current = loaded !== null;
  }, [loaded]);
  useEffect(() => bindSheetHistory(() => loadedRef.current), []);

  /*
   * 写真を読み込んだあとにページを離れようとしたら（再読み込み・タブを閉じる）確認する。
   * iOS Safari はこの確認を出さないが、PC では押し間違いで写真と設定を失うのを防げる。
   */
  useEffect(() => {
    if (!loaded) return;
    const guard = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [loaded]);

  useEffect(() => {
    safeStorage.init();
    /*
     * 画面が隠れるときに、待っている設定の保存を済ませる。
     * iOS は裏に回った頁を黙って終わらせるので、まとめ書きの待ち時間が返ってこないことがある。
     * pagehide だけでは足りない（ホームに戻しただけでは飛ばない端末がある）。
     */
    const flush = (): void => flushSettings();
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') flushSettings();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    preloadLatinFonts()
      .then(() => setFontsReady(true))
      .catch((e: unknown) =>
        setLoadError(
          `書体を読み込めませんでした: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  const background = useMemo(() => colorOf(doc.colorKey), [doc.colorKey]);

  /*
   * 仕上がりの札は名前が決まってから取りに行く。
   * 届くまでは null（名前だけの面に落ちている）で、届いたら状態が変わって組み直される。
   * ★描いている最中にモジュールの籠を覗かない。★ 覗くと、籠が変わっても React が気づかない。
   */
  const filmName = (doc.overrides.film ?? loaded?.exif.film ?? '').trim() || null;
  const [loadedLogo, setLoadedLogo] = useState<{ name: string; logo: BadgeImage } | null>(null);
  useEffect(() => {
    if (doc.badge !== 'logo' || !filmName) return;
    let alive = true;
    void ensureFilmLogo(filmName).then((logo) => {
      if (alive && logo) setLoadedLogo({ name: filmName, logo });
    });
    return () => {
      alive = false;
    };
  }, [filmName, doc.badge]);
  /*
   * 名前も一緒に覚えておき、一致するときだけ使う。
   * こうしないと、仕上がりを切り替えた直後の一瞬だけ前の札が新しい名前で出る。
   */
  useEffect(() => {
    useUi.setState({ hasFilm: filmName !== null, photoFilm: loaded?.exif.film ?? null });
  }, [filmName, loaded]);
  const filmBadge = loadedLogo && loadedLogo.name === filmName ? loadedLogo.logo : null;

  /* 情報の一覧に出す中身。載せる／載せないに関係なく、写真の値と手入力から */
  useEffect(() => {
    const facts = loaded
      ? collectFacts(loaded.exif, {
          dateFormat: doc.dateFormat,
          title: doc.title,
          artist: doc.artist,
          fields: doc.fields,
          overrides: doc.overrides,
        })
      : {};
    // 写真そのものの値（入力欄の見本の字）。手入力・タイトル・作者を除いて組む
    const photoFacts = loaded
      ? collectFacts(loaded.exif, { dateFormat: doc.dateFormat, title: '', artist: '', fields: doc.fields, overrides: { camera: null, lens: null, date: null, film: null } })
      : {};
    useUi.setState({ facts, photoFacts, photoDate: loaded?.exif.dateTaken ?? null });
  }, [loaded, doc.dateFormat, doc.title, doc.artist, doc.fields, doc.overrides]);

  const sceneInput: SceneInput | null = useMemo(() => {
    if (!loaded || !fontsReady) return null;
    const font = fontRefFor(doc.fontKey);
    const fields = effectiveFields(doc.fields, doc.skipShotFacts);
    const facts = collectFacts(loaded.exif, {
      dateFormat: doc.dateFormat,
      title: doc.title,
      artist: doc.artist,
      fields,
      overrides: doc.overrides,
    });
    return {
      style: doc.style,
      focus: doc.focus,
      photo: { id: 'photo', aspect: loaded.decoded.natural.w / loaded.decoded.natural.h },
      // 「文字を入れる」を切ったら文字は1つも載せない（帯ごと消え、写真は余白の中央に収まる）
      facts: doc.captionOn ? applyFieldSwitches(facts, fields) : {},
      lineLayout: doc.lineLayout,
      gates: gatesFrom(fields),
      family: font.family,
      weight: font.weight,
      // 和文サブセットは Regular だけ。Bold を頼むと合成太字になって字形が崩れる
      hasBold: doc.fontKey !== 'jp',
      align: doc.align,
      tracking: doc.tracking,
      size: doc.size,
      bordered: doc.bordered,
      borderLu: BORDER_LU[doc.borderWeight],
      separator: doc.separator,
      background,
      ink: inkFor(background),
      // 刻印は「載せる項目」のスイッチとは独立。文字列から外しても刻印だけ残せる
      badge:
        doc.badge !== 'none' && facts.film
          ? {
              text: facts.film,
              mode: doc.badge,
              place: doc.badgePlace,
              align: doc.badgeAlign,
              valign: doc.badgeValign,
              size: doc.badgeSize,
              framed: doc.badgeFramed,
              image: filmBadge,
            }
          : null,
    };
  }, [loaded, fontsReady, doc, background, filmBadge]);

  /**
   * スタイル定義が破綻していると buildScene は投げる。
   * 画面を白くせず、1つ前に戻せる状態のまま伝える。
   */
  const [scene, sceneError]: [Scene | null, string | null] = useMemo(() => {
    if (!sceneInput) return [null, null];
    try {
      return [buildScene(sceneInput, canvasMeasurer), null];
    } catch (e) {
      return [null, e instanceof Error ? e.message : '組み立てに失敗しました'];
    }
  }, [sceneInput]);

  /* 写真の位置・文字の寄せが効くかを操作面へ（効かない点を薄くする） */
  const freedom = scene?.meta.freedom;
  const linesFit = scene?.meta.linesFit;
  useEffect(() => {
    if (freedom) useUi.setState({ freedom });
  }, [freedom]);
  useEffect(() => {
    if (linesFit) useUi.setState({ linesFit });
  }, [linesFit]);


  /*
   * 画面の組み方。PC と スマホで canvas の置き場所（親）が違うので、切り替わると
   * canvas の要素が作り直される。描く側と指で動かす側に、その合図として渡す。
   */
  const layout = useLayoutMode();
  const desk = layout === 'desk';

  /* 全面のとき、プレビューを指で動かして切り取りの位置を決める */
  const bleed = doc.style.margin === 'none';
  const beginDrag = useDoc((s) => s.beginDrag);
  const dragFocus = useDoc((s) => s.dragFocus);
  /*
   * 動かせるのは切り取っているときだけ（写真とキャンバスの比が違う）。
   * 以前は余白なしなら必ず掴む印を出していて、元比では掴んでも何も動かなかった
   */
  const crop = scene?.ops.find((o) => o.op === 'photo' && o.photo === 'photo');
  const pannable =
    bleed && loaded !== null && crop?.op === 'photo' && (crop.srcNorm.w < 0.999 || crop.srcNorm.h < 0.999);
  /*
   * ダブルタップで拡大して見る（スマホ）。プレビューの文字は画面では数 px しかなく、
   * 書体・字間・大きさを変えても違いが見えなかった。拡大の間は指で送って見回し、
   * もう一度ダブルタップ（か ✕）で戻る。拡大の間だけ細かく描き直すので、にじまない。
   * 余白なしで動かせるときも、1本指のドラッグは切り取り、ダブルタップは拡大、と役目を分ける
   */
  const [zoomState, setZoomState] = useState<{ x: number; y: number; of: Loaded; lay: string } | null>(null);
  const ZOOM = 2.5;
  // 写真・組み方が変わったら戻す（覚えた拡大はその写真・その組み方のときだけ効く）
  const zoom = zoomState && zoomState.of === loaded && zoomState.lay === layout ? zoomState : null;
  const setZoom = (z: { x: number; y: number } | null): void =>
    setZoomState(z && loaded ? { ...z, of: loaded, lay: layout } : null);
  usePan(canvasRef, scene, pannable && zoom === null, readFocus, beginDrag, dragFocus, layout);
  const tapRef = useRef({ t: 0, x: 0, y: 0 });
  const zoomDrag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const onZoomDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (desk) return;
    const now = e.timeStamp;
    const last = tapRef.current;
    const near = Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30;
    tapRef.current = { t: now, x: e.clientX, y: e.clientY };
    if (near && now - last.t < 320) {
      tapRef.current.t = 0;
      if (zoom) {
        setZoom(null);
      } else {
        const r = e.currentTarget.getBoundingClientRect();
        setZoom({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      }
      return;
    }
    if (zoom) {
      zoomDrag.current = { x: e.clientX, y: e.clientY, ox: zoom.x, oy: zoom.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const onZoomMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const d = zoomDrag.current;
    if (!d || !zoom) return;
    const r = e.currentTarget.getBoundingClientRect();
    // r は拡大後の大きさ。拡大前の幅に戻し、原点の動く量に直す（原点は 0..1 で端から端まで）
    const w = r.width / ZOOM;
    const h = r.height / ZOOM;
    const c = (n: number): number => Math.min(1, Math.max(0, n));
    setZoom({ x: c(d.ox - (e.clientX - d.x) / (w * (ZOOM - 1))), y: c(d.oy - (e.clientY - d.y) / (h * (ZOOM - 1))) });
  };
  const onZoomUp = (): void => {
    zoomDrag.current = null;
  };

  /*
   * 動かせることは見ても分からない。余白なしにしたとき（と比率を変えて動かせるようになったとき）、
   * 起動ごとに1回だけ足元で知らせる
   */
  const panToldRef = useRef(false);
  const setHint = useUi((s) => s.setHint);
  useEffect(() => {
    if (!bleed || panToldRef.current || !scene) return;
    panToldRef.current = true;
    if (pannable) setHint(desk ? 'ドラッグで位置を決められます' : '写真を指で動かして位置を決められます');
    else if (doc.style.ratio === 'OR') setHint('比率を変えると位置を動かせます');
    else panToldRef.current = false;
  }, [bleed, pannable, desk, doc.style.ratio, scene, setHint]);

  /* キーボードでも動かす。矢印で 2%、Shift で 10%。ダブルクリックで真ん中に戻す */
  const onCanvasKey = (e: React.KeyboardEvent<HTMLCanvasElement>): void => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    const f = useDoc.getState().focus;
    beginDrag();
    dragFocus({ x: f.x + v[0] * step, y: f.y + v[1] * step });
  };
  const onCanvasDouble = (): void => {
    beginDrag();
    useDoc.getState().resetFocus();
  };

  /*
   * 動画は編集中も流す（書き出す前に、動いたときの見え方を確かめられる）。
   * 書き出しの窓を開いている間と、画面が隠れている間は止める
   */
  const pageVisible = usePageVisible();
  const playback = useVideoPlayback(
    loaded?.video ? loaded.file : null,
    loaded?.video ? loaded.decoded.natural : null,
    (sheet === null || sheet === 'view') && pageVisible,
  );

  /* 音のある動画が流れ始めたら、起動ごとに1回だけ「音を出せる」と知らせる（印だけでは押せると分からない） */
  const soundToldRef = useRef(false);
  useEffect(() => {
    if (soundToldRef.current || playback.state !== 'playing' || !loaded?.video?.hasAudio) return;
    soundToldRef.current = true;
    setHint('スピーカーの印で音を出せます');
  }, [playback.state, loaded, setHint]);

  /** 描くときに識別子から画像を引く。写真は1枚、動画はいまのコマ（まだ無ければ最初のコマ）、札は名前ごと */
  const playbackSource = playback.source;
  const previewImage = useCallback(
    (id: string): CanvasImageSource | null =>
      id === 'photo' ? (playbackSource() ?? loaded?.decoded.bitmap ?? null) : filmLogoImage(id),
    [loaded, playbackSource],
  );

  const preview = usePreview(
    canvasRef,
    stageRef,
    scene,
    previewImage,
    EXPORT_LONG_EDGE,
    layout,
    loaded?.video ? playback.subscribe : null,
    zoom ? ZOOM : 1,
  );

  /* 拡大できることは見ても分からない。スマホで最初の数回だけ足元で知らせる */
  useEffect(() => {
    if (!loaded || desk) return;
    try {
      const n = Number(localStorage.getItem('fuchidori:zoom-told') ?? '0');
      if (n >= 3) return;
      localStorage.setItem('fuchidori:zoom-told', String(n + 1));
    } catch {
      return;
    }
    const t = setTimeout(() => {
      if (!useUi.getState().hint) setHint('ダブルタップで文字を拡大');
    }, 900);
    return () => clearTimeout(t);
  }, [loaded, desk, setHint]);

  const pick = useCallback(async (file: File) => {
    setBusy('写真を読み込んでいます');
    setLoadError(null);
    setBandDismissed(false);
    try {
      let next: Loaded;
      if (isVideoFile(file)) {
        setBusy('動画を読み込んでいます');
        const { openVideo } = await videoModule();
        const v = await openVideo(file, { posterWidth: 2048 });
        // 動画の撮影情報は写真の EXIF ほど揃わない（露出は入っていない）
        const exif: ExifFacts = { ...EMPTY_EXIF, camera: v.meta.camera, lens: v.meta.lens, dateTaken: v.meta.dateTaken, gps: v.meta.gps };
        next = { file, decoded: v.poster, exif, video: { duration: v.duration, hasAudio: v.hasAudio } };
      } else {
        const [decoded, exif] = await Promise.all([decode(file, { resizeWidth: 2048 }), readExif(file)]);
        next = { file, decoded, exif, video: null };
      }
      setLoaded((prev) => {
        if (prev) closeDecoded(prev.decoded);
        return next;
      });
      // 前の写真のタイトル・手入力・切り取り・取り消しの履歴を持ち越さない
      useDoc.getState().startPhoto();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'この写真を開けませんでした');
    } finally {
      setBusy(null);
    }
  }, []);

  /*
   * PC の入口を増やす。窓に落とす・Ctrl/⌘+V で貼る。ボタンは増えない。
   * 貼り付けは画像のときだけ横取りする（入力欄への文字の貼り付けは邪魔しない）。
   * 落とすときは、画像でなくても既定の動き（ブラウザがそのファイルを開く）を止める。
   */
  useEffect(() => {
    const imageOf = (files: FileList | undefined | null): File | null => {
      for (const f of Array.from(files ?? [])) {
        if (f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|avif|tiff?)$/i.test(f.name) || isVideoFile(f)) return f;
      }
      return null;
    };
    const hasFiles = (dt: DataTransfer | null): boolean => !!dt && Array.from(dt.types).includes('Files');
    const onDragOver = (e: DragEvent): void => {
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent): void => {
      // 窓の外へ出たときだけ。子要素の間を移るだけでも leave は飛ぶ
      if (e.relatedTarget === null) setDragging(false);
    };
    const onDrop = (e: DragEvent): void => {
      setDragging(false);
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      const f = imageOf(e.dataTransfer?.files);
      if (f) void pick(f);
    };
    const onPaste = (e: ClipboardEvent): void => {
      const f = imageOf(e.clipboardData?.files);
      if (!f) return;
      e.preventDefault();
      void pick(f);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, [pick]);

  /*
   * PC のキー。Ctrl/⌘+Z で取り消し、Shift を足すか Ctrl+Y でやり直し、Ctrl/⌘+S で書き出し、F で全画面。
   * 文字を打っている欄の中では横取りしない（欄の中の取り消しはブラウザに任せる）。
   */
  useEffect(() => {
    if (!loaded) return;
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = e.key.toLowerCase();
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      // F で全画面を開け閉めする（修飾キー付きはブラウザの検索などに任せる）
      if (plain && k === 'f') {
        const sheet = useUi.getState().sheet;
        if (sheet === 'view') closeSheet();
        else if (sheet === null) openSheet('view');
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (useUi.getState().sheet !== null) return;
      if (k === 'z' || k === 'y') {
        e.preventDefault();
        if (k === 'y' || e.shiftKey) useDoc.getState().redo();
        else useDoc.getState().undo();
      } else if (k === 's') {
        e.preventDefault();
        if (!busy) openSheet('export');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loaded, busy, openSheet, closeSheet]);

  /** 書き出し。原寸を掴むのはここだけ。終わったらすぐ手放す */
  const renderFull: Render = useCallback(async ({ onProgress, onFrame, signal }) => {
    if (!loaded || !scene) throw new Error('写真が選ばれていません');
    if (loaded.video) {
      /*
       * 動画: 1コマ＝1枚の写真として、同じ Scene を同じ描き手で描く。
       * 大きさは長辺 1920 で縦横とも偶数（H.264 の約束）。偶数に丸めた分だけ倍率を合わせる
       */
      const { evenSize, exportVideo, VIDEO_LONG_EDGE } = await videoModule();
      const aspect = scene.canvas.widthLu / scene.canvas.heightLu;
      const size = evenSize(aspect, VIDEO_LONG_EDGE);
      const k = size.w / scene.canvas.widthLu;
      const target: RenderTarget = { widthPx: size.w, heightPx: size.h, k, kExport: k, kind: 'export', dpr: 1 };
      const v = await exportVideo(loaded.file, {
        width: size.w,
        height: size.h,
        onProgress,
        onFrame,
        signal,
        render: (frame, ctx) =>
          renderScene(scene, ctx, target, {
            photo: (id) => (id === 'photo' ? frame : filmLogoImage(id)),
            grainTile: () => null,
            verticalText: () => null,
          }),
      });
      return {
        blob: v.blob,
        filename: makeFilename(loaded.exif.dateTaken ?? nowWallClock(), v.ext),
        exif: 'skipped',
        video: { audio: v.audio, seconds: v.seconds, trimmed: v.trimmed, poster: v.poster },
      };
    }
    const full = await decode(loaded.file);
    try {
      const target = makeExportTarget(scene, EXPORT_LONG_EDGE);
      const canvas = createVerifiedCanvas(target.widthPx, target.heightPx);
      if (!canvas.ok) {
        throw new Error(`この大きさの画像を作れませんでした（${target.widthPx}×${target.heightPx}）`);
      }
      try {
        renderScene(scene, canvas.ctx, target, {
          photo: (id) => (id === 'photo' ? full.bitmap : filmLogoImage(id)),
          grainTile: () => null,
          verticalText: () => null,
        });
        const blob = await encodeCanvas(canvas.canvas, 'image/jpeg', 0.92);
        if (!blob) throw new Error('画像を書き出せませんでした');
        /*
         * 撮影情報を書き戻す。canvas から出た JPEG には EXIF が無く、そのままだと
         * 写真アプリで「今日の写真」に並ぶ。失敗しても写真は返す（おまけは本体を落とさない）。
         * 名前も撮影日時から付ける。
         */
        const written = await reinjectExif(blob, loaded.file, {
          software: softwareTag(),
          width: target.widthPx,
          height: target.heightPx,
          fallback: minimalExifOf(loaded.exif),
        });
        return {
          blob: written.blob,
          filename: makeFilename(loaded.exif.dateTaken ?? nowWallClock()),
          exif: written.status,
        };
      } finally {
        release(canvas.canvas);
      }
    } finally {
      closeDecoded(full);
    }
  }, [loaded, scene]);

  const exif = loaded?.exif ?? EMPTY_EXIF;
  const noExif = loaded !== null && !exif.camera && !exif.dateTaken && !bandDismissed;

  /* 撮影情報が無いときの案内。phone では帯の行、desk ではプレビューの下に置く */
  const band = loadError ? (
    <div className="band" role="alert">
      <p>{loadError}</p>
      <div className="band__acts">
        <button type="button" className="btn--s" onClick={() => fileRef.current?.click()}>
          別の写真を選ぶ
        </button>
      </div>
    </div>
  ) : noExif ? (
    <Band
      fileDate={wallClockFromDate(new Date(loaded.file.lastModified))}
      onUseFileDate={() => {
        doc.setOverride('date', wallClockFromDate(new Date(loaded.file.lastModified)));
        setBandDismissed(true);
      }}
      onEdit={() => {
        setBandDismissed(true);
        useUi.getState().openInfo('date');
      }}
      onSkip={() => {
        // この1枚だけ。保存される「載せる項目」は触らない（次の写真で撮影情報が消えていた）
        doc.set('skipShotFacts', true);
        setBandDismissed(true);
      }}
    />
  ) : null;

  const header = (
      <header className="hdr">
        {loaded ? (
          <button
            type="button"
            className="iconbtn hdr__left"
            aria-label="写真を変える"
            title="写真を変える"
            onClick={() => fileRef.current?.click()}
          >
            <IconPhoto />
          </button>
        ) : (
          <span />
        )}
        {/*
         * 写真を開いたら、真ん中は題ではなく取り消し・やり直し。
         * 何を作っているかは画面を見れば分かる。いちばん押したくなるのは「今のを戻す」
         */}
        {loaded ? (
          <span className="hdr__undo" role="group" aria-label="取り消し">
            <button
              type="button"
              className="iconbtn"
              aria-label="取り消す"
              title="取り消す（Ctrl/⌘+Z）"
              disabled={doc.undoDepth === 0}
              onClick={doc.undo}
            >
              <IconUndo />
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="やり直す"
              title="やり直す（Ctrl/⌘+Shift+Z）"
              disabled={doc.redoDepth === 0}
              onClick={doc.redo}
            >
              <IconRedo />
            </button>
          </span>
        ) : (
          <span className="hdr__title">Fuchidori</span>
        )}
        {loaded ? (
          <span className="hdr__right hdr__acts">
            {/* 仕上がりを画面いっぱいで確かめる */}
            <button
              type="button"
              className="iconbtn"
              aria-label="全画面で見る"
              title="全画面で見る（F）"
              disabled={scene === null}
              onClick={() => openSheet('view')}
            >
              <IconExpand />
            </button>
            {/* PC は欄の下に「書き出す」がいつも見えているので、見出しには置かない */}
            {!desk && (
              <button
                type="button"
                className="iconbtn"
                aria-label="書き出す"
                title="書き出す"
                aria-busy={busy !== null || undefined}
                disabled={busy !== null}
                onClick={() => openSheet('export')}
              >
                <IconShare />
              </button>
            )}
          </span>
        ) : (
          <span />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              // 書き出しの窓の「次の写真を選ぶ」から来たら、選び終えた時点で窓を閉じる
              if (useUi.getState().sheet === 'export') closeSheet();
              void pick(f);
            }
            e.target.value = '';
          }}
        />
      </header>
  );

  const stage = (
    <div className="stage" ref={stageRef} data-video={loaded?.video ? true : undefined} data-busy={busy !== null || undefined}>
        {loaded ? (
          preview.error || sceneError ? (
            <div className="stage__e3">
              <p>{preview.error ?? sceneError}</p>
              {doc.undoDepth > 0 && (
                <button type="button" className="btn--s" onClick={doc.undo}>
                  1つ前に戻す
                </button>
              )}
            </div>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                className="stage__canvas"
                role="img"
                aria-label={pannable ? '枠を付けた写真のプレビュー。動かして切り取る位置を決める（矢印キーでも）' : '枠を付けた写真のプレビュー'}
                data-pannable={pannable || undefined}
                tabIndex={pannable ? 0 : undefined}
                onKeyDown={pannable ? onCanvasKey : undefined}
                onDoubleClick={pannable && desk ? onCanvasDouble : undefined}
                onPointerDown={onZoomDown}
                onPointerMove={onZoomMove}
                onPointerUp={onZoomUp}
                onPointerCancel={onZoomUp}
                data-zoomed={zoom ? true : undefined}
                style={zoom ? { transform: `scale(${ZOOM})`, transformOrigin: `${zoom.x * 100}% ${zoom.y * 100}%` } : undefined}
              />
              {preview.slow && <span className="stage__dot" aria-hidden="true" />}
              {zoom && (
                <button type="button" className="stage__chip stage__chip--btn stage__zoom" aria-label="拡大をやめる" onClick={() => setZoom(null)}>
                  {ZOOM}× ✕
                </button>
              )}
              {/*
               * 動画の印。流れている間はスピーカーの印で音を出し入れする（音は消して始まる）。
               * 自動再生を止められたら ▶ で流す。流せない端末では長さだけ出す（最初のコマのまま）
               */}
              {loaded.video &&
                (playback.state === 'playing' && loaded.video.hasAudio ? (
                  <button
                    type="button"
                    className="stage__chip stage__chip--btn"
                    aria-pressed={!playback.muted}
                    aria-label={playback.muted ? '音を出す' : '音を消す'}
                    data-muted={playback.muted || undefined}
                    onClick={playback.toggleMuted}
                  >
                    {playback.muted ? <IconMuted size={16} /> : <IconSound size={16} />}
                    <span>{fmtSec(loaded.video.duration)}</span>
                  </button>
                ) : playback.state === 'blocked' ? (
                  <button type="button" className="stage__chip stage__chip--btn" aria-label="再生する" onClick={playback.play}>
                    <IconPlay size={16} />
                    <span>{fmtSec(loaded.video.duration)}</span>
                  </button>
                ) : (
                  <span className="stage__chip" aria-label={`動画 ${fmtSec(loaded.video.duration)}`}>
                    ▶ {fmtSec(loaded.video.duration)}
                  </span>
                ))}
              {/* 注記は操作の上に重ねない。プレビューの足元に短く出て、自分で消える */}
              {/* 写真を差し替えている間は、プレビューを薄めて足元に何をしているかを出す */}
              {busy ? (
                <p className="stage__hint" role="status">
                  {busy}
                </p>
              ) : (
                hint && (
                  <p className="stage__hint" role="status">
                    {hint}
                  </p>
                )
              )}
            </>
          )
        ) : (
          <div className="home">
            <button
              type="button"
              className="opener"
              aria-label="写真を選ぶ"
              title={desk ? '写真を選ぶ（ドロップ・Ctrl+V でも開けます）' : undefined}
              aria-busy={busy !== null || undefined}
              disabled={busy !== null}
              onClick={() => fileRef.current?.click()}
            >
              <FrameMark />
            </button>
            {busy && (
              <p className="home__busy" role="status">
                {busy}
              </p>
            )}
            {/* LINE などの中のブラウザだけ。作業を始める前に出口を知らせる */}
            {!busy && inAppBrowser() && <p className="home__note">保存できないときは右上の … から「ブラウザで開く」</p>}
            <ShareApp />
          </div>
        )}
      </div>
  );

  return (
    <div
      className="app"
      data-tab={tab}
      data-layout={layout}
      data-empty={loaded ? undefined : 'true'}
      data-dragging={dragging || undefined}
    >
      {header}

      {desk ? (
        /*
         * PC: 左にプレビュー、右に設定の欄。
         * 設定は全部見えていて、プレビューを見ながらどこでも触れる。タブは要らない。
         */
        <div className="desk">
          <div className="desk__main">
            {stage}
            {band}
          </div>
          {loaded && <Side onExport={() => openSheet('export')} busy={busy !== null} />}
        </div>
      ) : (
        <>
          {stage}
          {band ?? <span />}
          {loaded && <OptionRow />}
          {loaded && <TabBar />}
        </>
      )}

      {sheet === 'view' && scene && (
        <Viewer
          scene={scene}
          image={previewImage}
          exportLongEdge={EXPORT_LONG_EDGE}
          subscribe={loaded?.video ? playback.subscribe : null}
          onClose={closeSheet}
        />
      )}
      {sheet === 'export' && <ExportSheet
          render={renderFull}
          video={loaded?.video != null}
          still={canvasRef}
          // await を挟まずに開く（iOS は操作の中でしか選択を開かない）
          onNextPhoto={() => fileRef.current?.click()}
          onClose={closeSheet}
        />}
      {sheet === 'diagnostics' && (
        <Sheet title="この端末を調べる" size="full" onClose={closeSheet}>
          <Diagnostics />
        </Sheet>
      )}

    </div>
  );
}

/**
 * 空の画面に置く印。**枠の中に＋**。
 *
 * 文章で説明しない。枠を作るアプリで、枠に＋が入っていれば、
 * 押せば写真が入ることは見れば分かる。
 */
function FrameMark(): React.ReactElement {
  return (
    <svg className="opener__mark" viewBox="0 0 120 120" aria-hidden="true">
      <rect x="6" y="6" width="108" height="108" rx="4" fill="none" strokeWidth="2" />
      <rect x="20" y="20" width="80" height="66" fill="none" strokeWidth="1.5" opacity="0.5" />
      <path d="M60 39v28M46 53h28" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
