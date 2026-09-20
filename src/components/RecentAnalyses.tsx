import React, { useMemo, useState } from 'react';
import { Clock, FolderSearch, Plus, ScanEye } from 'lucide-react';
import type { AnalysisItem, AnalysisCategory } from '../types';

export interface RecentAnalysesProps {
  items: AnalysisItem[];
  onInspect: (item: AnalysisItem) => void;
  onNewChat: () => void;
}

const CATEGORIES: (AnalysisCategory | 'All')[] = ['All', 'Coastal', 'Agriculture', 'Environment', 'Urban'];

const RecentAnalyses: React.FC<RecentAnalysesProps> = ({ items, onInspect, onNewChat }) => {
  const [filter, setFilter] = useState<AnalysisCategory | 'All'>('All');

  const visible = useMemo(
    () => (filter === 'All' ? items : items.filter((i) => i.category === filter)),
    [items, filter],
  );

  return (
    <section className="px-4 pt-10 lg:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-400">Analyses</p>
          <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-100">Recent analyses</h3>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-slate-900/20 transition-colors hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" /> New Analysis
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const count = cat === 'All' ? items.length : items.filter((i) => i.category === cat).length;
          const active = filter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={[
                'rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all',
                active
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                  : 'glass-pill text-slate-700 hover:bg-white',
              ].join(' ')}
            >
              {cat} <span className={active ? 'text-sky-200' : 'text-slate-400'}>({count})</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="glass-panel flex flex-col items-center rounded-3xl px-6 py-14 text-center">
          <FolderSearch className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-700">No analyses here yet</p>
          <p className="mt-1 max-w-sm text-xs font-medium text-slate-500">
            Run a query or attach a T1/T2 pair in chat and your evidence-backed results will show up in this grid.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <article
              key={item.id}
              className="group glass-panel flex flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                <span
                  className={[
                    'absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                    item.category === 'Coastal' && 'bg-sky-100 text-sky-700',
                    item.category === 'Agriculture' && 'bg-emerald-100 text-emerald-700',
                    item.category === 'Environment' && 'bg-teal-100 text-teal-700',
                    item.category === 'Urban' && 'bg-stone-200 text-stone-700',
                  ].join(' ')}
                >
                  {item.category}
                </span>
                <span className="absolute bottom-2 left-3 flex items-center gap-1 text-[10px] font-bold text-white/90">
                  <Clock className="h-3 w-3" /> {item.date}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h4 className="text-sm font-extrabold leading-snug tracking-tight text-slate-900 line-clamp-2">
                  {item.title}
                </h4>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                  <span className="text-emerald-600 font-bold">Δ {item.metrics.changedAreaPct}%</span>
                  <span>{item.metrics.changedAreaKm2.toFixed(1)} km²</span>
                  <span>IoU {item.metrics.iou.toFixed(1)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onInspect(item)}
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2 text-[11px] font-bold text-white transition-colors hover:bg-slate-800"
                >
                  <ScanEye className="h-3.5 w-3.5" /> Inspect comparison
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default RecentAnalyses;