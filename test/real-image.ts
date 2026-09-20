import fs from 'node:fs';
import { classifySceneData } from '../src/utils/sceneAnalysis.ts';
import { decodePng } from './png.ts';

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