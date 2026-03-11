'use client';

import { useState, useActionState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  createTag,
  updateTag,
  deleteTag,
  type ActionState,
} from '@/server/actions/tag';

type Tag = {
  id: string;
  name: string;
  _count: { activityTags: number };
};

type Props = {
  tags: Tag[];
};

export function TagManager({ tags }: Props) {
  return (
    <div className="space-y-4">
      <AddTagButton />

      {tags.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tags yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Usage</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <TagRow key={tag.id} tag={tag} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TagRow({ tag }: { tag: Tag }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm(`Delete "${tag.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTag(tag.id);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      }
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">{tag.name}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {tag._count.activityTags} {tag._count.activityTags === 1 ? 'activity' : 'activities'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <EditTagButton tag={tag} />
          <Button
            variant="destructive"
            size="xs"
            onClick={handleDelete}
            disabled={isPending}
          >
            Delete
          </Button>
        </div>
        {error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </td>
    </tr>
  );
}

function AddTagButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(createTag, {});
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
      <DialogTrigger render={<Button />}>Add Tag</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" maxLength={50} required />
            {state.errors?.name && (
              <p className="mt-1 text-xs text-destructive">{state.errors.name[0]}</p>
            )}
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

function EditTagButton({ tag }: { tag: Tag }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(updateTag, {});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('id', tag.id);
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
          <DialogTitle>Edit Tag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" name="name" defaultValue={tag.name} maxLength={50} required />
            {state.errors?.name && (
              <p className="mt-1 text-xs text-destructive">{state.errors.name[0]}</p>
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
