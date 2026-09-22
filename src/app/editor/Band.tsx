/**
 * 撮影情報が読み取れなかったときの帯。
 *
 * 行き止まりを作らない。3つの出口を必ず用意する。
 */
import { formatWallClock, type WallClock } from '../../core/wallclock';

export function Band({
  fileDate,
  onUseFileDate,
  onEdit,
  onSkip,
}: {
  fileDate: WallClock;
  onUseFileDate: () => void;
  onEdit: () => void;
  onSkip: () => void;
}): React.ReactElement {
  return (
    <div className="band" role="status">
      <p>撮影情報が読み取れませんでした。</p>
      <p>スクリーンショットや加工済みの写真ではよくあることです。</p>
      <div className="band__acts">
        <button type="button" className="btn--s" onClick={onUseFileDate}>
          ファイルの日付を使う（{formatWallClock(fileDate)}）
        </button>
        <button type="button" className="btn--s" onClick={onEdit}>
          手で入力
        </button>
        <button type="button" className="btn--s" onClick={onSkip}>
          入れない
        </button>
      </div>
    </div>
  );
}
