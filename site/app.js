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

/* ================= Scene analysis (RGB heuristic) ================= */

const SCENE_SIZE = 256;
const CLASSES = [
  { name: 'Shadow / unclear', color: [28, 29, 34] },   // 0
  { name: 'Water',            color: [31, 119, 180] },  // 1
  { name: 'Vegetation',       color: [74, 176, 91] },   // 2
  { name: 'Bare land / soil', color: [205, 170, 92] },  // 3
  { name: 'Built-up / urban', color: [177, 92, 150] },  // 4
  { name: 'Cloud / snow',     color: [232, 232, 238] }, // 5
];

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

/* Classify a downsampled RGBA image into land-cover classes.
   imgData: {width,height,data}. Returns {ids: Uint8Array (SCENE_SIZE^2), counts: Int32Array(6)} */
function classifyScene(imgData) {
  const n = SCENE_SIZE * SCENE_SIZE;
  const ids = new Uint8Array(n);
  const counts = new Int32Array(CLASSES.length);
  const { width, height, data } = imgData;
  const dx = width / SCENE_SIZE, dy = height / SCENE_SIZE;
  const bright = new Float32Array(n);
  for (let y = 0; y < SCENE_SIZE; y++) {
    const sy0 = Math.min(height - 1, Math.round(y * dy));
    for (let x = 0; x < SCENE_SIZE; x++) {
      const sx0 = Math.min(width - 1, Math.round(x * dx));
      const s = (sy0 * width + sx0) * 4;
      bright[y * SCENE_SIZE + x] = (data[s] + data[s + 1] + data[s + 2]) / (3 * 255);
    }
  }
  const sorted = Array.from(bright).sort((a, b) => a - b);
  const lq = percentile(sorted, 0.2);
  const uq = percentile(sorted, 0.8);
  const thrDark = Math.max(0.04, lq * 0.7);
  const thrBright = Math.min(0.88, Math.max(0.5, uq * 1.05));

  const decide = (r, g, b, v) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx > 1e-6 ? (mx - mn) / mx : 0;
    const grn = g - r;             // greenness
    const blu = b - r;             // blue dominance
    if (v < thrDark) return 0;                        // shadow
    if (v > thrBright && sat < 0.16) return 5;        // bright white -> cloud/snow
    if (grn > 0.045 && g > b && sat > 0.12) return 2; // vegetation
    if (blu > 0.03 && b > g && v < 0.62 && sat > 0.10) return 1; // blue water
    if (sat > 0.18) {
      if (r >= g && g > b && v > 0.18 && v < 0.78) return 3; // warm bare soil
    }
    if (sat < 0.18 && v > 0.30 && v < thrBright) return 4;  // gray built-up
    return 0;
  };

  for (let y = 0; y < SCENE_SIZE; y++) {
    const sy0 = Math.min(height - 1, Math.round(y * dy));
    for (let x = 0; x < SCENE_SIZE; x++) {
      const sx0 = Math.min(width - 1, Math.round(x * dx));
      const s = (sy0 * width + sx0) * 4;
      const r = data[s] / 255, g = data[s + 1] / 255, b = data[s + 2] / 255;
      const v = (r + g + b) / 3;
      const c = decide(r, g, b, v);
      ids[y * SCENE_SIZE + x] = c;
      counts[c]++;
    }
  }
  return { ids, counts };
}

function pct(arr, i) { return 100 * arr[i] / SCENE_SIZE / SCENE_SIZE; }

/* Approximate location of a class as a phrase using its centroid. */
function whereIsClass(ids, cls) {
  let sx = 0, sy = 0, c = 0;
  for (let y = 0; y < SCENE_SIZE; y++) {
    for (let x = 0; x < SCENE_SIZE; x++) {
      if (ids[y * SCENE_SIZE + x] === cls) { sx += x; sy += y; c++; }
    }
  }
  if (c === 0) return '';
  const fy = sy / c / (SCENE_SIZE - 1), fx = sx / c / (SCENE_SIZE - 1);
  const yt = fy < 0.36 ? 'top' : fy > 0.64 ? 'bottom' : 'middle';
  const xt = fx < 0.36 ? 'left' : fx > 0.64 ? 'right' : 'center';
  return `${yt}-${xt}`;
}

/* Build a natural-language explanation from classification results. */
function describeScene(counts, ids) {
  const parts = [];
  for (let i = 0; i < CLASSES.length; i++) parts.push({ id: i, name: CLASSES[i].name, p: pct(counts, i) });
  parts.sort((a, b) => b.p - a.p);
  const top = parts[0];
  const notable = parts.filter((x) => x.p >= 5);
  let lead = `Dominant land cover: ${top.name} (~${top.p.toFixed(0)}% of the scene).`;
  const rest = notable.filter((x) => x.id !== top.id);
  if (rest.length) {
    lead += ` Alongside it: ${rest.map((x) => `${x.name} (~${x.p.toFixed(0)}%)`).join(', ')}.`;
  }
  const water = parts.find((x) => x.id === 1);
  let tail = '';
  if (water && water.p >= 8) {
    const loc = whereIsClass(ids, 1);
    tail = ` Water covers ~${water.p.toFixed(0)}%${loc ? `, concentrated in the ${loc}` : ''} — looks like a lake, sea, river or reservoir.`;
  }
  const shadow = parts.find((x) => x.id === 0);
  if (shadow && shadow.p >= 25) {
    tail += (tail ? ' ' : '') + ` Note: ~${shadow.p.toFixed(0)}% is shadow/unclear — a dark or low-contrast scene makes detection partial.`;
  }
  return (lead + tail).trim().replace(/\s+/g, ' ');
}
function ids2cls() { return []; }

