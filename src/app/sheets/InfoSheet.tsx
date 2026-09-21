/** 作品の情報と、写真に無かった撮影情報の手入力 */
import { useState } from 'react';
import { useDoc } from '../state/doc';
import type { ExifFacts } from '../exif';
import { Sheet } from '../ui/Sheet';

const toInput = (d: Date | null): string => {
  if (!d) return '';
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function InfoSheet({ exif, onClose }: { exif: ExifFacts; onClose: () => void }): React.ReactElement {
  const doc = useDoc();
  const [title, setTitle] = useState(doc.title);
  const [artist, setArtist] = useState(doc.artist);
  const [camera, setCamera] = useState(doc.overrides.camera ?? '');
  const [lens, setLens] = useState(doc.overrides.lens ?? '');
  const [date, setDate] = useState(toInput(doc.overrides.date));

  const confirm = (): void => {
    doc.set('title', title);
    doc.set('artist', artist);
    doc.setOverride('camera', camera.trim() || null);
    doc.setOverride('lens', lens.trim() || null);
    doc.setOverride('date', date ? new Date(`${date}T12:00:00`) : null);
    onClose();
  };

  return (
    <Sheet title="情報を編集" size="tall" onClose={onClose} onConfirm={confirm}>
      <p className="sheet__label">作品の情報</p>
      <div className="card">
        <label className="card__row">
          <span>タイトル</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
        </label>
        <label className="card__row">
          <span>作者</span>
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="名前（省略できます）"
          />
        </label>
      </div>

      <p className="sheet__label">撮影の情報</p>
      <div className="card">
        <label className="card__row">
          <span>カメラ</span>
          <input
            value={camera}
            onChange={(e) => setCamera(e.target.value)}
            placeholder={exif.camera ?? 'カメラ名（写真に記録なし）'}
          />
        </label>
        <label className="card__row">
          <span>レンズ</span>
          <input
            value={lens}
            onChange={(e) => setLens(e.target.value)}
            placeholder={exif.lens ?? 'レンズ名（写真に記録なし）'}
          />
        </label>
        <label className="card__row">
          <span>日付</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <p className="e1" style={{ padding: 0 }}>
        ここに入れた内容は、写真に記録された値より優先されます。空欄なら写真の値を使います。
      </p>
    </Sheet>
  );
}
