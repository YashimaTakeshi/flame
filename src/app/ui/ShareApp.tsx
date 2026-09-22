/**
 * 「アプリを共有」の押しどころ。
 *
 * 結果はこの部品の中だけで知らせる。プレビューの注記（stage__hint）は
 * 写真があるときしか出ないので、ホーム画面では使えない。
 * ここで出せば、ホームでも書き出しシートでも同じように動く。
 */
import { useEffect, useRef, useState } from 'react';
import { shareApp, type ShareOutcome } from '../share';
import { IconLink } from './icons';

/** 知らせが出ている時間。読み終わる長さだけ出して、あとは黙る */
const NOTE_MS = 3000;

const noteOf = (o: ShareOutcome): string | null => {
  switch (o.kind) {
    case 'shared':
    case 'cancelled':
      return null; // 共有シートが出たなら、それ以上こちらから言うことはない
    case 'copied':
      return 'リンクをコピーしました';
    case 'manual':
      return o.url;
  }
};

export function ShareApp({ variant = 'quiet' }: { variant?: 'quiet' | 'button' }): React.ReactElement {
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const run = (): void => {
    void shareApp().then((o) => {
      const n = noteOf(o);
      setNote(n);
      if (timer.current) clearTimeout(timer.current);
      // URL を手で選んでもらう場合は消さない。消えると写せない
      if (n && o.kind !== 'manual') timer.current = setTimeout(() => setNote(null), NOTE_MS);
    });
  };

  return (
    <div className="shareapp" data-variant={variant}>
      <button type="button" className={variant === 'button' ? 'btn btn--sec' : 'shareapp__quiet'} onClick={run}>
        <IconLink />
        <span>アプリを共有</span>
      </button>
      {note && (
        <p className="shareapp__note" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
