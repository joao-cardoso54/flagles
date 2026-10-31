"""Transforma a imagem das quatro cabeleiras (preto sobre cinzento claro) num ícone com fundo transparente.
O resultado é só uma máscara (preto + transparência): na app é pintada com a cor do texto (CSS mask).
Uso: python3 tools/make-heads-icon.py <imagem-original.png>"""
import sys, os
from PIL import Image

src = sys.argv[1]
im = Image.open(src).convert("L")
pixels = list(im.getdata())
bg = max((v for v in set(pixels) if v > 128), key=pixels.count)  # tom do fundo: o claro mais comum (o preto são as cabeleiras)
alpha = im.point(lambda v: max(0, min(255, round((bg - v) / bg * 255))))  # preto -> opaco, fundo -> transparente
box = alpha.point(lambda v: 255 if v > 24 else 0).getbbox()                  # recorta as margens vazias
alpha = alpha.crop(box)
w, h = alpha.size
H = 132                                                                      # 44px de altura a 3x
alpha = alpha.resize((round(w * H / h), H), Image.LANCZOS)
out = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
out.putalpha(alpha)
dst = os.path.join(os.path.dirname(__file__), "..", "icons", "beatles-heads.png")
out.save(dst, optimize=True)
print("guardado:", os.path.abspath(dst), out.size, os.path.getsize(dst), "bytes")
