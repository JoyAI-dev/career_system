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
  createRecruitment,
  updateRecruitment,
  deleteRecruitment,
  type ActionState,
} from '@/server/actions/recruitment';

type RecruitmentItem = {
  id: string;
  title: string;
  company: string;
  description: string | null;
  eventDate: string;
  createdAt: string;
  creator: { id: string; name: string | null; username: string };
};

type Props = {
  items: RecruitmentItem[];
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function toInputDate(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 16);
}

export function RecruitmentManager({ items }: Props) {
  return (
    <div className="space-y-4">
      <AddRecruitmentButton />

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No recruitment info yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Event Date</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <RecruitmentRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecruitmentRow({ item }: { item: RecruitmentItem }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm(`Delete "${item.title}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteRecruitment(item.id);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      }
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <div>{item.title}</div>
        {item.description && (
          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {item.description}
          </div>
        )}
      </td>
      <td className="px-4 py-3">{item.company}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(item.eventDate)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <EditRecruitmentButton item={item} />
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

function AddRecruitmentButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(createRecruitment, {});
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
      <DialogTrigger render={<Button />}>Add Recruitment</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Recruitment Info</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" maxLength={200} required />
            {state.errors?.title && (
              <p className="mt-1 text-xs text-destructive">{state.errors.title[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Input id="company" name="company" maxLength={200} required />
            {state.errors?.company && (
              <p className="mt-1 text-xs text-destructive">{state.errors.company[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              name="description"
              maxLength={2000}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <Label htmlFor="eventDate">Event Date & Time</Label>
            <Input id="eventDate" name="eventDate" type="datetime-local" required />
            {state.errors?.eventDate && (
              <p className="mt-1 text-xs text-destructive">{state.errors.eventDate[0]}</p>
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

function EditRecruitmentButton({ item }: { item: RecruitmentItem }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(updateRecruitment, {});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('id', item.id);
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
          <DialogTitle>Edit Recruitment Info</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" name="title" defaultValue={item.title} maxLength={200} required />
            {state.errors?.title && (
              <p className="mt-1 text-xs text-destructive">{state.errors.title[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="edit-company">Company</Label>
            <Input id="edit-company" name="company" defaultValue={item.company} maxLength={200} required />
            {state.errors?.company && (
              <p className="mt-1 text-xs text-destructive">{state.errors.company[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="edit-description">Description (optional)</Label>
            <textarea
              id="edit-description"
              name="description"
              defaultValue={item.description ?? ''}
              maxLength={2000}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <Label htmlFor="edit-eventDate">Event Date & Time</Label>
            <Input
              id="edit-eventDate"
              name="eventDate"
              type="datetime-local"
              defaultValue={toInputDate(item.eventDate)}
              required
            />
            {state.errors?.eventDate && (
              <p className="mt-1 text-xs text-destructive">{state.errors.eventDate[0]}</p>
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
