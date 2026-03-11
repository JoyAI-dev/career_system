'use client';

import { useState, useActionState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
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

function toInputDate(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 16);
}

export function RecruitmentManager({ items }: Props) {
  const t = useTranslations('admin.recruitment');
  const locale = useLocale();

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  return (
    <div className="space-y-4">
      <AddRecruitmentButton />

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('noRecruitment')}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{t('titleColumn')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('company')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('eventDate')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <RecruitmentRow key={item.id} item={item} formatDate={formatDate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecruitmentRow({ item, formatDate }: { item: RecruitmentItem; formatDate: (d: string) => string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('admin.recruitment');

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

function AddRecruitmentButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(createRecruitment, {});
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.recruitment');

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
      <DialogTrigger render={<Button />}>{t('addRecruitment')}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addRecruitmentInfo')}</DialogTitle>
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
            <Label htmlFor="company">{t('companyField')}</Label>
            <Input id="company" name="company" maxLength={200} required />
            {state.errors?.company && (
              <p className="mt-1 text-xs text-destructive">{state.errors.company[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="description">{t('descriptionField')}</Label>
            <MarkdownEditor
              id="description"
              name="description"
              minHeight={150}
              preview="edit"
            />
          </div>
          <div>
            <Label htmlFor="eventDate">{t('eventDateTime')}</Label>
            <Input id="eventDate" name="eventDate" type="datetime-local" required />
            {state.errors?.eventDate && (
              <p className="mt-1 text-xs text-destructive">{state.errors.eventDate[0]}</p>
            )}
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

function EditRecruitmentButton({ item }: { item: RecruitmentItem }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(updateRecruitment, {});
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.recruitment');

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editRecruitmentInfo')}</DialogTitle>
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
            <Label htmlFor="edit-company">{t('companyField')}</Label>
            <Input id="edit-company" name="company" defaultValue={item.company} maxLength={200} required />
            {state.errors?.company && (
              <p className="mt-1 text-xs text-destructive">{state.errors.company[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="edit-description">{t('descriptionField')}</Label>
            <MarkdownEditor
              id="edit-description"
              name="description"
              defaultValue={item.description ?? ''}
              minHeight={150}
              preview="edit"
            />
          </div>
          <div>
            <Label htmlFor="edit-eventDate">{t('eventDateTime')}</Label>
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
