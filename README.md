# SatQuery — Satellite Change Detection Demo

Upload a before/after image pair of the same area. A ~6 M-parameter change-detection model runs **100 % in your browser** via WebAssembly — nothing is uploaded to any server.

## Live Demo

After deploying, visit  
`https://<your-username>.github.io/<repo>/`

## How It Works

1. **ResNet encoder** processes each image independently (shared weights).
2. **Fusion layer** compares encodings via concatenation + element-wise diff + element-wise product.
3. **Decoder** upsamples fused features back to 512 × 512.
4. **Otsu auto-threshold** picks a sensible cutoff; connected-component cleanup removes tiny blobs.

Model: `T1T2ChangeDetector` (Siamese U-Net) — exported to ONNX with opset 18, 0.2 MB graph + 23 MB weights (~24 MB total).

## Local Development

Serve the `site/` directory over HTTP:

```bash
# Python
python -m http.server 8000 --directory site

# Node
npx serve site
```

Open `http://localhost:8000`.

## Deploy to GitHub Pages

1. Create a new GitHub repo and push this project (without `*.pth`).
2. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or `master`) — the workflow in `.github/workflows/pages.yml` deploys automatically.
4. Your site is live at `https://<username>.github.io/<repo>/`.

## Project Structure

```
.
├── app.py                   # FastAPI local server (Python, runs model via torch)
├── model.py                 # T1T2ChangeDetector architecture definition
├── infer.py                 # CLI inference helper
├── t1t2_change_best.pth     # Checkpoint (~70 MB, git-ignored)
├── site/                    # Static site deployed to GitHub Pages
│   ├── index.html
│   ├── style.css
│   ├── app.js               # Browser inference via onnxruntime-web
│   └── satquery_change.onnx # Exported model (~24 MB)
└── .github/workflows/pages.yml
```
