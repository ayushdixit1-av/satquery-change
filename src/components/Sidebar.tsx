import React, { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from 'lucide-react';
import GooeyNav, { type GooeyNavItem } from './GooeyNav';
import { SatQueryLogo } from './SatQueryLogo';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export interface SidebarProps {
  items: NavItem[];
  activeId: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onSelect: (id: string) => void;
  onToggleCollapse: () => void;
  onMobileClose: () => void;
}

export const USER = {
  name: 'Ayush Dixit',
  email: 'ayushdixit@satquery.ai',
  initials: 'AD',
};

const Sidebar: React.FC<SidebarProps> = ({
  items,
  activeId,
  collapsed,
  mobileOpen,
  onSelect,
  onToggleCollapse,
  onMobileClose,
}) => {
  const [width, setWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1280);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = width < 1024;

  const activeIdx = Math.max(
    0,
    items.findIndex((i) => i.id === activeId),
  );

  const gooeyItems: GooeyNavItem[] = items.map((item, idx): GooeyNavItem => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    badge: item.badge,
    hasDividerBefore: idx === 5,
    onClick: isMobile ? onMobileClose : undefined,
  }));

  const activeNavId = activeId === 'profile' ? 'profile' : activeId;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ease-out',
          'lg:static lg:translate-x-0 lg:transition-[width,padding]',
          collapsed ? 'lg:w-[84px]' : 'lg:w-[264px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
      >
        <div
          className={[
            'glass-panel m-3 flex h-[calc(100%-24px)] flex-col overflow-hidden rounded-3xl',
            collapsed ? 'p-2.5' : 'p-4',
          ].join(' ')}
        >
          {/* Brand */}
          <div className={['flex items-center gap-3 px-1 py-1', collapsed ? 'flex-col gap-2' : ''].join(' ')}>
            <div className="earth-glow shrink-0 rounded-full">
              <SatQueryLogo className={collapsed ? 'h-8 w-8' : 'h-10 w-10'} />
            </div>
            {!collapsed && (
              <div className="min-w-0 brand-name">
                <p className="text-sm font-extrabold tracking-tight text-slate-900 truncate">
                  SatQuery <span className="text-sky-600">AI</span>
                </p>
                <p className="text-[10px] font-medium text-slate-500 truncate">
                  Geospatial Intelligence
                </p>
              </div>
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className={[
                  'flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-900',
                  collapsed ? 'mx-auto w-full justify-center' : '',
                ].join(' ')}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : (
                  <>
                    <PanelLeftClose className="h-4 w-4" />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            )}
            {isMobile && (
              <button
                type="button"
                onClick={onMobileClose}
                className="ml-auto rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="sq-hairline my-3 border-t" />

          {/* Gooey navigation */}
          <div className={['flex-1 overflow-y-auto sq-scroll-slim', collapsed ? 'sq-rail' : ''].join(' ')}>
            <div className="h-full">
              <GooeyNav
                items={gooeyItems}
                activeIndex={items.findIndex((i) => i.id === activeNavId) >= 0 ? items.findIndex((i) => i.id === activeNavId) : activeIdx}
                onSelect={(id) => {
                  if (id === 'profile') {
                    onSelect('profile');
                  } else {
                    onSelect(id);
                  }
                }}
                vertical
                initialActiveIndex={activeIdx}
              />
            </div>
          </div>

          {/* Profile pinned to the lower side */}
          <button
            type="button"
            onClick={() => {
              if (isMobile) onMobileClose();
              onSelect('profile');
            }}
            className={[
              'relative z-10 mt-3 flex w-full items-center rounded-2xl p-2.5 transition-all duration-150',
              activeNavId === 'profile'
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 border border-slate-800'
                : 'bg-white/60 hover:bg-white/90 text-slate-800 border border-slate-200/60 shadow-xs',
              collapsed ? 'justify-center' : 'justify-between',
            ].join(' ')}
            aria-label={`Profile: ${USER.name}`}
          >
            <div className={['flex min-w-0 items-center', collapsed ? '' : 'gap-2.5']}>
              <div
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tracking-wider shadow-xs',
                  activeNavId === 'profile'
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400/50'
                    : 'bg-slate-900 text-white',
                ].join(' ')}
              >
                {USER.initials}
              </div>
              {!collapsed && (
                <div className="min-w-0 text-left">
                  <p className="truncate text-xs font-bold">{USER.name}</p>
                  <p className="truncate text-[10px] text-slate-500">{USER.email}</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <span className={['shrink-0 text-xs font-semibold', activeNavId === 'profile' ? 'text-sky-300' : 'text-slate-400']}>
                →
              </span>
            )}
          </button>

          {!isMobile && (
            <p className={['mt-3 text-center text-[9px] font-medium tracking-widest text-slate-400 uppercase', collapsed ? 'hidden' : ''].join(' ')}>
              v2.1 · On-device engine
            </p>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;