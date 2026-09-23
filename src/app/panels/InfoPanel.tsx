/**
 * 情報。キャプションに載せる項目を、**中身と一緒に**全部並べる。
 *
 * 以前は8項目のうち3行しか見えず、空のタイトルにも ✓ が付いていた。何が載るのか、
 * どこを押せば直せるのかが分からなかった。今は1行に「名前・今の中身・載せるスイッチ」。
 * 行を押すと情報シートがその欄から開く。
 */
import type { FieldId } from '../../core/styles/types';
import { SHOT_FACTS, effectiveFields } from '../caption';
import { useDoc } from '../state/doc';
import { useUi } from '../state/ui';
import { Switch } from '../ui/controls';
import { IconEdit, IconReset } from '../ui/icons';

/** よく触る順。撮影情報が先、作品の情報（タイトル・作者）が後 */
const FIELDS: { id: FieldId; label: string; editable: boolean; empty: string }[] = [
  { id: 'camera', label: 'カメラ', editable: true, empty: '記録なし' },
  { id: 'lens', label: 'レンズ', editable: true, empty: '記録なし' },
  { id: 'exposure', label: '露出', editable: false, empty: '記録なし' },
  { id: 'focalLength', label: '焦点距離', editable: false, empty: '記録なし' },
  { id: 'date', label: '日付', editable: true, empty: '記録なし' },
  { id: 'film', label: '仕上がり', editable: true, empty: '記録なし' },
  { id: 'title', label: 'タイトル', editable: true, empty: '未入力' },
  { id: 'artist', label: '作者', editable: true, empty: '未入力' },
];

export function InfoPanel(): React.ReactElement {
  const fields = useDoc((s) => s.fields);
  const skip = useDoc((s) => s.skipShotFacts);
  const toggleField = useDoc((s) => s.toggleField);
  const set = useDoc((s) => s.set);
  const resetInfo = useDoc((s) => s.resetInfo);
  const facts = useUi((s) => s.facts);
  const openInfo = useUi((s) => s.openInfo);
  const setHint = useUi((s) => s.setHint);
  const shown = effectiveFields(fields, skip);
  const captionOn = useDoc((s) => s.captionOn);
  const setTab = useUi((s) => s.setTab);

  /*
   * 戻すのは情報だけ（載せる項目・日付の書き方・タイトル・手入力）。
   * 以前は配置も書体も地色もまとめて工場出荷に戻り、取り消せなかった
   */
  const reset = (): void => {
    resetInfo();
    setHint('情報を戻しました（↶ で元に戻せます）');
  };

  const toggle = (id: FieldId): void => {
    // 「この写真では撮影情報を入れない」を選んだあとに撮影情報を入れ直したら、その選択をやめる
    if (skip && SHOT_FACTS.includes(id)) {
      set('skipShotFacts', false);
      if (!fields[id]) toggleField(id);
      return;
    }
    toggleField(id);
  };

  return (
    <div className="pnl pnl--list">
      {/* 文字を切っているあいだは何も載らない。どこで入れ直すかを1行で */}
      {!captionOn && (
        <button type="button" className="irows__off" onClick={() => setTab('text')}>
          文字は入れない設定です（文字タブで入れられます）
        </button>
      )}
      <div className="irows" role="group" aria-label="キャプションに載せる項目">
        {FIELDS.map((f) => {
          const v = facts[f.id];
          const body = (
            <>
              <span className="irow__name">{f.label}</span>
              <span className="irow__val" data-empty={v ? undefined : true}>
                {v ?? f.empty}
                {f.editable && <span aria-hidden="true"> ›</span>}
              </span>
            </>
          );
          return (
            <div key={f.id} className="irow" data-off={!shown[f.id] || undefined}>
              {f.editable ? (
                <button type="button" className="irow__main" aria-label={`${f.label}を編集`} onClick={() => openInfo(f.id)}>
                  {body}
                </button>
              ) : (
                <span className="irow__main">{body}</span>
              )}
              <Switch label={`${f.label}を載せる`} on={shown[f.id]} onChange={() => toggle(f.id)} />
            </div>
          );
        })}
      </div>
      <div className="irows__acts">
        <button type="button" className="btn--s" onClick={() => openInfo(null)}>
          <IconEdit size={16} />
          まとめて編集
        </button>
        <button type="button" className="btn--s" aria-label="情報を初期値に戻す" onClick={reset}>
          <IconReset size={16} />
          情報を戻す
        </button>
      </div>
    </div>
  );
}
