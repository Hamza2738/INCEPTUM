"""Image preparation and quality control for the plant scanner (course section 5.3 and 5.5).

* GPS and other EXIF data are removed by re-encoding the pixels only.
* Blurry, dark or plant-free photos are refused before any model call.
"""
import io

import numpy as np
from PIL import Image, ImageOps

MIN_SHARPNESS = 40.0     # ASSUMPTION: variance of the Laplacian on a 320 px grayscale image
MIN_BRIGHTNESS, MAX_BRIGHTNESS = 45.0, 235.0
MIN_VEGETATION = 0.03    # ASSUMPTION: share of green or yellow-green pixels


def prepare(image_bytes, max_side=1280):
    """Returns (jpeg_bytes_without_exif, quality dict)."""
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((max_side, max_side))
    clean = Image.fromarray(np.asarray(img))   # pixels only: no EXIF, no GPS
    buf = io.BytesIO()
    clean.save(buf, format="JPEG", quality=88)
    small = ImageOps.contain(clean, (320, 320))
    arr = np.asarray(small, dtype=float)
    gray = arr.mean(axis=2)
    lap = (-4 * gray[1:-1, 1:-1] + gray[:-2, 1:-1] + gray[2:, 1:-1] + gray[1:-1, :-2] + gray[1:-1, 2:])
    sharp = float(lap.var())
    bright = float(gray.mean())
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    veg = float(((g > r * 1.02) & (g > b * 1.05) & (g > 40)).mean())
    reasons = []
    if sharp < MIN_SHARPNESS:
        reasons.append("blurry")
    if bright < MIN_BRIGHTNESS:
        reasons.append("too_dark")
    if bright > MAX_BRIGHTNESS:
        reasons.append("too_bright")
    if veg < MIN_VEGETATION:
        reasons.append("no_plant")
    return buf.getvalue(), {"sharpness": round(sharp, 1), "brightness": round(bright, 1), "vegetation": round(veg, 3), "ok": not reasons, "reasons": reasons}


