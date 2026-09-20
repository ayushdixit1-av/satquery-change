import React from 'react';
import { ArrowRight, Binary, Layers } from 'lucide-react';

export interface PromoBannerProps {
  onAction: () => void;
}

const PromoBanner: React.FC<PromoBannerProps> = ({ onAction }) => (
  <section className="px-4 pt-10 lg:px-6">
    <div className="glass-card-dark relative overflow-hidden rounded-3xl p-5 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_260px_at_85%_-50%,rgba(56,189,248,0.25),transparent)]" />

      <div className="relative flex flex-wrap items-center gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 ring-1 ring-sky-400/40">
          <Binary className="h-6 w-6 text-sky-300" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-400">Multi-temporal engine</p>
            <span className="hidden items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 sm:flex">
              <Layers className="h-3 w-3" /> T1 ↔ T2
            </span>
          </div>
          <h3 className="mt-1 text-base font-extrabold tracking-tight text-white sm:text-lg">
            Compare two dates. See exactly what changed — in kilometres and confidence scores.
          </h3>
          <p className="mt-1 max-w-2xl text-xs font-medium text-slate-400">
            Align, infer, explain. The Siamese change detector isolates pixel-level delta while an Otsu threshold keeps
            the story readable — coastline, crop, water or concrete.
          </p>
        </div>

        <button
          type="button"
          onClick={onAction}
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 shadow-lg transition-all hover:-translate-y-0.5"
        >
          Try a pair today <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </section>
);

export default PromoBanner;