'use client';

/**
 * CommunityAdminTabs
 * Wraps the community management page with tabs for:
 * 1. Communities (existing CommunityManager)
 * 2. Virtual Groups (VirtualGroupAdmin)
 * 3. Standby Users (StandbyManager)
 * 4. Scheduling (SchedulingConfigEditor)
 */

import { useState, useTransition } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CommunityManager } from './CommunityManager';
import { StandbyManager } from '@/components/admin/StandbyManager';
import { SchedulingConfigEditor } from '@/components/admin/SchedulingConfigEditor';
import { VirtualGroupAdmin } from '@/components/admin/VirtualGroupAdmin';
import { fetchCommunityVirtualGroupsAction } from '@/server/actions/community';
import type {
  CommunityStats,
  CommunityListItem,
  GroupingCategory,
} from '@/server/queries/community';

// ── Types ──────────────────────────────────────────────────────────

type Props = {
  initialStats: CommunityStats;
  initialList: { communities: CommunityListItem[]; total: number };
  groupingCategories: GroupingCategory[];
  settings: { autoDeleteEmpty: boolean };
};

// ── Component ──────────────────────────────────────────────────────

export function CommunityAdminTabs({
  initialStats,
  initialList,
  groupingCategories,
  settings,
}: Props) {
  // Virtual groups state
  const [communityId, setCommunityId] = useState('');
  const [communityLabel, setCommunityLabel] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [groupError, setGroupError] = useState<string | null>(null);

  function loadGroups(cId?: string) {
    const targetId = cId ?? communityId;
    if (!targetId.trim()) return;
    setGroupError(null);
    startTransition(async () => {
      try {
        const data = await fetchCommunityVirtualGroupsAction(targetId.trim());
        setGroups(data);
        setGroupsLoaded(true);
        setCommunityLabel(targetId.trim());
      } catch (err) {
        setGroupError(err instanceof Error ? err.message : '加载失败');
        setGroups([]);
        setGroupsLoaded(true);
      }
    });
  }

  return (
    <Tabs defaultValue="communities">
      <TabsList>
        <TabsTrigger value="communities">社区</TabsTrigger>
        <TabsTrigger value="groups">虚拟小组</TabsTrigger>
        <TabsTrigger value="standby">候补用户</TabsTrigger>
        <TabsTrigger value="scheduling">调度配置</TabsTrigger>
      </TabsList>

      {/* Tab 1: Communities (existing) */}
      <TabsContent value="communities">
        <CommunityManager
          initialStats={initialStats}
          initialList={initialList}
          groupingCategories={groupingCategories}
          settings={settings}
        />
      </TabsContent>

      {/* Tab 2: Virtual Groups */}
      <TabsContent value="groups">
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="vg-community-id" className="text-xs">社区 ID</Label>
              <Input
                id="vg-community-id"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                placeholder="输入社区 ID 查看其虚拟小组"
                className="mt-1"
              />
            </div>
            <Button
              onClick={() => loadGroups()}
              disabled={isPending || !communityId.trim()}
              size="sm"
            >
              {isPending ? '加载中...' : '查看小组'}
            </Button>
          </div>
          {groupError && (
            <p className="text-xs text-destructive">{groupError}</p>
          )}
          {groupsLoaded && (
            <VirtualGroupAdmin
              communityId={communityId}
              communityLabel={communityLabel}
              groups={groups}
              onRefresh={() => loadGroups()}
            />
          )}
        </div>
      </TabsContent>

      {/* Tab 3: Standby Users */}
      <TabsContent value="standby">
        <StandbyManager />
      </TabsContent>

      {/* Tab 4: Scheduling Config */}
      <TabsContent value="scheduling">
        <SchedulingConfigEditor />
      </TabsContent>
    </Tabs>
  );
}
