'use client';

import { useState, useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createActivity,
  updateActivity,
  type ActionState,
} from '@/server/actions/activity';

type ActivityType = {
  id: string;
  name: string;
  defaultCapacity: number;
};

type Tag = {
  id: string;
  name: string;
  _count: { activityTags: number };
};

type ActivityData = {
  id: string;
  typeId: string;
  title: string;
  capacity: number;
  guideMarkdown: string | null;
  location: string | null;
  isOnline: boolean;
  tagIds: string[];
};

type Props = {
  types: ActivityType[];
  tags: Tag[];
  activity?: ActivityData;
};

export function ActivityForm({ types, tags, activity }: Props) {
  const isEdit = !!activity;
  const router = useRouter();
  const t = useTranslations('admin.activityForm');
  const [state, formAction] = useActionState<ActionState, FormData>(
    isEdit ? updateActivity : createActivity,
    {},
  );
  const [isPending, startTransition] = useTransition();

  const [selectedTypeId, setSelectedTypeId] = useState(activity?.typeId ?? '');
  const [capacity, setCapacity] = useState(activity?.capacity?.toString() ?? '');
  const [guideMarkdown, setGuideMarkdown] = useState(activity?.guideMarkdown ?? '');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(activity?.tagIds ?? []),
  );
  const [previewMode, setPreviewMode] = useState(false);

  function handleTypeChange(typeId: string) {
    setSelectedTypeId(typeId);
    if (!isEdit) {
      const type = types.find((t) => t.id === typeId);
      if (type) setCapacity(type.defaultCapacity.toString());
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (isEdit) formData.set('id', activity!.id);
    // Remove existing tagIds and re-add from state
    formData.delete('tagIds');
    selectedTagIds.forEach((id) => formData.append('tagIds', id));

    startTransition(async () => {
      const result = await (isEdit ? updateActivity : createActivity)({}, formData);
      if (result.success) {
        router.push('/admin/activities');
      }
    });
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {state.errors?._form && (
            <p className="text-sm text-destructive">{state.errors._form[0]}</p>
          )}

          {/* Activity Type */}
          <div>
            <Label htmlFor="typeId">{t('activityType')}</Label>
            <select
              id="typeId"
              name="typeId"
              value={selectedTypeId}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">{t('selectType')}</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {state.errors?.typeId && (
              <p className="mt-1 text-xs text-destructive">{state.errors.typeId[0]}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title">{t('title')}</Label>
            <Input
              id="title"
              name="title"
              defaultValue={activity?.title ?? ''}
              maxLength={200}
              required
            />
            {state.errors?.title && (
              <p className="mt-1 text-xs text-destructive">{state.errors.title[0]}</p>
            )}
          </div>

          {/* Capacity */}
          <div>
            <Label htmlFor="capacity">{t('capacity')}</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
            {state.errors?.capacity && (
              <p className="mt-1 text-xs text-destructive">{state.errors.capacity[0]}</p>
            )}
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">{t('location')}</Label>
            <Input
              id="location"
              name="location"
              defaultValue={activity?.location ?? ''}
              placeholder={t('optional')}
            />
          </div>

          {/* Online */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isOnline"
              name="isOnline"
              value="true"
              defaultChecked={activity?.isOnline ?? false}
              className="size-4 rounded border-border"
            />
            <Label htmlFor="isOnline">{t('onlineActivity')}</Label>
          </div>

          {/* Tags */}
          <div>
            <Label>{t('tags')}</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    selectedTagIds.has(tag.id)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
              {tags.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  {t('noTags')}
                </span>
              )}
            </div>
          </div>

          {/* Markdown Guide */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label htmlFor="guideMarkdown">{t('guideMarkdown')}</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={!previewMode ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setPreviewMode(false)}
                >
                  {t('write')}
                </Button>
                <Button
                  type="button"
                  variant={previewMode ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setPreviewMode(true)}
                >
                  {t('preview')}
                </Button>
              </div>
            </div>
            {previewMode ? (
              <div className="min-h-[200px] rounded-lg border border-border bg-background p-4 prose prose-sm max-w-none">
                {guideMarkdown ? (
                  <ReactMarkdown>{guideMarkdown}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground">{t('nothingToPreview')}</p>
                )}
              </div>
            ) : (
              <textarea
                id="guideMarkdown"
                name="guideMarkdown"
                value={guideMarkdown}
                onChange={(e) => setGuideMarkdown(e.target.value)}
                className="min-h-[200px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder={t('guidePlaceholder')}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEdit
                  ? t('saving')
                  : t('creating')
                : isEdit
                  ? t('saveChanges')
                  : t('createActivity')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/activities')}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
