'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  createGradeOption,
  updateGradeOption,
  deleteGradeOption,
  reorderGradeOption,
  type GradeOptionState,
} from '@/server/actions/admin';

type GradeOption = {
  id: string;
  label: string;
  order: number;
  isActive: boolean;
};

export function GradeOptionsTable({ options }: { options: GradeOption[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOption, setEditOption] = useState<GradeOption | null>(null);
  const t = useTranslations('admin.grades');

  const [addState, addAction, addPending] = useActionState<GradeOptionState, FormData>(
    async (prev, formData) => {
      const result = await createGradeOption(prev, formData);
      if (result.success) setAddOpen(false);
      return result;
    },
    {},
  );

  const [editState, editAction, editPending] = useActionState<GradeOptionState, FormData>(
    async (prev, formData) => {
      const result = await updateGradeOption(prev, formData);
      if (result.success) setEditOption(null);
      return result;
    },
    {},
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('gradeOptions')}</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {t('addGrade')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('addGradeOption')}</DialogTitle>
            </DialogHeader>
            <form action={addAction} className="space-y-4">
              {addState.errors?._form && (
                <p className="text-sm text-destructive">{addState.errors._form.join(', ')}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="add-label">{t('label')}</Label>
                <Input id="add-label" name="label" required />
                {addState.errors?.label && (
                  <p className="text-sm text-destructive">{addState.errors.label[0]}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-order">{t('order')}</Label>
                <Input
                  id="add-order"
                  name="order"
                  type="number"
                  defaultValue={options.length}
                  required
                />
                {addState.errors?.order && (
                  <p className="text-sm text-destructive">{addState.errors.order[0]}</p>
                )}
              </div>
              <input type="hidden" name="isActive" value="true" />
              <Button type="submit" disabled={addPending}>
                {addPending ? t('adding') : t('add')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('order')}</TableHead>
            <TableHead>{t('label')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead className="text-right">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {options.map((option, index) => (
            <TableRow key={option.id}>
              <TableCell>{option.order}</TableCell>
              <TableCell className="font-medium">{option.label}</TableCell>
              <TableCell>
                <span
                  className={
                    option.isActive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-muted-foreground'
                  }
                >
                  {option.isActive ? t('active') : t('inactive')}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => reorderGradeOption(option.id, 'up')}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === options.length - 1}
                    onClick={() => reorderGradeOption(option.id, 'down')}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditOption(option)}
                  >
                    {t('edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${option.label}"?`)) {
                        deleteGradeOption(option.id);
                      }
                    }}
                  >
                    {t('delete')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {options.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                {t('noGrades')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Edit Dialog */}
      <Dialog open={!!editOption} onOpenChange={(open) => !open && setEditOption(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editGradeOption')}</DialogTitle>
          </DialogHeader>
          {editOption && (
            <form action={editAction} className="space-y-4">
              <input type="hidden" name="id" value={editOption.id} />
              {editState.errors?._form && (
                <p className="text-sm text-destructive">{editState.errors._form.join(', ')}</p>
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
                  <p className="text-sm text-destructive">{editState.errors.label[0]}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-order">{t('order')}</Label>
                <Input
                  id="edit-order"
                  name="order"
                  type="number"
                  defaultValue={editOption.order}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="edit-active">{t('active')}</Label>
                <input
                  type="hidden"
                  name="isActive"
                  value={editOption.isActive ? 'true' : 'false'}
                />
                <input
                  id="edit-active"
                  type="checkbox"
                  defaultChecked={editOption.isActive}
                  onChange={(e) => {
                    const hidden = e.target.previousElementSibling as HTMLInputElement;
                    hidden.value = e.target.checked ? 'true' : 'false';
                  }}
                  className="h-4 w-4"
                />
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
