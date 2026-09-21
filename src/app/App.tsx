import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildScene, INK, type SceneInput } from '../core/compose';
import { rgba, type Rgba } from '../core/scene/ops';
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
import { fontRefFor, preloadLatinFonts } from './fonts-catalog';
import { colorOf } from './panels/constants';
import { ExportSheet } from './sheets/ExportSheet';
import { InfoSheet } from './sheets/InfoSheet';
import { DEFAULT_FIELDS, useDoc } from './state/doc';
import { useUi } from './state/ui';
import { IconPhoto, IconShare } from './ui/icons';
import { Sheet } from './ui/Sheet';
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
    preloadLatinFonts()
      .then(() => setFontsReady(true))
      .catch((e: unknown) =>
        setLoadError(
          `書体を読み込めませんでした: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
  }, []);

  const background = useMemo(() => colorOf(doc.colorKey), [doc.colorKey]);

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
    };
  }, [loaded, fontsReady, doc, background]);

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

  const preview = usePreview(
    canvasRef,
    stageRef,
    scene,
    loaded?.decoded.bitmap ?? null,
    EXPORT_LONG_EDGE,
  );

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
          photo: () => full.bitmap,
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
        <span className="hdr__title">flame</span>
        {loaded ? (
          <button
            type="button"
            className="iconbtn iconbtn--solid hdr__right"
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
                aria-label="枠を付けた写真のプレビュー"
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
          <button
            type="button"
            className="opener"
            aria-label="写真を選ぶ"
            onClick={() => fileRef.current?.click()}
          >
            <FrameMark />
          </button>
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
