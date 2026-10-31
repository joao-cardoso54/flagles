"""Desenhos de bandeiras (quadrados) para a etiqueta do disco no ícone. Usado por make-icons.py e icon-options.py."""
from PIL import Image, ImageDraw
import math

RED, WHITE, BLUE = (210, 58, 42), (245, 240, 230), (31, 79, 216)

def _canvas(s, bg):
    im = Image.new("RGBA", (s, s), bg)
    return im, ImageDraw.Draw(im)

def stripes(s):  # a atual (parece Paraguai/Países Baixos)
    im, d = _canvas(s, WHITE)
    d.rectangle([0, 0, s, s / 3], fill=RED); d.rectangle([0, 2 * s / 3, s, s], fill=BLUE)
    return im

def uk(s):
    im, d = _canvas(s, (1, 33, 105))
    d.line([0, 0, s, s], fill=WHITE, width=int(s * 0.22)); d.line([0, s, s, 0], fill=WHITE, width=int(s * 0.22))
    d.line([0, 0, s, s], fill=(200, 16, 46), width=int(s * 0.08)); d.line([0, s, s, 0], fill=(200, 16, 46), width=int(s * 0.08))
    d.rectangle([s * 0.5 - s * 0.17, 0, s * 0.5 + s * 0.17, s], fill=WHITE); d.rectangle([0, s * 0.5 - s * 0.17, s, s * 0.5 + s * 0.17], fill=WHITE)
    d.rectangle([s * 0.5 - s * 0.1, 0, s * 0.5 + s * 0.1, s], fill=(200, 16, 46)); d.rectangle([0, s * 0.5 - s * 0.1, s, s * 0.5 + s * 0.1], fill=(200, 16, 46))
    return im

def us(s):
    im, d = _canvas(s, WHITE)
    h = s / 7
    for i in range(0, 7, 2):
        d.rectangle([0, i * h, s, (i + 1) * h], fill=(178, 34, 52))
    d.rectangle([0, 0, s * 0.5, h * 4], fill=(60, 59, 110))
    for r in range(3):
        for c in range(3):
            x, y = s * (0.1 + 0.15 * c), h * (0.8 + 1.2 * r)
            d.ellipse([x - s * 0.02, y - s * 0.02, x + s * 0.02, y + s * 0.02], fill=WHITE)
    return im

def portugal(s):
    im, d = _canvas(s, (218, 41, 28))
    d.rectangle([0, 0, s * 0.4, s], fill=(0, 102, 0))
    r = s * 0.13
    d.ellipse([s * 0.4 - r, s / 2 - r, s * 0.4 + r, s / 2 + r], fill=(255, 205, 0))
    d.ellipse([s * 0.4 - r * 0.55, s / 2 - r * 0.55, s * 0.4 + r * 0.55, s / 2 + r * 0.55], fill=WHITE)
    return im

def japan(s):
    im, d = _canvas(s, WHITE)
    r = s * 0.3
    d.ellipse([s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r], fill=(188, 0, 45))
    return im

def brazil(s):
    im, d = _canvas(s, (0, 156, 59))
    d.polygon([(s / 2, s * 0.12), (s * 0.9, s / 2), (s / 2, s * 0.88), (s * 0.1, s / 2)], fill=(255, 223, 0))
    r = s * 0.22
    d.ellipse([s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r], fill=(0, 39, 118))
    return im

def sweden(s):
    im, d = _canvas(s, (0, 106, 167))
    d.rectangle([s * 0.3, 0, s * 0.45, s], fill=(254, 204, 0)); d.rectangle([0, s * 0.42, s, s * 0.58], fill=(254, 204, 0))
    return im

def world(s):  # fatias de cores de várias bandeiras
    im, d = _canvas(s, WHITE)
    cols = [RED, WHITE, BLUE, (0, 156, 59), (254, 204, 0), (28, 27, 23)]
    for i, c in enumerate(cols):
        d.pieslice([-s * 0.1, -s * 0.1, s * 1.1, s * 1.1], start=i * 60 - 90, end=(i + 1) * 60 - 90, fill=c)
    return im

OPTIONS = {"A Reino Unido": uk, "B EUA": us, "C Portugal": portugal, "D Japao": japan, "E Brasil": brazil, "F Suecia": sweden, "G Mistura": world, "(atual)": stripes}
