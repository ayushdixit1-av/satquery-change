"use strict";

/* ================= Pure math / preprocessing (no DOM) ================= */

const SIZE = 512;
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

/* imgData: {width, height, data(Uint8ClampedArray RGBA)} -> resize handled by caller canvas
   Returns Float32Array CHW length 3*SIZE*SIZE, normalized per-channel zero-mean/std. */
function imageToCHW(imgData, norm) {
  const n = SIZE * SIZE;
  const out = new Float32Array(3 * n);
  const { width, height, data } = imgData;
  // scale factor to cover 512x512 (stretch, matching Python resize)
  const dx = width / SIZE, dy = height / SIZE;
  for (let y = 0; y < SIZE; y++) {
    const sy = Math.min(height - 1, Math.round(y * dy));
    for (let x = 0; x < SIZE; x++) {
      const sx = Math.min(width - 1, Math.round(x * dx));
      const src = (sy * width + sx) * 4;
      const i = y * SIZE + x;
      out[i] = data[src] / 255;
      out[n + i] = data[src + 1] / 255;
      out[2 * n + i] = data[src + 2] / 255;
    }
  }
  if (norm === 'imagenet') {
    for (let c = 0; c < 3; c++) {
      const base = c * n, m = IMAGENET_MEAN[c], s = IMAGENET_STD[c];
      for (let i = 0; i < n; i++) out[base + i] = (out[base + i] - m) / s;
    }
    return out;
  }
  // zero-mean per channel
  for (let c = 0; c < 3; c++) {
    const base = c * n;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += out[base + i];
    const mean = sum / n;
    let vsum = 0;
    for (let i = 0; i < n; i++) vsum += (out[base + i] - mean) ** 2;
    const std = Math.sqrt(vsum / n) || 1e-6;
    for (let i = 0; i < n; i++) out[base + i] = (out[base + i] - mean) / std;
  }
  return out;
}

/* Otsu threshold on a prob Float32Array (0..1). Returns {thr: [0..1], score} */
function otsu(probs) {
  const BINS = 256;
  const hist = new Float64Array(BINS);
  let total = 0;
  for (let i = 0; i < probs.length; i++) {
    const b = Math.max(0, Math.min(BINS - 1, Math.floor(probs[i] * BINS)));
    hist[b]++;
    total++;
  }
  let sumAll = 0;
  for (let b = 0; b < BINS; b++) sumAll += b * hist[b];
  let sumB = 0, wB = 0;
  let best = { thr: 0.5, score: -1 };
  for (let b = 0; b < BINS; b++) {
    wB += hist[b];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += b * hist[b];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best.score) best = { thr: (b + 0.5) / BINS, score: between };
  }
  return best;
}

/* Connected-component cleanup: keeps blobs with area >= minArea. Returns new Uint8Array. */
function removeSmallBlobs(bin8, minArea) {
  const n = SIZE * SIZE;
  const labels = new Int32Array(n);
  const areas = [];
  const queue = new Int32Array(n);
  let cur = 0;
  for (let i = 0; i < n; i++) {
    if (bin8[i] && labels[i] === 0) {
      cur++;
      let head = 0, tail = 0;
      queue[tail++] = i;
      labels[i] = cur;
      while (head < tail) {
        const p = queue[head++];
        const x = p % SIZE, y = (p / SIZE) | 0;
        const nl = [p - 1, p + 1, p - SIZE, p + SIZE];
        if (x === 0) nl[0] = -1;
        if (x === SIZE - 1) nl[1] = -1;
        if (y === 0) nl[2] = -1;
        if (y === SIZE - 1) nl[3] = -1;
        for (let k = 0; k < 4; k++) {
          const q = nl[k];
          if (q >= 0 && bin8[q] && labels[q] === 0) { labels[q] = cur; queue[tail++] = q; }
        }
      }
      areas[cur] = tail;
    }
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l > 0 && areas[l] >= minArea) out[i] = 1;
  }
  return out;
}

/* Normalized cross-correlation of two downscaled 64x64 grayscale views.
   Returns {ncc, bestShift:[dy,dx]} evaluated over shifts in [-sh..+sh]. */
