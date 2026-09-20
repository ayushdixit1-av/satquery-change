import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Columns2,
  MoveHorizontal,
  Eye,
  EyeOff,
  Database,
  FileDown,
  CheckCircle2,
  Ruler,
  Percent,
} from 'lucide-react';
import type { AnalysisItem, AnalysisViewMode } from '../types';
import SwipeCompare from './SwipeCompare';

export interface AnalysisModalProps {
  analysis: AnalysisItem;
  onClose: () => void;
}

function MaskLayer({ mask, className }: { mask: string; className?: string }) {
  if (mask.startsWith('linear-gradient')) {
    return <div className={`pointer-events-none absolute inset-0 ${className ?? ''}`} style={{ background: mask }} />;
  }
  return (
    <img
      src={mask}
      alt="Change evidence overlay"
      className={`sq-evidence pointer-events-none absolute inset-0 h-full w-full object-cover ${className ?? ''}`}
    />
  );
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ analysis, onClose }) => {
  const [mode, setMode] = useState<AnalysisViewMode>('sidebyside');
  const [showMask, setShowMask] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const m = analysis.metrics;

  const exportPng = async () => {
    setDownloading(true);
    try {
      const load = (src: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = src;
        });

      const [t1, t2] = await Promise.all([load(analysis.t1Image), load(analysis.t2Image)]);
      const w = 1200;
      const h = Math.max(1, Math.round((w * Math.max(t1.naturalHeight, t2.naturalHeight, 400)) / Math.max(t1.naturalWidth, t2.naturalWidth, 600)));
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const isGradientMask = analysis.changeMask.startsWith('linear-gradient');
      let maskImg: HTMLImageElement | null = null;
      if (!isGradientMask) {
        try {
          maskImg = await load(analysis.changeMask);
        } catch {
          maskImg = null;
        }
      }

      ctx.fillStyle = '#05060c';
      ctx.fillRect(0, 0, w, h);

      const h1 = Math.round((h / 2) - 8);
      ctx.drawImage(t1, 0, 0, w, h1);
      ctx.drawImage(t2, 0, h1 + 16, w, h1);

      if (showMask) {
        if (maskImg) {
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(maskImg, 0, h1 + 16, w, h1);
          ctx.globalCompositeOperation = 'source-over';
        } else if (isGradientMask) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
          ctx.fillRect(0, h1 + 16, w, h1);
        }
      }

      ctx.fillStyle = 'rgba(5, 6, 12, 0.8)';
      ctx.fillRect(0, 0, w, 30);
      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`SatQuery AI • ${analysis.title}`, 12, 20);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(
        `Δ ${m.changedAreaPct}%  •  Precision ${m.precision}  •  Recall ${m.recall}  •  F1 ${m.f1}  •  IoU ${m.iou}`,
        w - 480,
        20,
      );

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `satquery-${analysis.id.split('-').slice(-4).join('-') || 'analysis'}.png`;
      a.click();
    } catch (e) {
      console.error('PNG export failed', e);
    } finally {
      setDownloading(false);
    }
  };

  const exportReport = () => {
    const report = {
      id: analysis.id,
      title: analysis.title,
      model: analysis.model,
      category: analysis.category,
      date: analysis.date,
      query: analysis.query,
      summary: analysis.summary,
      metrics: m,
      executionTrace: analysis.trace,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `satquery-report-${analysis.id.slice(-8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />

      <div className="glass-card-dark relative flex h-full w-full max-h-[calc(100vh-2rem)] max-w-6xl flex-col overflow-hidden rounded-3xl">
        {/* hidden canvas for export */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                {analysis.category}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">{analysis.model}</span>
              <span className="text-[10px] font-semibold text-slate-500">{analysis.date}</span>
            </div>
            <h2 className="mt-1 text-base font-extrabold tracking-tight text-white sm:text-lg">{analysis.title}</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-400 line-clamp-2">“{analysis.query}”</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-2.5">
          <button
            type="button"
            onClick={() => setMode('sidebyside')}
            className={[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
              mode === 'sidebyside' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:bg-white/10',
            ].join(' ')}
          >
            <Columns2 className="h-3.5 w-3.5" /> Side by Side
          </button>
          <button
            type="button"
            onClick={() => setMode('swipe')}
            className={[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
              mode === 'swipe' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:bg-white/10',
            ].join(' ')}
          >
            <MoveHorizontal className="h-3.5 w-3.5" /> Swipe Slider
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMask((v) => !v)}
              className={[
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                showMask ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:bg-white/10',
              ].join(' ')}
            >
              {showMask ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              Change Mask
            </button>
            <button
              type="button"
              onClick={exportPng}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" /> {downloading ? 'Exporting…' : 'Export PNG'}
            </button>
            <button
              type="button"
              onClick={exportReport}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-white/20"
            >
              <Database className="h-3.5 w-3.5" /> Report
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto sq-scroll-slim px-5 py-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            {mode === 'sidebyside' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <figure className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
                  <img src={analysis.t1Image} alt="T1 baseline" className="aspect-[16/10] w-full object-cover" />
                  <figcaption className="glass-pill absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[10px] font-bold text-slate-800">
                    T1 Baseline
                  </figcaption>
                </figure>
                <figure className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
                  <img src={analysis.t2Image} alt="T2 observation" className="aspect-[16/10] w-full object-cover" />
                  {showMask && <MaskLayer mask={analysis.changeMask} className="aspect-[16/10]" />}
                  <figcaption className="glass-pill absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[10px] font-bold text-slate-800">
                    T2 Observation
                  </figcaption>
                </figure>
              </div>
            ) : (
              <SwipeCompare t1={analysis.t1Image} t2={analysis.t2Image} className="w-full" />
            )}

            {/* Benchmarks */}
            <div className="mt-4">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-400">Benchmark metrics</h4>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Precision', value: m.precision.toFixed(1), tint: 'text-emerald-300' },
                  { label: 'Recall', value: m.recall.toFixed(1), tint: 'text-sky-300' },
                  { label: 'F1-Score', value: m.f1.toFixed(1), tint: 'text-indigo-300' },
                  { label: 'IoU Score', value: m.iou.toFixed(1), tint: 'text-amber-300' },
                ].map((s) => (
                  <div key={s.label} className="glass-card-dark-pill rounded-2xl px-3 py-2.5 text-center">
                    <p className={`text-lg font-extrabold ${s.tint}`}>{s.value}%</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-sky-400" /> {m.changedAreaKm2.toFixed(2)} km² changed
                </span>
                <span className="flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-emerald-400" /> {m.changedAreaPct.toFixed(1)}% of AOI
                </span>
                <span className="ml-auto text-[10px] text-slate-500">{analysis.summary}</span>
              </div>
            </div>
          </div>

          {/* Execution trace */}
          <aside className="w-full shrink-0 lg:w-72">
            <div className="glass-card-dark-pill rounded-2xl p-4">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-400">Execution audit trace</h4>
              <ol className="mt-3 space-y-3">
                {analysis.trace.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <div>
                      <p className="text-xs font-semibold leading-snug text-slate-200">{step}</p>
                      <p className="text-[10px] font-medium text-slate-500">step {i + 1} — verified</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-3 text-[10px] font-semibold text-slate-500">
          <span>Evidence rendered by SatQuery Change Engine</span>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-slate-400 transition-colors hover:bg-white/10">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;