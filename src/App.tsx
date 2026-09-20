import React, { useEffect, useMemo, useState } from 'react';
import { Home, MessageSquareText, Settings2, LifeBuoy } from 'lucide-react';
import Sidebar, { USER, type NavItem } from './components/Sidebar';
import TopBar from './components/TopBar';
import HeroSection from './components/HeroSection';
import FeatureCards from './components/FeatureCards';
import QueryInputCard from './components/QueryInputCard';
import RecentAnalyses from './components/RecentAnalyses';
import PromoBanner from './components/PromoBanner';
import AnalysisModal from './components/AnalysisModal';
import ChatView from './components/ChatView';
import SettingsView from './components/SettingsView';
import { SAMPLE_ANALYSES } from './data/mockData';
import { DEFAULT_SETTINGS, type AnalysisItem, type AppView, type SatQuerySettings } from './types';

const LEGACY_STORAGE_KEYS = ['satquery.analyses', 'satquery.settings'];

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'chat', label: 'Ask Satellite', icon: MessageSquareText },
  { id: 'settings', label: 'Settings & Model', icon: Settings2 },
  { id: 'help', label: 'Help & Support', icon: LifeBuoy },
];

function CosmicBackdrop() {
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        key: i,
        left: `${(i * 13.7) % 100}%`,
        top: `${(i * 29.3) % 100}%`,
        size: 1 + ((i * 7) % 3),
        delay: `${(i % 12) * 0.7}s`,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-0" aria-hidden="true">
      <div className="absolute inset-0 bg-[#04060c]" />
      <div className="absolute -left-40 top-[-20%] h-[38rem] w-[38rem] rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute right-[-12%] top-[30%] h-[30rem] w-[30rem] rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="absolute bottom-[-18%] left-[30%] h-[28rem] w-[28rem] rounded-full bg-teal-500/8 blur-3xl" />
      {stars.map((s) => (
        <span
          key={s.key}
          className="sq-star absolute rounded-full bg-white/80"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatKey, setChatKey] = useState(1);
  const [seedQuery, setSeedQuery] = useState('');
  const [seedMode, setSeedMode] = useState<'single' | 'pair'>('pair');
  const [modal, setModal] = useState<AnalysisItem | null>(null);
  const [settings, setSettings] = useState<SatQuerySettings>(DEFAULT_SETTINGS);
  const [analyses, setAnalyses] = useState<AnalysisItem[]>(SAMPLE_ANALYSES);

  useEffect(() => {
    LEGACY_STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    });
  }, []);

  const go = (id: string) => {
    setView(id as AppView);
    setMobileOpen(false);
  };

  const startChat = (query = '', mode: 'single' | 'pair' = 'pair') => {
    setSeedQuery(query);
    setSeedMode(mode);
    setChatKey((k) => k + 1);
    setView('chat');
    setMobileOpen(false);
  };

  const addRecent = (item: AnalysisItem) => {
    setAnalyses((prev) => {
      const next = prev.filter((a) => a.id !== item.id);
      next.unshift(item);
      return next.slice(0, 24);
    });
  };

  const updateSettings = (patch: Partial<SatQuerySettings>) => setSettings((s) => ({ ...s, ...patch }));

  const handleFeature = (action: string) => {
    const map: Record<string, string> = {
      'chat-scene': 'Describe this scene in full — land cover, vegetation health, water and structure.',
      'chat-upload': 'Diff this T1/T2 pair — box every zone where anything changed.',
      'chat-ask': 'Show me what changed near the dock between June and now.',
      'chat-multi': 'Run a full multi-task scan: land cover, NDVI health and water extent over this AOI.',
      'chat-evidence': 'Give me an evidence-based answer with precision and recall on this imagery pair.',
    };
    startChat(map[action] ?? '', action === 'chat-scene' ? 'single' : 'pair');
  };

  return (
    <div className="min-h-dvh bg-[#04060c] font-sans text-slate-900 antialiased">
      <CosmicBackdrop />

      <div className="relative z-10 flex min-h-dvh">
        <Sidebar
          items={NAV_ITEMS}
          activeId={view === 'profile' ? 'profile' : view}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onSelect={go}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onMobileClose={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            onOpenMenu={() => setMobileOpen(true)}
            onQuerySubmit={(q) => startChat(q)}
            onNewChat={() => startChat('')}
            onOpenSettings={() => go('settings')}
          />

          <main className="flex-1 pb-16">
            {view === 'home' && (
              <>
                <HeroSection onStart={() => startChat('')} />
                <FeatureCards onAction={handleFeature} />
                <QueryInputCard
                  onQuery={(q) => startChat(q)}
                  onAttachImages={() => startChat('I uploaded a T1/T2 pair — measure everything that changed.')}
                />
                <RecentAnalyses items={analyses} onInspect={setModal} onNewChat={() => startChat('')} />
                <PromoBanner onAction={() => startChat('Compare a before/after satellite pair and show me the delta.')} />
              </>
            )}

            {view === 'chat' && (
              <ChatView
                key={chatKey}
                settings={settings}
                onInspect={setModal}
                onAddRecent={addRecent}
                initialQuery={seedQuery}
                initialMode={seedMode}
              />
            )}

            {view === 'settings' && <SettingsView settings={settings} onChange={updateSettings} />}

            {view === 'help' && (
              <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 lg:px-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-400">Help</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-100">Getting started</h2>
                <div className="glass-panel mt-6 space-y-5 rounded-3xl p-6">
                  {[
                    {
                      step: '1',
                      title: 'Attach a T1 / T2 pair',
                      body: 'In Ask Satellite, attach a baseline image and an observation image. Both render as chips with file size before you send.',
                    },
                    {
                      step: '2',
                      title: 'Ask in plain language',
                      body: 'Type things like “how much shoreline disappeared?” or “highlight new construction”. No band math or windowing required.',
                    },
                    {
                      step: '3',
                      title: 'Read the evidence',
                      body: 'Every answer ships with a swipeable before/after, neon change contours, and Precision / Recall / F1 / IoU scores you can export as PNG or JSON.',
                    },
                    {
                      step: '4',
                      title: 'Go live (optional)',
                      body: 'Point Settings → Model backend at your FastAPI/Flask inference server serving /health and /analyze to replace the on-device engine.',
                    },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sm font-extrabold text-sky-600">
                        {s.step}
                      </span>
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">{s.title}</p>
                        <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">{s.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === 'profile' && (
              <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 lg:px-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-400">Account</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-100">Profile</h2>
                <div className="glass-panel mt-6 rounded-3xl p-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-xl font-extrabold text-white">
                      {USER.initials}
                    </span>
                    <div>
                      <p className="text-lg font-extrabold text-slate-900">{USER.name}</p>
                      <p className="text-xs font-semibold text-slate-500">{USER.email}</p>
                      <p className="mt-1 inline-flex rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold text-sky-700">
                        On-device analyst · no cloud round-trips · no stored scans
                      </p>
                    </div>
                  </div>
                  <div className="sq-hairline mt-5 border-t" />
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['42', 'Analyses run'],
                      ['4', 'Constellations'],
                      ['ONNX', 'Engine runtime'],
                      ['0', 'Data sent off-device'],
                    ].map(([v, l]) => (
                      <div key={l} className="glass-card-dark-pill rounded-2xl px-3 py-3 text-center">
                        <p className="text-base font-extrabold text-sky-300">{v}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {modal && <AnalysisModal analysis={modal} onClose={() => setModal(null)} />}
    </div>
  );
};

export default App;