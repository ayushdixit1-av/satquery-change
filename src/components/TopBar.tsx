import React, { useEffect, useRef, useState } from 'react';
import { Bell, Command, Menu, Search, ArrowUpWideNarrow } from 'lucide-react';
import { SatQueryLogo } from './SatQueryLogo';
import { USER } from './Sidebar';

export interface TopBarProps {
  onOpenMenu: () => void;
  onQuerySubmit: (query: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onOpenMenu, onQuerySubmit, onNewChat, onOpenSettings }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (ev?: React.FormEvent) => {
    ev?.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    onQuerySubmit(trimmed);
    setQ('');
    inputRef.current?.blur();
  };

  return (
    <header className="sticky top-0 z-20 px-4 pt-2 lg:px-6 lg:pt-2.5">
      <div className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-2">
        {/* Mobile menu + brand */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="rounded-xl p-2 text-slate-600 hover:bg-white/80 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 lg:hidden">
          <SatQueryLogo className="h-8 w-8" />
          <span className="text-sm font-extrabold tracking-tight text-slate-900">
            SatQuery <span className="text-sky-600">AI</span>
          </span>
        </div>

        {/* Command palette search */}
        <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-2">
          <div className="glass-input flex w-full max-w-xl items-center gap-2 rounded-xl px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask satellite about any place, time or change…  (Ctrl+K)"
              className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none"
              aria-label="Command palette search"
            />
            <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-slate-300 bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 md:flex">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>
          <button
            type="submit"
            className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-slate-900/20 transition-colors hover:bg-slate-800 md:flex"
          >
            <ArrowUpWideNarrow className="h-3.5 w-3.5" /> Ask
          </button>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Notifications */}
          <button
            type="button"
            className="glass-pill relative rounded-xl p-2 text-slate-600 transition-colors hover:text-slate-900"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          {/* Profile */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="glass-pill flex items-center gap-2 rounded-xl py-1 pl-1 pr-2.5 transition-colors hover:text-slate-900"
            aria-label="Account"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-white">
              {USER.initials}
            </span>
            <span className="hidden text-xs font-bold text-slate-700 md:block">{USER.name.split(' ')[0]}</span>
          </button>

          <button
            type="button"
            onClick={onNewChat}
            className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-sky-500/30 transition-colors hover:bg-sky-400 sm:flex"
          >
            New Chat
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;