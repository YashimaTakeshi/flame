#!/usr/bin/env python3
"""仕上がり（フィルムシミュレーション）の札を配布物に置く。

原画は `assets/film/<名前>.webp`。名前は EXIF から読み取る文字列そのもの
（"CLASSIC Neg." のように空白と点を含む）なので、URL に出す名前は英数字だけに直す。
対応は目録（manifest.json）に書き出す。**コードにファイル名を直書きしない。**
差し替えたときに名前も大きさも変わりうるので、目録を正とする。

大きさを目録に持つのは、描く前に縦横比が要るから。
画像が届く前に組み上がりの寸法を決めたいので、比を先に知っておく。
"""
import hashlib
import json
import re
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'film'
OUT = ROOT / 'public' / 'film'


def slug(name: str) -> str:
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', name.lower())).strip('-')


def main() -> None:
    if not SRC.is_dir():
        raise SystemExit(f'{SRC} がありません')
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.webp'):
        old.unlink()

    entries: dict[str, dict[str, object]] = {}
    for p in sorted(SRC.glob('*.webp')):
        name = p.stem
        key = slug(name)
        if not key:
            raise SystemExit(f'{p.name}: URL に出せる名前になりません')
        with Image.open(p) as im:
            w, h = im.size
        dst = OUT / f'{key}.webp'
        if dst.exists():
            raise SystemExit(f'{p.name}: 名前が {dst.name} とぶつかります')
        shutil.copyfile(p, dst)
        entries[name] = {
            'file': f'film/{key}.webp',
            'w': w,
            'h': h,
            'bytes': dst.stat().st_size,
            'sha256': hashlib.sha256(dst.read_bytes()).hexdigest(),
        }
        print(f'  {name:<26} {w}x{h}  {dst.stat().st_size / 1024:5.1f} KB')

    (OUT / 'manifest.json').write_text(
        json.dumps({'logos': entries}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
    )
    total = sum(int(e['bytes']) for e in entries.values())
    print(f'  {len(entries)} 枚 合計 {total / 1024:.1f} KB')


if __name__ == '__main__':
    main()
