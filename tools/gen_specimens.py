#!/usr/bin/env python3
"""Render clearly-marked SPECIMEN document photos from testdata/cases.json, with realistic photo problems.
Not replicas of real documents. Deterministic (seeded). Needs: pip install pillow fonttools brotli."""
import json, os, random, re, shutil, sys, tempfile
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'testdata', 'specimens')
FONTDIR = tempfile.mkdtemp()

def font(script, weight, size):
    key = f'hind-siliguri-{script}-{weight}-normal'
    ttf = os.path.join(FONTDIR, key + '.ttf')
    if not os.path.exists(ttf):
        f = TTFont(os.path.join(ROOT, 'public', 'fonts', key + '.woff2')); f.flavor = None; f.save(ttf)
    return ImageFont.truetype(ttf, size, layout_engine=ImageFont.Layout.RAQM)

BN = re.compile(r'([\u0980-\u09FF\u200c\u200d]+)')
def draw_mixed(d, xy, text, size, weight=400, fill=(20, 30, 60)):
    x, y = xy
    for run in BN.split(text):
        if not run: continue
        f = font('bengali' if BN.match(run) else 'latin', weight, size)
        d.text((x, y), run, font=f, fill=fill); x += f.getlength(run)

LAYOUT = {
    'nid': ('NATIONAL ID CARD', [('name', 'Name'), ('father_name', "Father's Name"), ('mother_name', "Mother's Name"), ('dob', 'Date of Birth'), ('nid_number', 'ID No.')], (236, 244, 238)),
    'old_passport': ('PASSPORT  DATA PAGE', [('name', 'Name'), ('dob', 'Date of Birth'), ('passport_number', 'Passport No.'), ('expiry_date', 'Date of Expiry')], (238, 240, 248)),
}

def render(doc_id, fields):
    title, rows, bg = LAYOUT[doc_id]
    im = Image.new('RGB', (1000, 640), bg); d = ImageDraw.Draw(im)
    d.rectangle([14, 14, 985, 625], outline=(60, 80, 130), width=4)
    d.text((44, 38), title, font=font('latin', 600, 38), fill=(30, 50, 110))
    d.text((44, 92), 'SPECIMEN: NOT A REAL DOCUMENT', font=font('latin', 600, 24), fill=(170, 40, 40))
    y = 160
    for key, label in rows:
        d.text((44, y + 8), label, font=font('latin', 400, 26), fill=(90, 100, 130))
        val = (fields.get(key) or {}).get('value')
        if val: draw_mixed(d, (330, y), val, 40, 600)
        y += 84
    wm = Image.new('RGBA', im.size, (0, 0, 0, 0)); wd = ImageDraw.Draw(wm)
    wd.text((200, 330), 'SPECIMEN', font=font('latin', 600, 150), fill=(180, 30, 30, 26))
    return Image.alpha_composite(im.convert('RGBA'), wm.rotate(18, resample=Image.BICUBIC)).convert('RGB')

def degrade(im, profile, rng):
    if profile == 'clean': return im, 90
    if profile == 'blur': return im.filter(ImageFilter.GaussianBlur(2.2)), 85
    if profile == 'heavy_blur': return im.filter(ImageFilter.GaussianBlur(6)), 85
    if profile == 'lowlight':
        im = ImageEnhance.Brightness(im).enhance(0.33)
        noise = Image.effect_noise(im.size, 28).convert('RGB')
        return Image.blend(im, noise, 0.22), 80
    if profile == 'glare':
        g = Image.radial_gradient('L').resize((520, 520)).point(lambda v: 255 - v)
        layer = Image.new('RGB', im.size, 'white'); mask = Image.new('L', im.size, 0); mask.paste(g, (440, 150))
        return Image.composite(layer, im, mask.point(lambda v: int(v * 0.97))), 88
    if profile == 'tilt':
        return im.rotate(7, expand=True, fillcolor=(90, 90, 90), resample=Image.BICUBIC), 85
    if profile == 'cropped': return im.crop((0, 0, 700, 640)), 88
    if profile == 'jpeg_low': return im.resize((500, 320)).resize((1000, 640)), 14
    raise ValueError(profile)

PROFILES_FOR_CLEAN = ['blur', 'heavy_blur', 'lowlight', 'glare', 'tilt', 'cropped', 'jpeg_low']
EXTRA = {'dob_year_mismatch': ['blur', 'tilt'], 'name_honorific_missing': ['glare', 'lowlight']}

def main():
    cases = json.load(open(os.path.join(ROOT, 'testdata', 'cases.json')))
    shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
    manifest = []
    plan = [(c, 'clean') for c in cases]
    plan += [(c, p) for c in cases if c['name'] == 'clean_english' for p in PROFILES_FOR_CLEAN]
    plan += [(c, p) for c in cases for p in EXTRA.get(c['name'], [])]
    for c, profile in plan:
        sid = f"{c['name']}__{profile}"; os.makedirs(os.path.join(OUT, sid))
        rng = random.Random(sid); images = {}
        for doc_id, fields in c['docs'].items():
            if fields is None: continue
            im, q = degrade(render(doc_id, fields), profile, rng)
            rel = f'{sid}/{doc_id}.jpg'; im.save(os.path.join(OUT, rel), 'JPEG', quality=q); images[doc_id] = rel
        manifest.append({'id': sid, 'case': c['name'], 'profile': profile, 'images': images, 'truth': c['docs'], 'expect': c['expect'], 'verdict': c['verdict']})
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'{len(manifest)} specimen sets, {sum(len(m["images"]) for m in manifest)} images -> {OUT}')

if __name__ == '__main__': main()
