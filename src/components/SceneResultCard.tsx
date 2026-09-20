import React from 'react';
import { ImageIcon, Leaf, Droplets, Sun, ScanSearch } from 'lucide-react';
import type { SceneResult } from '../types';

export interface SceneResultCardProps {
  scene: SceneResult;
}

const SceneResultCard: React.FC<SceneResultCardProps> = ({ scene }) => {
  const bars = scene.classes.slice(0, 6).filter((c) => c.pct >= 0.5);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-white/70 ring-1 ring-slate-200/80">
      <div className="relative">
        <img src={scene.imageUrl} alt={scene.fileName} className="aspect-[16/10] w-full object-cover" />
        <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-lg bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">
          <ImageIcon className="h-3 w-3" /> {scene.fileName}
        </span>
      </div>

      <div className="p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-800">
          <ScanSearch className="h-3.5 w-3.5 text-sky-500" />
          Scene composition
        </p>

        <div className="mt-2 space-y-1.5">
          {bars.map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {c.label}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200/70">
                <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
              </div>
              <span className="w-12 shrink-0 text-right text-[10px] font-bold text-slate-700">{c.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <span className="flex flex-col items-center rounded-xl bg-white/80 px-2 py-1.5 ring-1 ring-slate-200/80">
            <Leaf className="h-3.5 w-3.5 text-emerald-500" />
            <span className="mt-1 text-[10px] font-bold text-slate-700">Veg. health</span>
            <span className="text-[10px] font-extrabold text-emerald-600">{Math.round(scene.vegetationHealth * 100)}%</span>
          </span>
          <span className="flex flex-col items-center rounded-xl bg-white/80 px-2 py-1.5 ring-1 ring-slate-200/80">
            <Droplets className="h-3.5 w-3.5 text-sky-500" />
            <span className="mt-1 text-[10px] font-bold text-slate-700">Water</span>
            <span className="text-[10px] font-extrabold text-sky-600">{scene.waterPct.toFixed(0)}%</span>
          </span>
          <span className="flex flex-col items-center rounded-xl bg-white/80 px-2 py-1.5 ring-1 ring-slate-200/80">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span className="mt-1 text-[10px] font-bold text-slate-700">Brightness</span>
            <span className="text-[10px] font-extrabold text-amber-600">{Math.round(scene.brightness * 100)}%</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default SceneResultCard;