import React, { useRef, useEffect, useState } from 'react';
import './GooeyNav.css';

export interface GooeyNavItem {
  id?: string;
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  isProfile?: boolean;
  hasDividerBefore?: boolean;
  isDivider?: boolean;
  badge?: string;
  user?: {
    name: string;
    email: string;
    initials: string;
  };
  onClick?: () => void;
}

export interface GooeyNavProps {
  items: GooeyNavItem[];
  animationTime?: number;
  particleCount?: number;
  particleDistances?: [number, number];
  particleR?: number;
  timeVariance?: number;
  colors?: number[];
  initialActiveIndex?: number;
  activeIndex?: number;
  onSelect?: (id: string, index: number) => void;
  vertical?: boolean;
  className?: string;
}

export const GooeyNav: React.FC<GooeyNavProps> = ({
  items,
  animationTime = 600,
  particleCount = 15,
  particleDistances = [90, 10],
  particleR = 100,
  timeVariance = 300,
  colors = [1, 2, 3, 1, 2, 3, 1, 4],
  initialActiveIndex = 0,
  activeIndex: controlledActiveIndex,
  onSelect,
  vertical = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLUListElement | null>(null);
  const filterRef = useRef<HTMLSpanElement | null>(null);
  const [internalActiveIndex, setInternalActiveIndex] = useState<number>(initialActiveIndex);

  const activeIndex = controlledActiveIndex !== undefined ? controlledActiveIndex : internalActiveIndex;

  const noise = (n = 1) => n / 2 - Math.random() * n;

  const getXY = (distance: number, pointIndex: number, totalPoints: number): [number, number] => {
    const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
    return [distance * Math.cos(angle), distance * Math.sin(angle)];
  };

  const createParticle = (i: number, t: number, d: [number, number] | number[], r: number) => {
    const rotate = noise(r / 10);
    const d0 = d[0] ?? 90;
    const d1 = d[1] ?? 10;
    return {
      start: getXY(d0, particleCount - i, particleCount),
      end: getXY(d1 + noise(7), particleCount - i, particleCount),
      time: t,
      scale: 1 + noise(0.2),
      color: colors[Math.floor(Math.random() * colors.length)],
      rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10,
    };
  };

  const makeParticles = (element: HTMLElement) => {
    const d = particleDistances;
    const r = particleR;
    const bubbleTime = animationTime + timeVariance;
    element.style.setProperty('--time', `${bubbleTime}ms`);

    for (let i = 0; i < particleCount; i++) {
      const t = animationTime + noise(timeVariance);
      const p = createParticle(i, t, d, r);
      element.classList.remove('active');

      setTimeout(() => {
        const particle = document.createElement('span');
        const point = document.createElement('span');
        particle.classList.add('particle');
        particle.style.setProperty('--start-x', `${p.start[0]}px`);
        particle.style.setProperty('--start-y', `${p.start[1]}px`);
        particle.style.setProperty('--end-x', `${p.end[0]}px`);
        particle.style.setProperty('--end-y', `${p.end[1]}px`);
        particle.style.setProperty('--time', `${p.time}ms`);
        particle.style.setProperty('--scale', `${p.scale}`);
        particle.style.setProperty('--color', `var(--color-${p.color}, #38bdf8)`);
        particle.style.setProperty('--rotate', `${p.rotate}deg`);

        point.classList.add('point');
        particle.appendChild(point);
        element.appendChild(particle);
        requestAnimationFrame(() => {
          element.classList.add('active');
        });
        setTimeout(() => {
          try {
            if (element.contains(particle)) {
              element.removeChild(particle);
            }
          } catch {
            // Do nothing
          }
        }, t);
      }, 20);
    }
  };

  const updateEffectPosition = (element: HTMLElement) => {
    if (!containerRef.current || !filterRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const pos = element.getBoundingClientRect();

    const styles = {
      left: `${pos.x - containerRect.x}px`,
      top: `${pos.y - containerRect.y}px`,
      width: `${pos.width}px`,
      height: `${pos.height}px`,
    };
    Object.assign(filterRef.current.style, styles);
  };

  const triggerGooeyEffect = (element: HTMLElement, _index: number) => {
    updateEffectPosition(element);

    if (filterRef.current) {
      const particles = filterRef.current.querySelectorAll('.particle');
      particles.forEach((p) => {
        if (filterRef.current?.contains(p)) {
          filterRef.current.removeChild(p);
        }
      });

      makeParticles(filterRef.current);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLElement>, index: number) => {
    e.preventDefault();
    const liEl = (e.currentTarget.closest('li') as HTMLElement) || (e.currentTarget as HTMLElement);
    const item = items[index];

    if (controlledActiveIndex === undefined) {
      setInternalActiveIndex(index);
    }

    triggerGooeyEffect(liEl, index);

    if (item?.onClick) {
      item.onClick();
    }
    if (onSelect && item?.id) {
      onSelect(item.id, index);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const liEl = (e.currentTarget.closest('li') as HTMLElement) || (e.currentTarget as HTMLElement);
      if (liEl) {
        handleClick(e as unknown as React.MouseEvent<HTMLElement>, index);
      }
    }
  };

  useEffect(() => {
    if (!navRef.current || !containerRef.current) return;
    const listItems = navRef.current.querySelectorAll('li[data-nav-item="true"]');
    const activeLi = listItems[activeIndex] as HTMLElement | undefined;
    if (activeLi) {
      updateEffectPosition(activeLi);
    }

    const resizeObserver = new ResizeObserver(() => {
      const currentItems = navRef.current?.querySelectorAll('li[data-nav-item="true"]');
      const currentActiveLi = currentItems ? (currentItems[activeIndex] as HTMLElement) : null;
      if (currentActiveLi) {
        updateEffectPosition(currentActiveLi);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [activeIndex]);

  return (
    <div
      className={`gooey-nav-container ${vertical ? 'vertical' : ''} ${className}`}
      ref={containerRef}
    >
      {/* SVG Liquid Gooey Filter */}
      <svg
        className="absolute w-0 h-0 pointer-events-none opacity-0"
        aria-hidden="true"
      >
        <defs>
          <filter id="gooey-nav-filter" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -6"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Gooey Liquid Particle Effect Layer - rendered behind nav items */}
      <span className="effect filter" ref={filterRef} />

      <nav className="relative z-10 w-full flex-1 flex flex-col">
        <ul ref={navRef} className="flex flex-col w-full h-full space-y-0.5">
          {items.map((item, index) => {
            const isActive = activeIndex === index;
            const Icon = item.icon;

            return (
              <React.Fragment key={item.id || index}>
                {item.hasDividerBefore && (
                  <li
                    className="!p-0 !m-0 !bg-transparent !shadow-none !border-none pointer-events-none cursor-default my-1.5 list-none"
                    aria-hidden="true"
                  >
                    <div className="border-t border-slate-200/70 mx-1" />
                  </li>
                )}
                {item.isProfile && item.user ? (
                  <li
                    data-nav-item="true"
                    id={item.id ? `nav-${item.id}` : undefined}
                    className="mt-auto pt-2 list-none"
                  >
                    <button
                      type="button"
                      onClick={(e) => handleClick(e, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className={`relative z-10 flex items-center justify-between w-full !p-2.5 rounded-2xl cursor-pointer transition-all duration-150 ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 border border-slate-800'
                          : 'bg-white/60 hover:bg-white/90 text-slate-800 border border-slate-200/60 shadow-xs'
                      }`}
                      aria-label={`Profile: ${item.user.name}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs tracking-wider shrink-0 transition-colors shadow-xs ${
                            isActive
                              ? 'bg-blue-600 text-white ring-2 ring-blue-400/50'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {item.user.initials}
                        </div>
                        <div className="min-w-0 text-left">
                          <p
                            className={`text-xs font-bold truncate transition-colors ${
                              isActive ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {item.user.name}
                          </p>
                          <p
                            className={`text-[10px] truncate transition-colors ${
                              isActive ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {item.user.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 transition-colors ${
                          isActive ? 'text-sky-300' : 'text-slate-400'
                        }`}
                      >
                        →
                      </span>
                    </button>
                  </li>
                ) : (
                  <li
                    data-nav-item="true"
                    id={item.id ? `nav-${item.id}` : undefined}
                    className={`list-none rounded-2xl transition-all duration-150 ${
                      isActive
                        ? 'active bg-slate-900 text-white shadow-md shadow-slate-900/15'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <a
                      href={item.href || '#'}
                      onClick={(e) => handleClick(e, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="relative z-10 flex items-center justify-between w-full px-3.5 py-2.5 rounded-2xl cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {Icon && (
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive ? 'text-sky-400' : 'text-slate-500'
                            }`}
                          />
                        )}
                        <span
                          className={`text-xs font-semibold tracking-tight transition-colors ${
                            isActive ? 'text-white' : 'text-slate-700'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isActive
                              ? 'bg-blue-500/30 text-blue-200'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </a>
                  </li>
                )}
              </React.Fragment>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default GooeyNav;
