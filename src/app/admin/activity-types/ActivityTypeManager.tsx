'use client';

import { useState, useActionState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  createActivityType,
  updateActivityType,
  deleteActivityType,
  reorderActivityType,
  toggleActivityType,
  type ActionState,
} from '@/server/actions/activityType';

type ActivityType = {
  id: string;
  name: string;
  order: number;
  prerequisiteTypeId: string | null;
  defaultCapacity: number;
  isEnabled: boolean;
  prerequisiteType: { id: string; name: string } | null;
};

type Props = {
  types: ActivityType[];
};

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
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{type.name}</span>
            {!type.isEnabled && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {t('disabled')}
              </span>
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{t('capacity', { count: type.defaultCapacity })}</span>
            {type.prerequisiteType && (
              <span>{t('requires', { name: type.prerequisiteType.name })}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
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
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
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

function EditActivityTypeButton({ type, types }: { type: ActivityType; types: ActivityType[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(updateActivityType, {});
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.activityTypes');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('id', type.id);
    startTransition(() => {
      formAction(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="xs" />}>{t('edit')}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editActivityType')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">{t('name')}</Label>
            <Input id="edit-name" name="name" defaultValue={type.name} required />
            {state.errors?.name && (
              <p className="mt-1 text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>
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
            <Label htmlFor="edit-prereq">{t('prerequisiteType')}</Label>
            <select
              id="edit-prereq"
              name="prerequisiteTypeId"
              defaultValue={type.prerequisiteTypeId ?? ''}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('none')}</option>
              {types
                .filter((t) => t.id !== type.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
            {state.errors?.prerequisiteTypeId && (
              <p className="mt-1 text-xs text-destructive">{state.errors.prerequisiteTypeId[0]}</p>
            )}
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
