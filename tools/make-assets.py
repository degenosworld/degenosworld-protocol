# One-off asset derivation. Source: brand/LOGO DEGENOS PNG...png (RGBA, 2000x2000, alpha with pure-black transparent regions).
# Resizes are done on premultiplied RGBA so transparent black never bleeds into edges.
import numpy as np
from PIL import Image
src = Image.open('brand/LOGO DEGENOS PNG...png').convert('RGBA')
a = np.asarray(src).astype(np.float64) / 255.0
pm = a.copy(); pm[..., :3] *= a[..., 3:4]
def resize(n):
    chans = [Image.fromarray(pm[..., i].astype(np.float32), mode='F').resize((n, n), Image.LANCZOS) for i in range(4)]
    o = np.stack([np.asarray(c) for c in chans], -1)
    alpha = np.clip(o[..., 3:4], 0, 1)
    rgb = np.where(alpha > 1e-6, o[..., :3] / np.maximum(alpha, 1e-6), 0)
    return np.concatenate([np.clip(rgb, 0, 1), alpha], -1)
def save(n, path):
    Image.fromarray((resize(n) * 255 + .5).astype(np.uint8), 'RGBA').save(path, optimize=True)
# crop to content box first so the mark fills the frame
ys, xs = np.where(a[..., 3] > 0.02)
print('content bbox', xs.min(), ys.min(), xs.max(), ys.max())
pad = 40
x0, x1, y0, y1 = xs.min() - pad, xs.max() + pad, ys.min() - pad, ys.max() + pad
side = max(x1 - x0, y1 - y0); cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
pm = pm[box[1]:box[3], box[0]:box[2]]
save(512, 'src/assets/mark-512.png'); save(180, 'src/assets/apple-touch-icon.png'); save(96, 'src/assets/mark-96.png')
# favicon: trace 32x32 premultiplied grid, row runs of equal snapped colour
g = resize(32)
rects = []
for y in range(32):
    x = 0
    while x < 32:
        al = g[y, x, 3]
        if al < 0.5: x += 1; continue
        col = tuple((g[y, x, :3] * 255 + .5).astype(int)); x2 = x + 1
        while x2 < 32 and g[y, x2, 3] >= 0.5 and tuple((g[y, x2, :3] * 255 + .5).astype(int)) == col: x2 += 1
        rects.append((x, y, x2 - x, '#%02x%02x%02x' % col)); x = x2
svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges">' + ''.join(f'<rect x="{x}" y="{y}" width="{w}" height="1" fill="{c}"/>' for x, y, w, c in rects) + '</svg>'
assert '--' not in svg
open('src/assets/favicon.svg', 'w').write(svg); print('favicon rects', len(rects), len(svg))
