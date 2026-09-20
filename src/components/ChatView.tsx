import React, { useRef, useState } from 'react';
import {
  Bot,
  Eraser,
  FileImage,
  Images,
  ScanLine,
  Send,
  Sparkles,
  ScanEye,
  Loader2,
  X,
  Satellite,
} from 'lucide-react';
import type { AnalysisItem, ChatMessage, ChatMode, SatQuerySettings } from '../types';
import { CAPABILITY_TAGS, createAnalysisFromQuery } from '../data/mockData';
import { generateSketchedEvidence, describeChanges } from '../utils/imageSketch';
import { analyzeScene } from '../utils/sceneAnalysis';
import { boostScene, boostChange, shouldBoost } from '../lib/gemini';
import SwipeCompare from './SwipeCompare';
import SceneResultCard from './SceneResultCard';
import ChangeEvidenceView from './ChangeEvidenceView';

export interface ChatViewProps {
  settings: SatQuerySettings;
  onInspect: (item: AnalysisItem) => void;
  onAddRecent: (item: AnalysisItem) => void;
  initialQuery?: string;
  initialMode?: ChatMode;
  initialT1?: AttachFile;
  initialT2?: AttachFile;
}

interface AttachFile {
  url: string;
  name: string;
  size: string;
}

function readFile(file: File): Promise<AttachFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        url: String(reader.result),
        name: file.name,
        size: formatBytes(file.size),
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const uid = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ChatView: React.FC<ChatViewProps> = ({ settings, onInspect, onAddRecent, initialQuery, initialMode, initialT1, initialT2 }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialQuery ?? '');
  const [mode, setMode] = useState<ChatMode>(initialMode ?? 'pair');
  const [t1, setT1] = useState<AttachFile | null>(initialT1 ?? null);
  const [t2, setT2] = useState<AttachFile | null>(initialT2 ?? null);
  const [thinking, setThinking] = useState(false);
  const [analyzingScene, setAnalyzingScene] = useState(false);
  const [dragging, setDragging] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const attach = async (slot: 't1' | 't2', file?: File | null) => {
    if (!file) return;
    const f = await readFile(file);
    if (slot === 't1') setT1(f);
    else setT2(f);
  };

  const reset = () => {
    setMessages([]);
    setT1(null);
    setT2(null);
    setInput('');
  };

  const switchMode = (m: ChatMode) => {
    setMode(m);
    if (m === 'single') setT2(null);
  };

  const handleDropFiles = (files: FileList) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    if (imgs.length >= 2 && mode === 'single') setMode('pair');
    void readFile(imgs[0]).then((f) => setT1(f));
    if (imgs[1]) void readFile(imgs[1]).then((f) => setT2(f));
  };

  const dragDepth = useRef(0);
  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    handleDropFiles(e.dataTransfer.files);
  };

  const run = async (rawQuery?: string, forceMode?: ChatMode) => {
    const query = (rawQuery ?? input).trim();
    if (!query || thinking) return;
    const activeMode = forceMode ?? mode;

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      attachments:
        activeMode === 'single'
          ? t1
            ? { t1Url: t1.url, t1Name: t1.name }
            : undefined
          : t1 || t2
            ? { t1Url: t1?.url, t2Url: t2?.url, t1Name: t1?.name, t2Name: t2?.name }
            : undefined,
    };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);
    scrollToBottom();

    const t1f = t1;
    const t2f = t2;

    const pushHint = (hint: string) => {
      setMessages((m) => [
        ...m,
        { id: uid(), role: 'assistant', content: hint, timestamp: new Date().toISOString() },
      ]);
    };

    try {
      if (activeMode === 'single') {
        if (!t1f) {
          pushHint('Attach one image first — use the Image button above, then ask again.');
          return;
        }
        setAnalyzingScene(true);
        const scene = await analyzeScene(t1f.url, t1f.name);
        let content = scene.description;
        let boosted = false;
        if (shouldBoost(query, settings.geminiMode)) {
          const b = await boostScene(settings, scene, query);
          if (b.ok && b.text) {
            content = b.text;
            boosted = true;
          }
        }
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: 'assistant',
            content,
            timestamp: new Date().toISOString(),
            scene,
            boost: boosted,
            attachments: { t1Url: t1f.url, t1Name: t1f.name },
          },
        ]);
        return;
      }

      if (!t1f || !t2f) {
        pushHint('Attach both images (T1 baseline and T2 observation), then ask again.');
        return;
      }

      const analysis = createAnalysisFromQuery(query, {
        t1Url: t1f.url,
        t2Url: t2f.url,
        customTitle: query,
        category: 'Environment',
      });
      let backendProvidedMetrics = false;
      // 1) Live PyTorch model endpoint (optional)
      if (settings.apiMode === 'live' && settings.apiUrl.trim()) {
        try {
          const res = await fetch(`${settings.apiUrl.replace(/\/$/, '')}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, t1: t1f.url, t2: t2f.url }),
          });
          if (res.ok) {
            const data = (await res.json()) as Partial<AnalysisItem> & {
              metrics?: AnalysisItem['metrics'];
              evidenceUrl?: string;
            };
            if (data.metrics) {
              analysis.metrics = { ...analysis.metrics, ...data.metrics };
              backendProvidedMetrics = true;
            }
            if (data.summary) analysis.summary = data.summary;
            if (data.trace?.length) analysis.trace = data.trace;
            if (data.evidenceUrl) {
              analysis.changeMask = data.evidenceUrl;
              analysis.thumbnail = data.evidenceUrl;
            }
            analysis.trace = ['Live model endpoint responded', ...(analysis.trace ?? [])];
          }
        } catch {
          analysis.trace = ['Live endpoint unreachable — fell back to on-device engine', ...(analysis.trace ?? [])];
        }
      }
      // 2) Client-side evidence synthesis: pixel mask + change zone boxes (always)
      const evidence = await generateSketchedEvidence(t1f.url, t2f.url);
      analysis.changeMask = evidence.evidenceUrl;
      analysis.thumbnail = evidence.evidenceUrl;
      analysis.metrics.changedAreaKm2 = evidence.changedKm2;
      analysis.metrics.changedAreaPct = evidence.changedPct;
      if (!backendProvidedMetrics) {
        analysis.metrics.precision = evidence.coverage.precision * 100;
        analysis.metrics.recall = evidence.coverage.recall * 100;
        analysis.metrics.f1 = evidence.coverage.f1 * 100;
        analysis.metrics.iou = evidence.coverage.iou * 100;
      }
      analysis.summary = describeChanges(evidence);
      analysis.trace = [
        'Imagery pair ingested (T1 baseline & T2 observation)',
        'Multi-temporal spatial registration aligned',
        'Pixel-difference mask computed on canvas',
        `${evidence.regionCount} change zone${evidence.regionCount === 1 ? '' : 's'} isolated, boxed and ranked`,
        'Self-evaluated: zone coverage precision/recall/IoU vs the raw change mask',
        `Spatial scale assumed at ${evidence.gsdMeters} m/pixel ground sampling for area estimates`,
        'Boxed evidence + plain-text change summary rendered on T2',
      ];

      // 3) Gemini language boost (optional, gated + cached + capped)
      let boosted = false;
      if (shouldBoost(query, settings.geminiMode)) {
        const b = await boostChange(settings, analysis, evidence.evidenceUrl, query);
        if (b.ok && b.text) {
          analysis.summary = b.text;
          boosted = true;
        }
      }
      if (boosted) analysis.trace = [...analysis.trace, 'Gemini boost: language-only enhancement of measured evidence'];
      onAddRecent(analysis);

      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: 'assistant',
          content:
            analysis.summary +
            '\n\nReady metrics: ' +
            `Precision ${analysis.metrics.precision.toFixed(1)}, ` +
            `Recall ${analysis.metrics.recall.toFixed(1)}, ` +
            `F1 ${analysis.metrics.f1.toFixed(1)}, IoU ${analysis.metrics.iou.toFixed(1)}.`,
          timestamp: new Date().toISOString(),
          analysis,
          boost: boosted,
          attachments: { t1Url: t1f.url, t2Url: t2f.url, t1Name: t1f.name, t2Name: t2f.name },
        },
      ]);
    } catch (e) {
      console.error(e);
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: 'assistant',
          content: 'Something went wrong while analyzing your imagery. Try re-attaching the images and ask again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setThinking(false);
      setAnalyzingScene(false);
      setT1(null);
      setT2(null);
      scrollToBottom();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-150px)] flex-col px-4 pt-4 lg:px-6">
      {/* Chat surface */}
      <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
        {/* Chat header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-slate-900">SatQuery Geospatial Assistant</p>
              <p className="text-[10px] font-semibold text-slate-500">
                {settings.apiMode === 'live' && settings.apiUrl ? 'Live model endpoint' : 'On-device engine'} ·{' '}
                {settings.geminiKey || (settings.apiMode === 'live' && settings.apiUrl) ? 'Gemini boost ready' : 'private & offline'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-white/80"
          >
            <Eraser className="h-3.5 w-3.5" /> New chat
          </button>
        </div>

        {/* Messages */}
        <div ref={listRef} className="sq-scroll-slim flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-xl py-6 text-center">
              <Satellite className="mx-auto h-9 w-9 text-sky-400" />
              <p className="mt-3 text-sm font-extrabold text-slate-800">
                Ask a satellite anything about the surface of the Earth
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Pick a mode below — one image for a full scene read, or two images to measure what changed between them.
              </p>
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200/70">
                <FileImage className="h-3 w-3 text-sky-500" /> Drag &#38; drop images anywhere below, or use the buttons
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={[
                  'max-w-[85%] rounded-3xl px-4 py-3 sm:max-w-[75%]',
                  msg.role === 'user' ? 'bg-slate-900 text-white rounded-br-md' : 'bg-white text-slate-800 rounded-bl-md',
                ].join(' ')}
              >
                {msg.attachments && (msg.attachments.t1Url || msg.attachments.t2Url) && (
                  <div className="mb-2 flex items-center gap-2">
                    {msg.attachments.t1Url && (
                      <span className="flex items-center gap-1.5 rounded-xl bg-white/10 px-2 py-1 text-[10px] font-bold">
                        <FileImage className="h-3 w-3" /> {msg.attachments.t1Name ?? 'T1'}
                      </span>
                    )}
                    {msg.attachments.t2Url && (
                      <span className="flex items-center gap-1.5 rounded-xl bg-white/10 px-2 py-1 text-[10px] font-bold">
                        <FileImage className="h-3 w-3" /> {msg.attachments.t2Name ?? 'T2'}
                      </span>
                    )}
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">{msg.content}</p>
                <p className="mt-1 text-right text-[10px] opacity-50">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>

                {msg.boost && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600">
                    <Sparkles className="h-2.5 w-2.5" /> Gemini boost
                  </span>
                )}

                {msg.scene && <SceneResultCard scene={msg.scene} />}

                {msg.analysis && (
                  <div className="mt-3 rounded-2xl bg-white/70 p-2.5 ring-1 ring-slate-200/80">
                    <ChangeEvidenceView t1={msg.analysis.t1Image} t2={msg.analysis.t2Image} />
                    <SwipeCompare t1={msg.analysis.t1Image} t2={msg.analysis.t2Image} className="mt-2 w-full" />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                        <Sparkles className="h-3 w-3" /> Δ {msg.analysis.metrics.changedAreaPct}% · IoU {msg.analysis.metrics.iou}
                      </p>
                      <button
                        type="button"
                        onClick={() => msg.analysis && onInspect(msg.analysis)}
                        className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-slate-800"
                      >
                        <ScanEye className="h-3 w-3" /> Inspect full result
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-3xl rounded-bl-md bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                <span>
                  {analyzingScene
                    ? 'Reading the scene, classifying land cover, computing indices…'
                    : 'Aligning frames, computing deltas, drawing change boxes…'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div
          className="relative border-t border-slate-200/70 px-4 py-3"
          onDragEnter={handleDragEnter}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) e.preventDefault();
          }}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-sky-500/10 ring-4 ring-sky-400/60">
              <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-5 py-3 shadow-lg">
                <FileImage className="h-5 w-5 text-sky-500" />
                <p className="text-xs font-extrabold text-slate-800">
                  Drop to attach {mode === 'single' ? '1 image' : '2 images'}
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  {mode === 'single' ? '…for a full scene read' : '…for change detection (T1 → T2)'}
                </p>
              </div>
            </div>
          )}
          <div className="mb-2 flex w-fit gap-1 rounded-xl bg-slate-100/80 p-1 ring-1 ring-slate-200/70">
            <button
              type="button"
              onClick={() => switchMode('single')}
              className={[
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                mode === 'single' ? 'bg-white text-sky-600 shadow-sm ring-1 ring-slate-200/80' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <ScanLine className="h-3.5 w-3.5" /> Single image
              <span className="hidden font-semibold text-slate-400 sm:inline">· scene</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('pair')}
              className={[
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                mode === 'pair' ? 'bg-white text-sky-600 shadow-sm ring-1 ring-slate-200/80' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <Images className="h-3.5 w-3.5" /> Two images
              <span className="hidden font-semibold text-slate-400 sm:inline">· change</span>
            </button>
          </div>

          {(t1 || t2) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {t1 && (
                <span className="glass-pill flex items-center gap-2 rounded-xl px-2.5 py-1.5">
                  <img src={t1.url} alt="T1" className="h-8 w-8 rounded-lg object-cover" />
                  <span className="text-[10px] font-bold text-slate-700">
                    T1 · {t1.name}
                    <span className="ml-1 font-semibold text-slate-400">{t1.size}</span>
                  </span>
                  <button type="button" onClick={() => setT1(null)} className="text-slate-400 hover:text-slate-700" aria-label="Remove T1">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              {t2 && (
                <span className="glass-pill flex items-center gap-2 rounded-xl px-2.5 py-1.5">
                  <img src={t2.url} alt="T2" className="h-8 w-8 rounded-lg object-cover" />
                  <span className="text-[10px] font-bold text-slate-700">
                    T2 · {t2.name}
                    <span className="ml-1 font-semibold text-slate-400">{t2.size}</span>
                  </span>
                  <button type="button" onClick={() => setT2(null)} className="text-slate-400 hover:text-slate-700" aria-label="Remove T2">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={reset}
                className="rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-white/70"
              >
                Clear attachments
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            {mode === 'single' ? (
              <label
                className="glass-input flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100/70"
                title="Attach the single image to analyze its scene"
              >
                <FileImage className="h-4 w-4 text-indigo-500" />
                Image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => attach('t1', e.target.files?.[0] ?? null)} />
              </label>
            ) : (
              <>
                <label
                  className="glass-input flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100/70"
                  title="Attach T1 baseline"
                >
                  <FileImage className="h-4 w-4 text-indigo-500" />
                  T1
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => attach('t1', e.target.files?.[0] ?? null)} />
                </label>
                <label
                  className="glass-input flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100/70"
                  title="Attach T2 observation"
                >
                  <FileImage className="h-4 w-4 text-emerald-500" />
                  T2
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => attach('t2', e.target.files?.[0] ?? null)} />
                </label>
              </>
            )}

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  run();
                }
              }}
              placeholder={mode === 'single' ? 'Ask about your image…' : 'Ask what changed between your images…'}
              className="glass-input min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none"
              aria-label="Chat message"
            />
            <button
              type="button"
              onClick={() => run()}
              disabled={thinking || !input.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-500/30 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {CAPABILITY_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  const m: ChatMode = tag === 'Single-Scene Classification' ? 'single' : 'pair';
                  switchMode(m);
                  run(tag, m);
                }}
                disabled={thinking}
                className="rounded-full bg-white/60 px-2.5 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200/70 transition-all hover:bg-white disabled:opacity-40"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;