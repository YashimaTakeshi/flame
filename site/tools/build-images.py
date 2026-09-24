#!/usr/bin/env python3
"""作例と画面写真（work/）を、紹介ページ用の WebP に縮める。

    python3 site/tools/build-images.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "work")
OUT = os.path.join(HERE, "..", "public", "fuchidori", "img")
os.makedirs(OUT, exist_ok=True)


def save(im, name, widths, q=80):
    im = im.convert("RGB")
    for w in widths:
        h = round(im.height * w / im.width)
        path = os.path.join(OUT, f"{name}-{w}.webp")
        im.resize((w, h), Image.LANCZOS).save(path, "WEBP", quality=q, method=6)
        print(f"{name}-{w}.webp", (w, h), os.path.getsize(path) // 1024, "KB")


def webp(src, name, widths, q=80):
    save(Image.open(os.path.join(WORK, src)), name, widths, q)


def caption_crop(src):
    """書き出した作例から、写真の下の文字の部分だけを切り出す（拡大図に使う）"""
    im = Image.open(os.path.join(WORK, src)).convert("RGB")
    g = im.convert("L")
    w, h = g.size
    bg = g.getpixel((4, h - 4))
    px = g.load()
    # 地色と違う画素がある行を、上から塊にまとめる。一番背の高い塊が写真、その下が文字
    has = [any(abs(px[x, yy] - bg) > 40 for x in range(0, w, 3)) for yy in range(h)]
    runs, yy = [], 0
    while yy < h:
        if has[yy]:
            y0 = yy
            while yy < h and has[yy]:
                yy += 1
            runs.append((y0, yy - 1))
        yy += 1
    photo = max(runs, key=lambda r: r[1] - r[0])
    below = [r for r in runs if r[0] > photo[1]]
    top, bottom = below[0][0], below[-1][1]
    cols = [xx for xx in range(w) if any(abs(px[xx, yy] - bg) > 40 for yy in range(top, bottom + 1, 2))]
    pad = (bottom - top) * 0.9
    box = (int(cols[0] - pad), int(top - pad), int(cols[-1] + pad), int(bottom + pad))
    return im.crop(box)


# 冒頭と作例
webp("hero.jpg", "hero", (640, 1280))
webp("after.jpg", "after", (560, 1120))
save(Image.open(os.path.join(WORK, "real-tree.jpg")), "before", (560, 1120))
for n in ("v-white", "v-black", "v-tall", "v-bleed", "v-sakura", "v-wide", "r-45", "r-916", "r-11", "r-169"):
    webp(f"{n}.jpg", n, (480, 960))
# 文字の部分の拡大
save(caption_crop("hero.jpg"), "hero-caption", (720, 1440), q=88)
# 画面写真
for n in ("ui-home", "ui-edit", "ui-info", "ui-export"):
    webp(f"{n}.png", n, (360, 720), q=82)

# 画像の縦横（ページの width/height に使う。読み込み中に紙面が跳ねないように）
import json
sizes = {}
for f in sorted(os.listdir(OUT)):
    if f.endswith(".webp"):
        with Image.open(os.path.join(OUT, f)) as im:
            sizes[f[:-5]] = im.size
with open(os.path.join(HERE, "image-sizes.json"), "w") as fp:
    json.dump(sizes, fp, indent=0)
