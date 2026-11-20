#!/usr/bin/env python3
"""A large phone-style photo carrying EXIF (orientation + a marker string) to prove the browser strips metadata and downsizes."""
import os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = Image.new('RGB', (3200, 2100), (236, 244, 238)); d = ImageDraw.Draw(im)
d.rectangle([40, 40, 3160, 2060], outline=(60, 80, 130), width=12)
d.text((120, 120), 'SPECIMEN: NOT A REAL DOCUMENT', fill=(170, 40, 40))
exif = Image.Exif(); exif[0x010E] = 'SECRET-EXIF-MARKER location 23.8103N 90.4125E'; exif[0x0112] = 1
im.save(os.path.join(ROOT, 'testdata', 'e2e', 'big-exif.jpg'), 'JPEG', quality=88, exif=exif)
print('ok')
