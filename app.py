import base64
import io
import os
import time

import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from PIL import Image
from scipy import ndimage as ndi

from model import T1T2ChangeDetector

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

CKPT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "t1t2_change_best.pth")

app = FastAPI(title="T1/T2 Change Detection")

_model = None


def get_model():
    global _model
    if _model is None:
        ckpt = torch.load(CKPT_PATH, map_location="cpu", weights_only=False)
        _model = T1T2ChangeDetector()
        _model.load_state_dict(ckpt["model_state_dict"], strict=True)
        _model.eval()
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


@app.get("/", response_class=HTMLResponse)
async def index():
    return PAGE


@app.post("/predict")
async def predict(t1: UploadFile = File(...), t2: UploadFile = File(...), size: int = Form(512)):
    t0 = time.time()
    img1 = Image.open(io.BytesIO(await t1.read()))
    img2 = Image.open(io.BytesIO(await t2.read()))

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
    changed_pct = float(100.0 * cleaned.mean())
    elapsed = (time.time() - t0) * 1000.0

    return JSONResponse(
        {
            "prob_map": base64.b64encode(to_png_bytes(p * 255)).decode(),
            "mask": base64.b64encode(to_png_bytes(cleaned * 255)).decode(),
            "auto_threshold": round(float(auto_thr), 3),
            "norm": chosen,
            "shift_dy": shift[0],
            "shift_dx": shift[1],
            "alignment_ncc": round(quality, 3),
            "changed_pct": round(changed_pct, 2),
            "time_ms": round(elapsed, 1),
        }
    )


PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>T1/T2 Change Detection</title>
<style>
  :root { --bg:#0f1115; --panel:#171a21; --panel2:#1e222b; --line:#2a2f3a; --text:#e8ebf0; --muted:#9aa3b2; --accent:#4f8cff; --warn:#f0b429; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:'Segoe UI',system-ui,sans-serif; background:var(--bg); color:var(--text); }
  header { padding:20px 28px; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:14px; }
  header h1 { font-size:19px; margin:0; }
  header span { color:var(--muted); font-size:13px; }
  main { max-width:1100px; margin:0 auto; padding:24px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  h2 { font-size:14px; margin:0 0 10px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.06em; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; }
  .upload { border:1.5px dashed var(--line); border-radius:10px; padding:14px; }
  .upload input { width:100%; color:var(--muted); font-size:13px; }
  .preview { margin-top:12px; display:none; }
  .preview img { width:100%; border-radius:8px; border:1px solid var(--line); display:block; }
  button { background:var(--accent); color:#fff; border:0; border-radius:10px; padding:12px 18px; font-size:15px; font-weight:600; cursor:pointer; width:100%; margin-top:20px; }
  button:disabled { opacity:.5; cursor:not-allowed; }
  .results { margin-top:20px; display:none; }
  .result-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .result-grid img { width:100%; border-radius:8px; border:1px solid var(--line); display:block; background:#000; }
  canvas { width:100%; border-radius:8px; border:1px solid var(--line); background:#000; }
  .stats { display:flex; flex-wrap:wrap; gap:18px; margin-top:14px; font-size:13px; color:var(--muted); }
  .stats b { color:var(--text); font-size:15px; }
  .warn { color:var(--warn); }
  .slider-row { margin-top:14px; display:flex; align-items:center; gap:12px; font-size:13px; color:var(--muted); }
  input[type=range] { flex:1; accent-color:var(--accent); }
  .status { margin-top:12px; font-size:13px; color:var(--muted); }
  .center { text-align:center; }
  .note { font-size:12px; color:var(--muted); margin-top:8px; }
  @media (max-width:800px) { .grid, .result-grid { grid-template-columns:1fr; } }
</style>
</head>
<body>
<header><h1>T1/T2 Change Detection</h1><span>satellite change detection &middot; local model</span></header>
<main>
  <div class="grid">
    <div class="card">
      <h2>Before (T1)</h2>
      <div class="upload"><input type="file" id="t1" accept="image/*"><div class="preview" id="p1"></div></div>
    </div>
    <div class="card">
      <h2>After (T2)</h2>
      <div class="upload"><input type="file" id="t2" accept="image/*"><div class="preview" id="p2"></div></div>
    </div>
  </div>
  <button id="run">Detect Changes</button>
  <div class="status" id="status"></div>
  <p class="note">For a reliable result the two images must show the <b>same area</b> (co-registered). The alignment bar below reports how well they match &mdash; below ~0.75 the pair is probably not the same scene.</p>

  <div class="results" id="results">
    <div class="grid">
      <div class="card">
        <h2>Change probability map</h2>
        <img id="probMap" alt="probability map">
      </div>
      <div class="card">
        <h2>Binary change mask</h2>
        <canvas id="maskCanvas" width="512" height="512"></canvas>
      </div>
    </div>
    <div class="stats">
      <div>Changed <b id="changed">-</b>%</div>
      <div>Auto threshold <b id="autoThr">-</b></div>
      <div>Mask threshold <b id="thrVal">-</b></div>
      <div>Alignment <b id="ncc">-</b></div>
      <div>Shift <b id="shift">-</b></div>
      <div>Norm <b id="norm">-</b></div>
      <div>Inference <b id="inferTime">-</b></div>
    </div>
    <div class="slider-row">
      <label for="thr">Mask threshold</label>
      <input type="range" id="thr" min="1" max="99" value="50">
    </div>
    <div class="center" style="margin-top:14px"><a id="dl" href="#" download="change_mask.png" style="color:var(--accent);font-size:13px">Download mask</a></div>
  </div>
</main>

<script>
const t1 = document.getElementById('t1'), t2 = document.getElementById('t2');
const runBtn = document.getElementById('run'), statusEl = document.getElementById('status');
const results = document.getElementById('results');
const maskCanvas = document.getElementById('maskCanvas');
const probImg = document.getElementById('probMap');
let probPix = null;

function preview(input, boxId) {
  const box = document.getElementById(boxId);
  input.onchange = () => {
    const f = input.files[0];
    if (!f) return;
    box.innerHTML = '<img src="' + URL.createObjectURL(f) + '">';
    box.style.display = 'block';
  };
}
preview(t1, 'p1'); preview(t2, 'p2');

function activeMask() {
  if (!probPix) return;
  const thr = parseInt(document.getElementById('thr').value) / 100;
  const ctx = maskCanvas.getContext('2d');
  const img = ctx.createImageData(512, 512);
  const d = img.data;
  let changed = 0, n = probPix.length;
  for (let i = 0; i < n; i++) {
    const on = probPix[i] >= thr;
    if (on) changed++;
    const v = on ? 255 : 0;
    d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  document.getElementById('changed').textContent = (100 * changed / n).toFixed(1);
  document.getElementById('thrVal').textContent = Math.round(thr * 100);
  document.getElementById('dl').href = maskCanvas.toDataURL('image/png');
}

document.getElementById('thr').oninput = activeMask;

runBtn.onclick = async () => {
  const f1 = t1.files[0], f2 = t2.files[0];
  if (!f1 || !f2) { statusEl.textContent = 'Please choose both images.'; return; }
  runBtn.disabled = true;
  statusEl.textContent = 'Running model (alignment + inference)... this takes a few seconds';
  const fd = new FormData();
  fd.append('t1', f1); fd.append('t2', f2);
  try {
    const r = await fetch('/predict', { method: 'POST', body: fd });
    if (!r.ok) throw new Error((await r.json()).detail || r.statusText);
    const d = await r.json();
    probImg.src = 'data:image/png;base64,' + d.prob_map;
    probImg.onload = () => {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 512;
      const cctx = c.getContext('2d');
      cctx.drawImage(probImg, 0, 0, 512, 512);
      const px = cctx.getImageData(0, 0, 512, 512).data;
      probPix = new Float32Array(512 * 512);
      for (let i = 0; i < probPix.length; i++) probPix[i] = px[i * 4] / 255;
      const at = Math.min(98, Math.max(2, Math.round(d.auto_threshold * 100)));
      document.getElementById('thr').value = at;
      activeMask();
    };
    const nccEl = document.getElementById('ncc');
    nccEl.textContent = d.alignment_ncc;
    nccEl.classList.toggle('warn', d.alignment_ncc < 0.75);
    document.getElementById('autoThr').textContent = d.auto_threshold;
    document.getElementById('shift').textContent = '(' + d.shift_dy + ',' + d.shift_dx + ')';
    document.getElementById('norm').textContent = d.norm;
    document.getElementById('inferTime').textContent = d.time_ms + ' ms';
    results.style.display = 'block';
    statusEl.textContent = 'Done. Alignment is ' + (d.alignment_ncc >= 0.75 ? 'good.' : 'poor / not the same scene — mask may be unreliable.');
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
  } finally {
    runBtn.disabled = false;
  }
};
</script>
</body>
</html>
"""


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)