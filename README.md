# SatQuery — Ask a satellite

A privacy-first, browser-only satellite assistant. **Ask a satellite** two kinds of question and get a plain-language answer — your imagery never leaves your device.

- 🛰️ **Compare two dates** — detect every change between a before/after pair of the same ground.
- 🔍 **Inspect one scene** — a single image is enough; SatQuery reads its land cover and explains the scene.
- 🛡️ **100 % on-device** — a ~6 M-parameter model runs in your browser via ONNX + WebAssembly. No servers, no uploads, no tracking.

## Live Demo

After deploying, visit
`https://<your-username>.github.io/<repo>/`

## How It Works

1. **Align** — a phase-correlation pass verifies both frames view the same ground and reports a match score.
2. **Infer** — a Siamese U-Net change detector (trained on remote-sensing imagery) runs in your browser via ONNX + WebAssembly.
3. **Explain** — an Otsu threshold isolates what changed, a cleanup pass drops speckle, and a live slider lets you tune the cut to your liking.

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
