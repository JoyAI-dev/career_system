'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
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
  updatePreferenceCategory,
  createPreferenceOption,
  updatePreferenceOption,
  deletePreferenceOption,
} from '@/server/actions/preference';
import type { AdminPreferenceCategory } from '@/server/queries/preference';
import {
  MapPin, UserCircle, Compass, Building2, Flag, Building,
  Network, Briefcase, Users, GraduationCap, Clock, Palmtree,
  Heart, Baby, Settings,
} from 'lucide-react';

// ── Icon Map ─────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MapPin, UserCircle, Compass, Building2, Flag, Building,
  Network, Briefcase, Users, GraduationCap, Clock, Palmtree,
  Heart, Baby,
};

function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = name ? ICON_MAP[name] : null;
  if (Icon) return <Icon className={className || 'h-5 w-5'} />;
  return <Settings className={className || 'h-5 w-5 text-muted-foreground'} />;
}

// ── Main Component ───────────────────────────────────────────────────

type Props = {
  categories: AdminPreferenceCategory[];
};

export function PreferenceManager({ categories }: Props) {
  const t = useTranslations('admin.preferences');

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('description')}
      </p>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('noCategories')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryCard({ category }: { category: AdminPreferenceCategory }) {
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.preferences');

  const inputTypeLabels: Record<string, string> = {
    SINGLE_SELECT: t('typeSingle'),
    MULTI_SELECT: t('typeMulti'),
    HIERARCHICAL_MULTI: t('typeHierarchical'),
    SLIDER: t('typeSlider'),
  };

  function handleToggleActive() {
    const formData = new FormData();
    formData.set('id', category.id);
    formData.set('name', category.name);
    formData.set('isActive', String(!category.isActive));
    formData.set('isGroupingBasis', String(category.isGroupingBasis));
    startTransition(async () => {
      await updatePreferenceCategory({}, formData);
    });
  }

  return (
    <Card className={!category.isActive ? 'opacity-60' : ''}>
      <CardContent className="py-4">
        {/* Category header */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CategoryIcon name={category.icon} className="h-5 w-5" />
              <span className="font-semibold">{category.name}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {inputTypeLabels[category.inputType] || category.inputType}
              </span>
              <span className="text-xs text-muted-foreground">
                #{category.order}
              </span>
              {category.isGroupingBasis && (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  {t('groupingBasis')}
                </span>
              )}
              {!category.isActive && (
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                  {t('disabled')}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {category.slug} · {category.inputType === 'SLIDER'
                ? t('sliderCount', { count: category.sliders.length })
                : t('optionCount', { count: category._count.options })}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={handleToggleActive}
              disabled={isPending}
            >
              {category.isActive ? t('disable') : t('enable')}
            </Button>
            <EditCategoryButton category={category} />
            <Button
              variant="outline"
              size="xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? t('collapse') : t('expand')}
            </Button>
          </div>
        </div>

        {/* Expanded: show options or sliders */}
        {expanded && (
          <div className="mt-4 border-t pt-4">
            {category.inputType === 'SLIDER' ? (
              <SliderList sliders={category.sliders} />
            ) : (
              <OptionList category={category} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditCategoryButton({ category }: { category: AdminPreferenceCategory }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedIcon, setSelectedIcon] = useState(category.icon || '');
  const [isGroupingBasis, setIsGroupingBasis] = useState(category.isGroupingBasis);
  const t = useTranslations('admin.preferences');

  const inputTypeLabels: Record<string, string> = {
    SINGLE_SELECT: t('typeSingle'),
    MULTI_SELECT: t('typeMulti'),
    HIERARCHICAL_MULTI: t('typeHierarchical'),
    SLIDER: t('typeSlider'),
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('id', category.id);
    formData.set('isActive', String(category.isActive));
    formData.set('icon', selectedIcon);
    formData.set('isGroupingBasis', String(isGroupingBasis));
    startTransition(async () => {
      await updatePreferenceCategory({}, formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) {
        setSelectedIcon(category.icon || '');
        setIsGroupingBasis(category.isGroupingBasis);
      }
    }}>
      <DialogTrigger render={<Button variant="ghost" size="xs" />}>
        {t('edit')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editCategory')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="cat-name">{t('name')}</Label>
            <Input id="cat-name" name="name" defaultValue={category.name} required />
          </div>

          {/* Read-only inputType display */}
          <div>
            <Label>{t('inputTypeLabel')}</Label>
            <div className="mt-1">
              <span className="inline-block rounded bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                {inputTypeLabels[category.inputType] || category.inputType}
              </span>
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <Label>{t('icon')}</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {Object.entries(ICON_MAP).map(([name, Icon]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedIcon(name)}
                  className={`flex h-9 w-9 items-center justify-center rounded border transition-colors ${
                    selectedIcon === name
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                  title={name}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            {selectedIcon && (
              <p className="mt-1 text-xs text-muted-foreground">{selectedIcon}</p>
            )}
          </div>

          {/* isGroupingBasis checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cat-grouping-basis"
              checked={isGroupingBasis}
              onChange={(e) => setIsGroupingBasis(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="cat-grouping-basis" className="cursor-pointer">
              {t('groupingBasis')}
            </Label>
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

function OptionList({ category }: { category: AdminPreferenceCategory }) {
  const t = useTranslations('admin.preferences');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t('options')}</h4>
        <AddOptionButton categoryId={category.id} />
      </div>

      {category.options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noOptions')}</p>
      ) : (
        <div className="space-y-1">
          {category.options.map((opt) => (
            <div key={opt.id}>
              <OptionRow option={opt} categoryId={category.id} />
              {/* Children */}
              {opt.children.length > 0 && (
                <div className="ml-6 mt-1 space-y-1">
                  {opt.children.map((child) => (
                    <OptionRow key={child.id} option={child} categoryId={category.id} isChild />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type OptionRowProps = {
  option: {
    id: string;
    label: string;
    value: string;
    order: number;
    isActive: boolean;
    isAutoSelected: boolean;
    requiresChild: boolean;
    _count?: { selections: number };
  };
  categoryId: string;
  isChild?: boolean;
};

function OptionRow({ option, isChild }: OptionRowProps) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.preferences');
  const usageCount = option._count?.selections ?? 0;

  function handleDelete() {
    if (!confirm(t('confirmDelete', { label: option.label }))) return;
    startTransition(async () => {
      await deletePreferenceOption(option.id);
    });
  }

  return (
    <div className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${!option.isActive ? 'opacity-50' : ''} ${isChild ? 'bg-muted/50' : 'bg-muted/30'}`}>
      <span className="w-6 text-center text-xs text-muted-foreground">{option.order}</span>
      <span className="flex-1 font-medium">{option.label}</span>
      <span className="text-xs text-muted-foreground">{option.value}</span>
      {option.isAutoSelected && (
        <span className="rounded bg-blue-100 px-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {t('autoSelected')}
        </span>
      )}
      {option.requiresChild && (
        <span className="rounded bg-amber-100 px-1 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {t('requiresChild')}
        </span>
      )}
      {usageCount > 0 && (
        <span className="text-xs text-muted-foreground">
          {t('usedBy', { count: usageCount })}
        </span>
      )}
      <EditOptionButton option={option} />
      <Button
        variant="destructive"
        size="icon-xs"
        onClick={handleDelete}
        disabled={isPending || usageCount > 0}
        title={usageCount > 0 ? t('cannotDeleteInUse') : t('delete')}
      >
        x
      </Button>
    </div>
  );
}

function AddOptionButton({ categoryId, parentId }: { categoryId: string; parentId?: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.preferences');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('categoryId', categoryId);
    if (parentId) formData.set('parentId', parentId);
    startTransition(async () => {
      await createPreferenceOption({}, formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="xs" />}>
        {t('addOption')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addOptionTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="opt-label">{t('optionLabel')}</Label>
            <Input id="opt-label" name="label" required />
          </div>
          <div>
            <Label htmlFor="opt-value">{t('optionValue')}</Label>
            <Input id="opt-value" name="value" required />
          </div>
          <div>
            <Label htmlFor="opt-order">{t('optionOrder')}</Label>
            <Input id="opt-order" name="order" type="number" min={0} defaultValue={0} required />
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

function EditOptionButton({ option }: { option: { id: string; label: string; value: string; order: number } }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.preferences');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('id', option.id);
    startTransition(async () => {
      await updatePreferenceOption({}, formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-xs" />}>
        ✎
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editOption')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-label">{t('optionLabel')}</Label>
            <Input id="edit-label" name="label" defaultValue={option.label} required />
          </div>
          <div>
            <Label htmlFor="edit-value">{t('optionValue')}</Label>
            <Input id="edit-value" name="value" defaultValue={option.value} required />
          </div>
          <div>
            <Label htmlFor="edit-order">{t('optionOrder')}</Label>
            <Input id="edit-order" name="order" type="number" min={0} defaultValue={option.order} required />
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

function SliderList({ sliders }: { sliders: AdminPreferenceCategory['sliders'] }) {
  const t = useTranslations('admin.preferences');

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{t('sliders')}</h4>
      {sliders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noSliders')}</p>
      ) : (
        <div className="space-y-1">
          {sliders.map((slider) => (
            <div key={slider.id} className="flex items-center gap-3 rounded bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium">{slider.label}</span>
              <span className="text-xs text-muted-foreground">
                {t('sliderRange', { min: slider.minValue, max: slider.maxValue })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('sliderDefault', { value: slider.defaultValue })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('sliderStep', { step: slider.step })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
