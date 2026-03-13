'use client';

import { useState, useActionState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import {
  createActivityType,
  updateActivityType,
  deleteActivityType,
  reorderActivityType,
  toggleActivityType,
  type ActionState,
} from '@/server/actions/activityType';

// ── Label maps ─────────────────────────────────────────────────────

const SCOPE_LABELS: Record<string, string> = {
  GROUP_6: '6人组',
  PAIR_2: '2人配对',
  CROSS_GROUP: '跨组竞赛',
  INDIVIDUAL: '个人',
};

const COMPLETION_LABELS: Record<string, string> = {
  LEADER_ONLY: '组长确认',
  ALL_MEMBERS: '全员确认',
};

const PAIRING_LABELS: Record<string, string> = {
  AUTO: '自动配对',
  SELF_SELECT: '自选搭子',
  SELF_SELECT_WITH_LEADER: '自选+组长兜底',
};

// ── Types ──────────────────────────────────────────────────────────

type ActivityType = {
  id: string;
  name: string;
  order: number;
  prerequisiteTypeId: string | null;
  defaultCapacity: number;
  isEnabled: boolean;
  scope: string;
  peopleRequired: number;
  duration: string | null;
  guideContent: string | null;
  intervalHours: number;
  completionMode: string;
  pairingMode: string | null;
  allowViewLocked: boolean;
  timeoutHours: number;
  prerequisiteType: { id: string; name: string } | null;
};

type Props = {
  types: ActivityType[];
};

// ── Main Component ─────────────────────────────────────────────────

export function ActivityTypeManager({ types }: Props) {
  const t = useTranslations('admin.activityTypes');
  return (
    <div className="space-y-4">
      <AddActivityTypeButton types={types} />

      {types.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('noTypes')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {types.map((type, index) => (
            <ActivityTypeRow
              key={type.id}
              type={type}
              types={types}
              isFirst={index === 0}
              isLast={index === types.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Row Component ──────────────────────────────────────────────────

function ActivityTypeRow({
  type,
  types,
  isFirst,
  isLast,
}: {
  type: ActivityType;
  types: ActivityType[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.activityTypes');

  function handleReorder(direction: 'up' | 'down') {
    startTransition(() => {
      reorderActivityType(type.id, direction);
    });
  }

  function handleToggle() {
    startTransition(() => {
      toggleActivityType(type.id);
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${type.name}"?`)) return;
    startTransition(() => {
      deleteActivityType(type.id);
    });
  }

  return (
    <Card className={!type.isEnabled ? 'opacity-60' : ''}>
      <CardContent className="flex items-center gap-4 py-3">
        {/* Order controls */}
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => handleReorder('up')}
            disabled={isFirst || isPending}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => handleReorder('down')}
            disabled={isLast || isPending}
          >
            ↓
          </Button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{type.name}</span>
            {!type.isEnabled && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {t('disabled')}
              </span>
            )}
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
              {SCOPE_LABELS[type.scope] ?? type.scope}
            </span>
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
              {COMPLETION_LABELS[type.completionMode] ?? type.completionMode}
            </span>
            {type.pairingMode && (
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                {PAIRING_LABELS[type.pairingMode] ?? type.pairingMode}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            <span>{t('capacity', { count: type.defaultCapacity })}</span>
            <span>{type.peopleRequired}人参与</span>
            {type.duration && <span>{type.duration}</span>}
            {type.prerequisiteType && (
              <span>{t('requires', { name: type.prerequisiteType.name })}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleToggle}
            disabled={isPending}
          >
            {type.isEnabled ? t('disable') : t('enable')}
          </Button>
          <EditActivityTypeButton type={type} types={types} />
          <Button
            variant="destructive"
            size="xs"
            onClick={handleDelete}
            disabled={isPending}
          >
            {t('delete')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Add Button ─────────────────────────────────────────────────────

function AddActivityTypeButton({ types }: { types: ActivityType[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(createActivityType, {});
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.activityTypes');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      formAction(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{t('addActivityType')}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addActivityType')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">{t('name')}</Label>
            <Input id="name" name="name" required />
            {state.errors?.name && (
              <p className="mt-1 text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="defaultCapacity">{t('defaultCapacity')}</Label>
            <Input
              id="defaultCapacity"
              name="defaultCapacity"
              type="number"
              min={1}
              defaultValue={10}
              required
            />
          </div>
          <div>
            <Label htmlFor="prerequisiteTypeId">{t('prerequisiteType')}</Label>
            <select
              id="prerequisiteTypeId"
              name="prerequisiteTypeId"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('none')}</option>
              {types.map((tp) => (
                <option key={tp.id} value={tp.id}>{tp.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t('cancel')}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Button with Extended Fields ───────────────────────────────

function EditActivityTypeButton({ type, types }: { type: ActivityType; types: ActivityType[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(updateActivityType, {});
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.activityTypes');

  const [guideContent, setGuideContent] = useState(type.guideContent ?? '');
  const [allowViewLocked, setAllowViewLocked] = useState(type.allowViewLocked);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('id', type.id);
    formData.set('guideContent', guideContent);
    formData.set('allowViewLocked', String(allowViewLocked));
    startTransition(() => {
      formAction(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="xs" />}>{t('edit')}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('editActivityType')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Name */}
          <div>
            <Label htmlFor="edit-name">{t('name')}</Label>
            <Input id="edit-name" name="name" defaultValue={type.name} required />
            {state.errors?.name && (
              <p className="mt-1 text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          {/* Row 2: Scope + People Required */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-scope">活动范围</Label>
              <select
                id="edit-scope"
                name="scope"
                defaultValue={type.scope}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="edit-people">所需人数</Label>
              <Input
                id="edit-people"
                name="peopleRequired"
                type="number"
                min={1}
                max={100}
                defaultValue={type.peopleRequired}
                required
              />
            </div>
          </div>

          {/* Row 3: Capacity + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-capacity">{t('defaultCapacity')}</Label>
              <Input
                id="edit-capacity"
                name="defaultCapacity"
                type="number"
                min={1}
                defaultValue={type.defaultCapacity}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-duration">建议时长</Label>
              <Input
                id="edit-duration"
                name="duration"
                defaultValue={type.duration ?? ''}
                placeholder='如 "2小时"'
              />
            </div>
          </div>

          {/* Row 4: Interval + Timeout */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-interval">活动间隔(小时)</Label>
              <Input
                id="edit-interval"
                name="intervalHours"
                type="number"
                min={0}
                max={720}
                defaultValue={type.intervalHours}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-timeout">候补超时(小时)</Label>
              <Input
                id="edit-timeout"
                name="timeoutHours"
                type="number"
                min={1}
                max={720}
                defaultValue={type.timeoutHours}
                required
              />
            </div>
          </div>

          {/* Row 5: Completion Mode + Pairing Mode */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-completion">完成模式</Label>
              <select
                id="edit-completion"
                name="completionMode"
                defaultValue={type.completionMode}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {Object.entries(COMPLETION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="edit-pairing">配对模式</Label>
              <select
                id="edit-pairing"
                name="pairingMode"
                defaultValue={type.pairingMode ?? ''}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">无</option>
                {Object.entries(PAIRING_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 6: Prerequisite */}
          <div>
            <Label htmlFor="edit-prereq">{t('prerequisiteType')}</Label>
            <select
              id="edit-prereq"
              name="prerequisiteTypeId"
              defaultValue={type.prerequisiteTypeId ?? ''}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('none')}</option>
              {types
                .filter((tp) => tp.id !== type.id)
                .map((tp) => (
                  <option key={tp.id} value={tp.id}>{tp.name}</option>
                ))}
            </select>
            {state.errors?.prerequisiteTypeId && (
              <p className="mt-1 text-xs text-destructive">{state.errors.prerequisiteTypeId[0]}</p>
            )}
          </div>

          {/* Row 7: Allow View When Locked */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>锁定时允许查看内容</Label>
              <p className="text-xs text-muted-foreground">
                未解锁的活动是否允许学生预览活动指南
              </p>
            </div>
            <Switch
              checked={allowViewLocked}
              onCheckedChange={setAllowViewLocked}
            />
          </div>

          {/* Row 8: Guide Content */}
          <div>
            <Label className="mb-1 block">活动指南内容</Label>
            <MarkdownEditor
              name="guideContent"
              value={guideContent}
              onChange={setGuideContent}
              placeholder="输入活动指南内容 (Markdown)"
              preview="live"
              minHeight={160}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t('cancel')}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