/* ============================ DOM glue ============================ */

const $ = (s) => document.querySelector(s);

const el = {
  dz1: $('#dz1'), dz2: $('#dz2'),
  f1: $('#f1'), f2: $('#f2'),
  bx1: $('#bx1'), bx2: $('#bx2'),
  modes: [...document.querySelectorAll('.mode')],
  hint: $('#hint'), arrow: $('#arrow'),
  run: $('#run'), engine: $('#engine'), status: $('#status'),
  results: $('#results'), in1: $('#in1'), in2: $('#in2'),
  align: $('#align'), probCv: $('#probCv'), maskCv: $('#maskCv'),
  probMeta: $('#probMeta'), changedPct: $('#changedPct'),
  thr: $('#thr'), thrOut: $('#thrOut'), otsuOut: $('#otsuOut'), timeOut: $('#timeOut'),
  clean: $('#clean'), dlMask: $('#dlMask'), dlProb: $('#dlProb'),
  sceneBtn: $('#sceneBtn'), scene: $('#scene'), scIn: $('#scIn'), scCv: $('#scCv'),
  scExplain: $('#scExplain'), scDom: $('#scDom'), scLegend: $('#scLegend'), scWhich: $('#sceneWhich'),
  scMeta: $('#scMeta'),
};

const state = { img1: null, img2: null, probs: null, mask: null, otsu: 0.5, mode: 'pair' };

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

function updateRunState() {
  el.run.disabled = !(state.img1 && state.img2);
  el.sceneBtn.disabled = !(state.img1 || state.img2);
}

/* Swap between "compare two dates" (pair) and "inspect one scene" (single). */
function setMode(m) {
  state.mode = m;
  for (const b of el.modes) {
    const on = b.dataset.mode === m;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  }
  document.body.classList.toggle('single', m === 'single');
  el.dz2.hidden = m === 'single';
  el.arrow.hidden = m === 'single';
  const title = el.bx1.querySelector('b');
  const sub = el.bx1.querySelector('.sub');
  if (m === 'single') {
    title.textContent = 'Your satellite scene';
    sub.textContent = 'one image is all we need';
    el.hint.textContent = 'A single satellite frame or aerial shot is enough — SatQuery reads the land cover inside it.';
    el.run.hidden = true;
    el.sceneBtn.textContent = 'Read this scene';
    el.sceneBtn.classList.add('primary');
  } else {
    title.textContent = 'Before · T1';
    sub.textContent = 'drop or click to choose';
    el.hint.textContent = 'Both images should picture the same ground — ideally surveyed on different dates.';
    el.run.hidden = false;
    el.sceneBtn.textContent = 'Inspect single image';
    el.sceneBtn.classList.remove('primary');
  }
}

function wireDrop(dz, input, box, setter) {
  box.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files[0]) loadFile(input.files[0]).then((img) => { setter(img); paintBox(box, img); updateRunState(); });
  });
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('hover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('hover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault(); dz.classList.remove('hover');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]).then((img) => { setter(img); paintBox(box, img); updateRunState(); });
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

const SCENE_MAP_COLORS = CLASSES.map((c) => `rgb(${c.color[0]},${c.color[1]},${c.color[2]})`);

function drawSceneMap({ ctx, ids, explainEl }) {
  const id = ctx.createImageData(SCENE_SIZE, SCENE_SIZE);
  for (let i = 0; i < ids.length; i++) {
    const col = CLASSES[ids[i]].color;
    id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1]; id.data[i * 4 + 2] = col[2]; id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

function runScene() {
  const img = state.img1 || state.img2;
  if (!img) return;
  const which = state.mode === 'single'
    ? ''
    : (state.img2 && !state.img1 ? ' (T2 · after)' : ' (T1 · before)');
  el.scWhich.textContent = which;
  setStatus('Analyzing scene…');
  try {
    const t0 = performance.now();
    const d = imgToData(img);
    const { ids, counts } = classifyScene(d);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

    drawSceneMap({ ctx: el.scCv.getContext('2d'), ids });
    el.scMeta.textContent = 'RGB heuristic · 256² grid';
    const text = describeScene(counts, ids);
    el.scExplain.textContent = text;
    const sorted = [];
    for (let i = 0; i < CLASSES.length; i++) sorted.push({ i, p: pct(counts, i) });
    sorted.sort((a, b) => b.p - a.p);
    el.scDom.textContent = `${CLASSES[sorted[0].i].name} ${sorted[0].p.toFixed(0)}%`;
    el.scLegend.innerHTML = sorted
      .filter((x) => x.p >= 1)
      .map((x) => `<span class="lg"><i style="background:${SCENE_MAP_COLORS[x.i]}"></i>${CLASSES[x.i].name}<b>${x.p.toFixed(1)}%</b></span>`)
      .join('');
    el.scIn.src = img.src;
    el.scene.hidden = false;
    setStatus('Scene analyzed in ' + elapsed + 's.');
  } catch (e) {
    setStatus('Scene analysis failed: ' + e.message, true);
  }
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

el.sceneBtn.addEventListener('click', () => {
  setStatus('');
  runScene();
});

for (const b of el.modes) b.addEventListener('click', () => setMode(b.dataset.mode));
setMode('pair');
updateRunState();

// checkerboard indicator showing engine warms up
setEngineReady();

// try preloading engine in background for snappier first run
loadSession().catch(() => {});