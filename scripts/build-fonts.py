#!/usr/bin/env python3
"""同梱フォントを作る。

方針:
- 出来上がった woff2 とライセンス本文は **リポジトリにコミットする**。
  通常のビルド（CI・Cloudflare）は Python も fonttools も必要としない。
- このスクリプトは書体を足す・変えるときだけ手元で走らせる。
- 実測で判明した罠を、ここで機械的に潰す:
  * 可変フォントのままサブセットすると全ウェイトのデータが残り 2.3 倍になる
    （和文 463KB → 1,043KB）。必ず wght を固定してからサブセットする。
  * 「山﨑」「髙橋」の 﨑・髙 は JIS X 0208 の外にあり、明示的に足さないと欠落する。

必要なもの: python3 -m pip install fonttools brotli
"""
import hashlib
import json
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "fonts")
LIC = os.path.join(ROOT, "public", "licenses")
WORK = os.path.join(ROOT, ".fontwork")

GF = "https://raw.githubusercontent.com/google/fonts/main"

# 参考アプリの書体 → OFL の代替。実測サイズは docs/poc/report-fonts.md
# variable=True の書体は wght 軸を持ち、400 と 700 が同一ファイルで賄える。
LATIN = [
    # key            family            gf_dir            files(static時)          variable
    ("helvetica",    "Arimo",          "ofl/arimo",      ["Arimo[wght].ttf"],           True),
    ("futura",       "Jost",           "ofl/jost",       ["Jost[wght].ttf"],            True),
    ("din",          "Oswald",         "ofl/oswald",     ["Oswald[wght].ttf"],          True),
    ("copperplate",  "Cinzel",         "ofl/cinzel",     ["Cinzel[wght].ttf"],          True),
    ("didot",        "PlayfairDisplay","ofl/playfairdisplay", ["PlayfairDisplay[wght].ttf"], True),
    ("baskerville",  "LibreBaskerville","ofl/librebaskerville", ["LibreBaskerville[wght].ttf"], True),
    ("georgia",      "PTSerif",        "ofl/ptserif",    ["PT_Serif-Web-Regular.ttf", "PT_Serif-Web-Bold.ttf"], False),
    ("times",        "Tinos",          "ofl/tinos",      ["Tinos-Regular.ttf", "Tinos-Bold.ttf"], False),
]

# Tinos だけ google/fonts に OFL.txt が無い（404 を実測）。本家リポジトリから取る。
LICENSE_OVERRIDE = {
    "Tinos": "https://raw.githubusercontent.com/googlefonts/tinos/main/OFL.txt",
}

JP_FAMILY = "NotoSansJP"
JP_URL = f"{GF}/ofl/notosansjp/NotoSansJP[wght].ttf"
JP_LICENSE = f"{GF}/ofl/notosansjp/OFL.txt"

# ラテン: 西欧 + 約物 + 通貨記号
LATIN_UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0100-017F,U+0192,U+01FA-01FF,"
    "U+2000-206F,U+2070,U+2074-2079,U+20AC,U+2122,U+2190-2193,U+2212,U+25CA"
)


def sha256(path):
    """成果物の指紋。ビルドが再現するようにしてあるので、この値は入力が同じなら毎回同じ。
    検査スクリプト（Node）はこれを照合して、Python 無しで改変を検知できる。"""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def sh(*args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"失敗: {' '.join(args)}\n{r.stderr}")
    return r.stdout


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=120) as r, open(dest, "wb") as f:
            f.write(r.read())
    except Exception as e:
        sys.exit(f"取得できません: {url}\n{e}")
    return dest


def jis_chars(ku_lo, ku_hi):
    """JIS X 0208 の区点から文字を起こす。外部データに依存せず再現できる。"""
    out = []
    for ku in range(ku_lo, ku_hi + 1):
        for ten in range(1, 95):
            b = bytes([0x1B, 0x24, 0x42, 0x20 + ku, 0x20 + ten, 0x1B, 0x28, 0x42])
            try:
                ch = b.decode("iso2022_jp")
            except Exception:
                continue
            if ch:
                out.append(ch)
    return out


# JIS X 0208 の外にあるが、人名・地名で頻出する字。足さないと「山﨑」「髙橋」が化ける。
NAME_VARIANTS = "﨑髙德濵桒栁淺遞邊邉齋齊靑鄕祐祥凜凛麴麹曻昱彅栃埼茨潟塚﨟﨤﨧"
EXTRA_MARKS = "　、。・ー〜…‥「」『』（）〔〕【】〆〇々〃①②③④⑤⑥⑦⑧⑨⑩％＃＆＊＠°′″℃¥$€£©®™"


def jp_charset():
    chars = (
        [chr(c) for c in range(0x20, 0x7F)]
        + jis_chars(1, 2)    # 記号
        + jis_chars(3, 3)    # 全角英数
        + jis_chars(4, 5)    # ひらがな・カタカナ
        + jis_chars(16, 47)  # 第一水準漢字
        + list(NAME_VARIANTS)
        + list(EXTRA_MARKS)
    )
    return "".join(dict.fromkeys(chars))


def instance_wght(src, wght, dest):
    """可変軸を固定して静的フォントにする。これを飛ばすと 2.3 倍のサイズになる。

    --no-recalc-timestamp を外すと、フォント内の head.modified が現在時刻で
    書き換わり、同じ入力から毎回違うバイト列が出る。成果物をコミットしている以上、
    ビルドが再現しないと「この woff2 は本当にこのスクリプトから出たのか」を
    確かめられなくなる。（subset 側は既定で書き換えない）
    """
    sh(sys.executable, "-m", "fontTools.varLib.instancer", "--no-recalc-timestamp",
       src, f"wght={wght}", "-o", dest)
    return dest


