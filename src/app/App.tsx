import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildScene, INK, type SceneInput } from '../core/compose';
import { rgba, type Rgba } from '../core/scene/ops';
import type { Focus } from '../core/styles/types';
import type { Scene } from '../core/scene/scene';
import { closeDecoded, decode, type DecodedPhoto } from '../platform/decode';
import { safeStorage } from '../platform/storage';
import { renderScene } from '../render/executor';
import { createVerifiedCanvas, release } from '../render/guards';
import { canvasMeasurer } from '../render/measure';
import { makeExportTarget } from '../render/target';
import { applyFieldSwitches, collectFacts, gatesFrom } from './caption';
import { Diagnostics } from './Diagnostics';
import { Band } from './editor/Band';
import { OptionRow } from './editor/OptionRow';
import { TabBar } from './editor/TabBar';
import { EMPTY_EXIF, readExif, type ExifFacts } from './exif';
import { ShareApp } from './ui/ShareApp';
import { ensureFilmLogo, filmLogoImage } from './film-logos';
import type { BadgeImage } from '../core/badge';
import { flushSettings } from './state/persist';
import { fontRefFor, preloadLatinFonts } from './fonts-catalog';
import { colorOf } from './panels/constants';
import { ExportSheet } from './sheets/ExportSheet';
import { InfoSheet } from './sheets/InfoSheet';
import { DEFAULT_FIELDS, useDoc } from './state/doc';
import { useUi } from './state/ui';
import { IconPhoto, IconShare } from './ui/icons';
import { Sheet } from './ui/Sheet';
import { usePan } from './usePan';
import { usePreview } from './usePreview';
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
  readonly decoded: DecodedPhoto;
  readonly exif: ExifFacts;
}

export function App(): React.ReactElement {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bandDismissed, setBandDismissed] = useState(false);

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
   * 自己診断は画面から入口を外した（利用者には意味が分からない）。
   * ただし実機で困ったときに要るので、URL の末尾に #diag を足すと開く。
   */
  useEffect(() => {
    const check = (): void => {
      if (window.location.hash === '#diag') openSheet('diagnostics');
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, [openSheet]);

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
  const filmBadge = loadedLogo && loadedLogo.name === filmName ? loadedLogo.logo : null;

  const sceneInput: SceneInput | null = useMemo(() => {
    if (!loaded || !fontsReady) return null;
    const font = fontRefFor(doc.fontKey);
    const facts = collectFacts(loaded.exif, {
      title: doc.title,
      artist: doc.artist,
      fields: doc.fields,
      overrides: doc.overrides,
    });
    return {
      style: doc.style,
      focus: doc.focus,
      photo: { id: 'photo', aspect: loaded.decoded.natural.w / loaded.decoded.natural.h },
      facts: applyFieldSwitches(facts, doc.fields),
      gates: gatesFrom(doc.fields),
      family: font.family,
      weight: font.weight,
      // 和文サブセットは Regular だけ。Bold を頼むと合成太字になって字形が崩れる
      hasBold: doc.fontKey !== 'jp',
      align: doc.align,
      tracking: doc.tracking,
      size: doc.size,
      bordered: doc.bordered,
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

  /* 全面のとき、プレビューを指で動かして切り取りの位置を決める */
  const bleed = doc.style.margin === 'none';
  const beginDrag = useDoc((s) => s.beginDrag);
  const dragFocus = useDoc((s) => s.dragFocus);
  usePan(canvasRef, scene, bleed && loaded !== null, readFocus, beginDrag, dragFocus);

  /** 描くときに識別子から画像を引く。写真は1枚、札は名前ごと */
  const previewImage = useCallback(
    (id: string): CanvasImageSource | null =>
      id === 'photo' ? (loaded?.decoded.bitmap ?? null) : filmLogoImage(id),
    [loaded],
  );

  const preview = usePreview(canvasRef, stageRef, scene, previewImage, EXPORT_LONG_EDGE);

  const pick = useCallback(async (file: File) => {
    setBusy('写真を読み込んでいます');
    setLoadError(null);
    setBandDismissed(false);
    try {
      const [decoded, exif] = await Promise.all([
        decode(file, { resizeWidth: 2048 }),
        readExif(file),
      ]);
      setLoaded((prev) => {
        if (prev) closeDecoded(prev.decoded);
        return { file, decoded, exif };
      });
      useDoc.getState().resetFocus();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'この写真を開けませんでした');
    } finally {
      setBusy(null);
    }
  }, []);

  /** 書き出し。原寸を掴むのはここだけ。終わったらすぐ手放す */
  const renderFull = useCallback(async (): Promise<Blob> => {
    if (!loaded || !scene) throw new Error('写真が選ばれていません');
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
        const blob =
          'convertToBlob' in canvas.canvas
            ? await canvas.canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
            : await new Promise<Blob | null>((ok) =>
                (canvas.canvas as HTMLCanvasElement).toBlob(ok, 'image/jpeg', 0.92),
              );
        if (!blob) throw new Error('画像を書き出せませんでした');
        return blob;
      } finally {
        release(canvas.canvas);
      }
    } finally {
      closeDecoded(full);
    }
  }, [loaded, scene]);

  const exif = loaded?.exif ?? EMPTY_EXIF;
  const noExif = loaded !== null && !exif.camera && !exif.dateTaken && !bandDismissed;

  return (
    <div className="app" data-tab={tab} data-empty={loaded ? undefined : 'true'}>
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
        <span className="hdr__title">Fuchidori</span>
        {loaded ? (
          <button
            type="button"
            className="iconbtn hdr__right"
            aria-label="書き出す"
            title="書き出す"
            aria-busy={busy !== null || undefined}
            disabled={busy !== null}
            onClick={() => openSheet('export')}
          >
            <IconShare />
          </button>
        ) : (
          <span />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pick(f);
            e.target.value = '';
          }}
        />
      </header>

      <div className="stage" ref={stageRef}>
        {loaded ? (
          preview.error || sceneError ? (
            <div className="stage__e3">
              <p>{preview.error ?? sceneError}</p>
              {doc.canUndo() && (
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
                aria-label={bleed ? '枠を付けた写真のプレビュー。動かして切り取る位置を決める' : '枠を付けた写真のプレビュー'}
                data-pannable={bleed || undefined}
              />
              {preview.slow && <span className="stage__dot" aria-hidden="true" />}
              {/* 注記は操作の上に重ねない。プレビューの足元に短く出て、自分で消える */}
              {hint && (
                <p className="stage__hint" role="status">
                  {hint}
                </p>
              )}
            </>
          )
        ) : (
          <div className="home">
            <button
              type="button"
              className="opener"
              aria-label="写真を選ぶ"
              onClick={() => fileRef.current?.click()}
            >
              <FrameMark />
            </button>
            <ShareApp />
          </div>
        )}
      </div>

      {loadError ? (
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
          fileDate={new Date(loaded.file.lastModified)}
          onUseFileDate={() => {
            doc.setOverride('date', new Date(loaded.file.lastModified));
            setBandDismissed(true);
          }}
          onEdit={() => {
            setBandDismissed(true);
            openSheet('info');
          }}
          onSkip={() => {
            doc.set('fields', { ...DEFAULT_FIELDS, date: false, camera: false, lens: false, exposure: false, focalLength: false });
            setBandDismissed(true);
          }}
        />
      ) : (
        <span />
      )}

      {loaded && <OptionRow />}
      {loaded && <TabBar />}

      {sheet === 'info' && <InfoSheet exif={exif} onClose={closeSheet} />}
      {sheet === 'export' && <ExportSheet render={renderFull} onClose={closeSheet} />}
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
