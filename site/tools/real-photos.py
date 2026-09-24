#!/usr/bin/env python3
"""依頼者の実写（チャット経由で撮影情報が消えている）に、作例用の撮影情報を書き込む。

値は「ざっくりでよい」との依頼で、写真の雰囲気に合わせて決めた作例用の値（ページにもそう明記する）。
元の写真はリポジトリに置かない（site/tools/work/src/ に手で置く）。書き出した作例だけを public に入れる。

    python3 site/tools/real-photos.py
"""
import os
from fractions import Fraction

import piexif
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "work", "src")
OUT = os.path.join(HERE, "work")


def rat(x):
    f = Fraction(x).limit_denominator(100000)
    return (f.numerator, f.denominator)


PHOTOS = {
    # 鳥居と天の川（横）
    "torii": ("torii.jpg", dict(make=b"SONY", model=b"ILCE-7M4", lens=b"FE 20mm F1.8 G", f=1.8, t=15, iso=3200,
                                focal=20, f35=20, dt=b"2025:05:24 01:12:40")),
    # 冬の木と二人（縦）
    "tree": ("tree.jpg", dict(make=b"FUJIFILM", model=b"X-T5", lens=b"XF56mmF1.2 R WR", f=2.0, t=1 / 250, iso=400,
                              focal=56, f35=85, dt=b"2025:02:15 17:58:03")),
    # 犬と夕日の浜辺（横）
    "beach": ("beach.jpg", dict(make=b"FUJIFILM", model=b"X-S20", lens=b"XF70-300mmF4-5.6 R LM OIS WR", f=5.6, t=1 / 1000,
                                iso=200, focal=150, f35=228, dt=b"2025:04:06 18:21:15")),
    # 天の川と二人（縦）
    "stars": ("stars.jpg", dict(make=b"Canon", model=b"EOS R6 Mark II", lens=b"RF15-35mm F2.8 L IS USM", f=2.8, t=10,
                                iso=6400, focal=24, f35=24, dt=b"2025:07:26 23:40:52")),
}

for name, (src, e) in PHOTOS.items():
    im = Image.open(os.path.join(SRC, src)).convert("RGB")
    exif = piexif.dump({
        "0th": {piexif.ImageIFD.Make: e["make"], piexif.ImageIFD.Model: e["model"]},
        "Exif": {
            piexif.ExifIFD.LensModel: e["lens"],
            piexif.ExifIFD.FNumber: rat(e["f"]),
            piexif.ExifIFD.ExposureTime: rat(e["t"]),
            piexif.ExifIFD.ISOSpeedRatings: e["iso"],
            piexif.ExifIFD.FocalLength: rat(e["focal"]),
            piexif.ExifIFD.FocalLengthIn35mmFilm: e["f35"],
            piexif.ExifIFD.DateTimeOriginal: e["dt"],
        },
    })
    path = os.path.join(OUT, f"real-{name}.jpg")
    im.save(path, "JPEG", quality=95, exif=exif)
    print(path, im.size)
