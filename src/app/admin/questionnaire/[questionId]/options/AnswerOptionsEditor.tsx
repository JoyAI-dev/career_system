'use client';

import { useActionState, useState, useTransition, useMemo } from 'react';
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
              v{versionNumber} — {isDraft ? 'Draft (Editable)' : 'Published (Read Only)'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Score Total</p>
            <p className={`text-2xl font-bold ${sumColor}`}>
              {scoreSum} / 100
            </p>
            {scoreSum === 100 && (
              <p className="text-xs text-green-600 dark:text-green-400">Valid</p>
            )}
            {scoreSum !== 100 && (
              <p className="text-xs text-destructive">
                {scoreSum < 100 ? `Need ${100 - scoreSum} more` : `${scoreSum - 100} over`}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Options Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Options ({options.length})</CardTitle>
            {isDraft && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Add Option
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Answer Option</DialogTitle>
                  </DialogHeader>
                  <form action={addAction} className="space-y-4">
                    <input type="hidden" name="questionId" value={questionId} />
                    {addState.errors?._form && (
                      <p className="text-sm text-destructive">
                        {addState.errors._form.join(', ')}
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="add-label">Label</Label>
                      <Input id="add-label" name="label" required />
                      {addState.errors?.label && (
                        <p className="text-sm text-destructive">
                          {addState.errors.label[0]}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-score">Score (0-100)</Label>
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
                      {addPending ? 'Adding...' : 'Add Option'}
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
                <TableHead>Label</TableHead>
                <TableHead className="w-24 text-right">Score</TableHead>
                {isDraft && <TableHead className="w-32 text-right">Actions</TableHead>}
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
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={isPending}
                          onClick={() => {
                            if (confirm(`Delete "${option.label}"?`)) {
                              startTransition(async () => {
                                await deleteAnswerOption(option.id);
                              });
                            }
                          }}
                        >
                          Delete
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
                    No answer options configured.
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
            <DialogTitle>Edit Answer Option</DialogTitle>
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
                <Label htmlFor="edit-label">Label</Label>
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
                <Label htmlFor="edit-score">Score (0-100)</Label>
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
                {editPending ? 'Saving...' : 'Save'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
