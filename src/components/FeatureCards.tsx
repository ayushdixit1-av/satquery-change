import React from 'react';
import {
  ImagePlus,
  MessageCircleQuestion,
  Layers3,
  BadgeCheck,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';

export interface FeatureCardsProps {
  onAction: (action: string) => void;
}

interface FeatureCard {
  icon: LucideIcon;
  title: string;
  desc: string;
  action: string;
  tint: string;
  ring: string;
}

const CARDS: FeatureCard[] = [
  {
    icon: ImagePlus,
    title: 'Upload Images',
    desc: 'Drop a T1 baseline and T2 observation pair — preview chips, file sizes and instant fit checks.',
    action: 'chat-upload',
    tint: 'bg-sky-100 text-sky-700',
    ring: 'group-hover:ring-sky-400/40',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Ask in Natural Language',
    desc: '"Show me what changed near the dock between June and now." No prompts, no parameters.',
    action: 'chat-ask',
    tint: 'bg-indigo-100 text-indigo-700',
    ring: 'group-hover:ring-indigo-400/40',
  },
  {
    icon: Layers3,
    title: 'Multi-Task Analysis',
    desc: 'Change detection, land-cover classification, NDVI health and water extent — one query, each audited.',
    action: 'chat-multi',
    tint: 'bg-emerald-100 text-emerald-700',
    ring: 'group-hover:ring-emerald-400/40',
  },
  {
    icon: BadgeCheck,
    title: 'Evidence-Based Answers',
    desc: 'Every claim ships with sketched contours, bounding boxes and Precision / Recall / IoU numbers.',
    action: 'chat-evidence',
    tint: 'bg-amber-100 text-amber-700',
    ring: 'group-hover:ring-amber-400/40',
  },
];

const FeatureCards: React.FC<FeatureCardsProps> = ({ onAction }) => (
  <section className="px-4 pt-10 lg:px-6">
    <div className="mb-4 flex items-end justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-400">Capabilities</p>
        <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-100">
          Four ways to interrogate the surface of the Earth
        </h3>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.title}
            type="button"
            onClick={() => onAction(card.action)}
            className="group glass-panel flex flex-col rounded-3xl p-5 text-left transition-all duration-300 ring-2 ring-transparent hover:-translate-y-1 hover:shadow-xl"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.tint}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <h4 className="text-sm font-extrabold tracking-tight text-slate-900">{card.title}</h4>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-sky-500" />
            </div>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">{card.desc}</p>
          </button>
        );
      })}
    </div>
  </section>
);

export default FeatureCards;