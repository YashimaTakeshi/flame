/**
 * 露出を選んで入れる欄（F値・シャッター速度・ISO）。EXIF の無い写真でも露出を載せたいという要望（§3.32）。
 *
 * 打たせずに OS の選択（select）に任せる。iPhone では回すダイヤルが出て、片手で選べる。
 * 値の並びは実際のカメラの段（1段刻み）に揃え、候補を絞って回す量を減らした。
 * 書き方はキャプションと同じ整形（exif.ts の format…）で出すので、選んだ見た目のまま載る。
 *
 * 写真に露出があり手入力が無いときは、写真の値が候補にちょうどあればそれを選んでおく。
 * 無ければ「—」を見せるが、キャプションは写真の値のまま（caption.ts の collectFacts）。
 */
import type { ExposureParts } from '../caption';
import { formatAperture, formatIso, formatShutter } from '../exif';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';

const F_STOPS: readonly number[] = [1.0, 1.2, 1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
/** 秒。長い方から（ダイヤルを回す向きとカメラの表示を揃える） */
const SHUTTERS: readonly number[] = [
  30, 15, 8, 4, 2, 1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000, 1 / 8000,
];
const ISOS: readonly number[] = [100, 200, 400, 800, 1600, 3200, 6400, 12800];

const PARTS: readonly { key: keyof ExposureParts; label: string; opts: readonly number[]; fmt: (n: number) => string }[] = [
  { key: 'f', label: 'F値', opts: F_STOPS, fmt: formatAperture },
  { key: 's', label: 'シャッター速度', opts: SHUTTERS, fmt: formatShutter },
  { key: 'iso', label: 'ISO感度', opts: ISOS, fmt: formatIso },
];

const NONE: ExposureParts = { f: null, s: null, iso: null };

export function ExposurePicker(): React.ReactElement {
  const override = useDoc((s) => s.overrides.exposure);
  const setOverride = useDoc((s) => s.setOverride);
  const photo = useUi((s) => s.photoExposure);

  return (
    <div className="expsel">
      {PARTS.map(({ key, label, opts, fmt }) => {
        // 見せる値: 手入力、無ければ写真の値。候補の中にちょうど同じ表記があるときだけ選んでおく
        const cur = override?.[key] ?? photo?.[key] ?? null;
        const idx = cur === null ? -1 : opts.findIndex((o) => fmt(o) === fmt(cur));
        return (
          <select
            key={key}
            className="pselect expsel__one"
            // ほかのタブから「露出を入れる」で来たとき、最初の欄から始める
            data-field={key === 'f' ? 'exposure' : undefined}
            aria-label={label}
            title={label}
            value={idx < 0 ? '' : String(idx)}
            onChange={(e) => {
              const v = e.target.value === '' ? null : (opts[Number(e.target.value)] ?? null);
              const next = { ...(override ?? NONE), [key]: v };
              // 3つとも外したら手入力をやめる（写真の値に戻る）
              setOverride('exposure', next.f === null && next.s === null && next.iso === null ? null : next);
            }}
          >
            <option value="">—</option>
            {opts.map((o, i) => (
              <option key={i} value={String(i)}>
                {fmt(o)}
              </option>
            ))}
          </select>
        );
      })}
    </div>
  );
}
