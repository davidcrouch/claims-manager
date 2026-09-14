import easyocr
import json
from PIL import Image
import numpy as np

reader = easyocr.Reader(["en"], gpu=False, verbose=False)
path = r"c:\repos\claims-manager\docs\Crunchwork\Guides\Builder Assessment Flow - Vendor.png"
img = Image.open(path).convert("RGB")
w, h = img.size
all_items = []
for y0 in range(0, h, 350):
    y1 = min(h, y0 + 450)
    strip = img.crop((0, y0, w, y1))
    strip = strip.resize((strip.width * 2, strip.height * 2), Image.Resampling.LANCZOS)
    arr = np.array(strip)
    for bbox, text, conf in reader.readtext(
        arr, detail=1, paragraph=False, width_ths=0.4, height_ths=0.4
    ):
        oy = y0 + bbox[0][1] / 2
        ox = bbox[0][0] / 2
        all_items.append(
            {
                "x": float(ox),
                "y": float(oy),
                "text": text.strip(),
                "conf": float(conf),
            }
        )

all_items.sort(key=lambda i: (round(i["y"] / 15), i["x"]))
out = r"c:\repos\claims-manager\docs\Crunchwork\Guides\_assess_crops\ocr.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(all_items, f, indent=2)
print(f"{len(all_items)} items")
for i in all_items:
    if i["conf"] >= 0.25:
        print(f"y={int(i['y']):4d} x={int(i['x']):4d} | {i['text']}")
