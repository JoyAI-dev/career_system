'use client';

import { useState, useEffect, useRef } from 'react';

type DimensionInfo = {
  id: string;
  name: string;
};

type Props = {
  dimensions: DimensionInfo[];
};

export function DimensionNav({ dimensions }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dimensions.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the most visible entry that is intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id.replace('dimension-', ''));
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const dim of dimensions) {
      const el = document.getElementById(`dimension-${dim.id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [dimensions]);

  // Auto-scroll the active pill into view on mobile
  useEffect(() => {
    if (activeBtnRef.current && navRef.current) {
      activeBtnRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeId]);

  if (dimensions.length <= 1) return null;

  function scrollToDimension(id: string) {
    const el = document.getElementById(`dimension-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div
      ref={navRef}
      className="sticky top-14 z-20 -mx-4 flex gap-1 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur-sm md:top-16"
    >
      {dimensions.map((dim) => {
        const isActive = activeId === dim.id;
        return (
          <button
            key={dim.id}
            ref={isActive ? activeBtnRef : null}
            onClick={() => scrollToDimension(dim.id)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {dim.name}
          </button>
        );
      })}
    </div>
  );
}