function estimateAlignment(a, b, sh) {
  const S = 64;
  function gray(imgData) {
    const g = new Float64Array(S * S);
    const { width, height, data } = imgData;
    const dx = width / S, dy = height / S;
    for (let y = 0; y < S; y++) {
      const sy = Math.min(height - 1, Math.round(y * dy));
      for (let x = 0; x < S; x++) {
        const sx = Math.min(width - 1, Math.round(x * dx));
        const s = (sy * width + sx) * 4;
        g[y * S + x] = 0.299 * data[s] + 0.587 * data[s + 1] + 0.114 * data[s + 2];
      }
    }
    return g;
  }
  const ga = gray(a), gb = gray(b);
  const best = { ncc: -1, dy: 0, dx: 0 };
  for (let dy = -sh; dy <= sh; dy++) {
    for (let dx = -sh; dx <= sh; dx++) {
      let num = 0, sa = 0, sb = 0, sa2 = 0, sb2 = 0, cnt = 0;
      for (let y = sh; y < S - sh; y++) {
        for (let x = sh; x < S - sh; x++) {
          const va = ga[y * S + x];
          const bb = gb[(y + dy) * S + (x + dx)];
          num += va * bb; sa += va; sb += bb; sa2 += va * va; sb2 += bb * bb; cnt++;
        }
      }
      const numC = cnt * num - sa * sb;
      const denom = Math.sqrt((cnt * sa2 - sa * sa) * (cnt * sb2 - sb * sb));
      const ncc = denom > 0 ? numC / denom : 0;
      if (ncc > best.ncc) { best.ncc = ncc; best.dy = dy; best.dx = dx; }
    }
  }
  return best;
}

/* ============================ DOM glue ============================ */

const $ = (s) => document.querySelector(s);

const el = {
  dz1: $('#dz1'), dz2: $('#dz2'),
  f1: $('#f1'), f2: $('#f2'),
  bx1: $('#bx1'), bx2: $('#bx2'),
  run: $('#run'), engine: $('#engine'), status: $('#status'),
  results: $('#results'), in1: $('#in1'), in2: $('#in2'),
  align: $('#align'), probCv: $('#probCv'), maskCv: $('#maskCv'),
  probMeta: $('#probMeta'), changedPct: $('#changedPct'),
  thr: $('#thr'), thrOut: $('#thrOut'), otsuOut: $('#otsuOut'), timeOut: $('#timeOut'),
  clean: $('#clean'), dlMask: $('#dlMask'), dlProb: $('#dlProb'),
};

const state = { img1: null, img2: null, probs: null, mask: null, otsu: 0.5 };

let session = null, sessionPromise = null;

async function loadSession() {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    el.engine.classList.add('busy');
    setStatus('Downloading model (~23 MB) and engine…');
    ort.env.wasm.numThreads = 1; // GitHub Pages has no COOP/COEP -> single thread
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
    const resp = await fetch('satquery_change.onnx');
    if (!resp.ok) throw new Error('model download failed: HTTP ' + resp.status);
    const total = +resp.headers.get('Content-Length') || 1;
    const reader = resp.body.getReader();
    const chunks = [];
    let got = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      setStatus('Downloading model… ' + Math.round(100 * got / total) + '%');
    }
    const buf = new Uint8Array(got);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }
    setStatus('Initializing WebAssembly engine…');
    session = await ort.InferenceSession.create(buf.buffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    el.engine.classList.remove('busy');
    el.engine.querySelector('.dot').style.background = '';
    setStatus('Engine ready.');
    return session;
  })();
  return sessionPromise;
}

function setStatus(msg, isErr) {
  el.status.textContent = msg;
  el.status.classList.toggle('err', !!isErr);
}

function setEngineReady() {
  el.engine.innerHTML = '<span class="dot"></span> engine ready';
}

function wireDrop(dz, input, box, setter) {
  input.addEventListener('change', () => {
    if (input.files[0]) loadFile(input.files[0]).then((img) => { setter(img); paintBox(box, img); });
  });
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('hover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('hover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault(); dz.classList.remove('hover');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]).then((img) => { setter(img); paintBox(box, img); });
  });
}

function loadFile(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('cannot read image'));
    img.src = url;
  });
}

function paintBox(box, img) {
  box.classList.add('has');
  box.querySelector('img').src = img.src;
}

const imgToData = (img) => {
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  return ctx.getImageData(0, 0, SIZE, SIZE);
};

