import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildScene, INK, WHITE, type SceneInput } from '../core/compose';
import type { Scene } from '../core/scene/scene';
import { rgba, type Rgba } from '../core/scene/ops';
import { closeDecoded, decode, type DecodedPhoto } from '../platform/decode';
import { inFrame, makeFilename, saveImage, type SaveOutcome } from '../platform/save';
import { safeStorage } from '../platform/storage';
import { renderScene } from '../render/executor';
import { createVerifiedCanvas, release } from '../render/guards';
import { canvasMeasurer } from '../render/measure';
import { makeExportTarget } from '../render/target';
import { BUILD_INFO, shortVersion } from '../build-info';
import { composeCaption, missingFields } from './caption';
import { readExif, type ExifFacts } from './exif';
import { fontRefFor, LATIN_FONTS, preloadLatinFonts, type LatinFontKey } from './fonts-catalog';
import { Diagnostics } from './Diagnostics';
import { usePreview, type PreviewFailure } from './usePreview';
import './theme.css';
import './App.css';

/** 背景色。参考アプリの並びに寄せた無彩色中心の9色 */
const COLORS: { key: string; label: string; value: Rgba }[] = [
  { key: 'white', label: 'White', value: rgba(255, 255, 255) },
  { key: 'warm', label: 'Warm White', value: rgba(246, 244, 241) },
  { key: 'ivory', label: 'Ivory', value: rgba(240, 234, 220) },
  { key: 'silver', label: 'Silver Sand', value: rgba(196, 201, 199) },
  { key: 'gunmetal', label: 'Gunmetal', value: rgba(45, 52, 54) },
  { key: 'onyx', label: 'Onyx', value: rgba(24, 24, 24) },
  { key: 'black', label: 'Black', value: rgba(0, 0, 0) },
  { key: 'sakura', label: 'Sakura', value: rgba(244, 213, 218) },
  { key: 'sunny', label: 'Sunny Yellow', value: rgba(245, 224, 138) },
];

const SIZES = [
  { key: 'S', label: 'Small', lu: 13 },
  { key: 'M', label: 'Medium', lu: 16 },
  { key: 'L', label: 'Large', lu: 20 },
] as const;

const TRACKING = [
  { key: 'tight', label: 'Tight', lu: -0.24 },
  { key: 'normal', label: 'Normal', lu: 0 },
  { key: 'wide', label: 'Wide', lu: 1.44 },
  { key: 'widest', label: 'Widest', lu: 2.88 },
] as const;

const ALIGNS = [
  { key: 'left', label: 'Left' },
  { key: 'center', label: 'Center' },
  { key: 'right', label: 'Right' },
] as const;

/**
 * 背景の明るさから文字色を決める。
 * 白黒のコントラストが釣り合う明度で切り替える（W3C の相対輝度の交点）。
 */
const INK_CROSSOVER = 0.1791287847;

