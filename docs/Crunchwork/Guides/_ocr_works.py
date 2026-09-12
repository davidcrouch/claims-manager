import easyocr
from PIL import Image
import numpy as np
import re
import json

path = r"c:\repos\claims-manager\docs\Crunchwork\Guides\Builder Works Flow - Vendor.jpg"
out_path = r"c:\repos\claims-manager\docs\Crunchwork\Guides\_works_ocr.json"
reader = easyocr.Reader(["en"], gpu=False, verbose=False)
img = Image.open(path)
w, h = img.size
all_items = []
for y0 in range(0, h, 400):
    y1 = min(h, y0 + 500)
    strip = img.crop((0, y0, w, y1))
    strip = strip.resize((strip.width * 2, strip.height * 2), Image.Resampling.LANCZOS)
    arr = np.array(strip)
    results = reader.readtext(
        arr, detail=1, paragraph=False, width_ths=0.4, height_ths=0.4
    )
    for bbox, text, conf in results:
        oy = y0 + bbox[0][1] / 2
        ox = bbox[0][0] / 2
        all_items.append(
            {"x": float(ox), "y": float(oy), "text": text.strip(), "conf": float(conf)}
        )

all_items.sort(key=lambda i: (round(i["y"] / 20), i["x"]))
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(all_items, f, indent=2)

print("=== TASK CREATED / CREATE / CLOSE / EVERY ===")
for i in all_items:
    t = i["text"]
    if re.search(r"(?i)creat|close all|repair update|every \d|task created|task creat", t):
        print(f"y={int(i['y']):4d} x={int(i['x']):4d} conf={i['conf']:.2f} | {t}")

print("\n=== ALL TEXT (for context) ===")
for i in all_items:
    if i["conf"] >= 0.3:
        print(f"y={int(i['y']):4d} x={int(i['x']):4d} conf={i['conf']:.2f} | {i['text']}")
