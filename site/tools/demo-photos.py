#!/usr/bin/env python3
"""紹介ページの作例に使う「写真の代わり」の絵を作る。

リポジトリに実写の写真は無い（テスト用の画像は四隅に色の四角がある検査用の絵）。
作例は、この絵をアプリ本体で実際に縁取りして書き出したものを使う（site/tools/render-demos.mjs）。
実写の作例が用意できたら差し替える。撮影情報は作例用の架空の値。

必要なもの: python3 -m pip install pillow piexif
"""
import math
import os
import random
from fractions import Fraction

import piexif
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "work")
os.makedirs(OUT, exist_ok=True)


def rat(x):
    f = Fraction(x).limit_denominator(10000)
    return (f.numerator, f.denominator)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def grad(im, stops, y0, y1):
    d = ImageDraw.Draw(im)
    w = im.width
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1)
        for k in range(len(stops) - 1):
            (p0, c0), (p1, c1) = stops[k], stops[k + 1]
            if p0 <= t <= p1:
                d.line([(0, y), (w, y)], fill=lerp(c0, c1, (t - p0) / max(1e-6, p1 - p0)))
                break


def ridge(w, base, amp, seed, rough=5):
    rnd = random.Random(seed)
    ph = [rnd.random() * 6.28 for _ in range(rough)]
    pts = []
    for x in range(0, w + 8, 8):
        y = base
        for k in range(rough):
            f = (k + 1) ** 1.6 / w * 6.28
            y += amp / (k + 1) ** 1.2 * math.sin(x * f + ph[k])
        pts.append((x, y))
    return pts


def grain(im, amount=7, seed=1):
    rnd = random.Random(seed)
    n = Image.effect_noise(im.size, amount * 3).convert("RGB")
    return Image.blend(im, Image.merge("RGB", [n.getchannel(0)] * 3), 0.035)


