#!/usr/bin/env python3
"""テスト用の画像を作る。

成果物は tests/fixtures/ にコミットする。リポジトリを重くしないよう小さめにするが、
「回転フラグ付き」「EXIF なし」「縦位置」といった**実際に壊れる条件**は落とさない。

必要なもの: python3 -m pip install pillow piexif
"""
import os
import sys
from fractions import Fraction

import piexif
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tests", "fixtures")


def rat(x):
    f = Fraction(x).limit_denominator(10000)
    return (f.numerator, f.denominator)


def gps(lat, lng):
    def dms(v):
        v = abs(v)
        d = int(v)
        m = int((v - d) * 60)
        s = round((((v - d) * 60) - m) * 3600 / 60, 4)
        return ((d, 1), (m, 1), (int(s * 10000), 10000))

    return {
        piexif.GPSIFD.GPSLatitudeRef: b"N" if lat >= 0 else b"S",
        piexif.GPSIFD.GPSLatitude: dms(lat),
        piexif.GPSIFD.GPSLongitudeRef: b"E" if lng >= 0 else b"W",
        piexif.GPSIFD.GPSLongitude: dms(lng),
    }


def canvas(w, h):
    """四隅を見分けられる絵。回転やトリミングのずれが目で分かる。"""
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    top, bot = (40, 45, 70), (230, 140, 60)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    m = max(8, min(w, h) // 12)
    d.rectangle([m, m, m * 2, m * 2], fill=(255, 255, 255))                    # 左上: 白
    d.rectangle([w - m * 2, m, w - m, m * 2], fill=(255, 0, 0))                # 右上: 赤
    d.rectangle([m, h - m * 2, m * 2, h - m], fill=(0, 160, 255))              # 左下: 青
    d.rectangle([w - m * 2, h - m * 2, w - m, h - m], fill=(0, 0, 0))          # 右下: 黒
    return im


def build(name, w, h, *, make=None, model=None, lens=None, focal=None, focal35=None,
          fnum=None, exposure=None, iso=None, dt=None, with_gps=False, orientation=1):
    im = canvas(w, h)
    path = os.path.join(OUT, name)
    if make is None:
        im.save(path, quality=88)
        print(f"  {name:28s} {w}x{h}  EXIF なし  {os.path.getsize(path):>7,} B")
        return
    zeroth = {
        piexif.ImageIFD.Make: make.encode(),
        piexif.ImageIFD.Model: model.encode(),
        piexif.ImageIFD.Orientation: orientation,
    }
    exif = {
        piexif.ExifIFD.DateTimeOriginal: dt.encode(),
        piexif.ExifIFD.LensModel: lens.encode(),
        piexif.ExifIFD.FocalLength: rat(focal),
        piexif.ExifIFD.FocalLengthIn35mmFilm: focal35,
        piexif.ExifIFD.FNumber: rat(fnum),
        piexif.ExifIFD.ExposureTime: exposure,
        piexif.ExifIFD.ISOSpeedRatings: iso,
    }
    d = {"0th": zeroth, "Exif": exif,
         "GPS": gps(34.2959, 132.3197) if with_gps else {}, "1st": {}, "thumbnail": None}
    im.save(path, quality=88, exif=piexif.dump(d))
    tag = f"Orientation={orientation}" if orientation != 1 else ""
    print(f"  {name:28s} {w}x{h}  {model:14s} {tag:16s} {os.path.getsize(path):>7,} B")


def main():
    os.makedirs(OUT, exist_ok=True)
    # ミラーレス・横位置。キャプションの主役になる EXIF を一式持つ
    build("mirrorless-landscape.jpg", 1200, 800, make="FUJIFILM", model="X-M5",
          lens="SIGMA 18-50mm F2.8 DC DN | Contemporary 021", focal=23.0, focal35=35,
          fnum=2.8, exposure=(1, 250), iso=400, dt="2026:09:20 17:42:11", with_gps=True)
    # iPhone・縦位置。焦点距離の 35mm 換算が効く
    build("iphone-portrait.jpg", 600, 800, make="Apple", model="iPhone 16 Pro",
          lens="iPhone 16 Pro back camera 6.765mm f/1.78", focal=6.765, focal35=24,
          fnum=1.78, exposure=(1, 120), iso=80, dt="2026:09:21 13:05:00", with_gps=True)
    # ★回転フラグ付き★ デコード経路が食い違うとここで破れる
    build("rotated-orient6.jpg", 1200, 900, make="SONY", model="ILCE-7M4",
          lens="FE 35mm F1.8", focal=35.0, focal35=35, fnum=1.8, exposure=(1, 60),
          iso=1600, dt="2026:08:01 09:00:00", orientation=6)
    # EXIF なし。スクリーンショットや加工済み画像。**必ず来る**
    build("no-exif.jpg", 900, 1200)


if __name__ == "__main__":
    main()
