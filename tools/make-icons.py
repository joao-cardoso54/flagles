"""Gera os ícones da app (PNG) com Pillow. Uso: python3 tools/make-icons.py"""
from PIL import Image, ImageDraw
import math, os
from flag_labels import uk

LABEL = uk  # bandeira da etiqueta: escolhida pelo utilizador (Reino Unido)

BLUE, INK, PAPER, RED = (31, 79, 216), (28, 27, 23), (245, 240, 230), (210, 58, 42)
OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
SS = 4  # supersampling

def draw(size, disc_ratio, rounded):
    n = size * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.22), fill=BLUE)
    else:
        d.rectangle([0, 0, n, n], fill=BLUE)
    c, R = n / 2, n * disc_ratio
    d.ellipse([c - R, c - R, c + R, c + R], fill=INK)
    for k in range(1, 6):                       # sulcos do vinil
        r = R * (0.40 + 0.10 * k)
        d.ellipse([c - r, c - r, c + r, c + r], outline=(52, 50, 44), width=max(1, n // 300))
    L = R * 0.40                                # etiqueta: bandeira escolhida (tools/flag_labels.py)
    side = int(2 * L)
    label = LABEL(side).convert("RGBA")
    mask = Image.new("L", (side, side), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, side - 1, side - 1], fill=255)
    img.paste(label, (int(c - L), int(c - L)), mask)
    d = ImageDraw.Draw(img)
    h = R * 0.07                                # furo central
    d.ellipse([c - h, c - h, c + h, c + h], fill=INK)
    # brilho
    arc = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arc)
    rr = R * 0.93
    ad.arc([c - rr, c - rr, c + rr, c + rr], start=205, end=250, fill=(255, 255, 255, 90), width=max(2, n // 90))
    img = Image.alpha_composite(img, arc)
    return img.resize((size, size), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
draw(192, 0.38, True).save(f"{OUT}/icon-192.png")
draw(512, 0.38, True).save(f"{OUT}/icon-512.png")
draw(512, 0.30, False).save(f"{OUT}/icon-maskable-512.png")   # zona segura: disco dentro de 80%
draw(180, 0.38, False).save(f"{OUT}/apple-touch-icon.png")
draw(64, 0.40, True).save(f"{OUT}/favicon-64.png")
print("ícones gerados em", os.path.abspath(OUT))
