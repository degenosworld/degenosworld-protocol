import re, sys, glob, numpy as np
from PIL import Image
toks = re.findall(r'--[a-z0-9-]+:\s*#([0-9a-fA-F]{6})', open('src/tokens.css').read())
files = glob.glob('brand/*') + glob.glob('reference/*')
found = set()
for f in files:
    a = np.asarray(Image.open(f).convert('RGB')).reshape(-1, 3)
    packed = (a[:, 0].astype(np.uint32) << 16) | (a[:, 1].astype(np.uint32) << 8) | a[:, 2]
    u = set(np.unique(packed).tolist())
    for t in toks:
        if int(t, 16) in u: found.add(t.lower())
missing = [t for t in toks if t.lower() not in found]
print('tokens', len(toks), 'sampled', len(found), 'missing', missing)
sys.exit(1 if missing else 0)
