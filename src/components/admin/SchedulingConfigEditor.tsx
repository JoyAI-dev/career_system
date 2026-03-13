'use client';

/**
 * SchedulingConfigEditor
 * Admin panel for editing the auto-scheduling configuration.
 */

import { useState, useEffect, useTransition } from 'react';
import { Clock, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getSchedulingConfiguration,
  updateSchedulingConfig,
} from '@/server/actions/schedulingActions';

// ── Types ──────────────────────────────────────────────────────────

type SchedulingConfig = {
  morningCutoff: string;
  eveningCutoff: string;
  morningDelayHours: number;
  eveningDelayHours: number;
  defaultActivityTime: string;
  suggestedMorningStart: string;
  suggestedMorningEnd: string;
  suggestedAfternoonStart: string;
  suggestedAfternoonEnd: string;
};

const DEFAULTS: SchedulingConfig = {
  morningCutoff: '10:00',
  eveningCutoff: '17:00',
  morningDelayHours: 0,
  eveningDelayHours: 24,
  defaultActivityTime: '09:00',
  suggestedMorningStart: '09:00',
  suggestedMorningEnd: '11:00',
  suggestedAfternoonStart: '14:00',
  suggestedAfternoonEnd: '16:00',
};

// ── Component ──────────────────────────────────────────────────────

export function SchedulingConfigEditor() {
  const [config, setConfig] = useState<SchedulingConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await getSchedulingConfiguration();
      if (data) {
        setConfig({
          morningCutoff: data.morningCutoff,
          eveningCutoff: data.eveningCutoff,
          morningDelayHours: data.morningDelayHours,
          eveningDelayHours: data.eveningDelayHours,
          defaultActivityTime: data.defaultActivityTime,
          suggestedMorningStart: data.suggestedMorningStart,
          suggestedMorningEnd: data.suggestedMorningEnd,
          suggestedAfternoonStart: data.suggestedAfternoonStart,
          suggestedAfternoonEnd: data.suggestedAfternoonEnd,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof SchedulingConfig>(key: K, value: SchedulingConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaveMsg(null);
  }

  function handleSave() {
    startTransition(async () => {
      await updateSchedulingConfig(config);
      setSaveMsg('配置已保存');
    });
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Time cutoffs */}
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            时间节点设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sc-morning-cutoff" className="text-xs">上午截止时间</Label>
              <Input
                id="sc-morning-cutoff"
                type="time"
                value={config.morningCutoff}
                onChange={(e) => updateField('morningCutoff', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sc-evening-cutoff" className="text-xs">下午截止时间</Label>
              <Input
                id="sc-evening-cutoff"
                type="time"
                value={config.eveningCutoff}
                onChange={(e) => updateField('eveningCutoff', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sc-morning-delay" className="text-xs">上午延迟(小时)</Label>
              <Input
                id="sc-morning-delay"
                type="number"
                min={0}
                value={config.morningDelayHours}
                onChange={(e) => updateField('morningDelayHours', Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sc-evening-delay" className="text-xs">下午延迟(小时)</Label>
              <Input
                id="sc-evening-delay"
                type="number"
                min={0}
                value={config.eveningDelayHours}
                onChange={(e) => updateField('eveningDelayHours', Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="sc-default-time" className="text-xs">默认活动时间</Label>
            <Input
              id="sc-default-time"
              type="time"
              value={config.defaultActivityTime}
              onChange={(e) => updateField('defaultActivityTime', e.target.value)}
              className="mt-1 max-w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* Suggested time ranges */}
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">建议活动时间段</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">上午时段</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="time"
                value={config.suggestedMorningStart}
                onChange={(e) => updateField('suggestedMorningStart', e.target.value)}
              />
              <span className="text-sm text-muted-foreground">至</span>
              <Input
                type="time"
                value={config.suggestedMorningEnd}
                onChange={(e) => updateField('suggestedMorningEnd', e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">下午时段</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="time"
                value={config.suggestedAfternoonStart}
                onChange={(e) => updateField('suggestedAfternoonStart', e.target.value)}
              />
              <span className="text-sm text-muted-foreground">至</span>
              <Input
                type="time"
                value={config.suggestedAfternoonEnd}
                onChange={(e) => updateField('suggestedAfternoonEnd', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scheduling rules explanation */}
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">调度规则说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              {config.morningCutoff} 前人满 → 延迟 {config.morningDelayHours} 小时 → 安排在
              {config.morningDelayHours === 0 ? '当天' : `${config.morningDelayHours}小时后`}
              {' '}{config.defaultActivityTime}
            </p>
            <p>
              {config.morningCutoff} ~ {config.eveningCutoff} 之间人满 → 使用活动类型的间隔时间
            </p>
            <p>
              {config.eveningCutoff} 后人满 → 延迟 {config.eveningDelayHours} 小时 → 安排在
              {config.eveningDelayHours >= 24 ? '第二天' : `${config.eveningDelayHours}小时后`}
              {' '}{config.defaultActivityTime}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending} size="sm">
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {isPending ? '保存中...' : '保存配置'}
        </Button>
        {saveMsg && (
          <span className="text-xs text-green-600">{saveMsg}</span>
        )}
      </div>
    </div>
  );
}
