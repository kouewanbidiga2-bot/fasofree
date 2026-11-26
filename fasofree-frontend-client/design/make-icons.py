"""Produit les fichiers logo + icones PWA a partir du chariot recolore (forme inchangee)."""
import base64
import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
import build_logo as bl  # noqa: E402

PUB = Path("public")
SRC_ART = Path("design/source")

PAPER = (0xF0, 0xF2, 0xED)


def art(mode="mixte", size=1024):
    return bl.build(mode, size=size)


def square(img, size, ratio):
    """Place l'art centre sur un carre transparent, largeur = ratio * size."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    w = round(size * ratio)
    h = round(img.height * w / img.width)
    resized = img.resize((w, h), Image.LANCZOS)
    canvas.paste(resized, ((size - w) // 2, (size - h) // 2), resized)
    return canvas


def rounded_icon(img, size, ratio, radius_ratio=0.22):
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=round(size * radius_ratio), fill=PAPER)
    art_s = square(img, size, ratio)
    base.paste(art_s, (0, 0), art_s)
    return base


def full_icon(img, size, ratio):
    base = Image.new("RGBA", (size, size), PAPER)
    art_s = square(img, size, ratio)
    base.paste(art_s, (0, 0), art_s)
    return base


def bare_icon(img, size, ratio):
    """Logo seul, fond transparent."""
    return square(img, size, ratio)


def svg_favicon(img, px=128):
    small = square(img, px, 0.98).resize((px, px), Image.LANCZOS)
    buf = io.BytesIO()
    small.save(buf, "PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f'<image x="0" y="0" width="64" height="64" href="data:image/png;base64,{b64}"/>'
        "</svg>\n"
    )
    (PUB / "favicon.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    mix = art("mixte", 1024)
    mix.save(SRC_ART / "koliwa-logo-master.png")

    # Logo transparent pour l'interface
    logo = square(mix, 512, 0.94)
    logo.save(PUB / "assets" / "koliwa-logo.png", optimize=True)

    # Version recadree au plus pres du colis (barre d'accueil, sans marge carree)
    import numpy as np

    alpha = np.array(mix)[..., 3]
    ys, xs = np.where(alpha > 12)
    mark = mix.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    mark.thumbnail((448, 448), Image.LANCZOS)
    mark.save(PUB / "assets" / "koliwa-mark-run.png", optimize=True)

    bare_icon(mix, 512, 0.98).save(PUB / "icon-512.png", optimize=True)
    bare_icon(mix, 192, 0.98).save(PUB / "icon-192.png", optimize=True)
    full_icon(mix, 512, 0.62).save(PUB / "icon-512-maskable.png", optimize=True)
    full_icon(mix, 180, 0.78).save(PUB / "apple-touch-icon.png", optimize=True)
    bare_icon(mix, 32, 0.98).save(PUB / "favicon-32.png", optimize=True)
    bare_icon(mix, 16, 0.98).save(PUB / "favicon-16.png", optimize=True)

    ico = [bare_icon(mix, s, 0.98) for s in (16, 32, 48)]
    ico[0].save(PUB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    svg_favicon(mix, 128)

    # Planche de controle des icones
    sizes = [180, 96, 48, 32, 16]
    pad = 24
    W = sum(s + pad * 2 for s in sizes)
    sheet = Image.new("RGB", (W, 200), (0xE7, 0xE9, 0xE3))
    x = pad
    for s in sizes:
        ic = bare_icon(mix, s, 0.98)
        sheet.paste(ic, (x, (200 - s) // 2), ic)
        x += s + pad * 2
    sheet.save(SRC_ART / "logo-icons-sheet.png")
    print("ok")
