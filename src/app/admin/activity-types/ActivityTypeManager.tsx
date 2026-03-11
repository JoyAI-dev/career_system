'use client';

import { useState, useActionState, useTransition } from 'react';
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
  return (
    <div className="space-y-4">
      <AddActivityTypeButton types={types} />

      {types.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No activity types configured. Add one to get started.
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
                Disabled
              </span>
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Capacity: {type.defaultCapacity}</span>
            {type.prerequisiteType && (
              <span>Requires: {type.prerequisiteType.name}</span>
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
            {type.isEnabled ? 'Disable' : 'Enable'}
          </Button>
          <EditActivityTypeButton type={type} types={types} />
          <Button
            variant="destructive"
            size="xs"
            onClick={handleDelete}
            disabled={isPending}
          >
            Delete
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
      <DialogTrigger render={<Button />}>Add Activity Type</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Activity Type</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
            {state.errors?.name && (
              <p className="mt-1 text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="defaultCapacity">Default Capacity</Label>
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
            <Label htmlFor="prerequisiteTypeId">Prerequisite Type</Label>
            <select
              id="prerequisiteTypeId"
              name="prerequisiteTypeId"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create'}
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
      <DialogTrigger render={<Button variant="ghost" size="xs" />}>Edit</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Activity Type</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" name="name" defaultValue={type.name} required />
            {state.errors?.name && (
              <p className="mt-1 text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="edit-capacity">Default Capacity</Label>
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
            <Label htmlFor="edit-prereq">Prerequisite Type</Label>
            <select
              id="edit-prereq"
              name="prerequisiteTypeId"
              defaultValue={type.prerequisiteTypeId ?? ''}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">None</option>
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
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
