import easyocr
import json
from PIL import Image
import numpy as np

reader = easyocr.Reader(["en"], gpu=False, verbose=False)
crops = [
    "focus_start.jpg",
    "focus_contact_book.jpg",
    "focus_attend_submit.jpg",
    "focus_review_auto.jpg",
    "focus_quote_outcome.jpg",
    "focus_end_invoice.jpg",
    "focus_bottom_followup.jpg",
    "focus_top_attend.jpg",
    "focus_top_review.jpg",
    "zoom_fail_path.jpg",
    "zoom_alloc_start.jpg",
    "zoom_awaiting_sub.jpg",
]
base = r"c:\repos\claims-manager\docs\Crunchwork\Guides\_assess_crops"
all_out = {}
for name in crops:
    img = Image.open(f"{base}\\{name}").convert("RGB")
    if img.width > 3000:
        img = img.resize((img.width // 2, img.height // 2), Image.Resampling.LANCZOS)
    arr = np.array(img)
    results = reader.readtext(
        arr, detail=1, paragraph=True, width_ths=0.7, height_ths=0.7
    )
    texts = []
    for bbox, text, conf in results:
        if conf >= 0.2:
            texts.append(
                {
                    "text": text.strip(),
                    "conf": float(conf),
                    "y": float(bbox[0][1]),
                    "x": float(bbox[0][0]),
                }
            )
    texts.sort(key=lambda i: (round(i["y"] / 20), i["x"]))
    all_out[name] = texts
    print("====", name)
    for t in texts:
        line = "  %.2f | %s" % (t["conf"], t["text"])
        print(line)

with open(base + "\\ocr_focus.json", "w", encoding="utf-8") as f:
    json.dump(all_out, f, indent=2)
