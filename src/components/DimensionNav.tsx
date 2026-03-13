'use client';

import { useState, useEffect, useCallback } from 'react';

type DimensionInfo = {
  id: string;
  name: string;
};

type SubTopicGroup = {
  id: string;
  name: string;
  dimensions: DimensionInfo[];
  answeredCount: number;
  totalCount: number;
};

type Props = {
  /** Flat dimensions — used when there's only 1 group or no groups */
  dimensions: DimensionInfo[];
  /** SubTopic groups — when provided and length > 1, renders vertical tabs */
  groups?: SubTopicGroup[];
  /** Section progress: answered / total for the current topic */
  sectionAnswered?: number;
  sectionTotal?: number;
};

export function DimensionNav({ dimensions, groups, sectionAnswered = 0, sectionTotal = 0 }: Props) {
  const hasGroups = groups && groups.length > 1;
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [activeDimId, setActiveDimId] = useState<string | null>(null);

  // The dimensions to display: either from active group or flat
  const displayDimensions = hasGroups
    ? groups[activeGroupIdx]?.dimensions ?? []
    : dimensions;

  // Track active dimension via IntersectionObserver
  useEffect(() => {
    const dimsToObserve = hasGroups
      ? groups.flatMap(g => g.dimensions)
      : dimensions;
    if (dimsToObserve.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const dimId = visible[0].target.id.replace('dimension-', '');
          setActiveDimId(dimId);

          // Auto-switch group tab if the scrolled-to dimension belongs to a different group
          if (hasGroups) {
            const groupIdx = groups.findIndex(g =>
              g.dimensions.some(d => d.id === dimId)
            );
            if (groupIdx !== -1 && groupIdx !== activeGroupIdx) {
              setActiveGroupIdx(groupIdx);
            }
          }
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const dim of dimsToObserve) {
      const el = document.getElementById(`dimension-${dim.id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [dimensions, groups, hasGroups, activeGroupIdx]);

  const scrollToDimension = useCallback((id: string) => {
    const el = document.getElementById(`dimension-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Section progress percentage
  const sectionPct = sectionTotal > 0
    ? `${((sectionAnswered / sectionTotal) * 100).toFixed(1)}%`
    : '0.0%';
  const sectionComplete = sectionAnswered === sectionTotal && sectionTotal > 0;

  // Don't render if only 0 or 1 dimension and no groups
  if (!hasGroups && dimensions.length <= 1) {
    // Still show section progress bar if we have data
    if (sectionTotal > 0) {
      return (
        <div className="sticky top-14 z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur-sm md:top-16">
          <SectionProgressBar
            answered={sectionAnswered}
            total={sectionTotal}
            pct={sectionPct}
            complete={sectionComplete}
          />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="sticky top-14 z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur-sm md:top-16">
      {/* Section progress bar */}
      {sectionTotal > 0 && (
        <SectionProgressBar
          answered={sectionAnswered}
          total={sectionTotal}
          pct={sectionPct}
          complete={sectionComplete}
        />
      )}

      {hasGroups ? (
        /* ── Multi-group: vertical tabs on left + dimensions on right ── */
        <div className="mt-2 flex gap-2">
          {/* Vertical group tabs */}
          <div className="flex flex-col gap-0.5 border-r border-border pr-2">
            {groups.map((group, idx) => {
              const isActive = idx === activeGroupIdx;
              const groupPct = group.totalCount > 0
                ? `${((group.answeredCount / group.totalCount) * 100).toFixed(1)}%`
                : '0.0%';
              const groupComplete = group.answeredCount === group.totalCount && group.totalCount > 0;

              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setActiveGroupIdx(idx);
                    // Scroll to first dimension in this group
                    if (group.dimensions.length > 0) {
                      scrollToDimension(group.dimensions[0].id);
                    }
                  }}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{group.name}</span>
                  <span className={`ml-1.5 text-[10px] ${groupComplete ? 'text-green-600' : 'opacity-50'}`}>
                    {groupPct}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dimensions for the active group — wrap layout */}
          <div className="flex min-w-0 flex-1 flex-wrap gap-1 self-start">
            {displayDimensions.map((dim) => {
              const isActive = activeDimId === dim.id;
              return (
                <button
                  key={dim.id}
                  onClick={() => scrollToDimension(dim.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
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
        </div>
      ) : (
        /* ── Single group: flat wrap layout ── */
        <div className="mt-1 flex flex-wrap gap-1">
          {displayDimensions.map((dim) => {
            const isActive = activeDimId === dim.id;
            return (
              <button
                key={dim.id}
                onClick={() => scrollToDimension(dim.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
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
      )}
    </div>
  );
}

// ─── Section Progress Bar (inline) ───────────────────────────────────

function SectionProgressBar({
  answered,
  total,
  pct,
  complete,
}: {
  answered: number;
  total: number;
  pct: string;
  complete: boolean;
}) {
  const width = total > 0 ? (answered / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${complete ? 'bg-green-500' : 'bg-primary'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`flex-shrink-0 text-[11px] font-medium tabular-nums ${complete ? 'text-green-600' : 'text-muted-foreground'}`}>
        {answered}/{total} ({pct})
      </span>
    </div>
  );
}
