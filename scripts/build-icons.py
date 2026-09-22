#!/usr/bin/env python3
"""アプリの印（アイコン）を1枚の原画から作る。

原画は角丸四角の描き起こしで、透過の市松模様が焼き込まれた RGB の書き出し。
そのままでは四隅に市松が残るので、**角丸の外側を切り抜いて**透過にする。

切り抜きで絵を削ってしまっていないことは、切った画素がすべて市松（無彩色で明るい）
だったかを数えて確かめる。1画素でも絵を削っていたら止まる。

出力:
  icon-192.png / icon-512.png   … 透過。ブラウザのタブ・Android の適応アイコン以外
  icon-maskable-512.png         … 中央 80% に収めた不透過。Android の適応アイコン用
  apple-touch-icon.png (180)    … 不透過。iOS のホーム画面（透過は黒くなる）
  favicon-32.png                … タブ用
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'icon-source.png'
OUT = ROOT / 'public' / 'icons'

# 角丸の半径（一辺に対する比）。原画の角丸に合わせた実測値
RADIUS_RATIO = 0.205
# 不透過の版で四隅を埋める色。原画の縁から採った落ち着いたタン
PLATE = (150, 124, 97)
# maskable は中央 80% だけが必ず見える。そこに収める
MASKABLE_INSET = 0.10


def is_checker(px: tuple[int, int, int]) -> bool:
    """市松は無彩色で明るい。書き出しの粗さで数値がわずかに振れるので幅を持たせる"""
    r, g, b = px[:3]
    return max(r, g, b) - min(r, g, b) <= 12 and min(r, g, b) >= 185


def to_palette(img: Image.Image) -> Image.Image:
    """256色に落とす。写真を含む絵なので、そのままだと 512px で 430KB になる。

    透過のある版は八分木でしか減色できず（PIL の制限）、空に段が出る。
    そこで**色と透過を分けて扱う**: 色は誤差拡散つきで 255 色に落とし、
    残る1色を透過の席にする。角の外だけが透過なので、これで過不足がない。
    """
    if img.mode != 'RGBA':
        return img.convert('P', palette=Image.ADAPTIVE, colors=256, dither=Image.FLOYDSTEINBERG)

    alpha = img.getchannel('A')
    pal = img.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=255, dither=Image.FLOYDSTEINBERG)
    clear_index = 255
    px = pal.load()
    ax = alpha.load()
    w, h = pal.size
    for y in range(h):
        for x in range(w):
            if ax[x, y] < 128:
                px[x, y] = clear_index
    pal.info['transparency'] = clear_index
    return pal


def rounded_mask(side: int) -> Image.Image:
    # 4倍で描いて縮める。角のがたつきを消す
    k = 4
    m = Image.new('L', (side * k, side * k), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        (0, 0, side * k - 1, side * k - 1), radius=int(side * k * RADIUS_RATIO), fill=255
    )
    return m.resize((side, side), Image.LANCZOS)


def main() -> None:
    art = Image.open(SRC).convert('RGB')
    side = art.size[0]
    if art.size[1] != side:
        raise SystemExit(f'原画が正方形ではありません: {art.size}')

    mask = rounded_mask(side)

    # ★切り抜きで絵を削っていないこと★
    ap, mp = art.load(), mask.load()
    cut_art = 0
    for y in range(0, side, 2):
        for x in range(0, side, 2):
            if mp[x, y] < 128 and not is_checker(ap[x, y]):
                cut_art += 1
    if cut_art:
        raise SystemExit(f'角丸の外に絵が {cut_art} 画素あります。半径 {RADIUS_RATIO} が合っていません')

    OUT.mkdir(parents=True, exist_ok=True)
    clear = art.copy()
    clear.putalpha(mask)

    def save(img: Image.Image, name: str, size: int) -> None:
        out = img.resize((size, size), Image.LANCZOS)
        out = to_palette(out)
        out.save(OUT / name, optimize=True)
        print(f'  {name:<26} {size}px  {(OUT / name).stat().st_size / 1024:6.1f} KB')

    save(clear, 'icon-192.png', 192)
    save(clear, 'icon-512.png', 512)
    save(clear, 'favicon-32.png', 32)

    # 不透過（iOS のホーム画面。透過は黒く落ちる）
    opaque = Image.new('RGB', (side, side), PLATE)
    opaque.paste(art, (0, 0), mask)
    save(opaque, 'apple-touch-icon.png', 180)

    # maskable。どこを切られても絵が残るよう中央 80% に収める
    pad = int(side * MASKABLE_INSET)
    inner = side - pad * 2
    maskable = Image.new('RGB', (side, side), PLATE)
    shrunk = art.resize((inner, inner), Image.LANCZOS)
    maskable.paste(shrunk, (pad, pad), mask.resize((inner, inner), Image.LANCZOS))
    save(maskable, 'icon-maskable-512.png', 512)


if __name__ == '__main__':
    main()
