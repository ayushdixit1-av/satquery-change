import { inflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { classifySceneData } from '../src/utils/sceneAnalysis.ts';

function decodePng(file: string): { data: Uint8ClampedArray; width: number; height: number } {
  const buf = fs.readFileSync(path.resolve(file));
  let off = 8;
  const idat: Buffer[] = [];
  let width = 0, height = 0, colortype = 0, bitdepth = 0;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitdepth = chunk[8];
      colortype = chunk[9];
    } else if (type === 'IDAT') {
      idat.push(chunk);
    } else if (type === 'IEND') break;
    off += 12 + len;
  }
  const channels = colortype === 6 ? 4 : colortype === 2 ? 3 : colortype === 0 ? 1 : colortype === 3 ? 1 : 1;
  if (colortype === 3) throw new Error('palette PNG not supported');
  const bpp = Math.max(1, (channels * bitdepth) / 8);
  const stride = Math.ceil((width * bitdepth * channels) / 8);
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? out.subarray((y - 1) * stride, y * stride) : undefined;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prior ? prior[x] : 0;
      const c = prior && x >= bpp ? prior[x - bpp] : 0;
      let val = raw[rowStart + x];
      switch (f) {
        case 0: break;
        case 1: val = (val + a) & 0xff; break;
        case 2: val = (val + b) & 0xff; break;
        case 3: val = (val + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          val = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
      }
      cur[x] = val;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    data[p * 4] = out[p * channels];
    data[p * 4 + 1] = out[p * channels + 1];
    data[p * 4 + 2] = out[p * channels + 2];
    data[p * 4 + 3] = 255;
  }
  return { data, width, height };
}

for (const file of ['T1_before.png', 'T2_after.png']) {
  if (!fs.existsSync(file)) continue;
  const { data, width, height } = decodePng(file);
  console.log(`==== ${file} (${width}×${height}) sampled colors ====`);
  const sample = [0.1, 0.25, 0.5, 0.75, 0.9];
  for (const fy of sample) {
    const row: string[] = [];
    for (const fx of sample) {
      const x = Math.min(width - 1, Math.round(width * fx));
      const y = Math.min(height - 1, Math.round(height * fy));
      const i = (y * width + x) * 4;
      row.push(`rgb(${data[i]},${data[i + 1]},${data[i + 2]})`);
    }
    console.log('  ' + row.join('  '));
  }
  const res = classifySceneData(`./${file}`, file, data, width, height);
  console.log(`==== ${file} (${width}×${height}) ====`);
  for (const c of res.classes) console.log(`  ${c.label.padEnd(12)} ${c.pct.toFixed(1).padStart(5)}%`);
  console.log(`  water=${res.waterPct.toFixed(1)}% urban=${res.urbanPct.toFixed(1)}% cloud=${res.cloudPct.toFixed(1)}%`);
  console.log(`  health=${res.vegetationHealth.toFixed(2)} brightness=${(res.brightness * 100).toFixed(0)}% detail=${(res.detail * 100).toFixed(0)}%`);
  console.log('  DOMINANT:', res.dominant);
  console.log('  --- description ---');
  for (const line of res.description.split('\n')) console.log('  ' + line);
  console.log();
}