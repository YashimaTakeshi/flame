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
webp("hero.jpg", "hero", (640, 1280, 1920))
webp("after.jpg", "after", (560, 1120, 1600))
save(Image.open(os.path.join(WORK, "real-tree.jpg")), "before", (560, 1120))
FRAMED = ("hero", "after", "v-white", "v-black", "v-tall", "v-bleed", "v-sakura", "v-wide", "r-45", "r-916", "r-11", "r-169",
          "t-bleed", "t-black", "t-ivory", "tr-black", "tr-white", "s-ivory", "s-bleed", "b-silver")
for n in FRAMED[2:]:
    webp(f"{n}.jpg", n, (480, 960, 1600))
# 縁取りする前の写真（スクロールで額に収まっていく動きに使う）
for n in ("torii", "tree", "beach", "stars"):
    im = Image.open(os.path.join(WORK, f"real-{n}.jpg"))
    save(im, f"raw-{n}", (960, min(1920, max(im.size) if im.width >= im.height else im.width)))
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


def photo_box(src, aspect=None, raw_path=None):
    """書き出した作例の中で、写真が占める矩形と、文字が占める矩形（0〜1 の比率）"""
    im = Image.open(os.path.join(WORK, src)).convert("L")
    w, h = im.size
    small = im.resize((w // 4, h // 4))
    sw, sh = small.size
    px = small.load()
    bg = px[1, sh - 2]
    # 地色は一様（JPEG の揺れは数階調）。暗い写真が黒い地色に溶けないよう、閾値は低く、行の2%以上で判定する
    diff = lambda x, y: abs(px[x, y] - bg) > 10
    rows = [sum(diff(x, y) for x in range(sw)) > sw * 0.02 for y in range(sh)]
    runs, y = [], 0
    while y < sh:
        if rows[y]:
            y0 = y
            while y < sh and rows[y]:
                y += 1
            runs.append((y0, y - 1))
        y += 1
    top, bottom = max(runs, key=lambda r: r[1] - r[0])
    cols = [x for x in range(sw) if sum(diff(x, yy) for yy in range(top, bottom + 1)) > (bottom - top) * 0.02]
    left, right = cols[0], cols[-1]
    # 写真の端が地色に溶けている（黒い地色に暗い地面など）ときは、元の写真の縦横比から高さを決め、
    # 地色と見分けやすい側の辺を基準にする
    if aspect:
        want = (right - left + 1) / aspect
        if abs((bottom - top + 1) - want) > 2:
            raw = Image.open(raw_path).convert("L")
            rw, rh = raw.size
            band = max(1, rh // 30)
            mean = lambda y0: raw.crop((0, y0, rw, y0 + band)).resize((1, 1), Image.BOX).getpixel((0, 0)) 
            top_gap = abs(mean(0) - bg)
            bottom_gap = abs(mean(rh - band) - bg)
            if top_gap >= bottom_gap:
                bottom = round(top + want - 1)
            else:
                top = round(bottom - want + 1)
    cap = [r for r in runs if r[0] > bottom]
    box = lambda l, t, r, b: [round(l / sw, 4), round(t / sh, 4), round((r - l + 1) / sw, 4), round((b - t + 1) / sh, 4)]
    out = {"size": [w, h], "photo": box(left, top, right, bottom)}
    if cap:
        ccols = [x for x in range(sw) if any(diff(x, yy) for yy in range(cap[0][0], cap[-1][1] + 1))]
        out["caption"] = box(ccols[0], cap[0][0], ccols[-1], cap[-1][1])
    return out


# 額の中の写真の位置。余白なし（bleed）の作例は写真が全面
RAW = {"hero": "torii", "after": "tree", "t": "torii", "tr": "tree", "s": "stars", "b": "beach", "v": "beach", "r": "stars"}
frames = {}
for n in FRAMED:
    if "bleed" in n:
        frames[n] = {"size": list(Image.open(os.path.join(WORK, f"{n}.jpg")).size), "photo": [0, 0, 1, 1]}
        continue
    raw_path = os.path.join(WORK, f"real-{RAW.get(n) or RAW[n.split('-')[0]]}.jpg")
    rw, rh = Image.open(raw_path).size
    frames[n] = photo_box(f"{n}.jpg", rw / rh, raw_path)
with open(os.path.join(OUT, "frames.json"), "w") as fp:
    json.dump(frames, fp, indent=1)
# 検算: 額の中の写真の縦横比が、元の写真と合っているか
for n, f in frames.items():
    src = RAW.get(n) or RAW[n.split("-")[0]]
    rw, rh = Image.open(os.path.join(WORK, f"real-{src}.jpg")).size
    W, H = f["size"]
    a = (f["photo"][2] * W) / (f["photo"][3] * H)
    if "bleed" not in n and abs(a / (rw / rh) - 1) > 0.02:
        raise SystemExit(f"{n}: 写真の縦横比が合わない {a:.3f} ≠ {rw / rh:.3f}")
print("写真の位置: 縦横比の検算に通りました", len(frames))
