import io
import time

import numpy as np
from PIL import Image

from agent.tools.base import Tool, ToolResult

SCENE_SIZE = 256
CLASSES = [
    "Shadow/unclear",
    "Water",
    "Vegetation",
    "Bare land/soil",
    "Built-up/urban",
    "Cloud/snow",
]


class SceneDescriptionTool(Tool):
    name = "scene_description"
    description = "Single optical image -> land-cover readout + dominant classes (temporary RGB heuristic until VLM lands)."
    inputs = "one optical/multispectral image"

    def available(self):
        return True

    def run(self, ctx):
        t0 = time.time()
        img = Image.open(io.BytesIO(ctx["images"][0].bytes)).convert("RGB").resize((SCENE_SIZE, SCENE_SIZE), Image.BILINEAR)
        arr = np.asarray(img, dtype=np.float64) / 255.0
        r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
        mx = np.maximum(np.maximum(r, g), b)
        mn = np.minimum(np.minimum(r, g), b)
        sat = (mx - mn) / (mx + 1e-6)
        val = (r + g + b) / 3.0
        grn = g - r
        blu = b - r

        flat = val.ravel()
        lq = float(np.percentile(flat, 20))
        uq = float(np.percentile(flat, 80))
        thr_dark = max(0.04, lq * 0.7)
        thr_bright = min(0.88, max(0.5, uq * 1.05))

        ids = np.zeros(val.shape, dtype=np.uint8)
        ids[val < thr_dark] = 0
        ids[(val > thr_bright) & (sat < 0.16)] = 5
        ids[(grn > 0.045) & (g > b) & (sat > 0.12)] = 2
        ids[(blu > 0.03) & (b > g) & (val < 0.62) & (sat > 0.10)] = 1
        warm = (sat > 0.18) & (r >= g) & (g > b) & (val > 0.18) & (val < 0.78)
        ids[warm] = 3
        gray = (sat < 0.18) & (val > 0.30) & (val < thr_bright)
        ids[gray] = 4
        ids[(val >= thr_dark) & (val <= thr_bright) & ~warm & ~gray & (sat <= 0.18)] = 0

        counts = np.bincount(ids.ravel(), minlength=len(CLASSES))
        total = float(ids.size)
        shares = {CLASSES[i]: 100.0 * counts[i] / total for i in range(len(CLASSES))}
        ordered = [n for n, _ in sorted(shares.items(), key=lambda kv: kv[1], reverse=True)]
        dominant = ordered[0]
        text = f"Dominant land cover: {dominant} ({shares[dominant]:.0f}% of the scene)."
        rest = [n for n in ordered if shares[n] >= 5 and n != dominant][:2]
        if rest:
            text += " Alongside: " + ", ".join(f"{n} ({shares[n]:.0f}%)" for n in rest) + "."
        if "Water" in shares and shares["Water"] >= 8:
            ys, xs = np.nonzero(ids == 1)
            cy, cx = ys.mean() / (SCENE_SIZE - 1), xs.mean() / (SCENE_SIZE - 1)
            yt = "top" if cy < 0.36 else "bottom" if cy > 0.64 else "middle"
            xt = "left" if cx < 0.36 else "right" if cx > 0.64 else "center"
            text += f" Water covers ~{shares['Water']:.0f}%, concentrated {yt}-{xt}."

        payload = {"text": text, "dominant": dominant, "shares": {k: round(v, 1) for k, v in shares.items()}, "size": SCENE_SIZE}
        return ToolResult(
            tool=self.name,
            detail={"dominant": dominant},
            confidence=0.5,
            latency_ms=(time.time() - t0) * 1000.0,
            payload=payload,
        )