#!/usr/bin/env python3
"""作例と画面写真（work/）を、紹介ページ用の WebP に縮める。

    python3 site/tools/build-images.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "work")
OUT = os.path.join(HERE, "..", "public", "fuchidori", "img")


def webp(src, name, widths, q=82):
    im = Image.open(os.path.join(WORK, src)).convert("RGB")
    for w in widths:
        h = round(im.height * w / im.width)
        path = os.path.join(OUT, f"{name}-{w}.webp")
        im.resize((w, h), Image.LANCZOS).save(path, "WEBP", quality=q, method=6)
        print(path, (w, h), os.path.getsize(path) // 1024, "KB")


for n in ("dusk", "sea", "city"):
    webp(f"demo-{n}.jpg", f"demo-{n}", (640, 1280))
webp("ui-phone-frame.png", "ui-phone-frame", (390, 780))
webp("ui-phone-info.png", "ui-phone-info", (390, 780))
webp("ui-desk.png", "ui-desk", (1440,))