def subset(src, dest, *, unicodes=None, text_file=None):
    args = [sys.executable, "-m", "fontTools.subset", src,
            "--flavor=woff2", "--layout-features=kern,liga,clig,calt",
            "--no-hinting", "--desubroutinize", f"--output-file={dest}"]
    if unicodes:
        args.append(f"--unicodes={unicodes}")
    if text_file:
        args.append(f"--text-file={text_file}")
    sh(*args)
    return dest


def write_coverage(path, family, cmap):
    """収録コードポイントを昇順の [start, end] 区間列にして書き出す。"""
    cps = sorted(cmap.keys())
    ranges = []
    start = prev = cps[0]
    for cp in cps[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        ranges.append([start, prev])
        start = prev = cp
    ranges.append([start, prev])
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"family": family, "count": len(cps), "ranges": ranges},
                  f, separators=(",", ":"))
    return ranges


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(LIC, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    manifest = {"latin": {}, "jp": {}}

    for key, family, gfdir, files, variable in LATIN:
        lic_url = LICENSE_OVERRIDE.get(family, f"{GF}/{gfdir}/OFL.txt")
        fetch(lic_url, os.path.join(LIC, f"{family}-OFL.txt"))

        if variable:
            src = fetch(f"{GF}/{gfdir}/{files[0]}", os.path.join(WORK, f"{family}-var.ttf"))
            # 可変のままサブセットすると全ウェイトが残る。400/700 を別ファイルに固定する。
            entry = {}
            for wght, style in ((400, "regular"), (700, "bold")):
                st = instance_wght(src, wght, os.path.join(WORK, f"{family}-{wght}.ttf"))
                out = os.path.join(OUT, f"{family}-{style}.woff2")
                subset(st, out, unicodes=LATIN_UNICODES)
                entry[style] = {"file": f"fonts/{family}-{style}.woff2",
                                "bytes": os.path.getsize(out), "sha256": sha256(out)}
            manifest["latin"][key] = {"family": family, "variable": True, **entry}
        else:
            entry = {}
            for fn, style in zip(files, ("regular", "bold")):
                src = fetch(f"{GF}/{gfdir}/{fn}", os.path.join(WORK, fn))
                out = os.path.join(OUT, f"{family}-{style}.woff2")
                subset(src, out, unicodes=LATIN_UNICODES)
                entry[style] = {"file": f"fonts/{family}-{style}.woff2",
                                "bytes": os.path.getsize(out), "sha256": sha256(out)}
            manifest["latin"][key] = {"family": family, "variable": False, **entry}
        print(f"  {family:18s} regular {manifest['latin'][key]['regular']['bytes']:>7,} B"
              f"  bold {manifest['latin'][key]['bold']['bytes']:>7,} B")

    # 和文。Regular のみ同梱する（Bold は入れない。docs/design.md の裁定）
    fetch(JP_LICENSE, os.path.join(LIC, f"{JP_FAMILY}-OFL.txt"))
    jp_src = fetch(JP_URL, os.path.join(WORK, "NotoSansJP-var.ttf"))
    charset = jp_charset()
    txt = os.path.join(WORK, "jp-charset.txt")
    with open(txt, "w", encoding="utf-8") as f:
        f.write(charset)
    jp400 = instance_wght(jp_src, 400, os.path.join(WORK, "NotoSansJP-400.ttf"))
    jp_out = os.path.join(OUT, f"{JP_FAMILY}-regular.woff2")
    subset(jp400, jp_out, text_file=txt)
    manifest["jp"] = {
        "family": JP_FAMILY,
        "regular": {"file": f"fonts/{JP_FAMILY}-regular.woff2",
                    "bytes": os.path.getsize(jp_out), "sha256": sha256(jp_out)},
        "charCount": len(charset),
    }
    print(f"  {JP_FAMILY:18s} regular {manifest['jp']['regular']['bytes']:>7,} B"
          f"  ({len(charset):,} 文字)")

    # 収録の検証。足したはずの異体字が本当に入っているかを確かめる。
    from fontTools.ttLib import TTFont
    cmap = TTFont(jp_out).getBestCmap()
    missing = [c for c in NAME_VARIANTS if ord(c) not in cmap]
    if missing:
        sys.exit(f"異体字が収録されていません: {''.join(missing)}")
    manifest["jp"]["glyphs"] = len(cmap)

    # 実行時のカバレッジ照合用の表。
    # 同梱外の文字が入ると fillText は例外を投げずに豆腐（□）を描き、そのまま保存される。
    # 事前に照合して止めるため、収録コードポイントを区間列で書き出す
    # （3,476 字を裸の配列で持つと約 25KB。区間列なら数 KB に収まる）。
    coverage_path = os.path.join(OUT, "coverage-jp.json")
    write_coverage(coverage_path, JP_FAMILY, cmap)
    manifest["jp"]["coverage"] = {
        "file": "fonts/coverage-jp.json",
        "bytes": os.path.getsize(coverage_path),
        "sha256": sha256(coverage_path),
    }

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    total = sum(v[s]["bytes"] for v in manifest["latin"].values() for s in ("regular", "bold"))
    print(f"\n欧文 8 書体 合計: {total:,} B ({total/1024:.1f} KB)")
    print(f"和文 Regular   : {manifest['jp']['regular']['bytes']:,} B "
          f"({manifest['jp']['regular']['bytes']/1024:.1f} KB)")


if __name__ == "__main__":
    main()