function drawProbMap({ probCv, data, probMeta }) {
  const ctx = probCv.getContext('2d');
  const id = ctx.createImageData(SIZE, SIZE);
  const n = SIZE * SIZE;
  for (let i = 0; i < n; i++) {
    const p = Math.max(0, Math.min(1, data[i]));
    const v = Math.round(p * 255);
    id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

function drawMask({ maskCv, data, out }) {
  const thr = +out.value / 100;
  const n = SIZE * SIZE;
  let changed = 0;
  for (let i = 0; i < n; i++) if (data[i] >= thr) changed++;
  el.changedPct.textContent = (100 * changed / n).toFixed(2) + '%';
  const raw = new Uint8Array(n);
  for (let i = 0; i < n; i++) raw[i] = data[i] >= thr ? 1 : 0;
  const cleaned = el.clean.checked ? removeSmallBlobs(raw, 64) : raw;
  const ctx = maskCv.getContext('2d');
  const id = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < n; i++) {
    const on = cleaned[i] === 1;
    id.data[i * 4] = on ? 255 : 0;
    id.data[i * 4 + 1] = on ? 0 : 0;
    id.data[i * 4 + 2] = on ? 0 : 0;
    id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  state.mask = cleaned;
}

async function runModel() {
  if (!state.img1 || !state.img2) return;
  el.run.disabled = true;
  setStatus('Loading engine (first run)…');
  try { await loadSession(); } catch (e) { setStatus(e.message, true); el.run.disabled = false; return; }
  setStatus('Running inference…');
  try {
    const t0 = performance.now();
    const d1 = imgToData(state.img1), d2 = imgToData(state.img2);

    // alignment estimate
    const al = estimateAlignment(d1, d2, 6);
    const alignTxt = al.ncc > 0.75
      ? 'aligned ✓ (NCC ' + al.ncc.toFixed(2) + ')'
      : '<span style="color:#f0b429">misaligned ⚠ (NCC ' + al.ncc.toFixed(2) + ')</span>';
    el.align.innerHTML = alignTxt;

    const t1 = imageToCHW(d1, 'zeromean');
    const t2 = imageToCHW(d2, 'zeromean');

    const feeds = {
      t1: new ort.Tensor('float32', t1, [1, 3, SIZE, SIZE]),
      t2: new ort.Tensor('float32', t2, [1, 3, SIZE, SIZE]),
    };
    const res = await session.run(feeds);
    const probs = new Float32Array(res.prob.data);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

    state.probs = probs;
    const o = otsu(probs);
    state.otsu = o.thr;
    el.otsuOut.textContent = o.thr.toFixed(2);
    el.thr.value = Math.round(o.thr * 100);
    el.thrOut.textContent = o.thr.toFixed(2);

    drawProbMap({ probCv: el.probCv, data: probs, probMeta: el.probMeta });
    drawMask({ maskCv: el.maskCv, data: probs, out: el.thr });
    el.timeOut.textContent = elapsed + ' s';

    el.in1.src = state.img1.src; el.in2.src = state.img2.src;
    el.results.hidden = false;
    el.dlMask.addEventListener('click', () => saveCanvas(el.maskCv, 'change_mask.png'));
    el.dlProb.addEventListener('click', () => saveCanvas(el.probCv, 'change_probability.png'));
    setStatus('Done in ' + elapsed + 's.');
  } catch (e) {
    setStatus('Inference failed: ' + e.message, true);
  } finally {
    el.run.disabled = false;
  }
}

function saveCanvas(cv, name) {
  const a = document.createElement('a');
  a.href = cv.toDataURL('image/png');
  a.download = name;
  a.click();
}

/* ---------- wiring ---------- */
wireDrop(el.dz1, el.f1, el.bx1, (img) => (state.img1 = img));
wireDrop(el.dz2, el.f2, el.bx2, (img) => (state.img2 = img));

el.run.addEventListener('click', () => {
  if (!state.img1 || !state.img2) return;
  setStatus('');
  runModel().then(() => {
    state.thr = +el.thr.value / 100;
  });
});

el.thr.addEventListener('input', () => {
  el.thrOut.textContent = (+el.thr.value / 100).toFixed(2);
  if (state.probs) drawMask({ maskCv: el.maskCv, data: state.probs, out: el.thr });
});
el.clean.addEventListener('change', () => {
  if (state.probs) drawMask({ maskCv: el.maskCv, data: state.probs, out: el.thr });
});

// checkerboard indicator showing engine warms up
setEngineReady();

// try preloading engine in background for snappier first run
loadSession().catch(() => {});