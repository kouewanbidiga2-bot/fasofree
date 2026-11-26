"""Recolore le logo chariot fourni (forme identique) en palette Koliwa.

Deux variantes sont produites pour comparaison :
  A "fidele" : carrosserie anthracite, roues vert citron (mapping litteral vert->gris, jaune->citron)
  B "mixte"  : carrosserie citron, roues anthracite

Puis la planche de controle (fond papier + fond encre, tailles 24 a 256 px).
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage

SRC = "design/source/logo-cart-raw.webp"
OUT = "design/source"

INK = (0x24, 0x28, 0x26)
DARK = (0x3A, 0x41, 0x3C)
GRAY = (0x4A, 0x53, 0x4D)
LIGHT = (0x8F, 0x99, 0x91)
WHITE = (0xF0, 0xF2, 0xED)
LIME = (0xD7, 0xF3, 0x6B)
LIME_HI = (0xEC, 0xFF, 0xB8)
OLIVE = (0xA8, 0xBF, 0x54)
YELL_LO = (0x6F, 0x80, 0x2E)


def background_mask(img):
    a = np.array(img).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bgish = (g > 150) & ((g - np.maximum(r, b)) > 28)
    labels, _ = ndimage.label(bgish, structure=np.ones((3, 3), dtype=int))
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    edge = edge[edge != 0]
    bg = np.isin(labels, edge)
    return ndimage.binary_fill_holes(~bg)


def luminance(rgb):
    c = rgb / 255.0
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def ramp(t, stops):
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,), dtype=np.float64)
    for i in range(len(stops) - 1):
        a, ca = stops[i]
        b, cb = stops[i + 1]
        ca = np.array(ca, float)
        cb = np.array(cb, float)
        seg = (t >= a) & (t <= b) if i < len(stops) - 2 else (t >= a)
        k = np.clip((t - a) / max(b - a, 1e-6), 0, 1)[..., None]
        out = np.where(seg[..., None], ca + (cb - ca) * k, out)
    return out


def recolor(rgb, mode):
    l = luminance(rgb)
    green = rgb[..., 1] >= rgb[..., 0] - 6           # verts du chariot + fond deja retire
    yellow = (rgb[..., 0] > rgb[..., 1]) & (rgb[..., 2] < rgb[..., 1])  # jaune des roues

    # contour et traits : presque noirs
    ink = l < 0.20

    if mode == "fidele":
        body = ramp(np.clip((l - 0.14) / 0.55, 0, 1),
                    [(0.0, INK), (0.18, DARK), (0.45, GRAY), (0.78, LIGHT), (1.0, WHITE)])
        wheel = ramp(np.clip((l - 0.30) / 0.60, 0, 1),
                     [(0.0, YELL_LO), (0.35, OLIVE), (0.72, LIME), (1.0, LIME_HI)])
    else:  # mixte
        body = ramp(np.clip((l - 0.14) / 0.58, 0, 1),
                    [(0.0, YELL_LO), (0.28, OLIVE), (0.62, LIME), (1.0, LIME_HI)])
        wheel = ramp(np.clip((l - 0.22) / 0.5, 0, 1),
                     [(0.0, INK), (0.4, DARK), (0.8, GRAY), (1.0, LIGHT)])

    out = np.where(yellow[..., None], wheel, body)
    out = np.where(ink[..., None], np.array(INK, float), out)
    return np.clip(out, 0, 255)


def build(mode, size=1024):
    # Le WebP source est compresse : un median 3 lisse les speckles avant recoloration
    img = Image.open(SRC).convert("RGB").filter(ImageFilter.MedianFilter(3))
    mask = background_mask(img)
    alpha = np.array(
        Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    ).astype(float) / 255.0
    # Le WebP compresse laisse un voile d'alpha tres faible dans les coins
    alpha = np.where(alpha < 0.12, 0.0, alpha)
    rgb = np.array(img).astype(float)
    out = recolor(rgb, mode).astype(np.uint8)
    rgba = Image.fromarray(np.dstack([out, (alpha * 255).astype(np.uint8)]), "RGBA")
    solid = alpha > 0.5
    ys, xs = np.where(solid)
    rgba = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    pad = round(max(rgba.size) * 0.06)
    canvas = Image.new("RGBA", (rgba.width + pad * 2, rgba.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(rgba, (pad, pad), rgba)
    w, h = canvas.size
    s = size / max(w, h)
    return canvas.resize((round(w * s), round(h * s)), Image.LANCZOS)


def sheet(arts):
    paper, ink = (0xF0, 0xF2, 0xED), (0x24, 0x28, 0x26)
    sizes = [256, 96, 48, 32, 24]
    row_h = 300
    W = 300 + sum(s + 40 for s in sizes)
    img = Image.new("RGB", (W, row_h * len(arts) * 2), paper)
    d = ImageDraw.Draw(img)
    for i, (name, art) in enumerate(arts.items()):
        for band in range(2):
            bg = paper if band == 0 else ink
            y0 = (i * 2 + band) * row_h
            d.rectangle([0, y0, W, y0 + row_h], fill=bg)
            art.copy().resize((220, 220), Image.LANCZOS)
            big = art.copy()
            big.thumbnail((220, 220), Image.LANCZOS)
            img.paste(big, (40, y0 + (row_h - big.height) // 2), big)
            x = 300
            for s in sizes:
                small = art.copy()
                small.thumbnail((s, s), Image.LANCZOS)
                img.paste(small, (x + (s + 40 - small.width) // 2,
                                  y0 + (row_h - small.height) // 2), small)
                x += s + 40
    img.save(f"{OUT}/logo-koliwa-review.png")


if __name__ == "__main__":
    arts = {"fidele": build("fidele"), "mixte": build("mixte")}
    for name, art in arts.items():
        art.save(f"{OUT}/logo-koliwa-{name}.png")
    sheet(arts)
    print("ok", {k: v.size for k, v in arts.items()})
