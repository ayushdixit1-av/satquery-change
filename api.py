import base64
import io
import os
import time

import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from scipy import ndimage as ndi

from model import T1T2ChangeDetector

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

CKPT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "t1t2_change_best.pth")

app = FastAPI(title="T1/T2 Change Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_model = None
_models_loaded_at = None


def get_model():
    global _model, _models_loaded_at
    if _model is None:
        ckpt = torch.load(CKPT_PATH, map_location="cpu", weights_only=False)
        _model = T1T2ChangeDetector()
        _model.load_state_dict(ckpt["model_state_dict"], strict=True)
        _model.eval()
        _models_loaded_at = time.time()
    return _model


def to_png_bytes(gray):
    buf = io.BytesIO()
    Image.fromarray(np.clip(gray, 0, 255).astype(np.uint8), mode="L").save(buf, format="PNG")
    return buf.getvalue()


def ncc(a, b):
    a = (a - a.mean()) / (a.std() + 1e-6)
    b = (b - b.mean()) / (b.std() + 1e-6)
    return float((a * b).mean())


def phase_shift(a, b):
    fa = np.fft.fft2(a)
    fb = np.fft.fft2(b)
    cross = fa * np.conj(fb)
    cross /= np.abs(cross) + 1e-10
    cc = np.fft.ifft2(cross).real
    y, x = np.unravel_index(np.argmax(cc), cc.shape)
    dy = y if y < cc.shape[0] // 2 else y - cc.shape[0]
    dx = x if x < cc.shape[1] // 2 else x - cc.shape[1]
    return dy, dx


def otsu(p):
    p = np.clip(p, 0, 1)
    hist, _ = np.histogram(p, bins=256, range=(0, 1))
    tot = p.size
    wsum = float((np.arange(256) * hist).sum())
    best_t, best_var = 0, -1.0
    s1 = 0.0
    w1 = 0
    for t in range(256):
        w1 += hist[t]
        if w1 == 0 or w1 == tot:
            continue
        s1 += t * hist[t]
        m1 = s1 / w1
        m2 = (wsum - s1) / (tot - w1)
        var = w1 * (tot - w1) * ((m1 - m2) ** 2)
        if var > best_var:
            best_var, best_t = var, t
    return best_t / 255.0, best_var


def clean_mask(bin_mask, min_area=64):
    lab, n = ndi.label(bin_mask)
    if n == 0:
        return bin_mask
    sizes = ndi.sum(bin_mask, lab, range(1, n + 1))
    out = np.zeros_like(bin_mask)
    for i, s in zip(range(1, n + 1), sizes):
        if s >= min_area:
            out[lab == i] = 1
    return (out != 0)


def prepare_pair(img1, img2, size):
    img1 = img1.convert("RGB").resize((size, size), Image.BILINEAR)
    img2 = img2.convert("RGB").resize((size, size), Image.BILINEAR)

    g1 = np.asarray(img1.convert("L"), dtype=np.float64)
    g2 = np.asarray(img2.convert("L"), dtype=np.float64)

    dy, dx = phase_shift(g1, g2)
    arr2 = np.asarray(img2, dtype=np.float32)
    arr2 = np.roll(np.roll(arr2, dy, axis=0), dx, axis=1)
    img2 = Image.fromarray(arr2.astype(np.uint8))

    arr1 = np.asarray(img1, dtype=np.float32) / 255.0
    arr2 = np.asarray(img2, dtype=np.float32) / 255.0

    quality = ncc(g1, np.asarray(img2.convert("L"), dtype=np.float64))
    return arr1, arr2, (dy, dx), quality


def normalize(x, mode):
    if mode == "imagenet":
        x = (x - np.asarray(IMAGENET_MEAN, np.float32)) / np.asarray(IMAGENET_STD, np.float32)
    elif mode == "zeromean":
        x = (x - x.mean(axis=(0, 1), keepdims=True)) / (x.std(axis=(0, 1), keepdims=True) + 1e-6)
    return torch.from_numpy(x.transpose(2, 0, 1).copy()).float().unsqueeze(0)


def infer(prob_arrays):
    best = None
    for mode in ("imagenet", "zeromean"):
        p = prob_arrays[mode]
        thr, var = otsu(p)
        if best is None or var > best[3]:
            best = (mode, p, thr, var)
    mode, p, auto_thr, var = best
    return mode, p, auto_thr, var


def _run_pair(img1, img2, size):
    arr1, arr2, shift, quality = prepare_pair(img1, img2, size)
    model = get_model()

    probs = {}
    with torch.no_grad():
        for mode in ("imagenet", "zeromean"):
            x1 = normalize(arr1, mode)
            x2 = normalize(arr2, mode)
            probs[mode] = model(x1, x2)[0, 0].numpy()

    chosen, p, auto_thr, _ = infer(probs)
    raw_mask = p > auto_thr
    cleaned = clean_mask(raw_mask)
    return {
        "prob_map": base64.b64encode(to_png_bytes(p * 255)).decode(),
        "mask": base64.b64encode(to_png_bytes(cleaned * 255)).decode(),
        "auto_threshold": round(float(auto_thr), 3),
        "norm": chosen,
        "shift_dy": int(shift[0]),
        "shift_dx": int(shift[1]),
        "alignment_ncc": round(quality, 3),
        "changed_pct": round(float(100.0 * cleaned.mean()), 2),
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": get_model() is not None,
        "loaded_at": _models_loaded_at,
    }


@app.get("/", response_class=JSONResponse)
async def root():
    return {
        "endpoints": {
            "/predict": "POST - multipart form (t1, t2 image files, optional size)",
            "/predict/json": "POST - {'t1': base64, 't2': base64, 'size': 512}",
            "/health": "GET - server + model status",
        }
    }


@app.post("/predict")
async def predict(t1: UploadFile = File(...), t2: UploadFile = File(...), size: int = Form(512)):
    t0 = time.time()
    img1 = Image.open(io.BytesIO(await t1.read()))
    img2 = Image.open(io.BytesIO(await t2.read()))
    return _respond(img1, img2, size, t0)


@app.post("/predict/json")
async def predict_json(body: dict):
    t0 = time.time()
    if not body.get("t1") or not body.get("t2"):
        return JSONResponse({"error": "JSON body needs base64 fields 't1' and 't2'"}, status_code=400)
    img1 = Image.open(io.BytesIO(base64.b64decode(body["t1"])))
    img2 = Image.open(io.BytesIO(base64.b64decode(body["t2"])))
    size = int(body.get("size", 512))
    return _respond(img1, img2, size, t0)


def _respond(img1, img2, size, t0):
    out = _run_pair(img1, img2, size)
    out["time_ms"] = round((time.time() - t0) * 1000.0, 1)
    return JSONResponse(out)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8001)))