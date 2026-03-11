'use client';

import { useActionState, useState, useTransition, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  createAnswerOption,
  updateAnswerOption,
  deleteAnswerOption,
  type ActionState,
} from '@/server/actions/questionnaire';

type AnswerOption = {
  id: string;
  questionId: string;
  label: string;
  score: number;
};

type Props = {
  questionId: string;
  options: AnswerOption[];
  isDraft: boolean;
  versionNumber: number;
};

export function AnswerOptionsEditor({
  questionId,
  options,
  isDraft,
  versionNumber,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOption, setEditOption] = useState<AnswerOption | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.questionnaire.options');
  const tc = useTranslations('common');

  const scoreSum = useMemo(
    () => options.reduce((sum, opt) => sum + opt.score, 0),
    [options],
  );

  const sumColor =
    scoreSum === 100
      ? 'text-green-600 dark:text-green-400'
      : scoreSum > 100
        ? 'text-destructive'
        : 'text-amber-600 dark:text-amber-400';

  const [addState, addAction, addPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await createAnswerOption(prev, formData);
      if (result.success) setAddOpen(false);
      return result;
    },
    {},
  );

  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateAnswerOption(prev, formData);
      if (result.success) setEditOption(null);
      return result;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {/* Score Sum Indicator */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              v{versionNumber} — {isDraft ? t('draftEditable') : t('publishedReadOnly')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{t('scoreTotal')}</p>
            <p className={`text-2xl font-bold ${sumColor}`}>
              {scoreSum} / 100
            </p>
            {scoreSum === 100 && (
              <p className="text-xs text-green-600 dark:text-green-400">{t('valid')}</p>
            )}
            {scoreSum !== 100 && (
              <p className="text-xs text-destructive">
                {scoreSum < 100 ? t('needMore', { count: 100 - scoreSum }) : t('over', { count: scoreSum - 100 })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Options Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('optionsCount', { count: options.length })}</CardTitle>
            {isDraft && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  {t('addOption')}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('addAnswerOption')}</DialogTitle>
                  </DialogHeader>
                  <form action={addAction} className="space-y-4">
                    <input type="hidden" name="questionId" value={questionId} />
                    {addState.errors?._form && (
                      <p className="text-sm text-destructive">
                        {addState.errors._form.join(', ')}
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="add-label">{t('label')}</Label>
                      <Input id="add-label" name="label" required />
                      {addState.errors?.label && (
                        <p className="text-sm text-destructive">
                          {addState.errors.label[0]}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-score">{t('scoreRange')}</Label>
                      <Input
                        id="add-score"
                        name="score"
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={0}
                        required
                      />
                      {addState.errors?.score && (
                        <p className="text-sm text-destructive">
                          {addState.errors.score[0]}
                        </p>
                      )}
                    </div>
                    <Button type="submit" disabled={addPending}>
                      {addPending ? t('adding') : t('addOption')}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('label')}</TableHead>
                <TableHead className="w-24 text-right">{t('score')}</TableHead>
                {isDraft && <TableHead className="w-32 text-right">{t('actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map((option) => (
                <TableRow key={option.id}>
                  <TableCell className="font-medium">{option.label}</TableCell>
                  <TableCell className="text-right">{option.score}</TableCell>
                  {isDraft && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditOption(option)}
                        >
                          {tc('edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={isPending}
                          onClick={() => {
                            if (confirm(t('confirmDeleteOption', { label: option.label }))) {
                              startTransition(async () => {
                                await deleteAnswerOption(option.id);
                              });
                            }
                          }}
                        >
                          {tc('delete')}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {options.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isDraft ? 3 : 2}
                    className="text-center text-muted-foreground"
                  >
                    {t('noOptions')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editOption}
        onOpenChange={(open) => !open && setEditOption(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editAnswerOption')}</DialogTitle>
          </DialogHeader>
          {editOption && (
            <form action={editAction} className="space-y-4">
              <input type="hidden" name="id" value={editOption.id} />
              {editState.errors?._form && (
                <p className="text-sm text-destructive">
                  {editState.errors._form.join(', ')}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-label">{t('label')}</Label>
                <Input
                  id="edit-label"
                  name="label"
                  defaultValue={editOption.label}
                  required
                />
                {editState.errors?.label && (
                  <p className="text-sm text-destructive">
                    {editState.errors.label[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-score">{t('scoreRange')}</Label>
                <Input
                  id="edit-score"
                  name="score"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={editOption.score}
                  required
                />
                {editState.errors?.score && (
                  <p className="text-sm text-destructive">
                    {editState.errors.score[0]}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={editPending}>
                {editPending ? t('saving') : t('save')}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
