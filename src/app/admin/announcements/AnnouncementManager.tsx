'use client';

import { useState, useActionState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/MarkdownEditor';
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
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementActive,
  type ActionState,
} from '@/server/actions/announcement';

type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  countdownSeconds: number;
  createdAt: string;
};

type Props = {
  items: AnnouncementItem[];
};

export function AnnouncementManager({ items }: Props) {
  const t = useTranslations('admin.announcements');

  return (
    <div className="space-y-4">
      <AddAnnouncementButton />

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('noAnnouncements')}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{t('titleField')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('status')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('countdown')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('created')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <AnnouncementRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnnouncementRow({ item }: { item: AnnouncementItem }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('admin.announcements');

  function handleDelete() {
    if (!confirm(t('confirmDelete', { title: item.title }))) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAnnouncement(item.id);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      }
    });
  }

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleAnnouncementActive(item.id);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      }
    });
  }

  const formattedDate = new Date(item.createdAt).toLocaleDateString();

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium">{item.title}</div>
        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {item.content.slice(0, 100)}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            item.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {item.isActive ? t('active') : t('inactive')}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{item.countdownSeconds}s</td>
      <td className="px-4 py-3 text-muted-foreground">{formattedDate}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant={item.isActive ? 'outline' : 'default'}
            size="xs"
            onClick={handleToggle}
            disabled={isPending}
          >
            {t('toggleActive')}
          </Button>
          <EditAnnouncementButton item={item} />
          <Button
            variant="destructive"
            size="xs"
            onClick={handleDelete}
            disabled={isPending}
          >
            {t('delete')}
          </Button>
        </div>
        {error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </td>
    </tr>
  );
}

function AddAnnouncementButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(createAnnouncement, {});
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.announcements');

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
      <DialogTrigger render={<Button />}>{t('create')}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('createAnnouncement')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">{t('titleField')}</Label>
            <Input id="title" name="title" maxLength={200} required />
            {state.errors?.title && (
              <p className="mt-1 text-xs text-destructive">{state.errors.title[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="content">{t('content')}</Label>
            <MarkdownEditor
              id="content"
              name="content"
              minHeight={200}
              preview="edit"
            />
          </div>
          <div>
            <Label htmlFor="countdownSeconds">{t('countdownField')}</Label>
            <Input
              id="countdownSeconds"
              name="countdownSeconds"
              type="number"
              min={0}
              max={300}
              defaultValue={20}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('countdownHint')}</p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t('cancel')}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('creating') : t('createBtn')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAnnouncementButton({ item }: { item: AnnouncementItem }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(updateAnnouncement, {});
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.announcements');

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
      <DialogTrigger render={<Button variant="ghost" size="xs" />}>{t('edit')}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('editAnnouncement')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-title">{t('titleField')}</Label>
            <Input id="edit-title" name="title" defaultValue={item.title} maxLength={200} required />
            {state.errors?.title && (
              <p className="mt-1 text-xs text-destructive">{state.errors.title[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="edit-content">{t('content')}</Label>
            <MarkdownEditor
              id="edit-content"
              name="content"
              defaultValue={item.content}
              minHeight={200}
              preview="edit"
            />
          </div>
          <div>
            <Label htmlFor="edit-countdownSeconds">{t('countdownField')}</Label>
            <Input
              id="edit-countdownSeconds"
              name="countdownSeconds"
              type="number"
              min={0}
              max={300}
              defaultValue={item.countdownSeconds}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('countdownHint')}</p>
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
