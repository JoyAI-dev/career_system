'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

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
  dimensions: DimensionInfo[];
  groups?: SubTopicGroup[];
  sectionAnswered?: number;
  sectionTotal?: number;
};

export function DimensionNav({ dimensions, groups, sectionAnswered = 0, sectionTotal = 0 }: Props) {
  const hasGroups = groups && groups.length > 1;
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [activeDimId, setActiveDimId] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const displayDimensions = hasGroups
    ? groups[activeGroupIdx]?.dimensions ?? []
    : dimensions;

  // ── IntersectionObserver: track active dimension on scroll ──
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
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const dim of dimsToObserve) {
      const el = document.getElementById(`dimension-${dim.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [dimensions, groups, hasGroups, activeGroupIdx]);

  const scrollTo = useCallback((id: string) => {
    setActiveDimId(id);
    const el = document.getElementById(`dimension-${id}`);
    if (!el) return;
    // Dynamically calculate offset based on actual nav height
    // so the target element appears just below the sticky nav
    if (navRef.current) {
      const navBottom = navRef.current.getBoundingClientRect().bottom;
      const elTop = el.getBoundingClientRect().top;
      const buffer = 16; // 16px breathing room below nav
      window.scrollBy({ top: elTop - navBottom - buffer, behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // ── Progress ──
  const pct = sectionTotal > 0 ? (sectionAnswered / sectionTotal) * 100 : 0;
  const pctStr = `${pct.toFixed(1)}%`;
  const done = sectionAnswered === sectionTotal && sectionTotal > 0;

  // ── Minimal: no nav needed ──
  if (!hasGroups && dimensions.length <= 1) {
    if (sectionTotal > 0) {
      return (
        <div ref={navRef} className="sticky top-14 z-20 py-3 md:top-16">
          <Card>
            <CardContent>
              <ProgressBar width={pct} done={done} answered={sectionAnswered} total={sectionTotal} pctStr={pctStr} />
            </CardContent>
          </Card>
        </div>
      );
    }
    return null;
  }

  // ── Main render ──
  return (
    <div ref={navRef} className="sticky top-14 z-20 py-3 md:top-16">
      <Card>
        <CardContent className="space-y-4">
          {/* Progress */}
          {sectionTotal > 0 && (
            <ProgressBar width={pct} done={done} answered={sectionAnswered} total={sectionTotal} pctStr={pctStr} />
          )}

          {hasGroups ? (
            /* ═══ Multi-group: Shadcn Tabs vertical ═══ */
            <Tabs
              orientation="vertical"
              value={activeGroupIdx}
              onValueChange={(val) => {
                const idx = val as number;
                setActiveGroupIdx(idx);
                const group = groups[idx];
                if (group?.dimensions.length > 0) scrollTo(group.dimensions[0].id);
              }}
            >
              <TabsList variant="line" className="min-w-[8rem] shrink-0">
                {groups.map((group, idx) => {
                  const gPct = group.totalCount > 0
                    ? `${((group.answeredCount / group.totalCount) * 100).toFixed(1)}%`
                    : '0%';
                  const gDone = group.answeredCount === group.totalCount && group.totalCount > 0;

                  return (
                    <TabsTrigger key={group.id} value={idx}>
                      <span className="truncate">{group.name}</span>
                      <span className={`text-[10px] tabular-nums ${
                        gDone ? 'text-emerald-600 dark:text-emerald-400' : 'opacity-50'
                      }`}>
                        {gPct}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {groups.map((group, idx) => (
                <TabsContent key={group.id} value={idx}>
                  <div className="flex flex-wrap gap-2">
                    {group.dimensions.map((dim) => (
                      <Button
                        key={dim.id}
                        variant={activeDimId === dim.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => scrollTo(dim.id)}
                      >
                        {dim.name}
                      </Button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            /* ═══ Single-group: flat buttons ═══ */
            <div className="flex flex-wrap gap-2">
              {displayDimensions.map((dim) => (
                <Button
                  key={dim.id}
                  variant={activeDimId === dim.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => scrollTo(dim.id)}
                >
                  {dim.name}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══ Progress Bar ═══ */

function ProgressBar({ width, done, answered, total, pctStr }: {
  width: number; done: boolean; answered: number; total: number; pctStr: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            done ? 'bg-emerald-500' : 'bg-primary'
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`shrink-0 text-sm font-medium tabular-nums ${
        done ? 'text-emerald-600' : 'text-muted-foreground'
      }`}>
        {answered}/{total} ({pctStr})
      </span>
    </div>
  );
}