function relativeLuminance(c: Rgba): number {
  const ch = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

function inkFor(bg: Rgba): Rgba {
  return relativeLuminance(bg) > INK_CROSSOVER ? INK : rgba(236, 233, 228);
}

interface Loaded {
  readonly file: File;
  readonly decoded: DecodedPhoto;
  readonly exif: ExifFacts;
}

export function App(): React.ReactElement {
  const [route, setRoute] = useState<'edit' | 'diagnostics'>('edit');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<PreviewFailure | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  /** 書き出した画像。**必ず表示する。** 共有もダウンロードも駄目な環境で、長押し保存が最後の砦になる */
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [title, setTitle] = useState('Untitled');
  const [artist, setArtist] = useState('');
  const [fontKey, setFontKey] = useState<LatinFontKey>('helvetica');
  const [colorKey, setColorKey] = useState('white');
  const [sizeKey, setSizeKey] = useState<(typeof SIZES)[number]['key']>('M');
  const [trackKey, setTrackKey] = useState<(typeof TRACKING)[number]['key']>('normal');
  const [alignKey, setAlignKey] = useState<(typeof ALIGNS)[number]['key']>('left');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    safeStorage.init();
    preloadLatinFonts()
      .then(() => setFontsReady(true))
      .catch((e: unknown) =>
        setFailure({
          reason: 'font',
          message: `書体を読み込めませんでした: ${e instanceof Error ? e.message : String(e)}`,
        }),
      );
  }, []);

  const background = useMemo(
    () => COLORS.find((c) => c.key === colorKey)?.value ?? WHITE,
    [colorKey],
  );

  const sceneInput: SceneInput | null = useMemo(() => {
    if (!loaded || !fontsReady) return null;
    const size = SIZES.find((s) => s.key === sizeKey) ?? SIZES[1];
    const track = TRACKING.find((t) => t.key === trackKey) ?? TRACKING[1];
    return {
      styleId: 'OR1',
      photo: {
        id: 'photo',
        aspect: loaded.decoded.natural.w / loaded.decoded.natural.h,
      },
      caption: {
        text: composeCaption(loaded.exif, {
          title,
          artist,
          showExposure: true,
          showFocal: true,
        }),
        font: fontRefFor(fontKey),
        sizeLu: size.lu,
        letterSpacingLu: track.lu,
        align: alignKey,
      },
      background,
      ink: inkFor(background),
    };
  }, [loaded, fontsReady, title, artist, fontKey, sizeKey, trackKey, alignKey, background]);

  const scene: Scene | null = useMemo(
    () => (sceneInput ? buildScene(sceneInput, canvasMeasurer) : null),
    [sceneInput],
  );

  usePreview(canvasRef, scene, loaded?.decoded.bitmap ?? null, 4096, setFailure);

  const pick = useCallback(async (file: File) => {
    setBusy('写真を読み込んでいます');
    setOutcome(null);
    try {
      const [decoded, exif] = await Promise.all([
        // プレビューに使う縮小版。原寸は書き出しのときだけ掴む
        decode(file, { resizeWidth: 2048 }),
        readExif(file),
      ]);
      setLoaded((prev) => {
        if (prev) closeDecoded(prev.decoded);
        return { file, decoded, exif };
      });
    } catch (e) {
      setFailure({
        reason: 'unknown',
        message: e instanceof Error ? e.message : 'この写真を開けませんでした',
      });
    } finally {
      setBusy(null);
    }
  }, []);

  // 画像の URL は使い終わったら手放す。放っておくと書き出すたびに溜まる
  useEffect(() => {
    if (!resultUrl) return;
    return () => URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  const save = useCallback(async () => {
    if (!loaded || !scene || !sceneInput) return;
    setBusy('書き出しています');
    setOutcome(null);
    setResultUrl(null);
    try {
      // 書き出しのときだけ原寸を掴む。終わったらすぐ手放す
      const full = await decode(loaded.file);
      const target = makeExportTarget(scene, 4096);
      const canvas = createVerifiedCanvas(target.widthPx, target.heightPx);
      if (!canvas.ok) {
        setFailure({
          reason: 'canvas',
          message: `この大きさの画像を作れませんでした（${target.widthPx}x${target.heightPx}）`,
        });
        closeDecoded(full);
        return;
      }
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
      release(canvas.canvas);
      closeDecoded(full);
      if (!blob) {
        setFailure({ reason: 'unknown', message: '画像を書き出せませんでした' });
        return;
      }
      // 保存の成否によらず、結果は必ず表示する
      setResultUrl(URL.createObjectURL(blob));
      setOutcome(await saveImage(blob, makeFilename()));
    } catch (e) {
      setFailure({
        reason: 'unknown',
        message: e instanceof Error ? e.message : '書き出しに失敗しました',
      });
    } finally {
      setBusy(null);
    }
  }, [loaded, scene, sceneInput]);

  if (route === 'diagnostics') return <Diagnostics onBack={() => setRoute('edit')} />;

  const missing = loaded ? missingFields(loaded.exif) : [];

  return (
    <div className="app">
      <header className="header">
        <span className="brand">FLAME</span>
        <button className="chip" onClick={() => fileRef.current?.click()}>
          写真を選ぶ
        </button>
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

      <div className="stage">
        {loaded ? (
          <canvas ref={canvasRef} className="preview" />
        ) : (
          <div className="empty">
            <h1>写真に、撮影情報を添えた枠を</h1>
            <p>
              写真はこの端末から出ません。読み取りも合成も書き出しも、
              すべてブラウザの中で終わります。
            </p>
          </div>
        )}
      </div>

      {loaded && (
        <div className="panel">
          {failure && <p className="note warn">{failure.message}</p>}
          {missing.length > 0 && (
            <p className="note">
              この写真には {missing.join('・')} の情報がありません。
              キャプションからは省かれます。
            </p>
          )}
          {outcome && (
            <p className={outcome.ok ? 'note' : 'note warn'}>{outcome.detail}</p>
          )}

          <div className="field">
            <span className="label">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
          </div>
          <div className="field">
            <span className="label">Artist</span>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="名前（省略できます）"
            />
          </div>

          <div className="field">
            <span className="label">Font</span>
            <div className="row">
              {LATIN_FONTS.map((f) => (
                <button
                  key={f.key}
                  className="chip"
                  aria-pressed={fontKey === f.key}
                  onClick={() => setFontKey(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">Color</span>
            <div className="row">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  className="chip"
                  aria-pressed={colorKey === c.key}
                  onClick={() => setColorKey(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">Layout</span>
            <div className="row">
              {ALIGNS.map((a) => (
                <button
                  key={a.key}
                  className="chip"
                  aria-pressed={alignKey === a.key}
                  onClick={() => setAlignKey(a.key)}
                >
                  {a.label}
                </button>
              ))}
              {TRACKING.map((t) => (
                <button
                  key={t.key}
                  className="chip"
                  aria-pressed={trackKey === t.key}
                  onClick={() => setTrackKey(t.key)}
                >
                  {t.label}
                </button>
              ))}
              {SIZES.map((s) => (
                <button
                  key={s.key}
                  className="chip"
                  aria-pressed={sizeKey === s.key}
                  onClick={() => setSizeKey(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <dl className="facts">
            <dt>CAMERA</dt>
            <dd>{loaded.exif.camera ?? '—'}</dd>
            <dt>LENS</dt>
            <dd>{loaded.exif.lens ?? '—'}</dd>
            <dt>SIZE</dt>
            <dd>
              {loaded.decoded.natural.w} × {loaded.decoded.natural.h}
            </dd>
          </dl>

          <div className="actions">
            <button className="btn" onClick={() => void save()} disabled={busy !== null}>
              {busy ?? '書き出す'}
            </button>
          </div>

          {resultUrl && (
            <div className="result">
              <span className="label">書き出した画像</span>
              <p className="note">
                この画像を<strong>長押し</strong>して「写真に保存」を選んでください。
                {inFrame() && 'この画面は枠の中で動いているため、これが唯一の保存方法です。'}
              </p>
              <img src={resultUrl} alt="書き出した画像" className="result-img" />
            </div>
          )}
        </div>
      )}

      <footer className="footer">
        <span>
          {shortVersion()} · {BUILD_INFO.commit}
        </span>
        <button onClick={() => setRoute('diagnostics')}>この端末を調べる</button>
      </footer>
    </div>
  );
}
