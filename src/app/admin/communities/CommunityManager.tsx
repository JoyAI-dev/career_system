'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, ChevronRight, ChevronLeft, Users, Hash, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import type {
  CommunityStats,
  CommunityListItem,
  GroupingCategory,
  DrilldownResult,
  DrilldownNode,
} from '@/server/queries/community';
import {
  fetchCommunityListAction,
  fetchDrilldownAction,
  fetchStatsAction,
  updateCommunitySettings,
  updateHierarchicalMatchLevel,
  triggerRecompute,
} from '@/server/actions/community';

// ── Props ──────────────────────────────────────────────────────────

interface CommunityManagerProps {
  initialStats: CommunityStats;
  initialList: { communities: CommunityListItem[]; total: number };
  groupingCategories: GroupingCategory[];
  settings: { autoDeleteEmpty: boolean };
}

// ── Component ──────────────────────────────────────────────────────

export function CommunityManager({
  initialStats,
  initialList,
  groupingCategories,
  settings: initialSettings,
}: CommunityManagerProps) {
  const t = useTranslations('admin.communities');

  // Mode: 'list' or 'drilldown'
  const [mode, setMode] = useState<'list' | 'drilldown'>('list');

  // Stats
  const [stats, setStats] = useState<CommunityStats>(initialStats);

  // List state
  const [listItems, setListItems] = useState<CommunityListItem[]>(initialList.communities);
  const [listTotal, setListTotal] = useState(initialList.total);
  const [listPage, setListPage] = useState(1);
  const listPageSize = 20;
  const listTotalPages = Math.ceil(listTotal / listPageSize);

  // Drilldown state
  const [drilldownPath, setDrilldownPath] = useState<{ optionId: string; label: string }[]>([]);
  const [drilldownResult, setDrilldownResult] = useState<DrilldownResult | null>(null);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoDeleteEmpty, setAutoDeleteEmpty] = useState(initialSettings.autoDeleteEmpty);
  const [matchLevels, setMatchLevels] = useState<Record<string, string>>(() => {
    const levels: Record<string, string> = {};
    for (const cat of groupingCategories) {
      if (cat.inputType === 'HIERARCHICAL_MULTI' && cat.hierarchicalMatchLevel) {
        levels[cat.id] = cat.hierarchicalMatchLevel;
      }
    }
    return levels;
  });

  // Transitions
  const [isPending, startTransition] = useTransition();
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [recomputeMsg, setRecomputeMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────

  function refreshStats() {
    startTransition(async () => {
      const newStats = await fetchStatsAction();
      setStats(newStats);
    });
  }

  function goToListPage(page: number) {
    startTransition(async () => {
      const data = await fetchCommunityListAction(page, listPageSize);
      setListItems(data.communities);
      setListTotal(data.total);
      setListPage(page);
    });
  }

  function switchToList() {
    setMode('list');
    setDrilldownPath([]);
    setDrilldownResult(null);
  }

  function switchToDrilldown() {
    setMode('drilldown');
    setDrilldownPath([]);
    startTransition(async () => {
      const result = await fetchDrilldownAction([]);
      setDrilldownResult(result);
    });
  }

  function drillInto(node: DrilldownNode) {
    const newPath = [...drilldownPath, { optionId: node.optionId, label: node.label }];
    setDrilldownPath(newPath);
    startTransition(async () => {
      const result = await fetchDrilldownAction(newPath.map((p) => p.optionId));
      setDrilldownResult(result);
    });
  }

  function drillBackToTop() {
    setDrilldownPath([]);
    startTransition(async () => {
      const result = await fetchDrilldownAction([]);
      setDrilldownResult(result);
    });
  }

  function drillBackToLevel(level: number) {
    const newPath = drilldownPath.slice(0, level);
    setDrilldownPath(newPath);
    startTransition(async () => {
      const result = await fetchDrilldownAction(newPath.map((p) => p.optionId));
      setDrilldownResult(result);
    });
  }

  async function handleSaveSettings() {
    setIsSaving(true);
    try {
      // Save auto-delete setting
      const formData = new FormData();
      formData.set('autoDeleteEmpty', String(autoDeleteEmpty));
      await updateCommunitySettings({}, formData);

      // Save match levels for hierarchical categories
      for (const [catId, level] of Object.entries(matchLevels)) {
        await updateHierarchicalMatchLevel(catId, level);
      }

      setSettingsOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRecompute() {
    if (!confirm(t('recomputeConfirm'))) return;
    setIsRecomputing(true);
    setRecomputeMsg(null);
    try {
      const result = await triggerRecompute();
      if (result.success) {
        setRecomputeMsg(t('recomputeSuccess'));
        // Refresh data
        refreshStats();
        if (mode === 'list') {
          goToListPage(1);
        } else {
          drillBackToTop();
        }
      } else {
        setRecomputeMsg(result.errors?._form?.[0] || 'Error');
      }
    } finally {
      setIsRecomputing(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  const hierarchicalCategories = groupingCategories.filter(
    (c) => c.inputType === 'HIERARCHICAL_MULTI'
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Hash className="h-4 w-4" />
              {t('totalCommunities')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCommunities}</div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" />
              {t('totalMembers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Activity className="h-4 w-4" />
              {t('activeMembers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeMembers5min}</div>
          </CardContent>
        </Card>
      </div>

      {/* Mode Switcher + Settings */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={mode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={switchToList}
          >
            {t('listMode')}
          </Button>
          <Button
            variant={mode === 'drilldown' ? 'default' : 'outline'}
            size="sm"
            onClick={switchToDrilldown}
          >
            {t('drilldownMode')}
          </Button>
        </div>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm">
                <Settings className="mr-1.5 h-4 w-4" />
                {t('settings')}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('settingsTitle')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Auto delete empty */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>{t('autoDeleteEmpty')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('autoDeleteEmptyDesc')}
                  </p>
                </div>
                <Switch
                  checked={autoDeleteEmpty}
                  onCheckedChange={setAutoDeleteEmpty}
                />
              </div>

              {/* Hierarchical match level per category */}
              {hierarchicalCategories.length > 0 && (
                <div className="space-y-3">
                  <Label>{t('hierarchicalMatchLevel')}</Label>
                  {hierarchicalCategories.map((cat) => (
                    <div key={cat.id} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          variant={matchLevels[cat.id] === 'PARENT' ? 'default' : 'outline'}
                          onClick={() =>
                            setMatchLevels((prev) => ({ ...prev, [cat.id]: 'PARENT' }))
                          }
                        >
                          {t('parentMode')}
                        </Button>
                        <Button
                          size="xs"
                          variant={matchLevels[cat.id] === 'LEAF' ? 'default' : 'outline'}
                          onClick={() =>
                            setMatchLevels((prev) => ({ ...prev, [cat.id]: 'LEAF' }))
                          }
                        >
                          {t('leafMode')}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {matchLevels[cat.id] === 'LEAF'
                          ? t('leafModeDesc')
                          : t('parentModeDesc')}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Recompute */}
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecompute}
                  disabled={isRecomputing}
                  className="w-full"
                >
                  {isRecomputing ? t('recomputing') : t('recompute')}
                </Button>
                {recomputeMsg && (
                  <p className="mt-2 text-xs text-muted-foreground text-center">
                    {recomputeMsg}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleSaveSettings}
                disabled={isSaving}
                size="sm"
              >
                {isSaving ? t('saving') : t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content Area */}
      <div className={isPending ? 'pointer-events-none opacity-60 transition-opacity' : ''}>
        {mode === 'list' ? (
          <ListMode
            items={listItems}
            total={listTotal}
            page={listPage}
            totalPages={listTotalPages}
            onPageChange={goToListPage}
          />
        ) : (
          <DrilldownMode
            result={drilldownResult}
            path={drilldownPath}
            groupingCategories={groupingCategories}
            onDrillInto={drillInto}
            onBackToTop={drillBackToTop}
            onBackToLevel={drillBackToLevel}
          />
        )}
      </div>
    </div>
  );
}

// ── List Mode ────────────────────────────────────────────────────

function ListMode({
  items,
  total,
  page,
  totalPages,
  onPageChange,
}: {
  items: CommunityListItem[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const t = useTranslations('admin.communities');

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Users className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">{t('noData')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('communities', { count: total })}
      </p>

      <div className="space-y-2">
        {items.map((community) => (
          <Card key={community.id} size="sm">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {community.tags.map((tag, idx) => (
                  <span key={idx}>
                    {idx > 0 && (
                      <span className="mx-1 text-muted-foreground/50">·</span>
                    )}
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {tag.option.label}
                    </span>
                  </span>
                ))}
              </div>
              <span className="ml-4 shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                {t('members', { count: community.memberCount })}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('prevPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t('nextPage')}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Drilldown Mode ───────────────────────────────────────────────

function DrilldownMode({
  result,
  path,
  groupingCategories,
  onDrillInto,
  onBackToTop,
  onBackToLevel,
}: {
  result: DrilldownResult | null;
  path: { optionId: string; label: string }[];
  groupingCategories: GroupingCategory[];
  onDrillInto: (node: DrilldownNode) => void;
  onBackToTop: () => void;
  onBackToLevel: (level: number) => void;
}) {
  const t = useTranslations('admin.communities');

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Users className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">{t('noData')}</p>
      </div>
    );
  }

  const isDeepest = path.length >= groupingCategories.length - 1;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      {path.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <Button variant="ghost" size="xs" onClick={onBackToTop}>
            {t('backToTop')}
          </Button>
          {path.map((step, idx) => (
            <span key={idx} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onBackToLevel(idx + 1)}
                className={idx === path.length - 1 ? 'font-medium text-foreground' : ''}
              >
                {step.label}
              </Button>
            </span>
          ))}
        </div>
      )}

      {/* Current level info */}
      <div className="space-y-1">
        <p className="text-sm font-medium">{result.categoryName}</p>
        {!isDeepest && (
          <p className="text-xs text-muted-foreground">{t('drilldownPrompt')}</p>
        )}
      </div>

      {/* Nodes */}
      {result.nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-sm">{t('noData')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {result.nodes.map((node) => (
            <Card
              key={node.optionId}
              size="sm"
              className={!isDeepest ? 'cursor-pointer transition-colors hover:bg-muted/50' : ''}
              onClick={!isDeepest ? () => onDrillInto(node) : undefined}
            >
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{node.label}</span>
                  {!isDeepest && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{t('communities', { count: node.communityCount })}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                    {t('members', { count: node.memberCount })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
