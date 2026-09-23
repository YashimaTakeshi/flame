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
    /*
     * 高さを詰める（以前は4行で、プレビューが切手ほどに縮んだ）。見出し1行に日付を入れ、
     * 出口3つは短い言葉で横1列。3つとも必ず画面に見えている（横に送らない）
     */
    <div className="band band--noexif" role="status">
      <p>撮影情報がありません（ファイルの日付 {formatWallClock(fileDate)}）</p>
      <div className="band__acts">
        <button type="button" className="btn--s" onClick={onUseFileDate} title={`日付に ${formatWallClock(fileDate)} を使う`}>
          日付を使う
        </button>
        <button type="button" className="btn--s" onClick={onEdit}>
          手で入力
        </button>
        <button type="button" className="btn--s" onClick={onSkip} title="この写真は撮影情報なしで作る">
          なしで作る
        </button>
      </div>
    </div>
  );
}
