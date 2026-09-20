import base64
import io
import time

from PIL import Image

from agent.tools.base import Tool, ToolResult

from api import clean_mask, get_model, infer, normalize, otsu, prepare_pair, to_png_bytes


class ChangeDetectionTool(Tool):
    name = "change_detection"
    description = "Bi-temporal optical pair -> change probability map, binary mask, changed %, clusters, alignment score."
    inputs = "two co-registered images of the same area (T1 earlier, T2 later)"

    def available(self):
        return True

    def run(self, ctx):
        t0 = time.time()
        img1 = Image.open(io.BytesIO(ctx["images"][0].bytes))
        img2 = Image.open(io.BytesIO(ctx["images"][1].bytes))
        size = int(ctx.get("size", 512))
        arr1, arr2, shift, quality = prepare_pair(img1, img2, size)
        model = get_model()

        probs = {}
        import torch

        with torch.no_grad():
            for mode in ("imagenet", "zeromean"):
                x1 = normalize(arr1, mode)
                x2 = normalize(arr2, mode)
                probs[mode] = model(x1, x2)[0, 0].numpy()

        chosen, p, auto_thr, _ = infer(probs)
        cleaned = clean_mask(p > auto_thr)

        mask_b64 = base64.b64encode(to_png_bytes(cleaned * 255)).decode()
        prob_b64 = base64.b64encode(to_png_bytes(p * 255)).decode()

        payload = {
            "prob_map": prob_b64,
            "mask": mask_b64,
            "auto_threshold": round(float(auto_thr), 3),
            "norm": chosen,
            "shift_dy": int(shift[0]),
            "shift_dx": int(shift[1]),
            "alignment_ncc": round(quality, 3),
            "changed_pct": round(float(100.0 * cleaned.mean()), 2),
            "size": size,
        }
        return ToolResult(
            tool=self.name,
            detail={"changed_pct": payload["changed_pct"], "alignment_ncc": payload["alignment_ncc"]},
            confidence=min(0.95, max(0.3, quality)),
            latency_ms=(time.time() - t0) * 1000.0,
            payload=payload,
        )