def dusk_mountains(w, h):
    """夕暮れの山並みと湖（横位置）"""
    im = Image.new("RGB", (w, h))
    horizon = int(h * 0.64)
    grad(im, [(0, (38, 52, 92)), (0.45, (152, 112, 140)), (0.8, (238, 160, 120)), (1, (252, 206, 150))], 0, horizon)
    # 太陽
    glow = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(glow)
    cx, cy, r = int(w * 0.63), int(horizon - h * 0.07), int(h * 0.05)
    gd.ellipse([cx - r * 5, cy - r * 5, cx + r * 5, cy + r * 5], fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(r * 2.2))
    im = Image.composite(Image.new("RGB", (w, h), (255, 222, 170)), im, glow)
    d = ImageDraw.Draw(im)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 238, 205))
    # 山（遠いほど霞む）
    layers = [
        (horizon - h * 0.16, h * 0.10, (170, 130, 150), 3),
        (horizon - h * 0.09, h * 0.08, (118, 92, 124), 7),
        (horizon - h * 0.03, h * 0.06, (72, 60, 92), 11),
    ]
    for base, amp, col, seed in layers:
        pts = ridge(w, base, amp, seed)
        d.polygon(pts + [(w, horizon), (0, horizon)], fill=col)
    # 湖（空と山を映して暗く）
    sky = im.crop((0, 0, w, horizon)).transpose(Image.FLIP_TOP_BOTTOM)
    sky = sky.resize((w, h - horizon)).filter(ImageFilter.GaussianBlur(6))
    dark = Image.new("RGB", sky.size, (30, 30, 50))
    im.paste(Image.blend(sky, dark, 0.45), (0, horizon))
    d = ImageDraw.Draw(im)
    rnd = random.Random(5)
    for _ in range(140):
        y = horizon + int(rnd.random() ** 1.5 * (h - horizon))
        x = cx + int((rnd.random() - 0.5) * w * 0.18 * (1 + (y - horizon) / h * 3))
        l = int(w * 0.01 + rnd.random() * w * 0.04)
        d.line([(x - l, y), (x + l, y)], fill=(250, 200, 150), width=max(1, h // 900))
    # 手前の岸
    pts = ridge(w, h * 0.93, h * 0.03, 21)
    d.polygon(pts + [(w, h), (0, h)], fill=(22, 22, 32))
    return grain(im)


def sea_portrait(w, h):
    """朝の海と灯台（縦位置）"""
    im = Image.new("RGB", (w, h))
    horizon = int(h * 0.55)
    grad(im, [(0, (120, 170, 210)), (0.7, (196, 220, 232)), (1, (236, 230, 214))], 0, horizon)
    grad(im, [(0, (86, 136, 168)), (0.5, (52, 98, 130)), (1, (30, 66, 96))], horizon, h)
    d = ImageDraw.Draw(im)
    rnd = random.Random(9)
    # 雲
    cl = Image.new("L", (w, h), 0)
    cd = ImageDraw.Draw(cl)
    for _ in range(26):
        x, y = rnd.random() * w, rnd.random() * horizon * 0.6
        rw, rh = w * (0.08 + rnd.random() * 0.14), h * (0.012 + rnd.random() * 0.02)
        cd.ellipse([x - rw, y - rh, x + rw, y + rh], fill=int(120 + rnd.random() * 100))
    cl = cl.filter(ImageFilter.GaussianBlur(w // 60))
    im = Image.composite(Image.new("RGB", (w, h), (250, 250, 248)), im, cl)
    d = ImageDraw.Draw(im)
    # 波のきらめき
    for _ in range(900):
        y = horizon + int(rnd.random() ** 1.3 * (h - horizon))
        x = rnd.random() * w
        l = w * 0.004 + (y - horizon) / h * w * 0.03 * rnd.random()
        c = (220, 236, 240) if rnd.random() < 0.5 else (40, 84, 116)
        d.line([(x - l, y), (x + l, y)], fill=c, width=max(1, int((y - horizon) / h * 6)))
    # 岬と灯台
    pts = [(w * 0.58, horizon), (w * 0.66, horizon - h * 0.035), (w * 0.8, horizon - h * 0.05), (w, horizon - h * 0.06), (w, horizon)]
    d.polygon(pts, fill=(70, 86, 78))
    lx, ly = w * 0.8, horizon - h * 0.05
    tw, th = w * 0.022, h * 0.085
    d.polygon([(lx - tw, ly), (lx + tw, ly), (lx + tw * 0.7, ly - th), (lx - tw * 0.7, ly - th)], fill=(246, 244, 238))
    for k in (0.3, 0.62):
        y0 = ly - th * k
        d.rectangle([lx - tw * 0.95, y0 - th * 0.07, lx + tw * 0.95, y0], fill=(196, 64, 56))
    d.rectangle([lx - tw * 0.8, ly - th - h * 0.02, lx + tw * 0.8, ly - th], fill=(40, 44, 52))
    return grain(im, seed=3)


def city_blue(w, h):
    """ブルーアワーの街並み（横位置）"""
    im = Image.new("RGB", (w, h))
    grad(im, [(0, (22, 36, 78)), (0.55, (58, 84, 140)), (0.85, (150, 140, 170)), (1, (226, 170, 150))], 0, int(h * 0.78))
    d = ImageDraw.Draw(im)
    rnd = random.Random(12)
    ground = int(h * 0.78)
    # 奥・中・手前の3層のビル
    for layer, (col, hmin, hmax, wmin, wmax, lit) in enumerate([
        ((70, 80, 118), 0.18, 0.34, 0.04, 0.08, 0.10),
        ((44, 52, 84), 0.12, 0.40, 0.05, 0.10, 0.22),
        ((24, 28, 46), 0.06, 0.26, 0.06, 0.12, 0.30),
    ]):
        x = -rnd.random() * w * 0.05
        while x < w:
            bw = w * (wmin + rnd.random() * (wmax - wmin))
            bh = h * (hmin + rnd.random() * (hmax - hmin))
            top = ground - bh
            d.rectangle([x, top, x + bw, ground], fill=col)
            if layer and rnd.random() < 0.3:
                d.rectangle([x + bw * 0.45, top - h * 0.03, x + bw * 0.5, top], fill=col)
            ww, wh = max(3, w // 420), max(3, h // 260)
            gx, gy = ww * 3, wh * 3
            for yy in range(int(top + gy), ground - gy, gy):
                for xx in range(int(x + gx * 0.6), int(x + bw - gx * 0.6), gx):
                    if rnd.random() < lit:
                        c = (255, 214, 150) if rnd.random() < 0.8 else (200, 225, 255)
                        d.rectangle([xx, yy, xx + ww, yy + wh], fill=c)
            x += bw + w * 0.004
    # 川面の反射
    refl = im.crop((0, int(ground - h * 0.22), w, ground)).transpose(Image.FLIP_TOP_BOTTOM)
    refl = refl.resize((w, h - ground)).filter(ImageFilter.GaussianBlur(w // 300))
    dark = Image.new("RGB", refl.size, (14, 18, 34))
    im.paste(Image.blend(refl, dark, 0.5), (0, ground))
    d = ImageDraw.Draw(im)
    for _ in range(500):
        y = ground + int(rnd.random() * (h - ground))
        x = rnd.random() * w
        l = w * (0.002 + rnd.random() * 0.012)
        d.line([(x - l, y), (x + l, y)], fill=(255, 205, 140) if rnd.random() < 0.3 else (60, 76, 120), width=max(1, h // 1000))
    return grain(im, seed=4)


def save(im, name, exif):
    zeroth = {piexif.ImageIFD.Make: exif["make"], piexif.ImageIFD.Model: exif["model"]}
    ex = {
        piexif.ExifIFD.LensModel: exif["lens"],
        piexif.ExifIFD.FNumber: rat(exif["f"]),
        piexif.ExifIFD.ExposureTime: rat(exif["t"]),
        piexif.ExifIFD.ISOSpeedRatings: exif["iso"],
        piexif.ExifIFD.FocalLength: rat(exif["focal"]),
        piexif.ExifIFD.FocalLengthIn35mmFilm: exif["f35"],
        piexif.ExifIFD.DateTimeOriginal: exif["dt"],
    }
    data = piexif.dump({"0th": zeroth, "Exif": ex})
    path = os.path.join(OUT, name)
    im.save(path, "JPEG", quality=92, exif=data)
    print(path, im.size)


save(dusk_mountains(3000, 2000), "dusk.jpg", dict(
    make=b"FUJIFILM", model=b"X-T5", lens=b"XF23mmF1.4 R LM WR", f=2.8, t=1 / 500, iso=160,
    focal=23, f35=35, dt=b"2026:05:03 18:42:11"))
save(sea_portrait(2400, 3000), "sea.jpg", dict(
    make=b"Apple", model=b"iPhone 16 Pro", lens=b"iPhone 16 Pro back camera 6.765mm f/1.78", f=1.78, t=1 / 1600,
    iso=64, focal=6.765, f35=24, dt=b"2026:07:21 08:15:40"))
save(city_blue(3000, 2000), "city.jpg", dict(
    make=b"SONY", model=b"ILCE-7M4", lens=b"FE 35mm F1.8", f=1.8, t=1 / 60, iso=1600,
    focal=35, f35=35, dt=b"2026:08:14 20:03:27"))
