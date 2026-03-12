'use client';

import { useState, useTransition, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MultiSelectGroup } from './components/MultiSelectGroup';
import { SingleSelectGroup } from './components/SingleSelectGroup';
import { HierarchicalSelectGroup } from './components/HierarchicalSelectGroup';
import { SliderGroup } from './components/SliderGroup';
import { submitPreferences, type PreferenceSubmission } from '@/server/actions/preference';
import type { PreferenceCategoryWithRelations } from '@/server/queries/preference';

type Props = {
  categories: PreferenceCategoryWithRelations[];
};

// Icons mapping (using emoji as fallback since we don't import lucide dynamically)
const CATEGORY_ICONS: Record<string, string> = {
  location: '📍',
  'self-positioning': '👤',
  'development-direction': '🧭',
  industry: '🏭',
  'platform-type': '🏳️',
  'company-size': '🏢',
  'culture-hierarchy': '🔗',
  'culture-environment': '💼',
  'leadership-style': '👥',
  training: '🎓',
  'work-schedule': '⏰',
  vacation: '🏖️',
  'healthcare-benefit': '❤️',
  fertility: '👶',
};

export function PreferencesFlow({ categories }: Props) {
  // State: Map<categoryId, Set<optionId>> for select types
  const [selections, setSelections] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const cat of categories) {
      if (cat.inputType !== 'SLIDER') {
        init[cat.id] = new Set<string>();
      }
    }
    return init;
  });

  // State: Map<sliderId, value> for slider types
  const [sliderValues, setSliderValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const cat of categories) {
      for (const slider of cat.sliders) {
        init[slider.id] = slider.defaultValue;
      }
    }
    return init;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setCategoryRef = useCallback((slug: string) => (el: HTMLDivElement | null) => {
    categoryRefs.current[slug] = el;
  }, []);

  function updateSelection(categoryId: string, selected: Set<string>) {
    setSelections((prev) => ({ ...prev, [categoryId]: selected }));
    // Clear error for this category
    const cat = categories.find((c) => c.id === categoryId);
    if (cat && errors[cat.slug]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[cat.slug];
        return next;
      });
    }
  }

  function updateSingleSelection(categoryId: string, optionId: string | null) {
    if (optionId) {
      setSelections((prev) => ({ ...prev, [categoryId]: new Set([optionId]) }));
      const cat = categories.find((c) => c.id === categoryId);
      if (cat && errors[cat.slug]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[cat.slug];
          return next;
        });
      }
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    for (const cat of categories) {
      if (cat.inputType === 'SLIDER') {
        // Sliders always have default values, so they're always valid
        continue;
      }

      const selected = selections[cat.id];
      if (!selected || selected.size === 0) {
        newErrors[cat.slug] = `请选择${cat.name}`;
      }
    }

    setErrors(newErrors);

    // Scroll to first error
    const firstErrorSlug = Object.keys(newErrors)[0];
    if (firstErrorSlug) {
      const el = categoryRefs.current[firstErrorSlug];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    // Build submission data
    const data: PreferenceSubmission = {
      selections: {},
      sliderValues: [],
    };

    for (const cat of categories) {
      if (cat.inputType !== 'SLIDER') {
        const selected = selections[cat.id];
        if (selected && selected.size > 0) {
          data.selections[cat.id] = {
            optionIds: Array.from(selected),
          };
        }
      }
    }

    for (const [sliderId, value] of Object.entries(sliderValues)) {
      data.sliderValues.push({ sliderId, value });
    }

    setSubmitError(null);
    startTransition(async () => {
      const result = await submitPreferences(data);
      if (result?.errors) {
        const firstError = Object.values(result.errors).flat()[0];
        setSubmitError(firstError || 'Submission failed');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          职业偏好选择
        </h1>
        <p className="mt-2 text-muted-foreground">
          请根据你的职业规划和个人偏好填写以下{categories.length}个类别，所有类别均为必填。
        </p>
      </div>

      {/* Categories */}
      {categories.map((cat) => {
        const icon = CATEGORY_ICONS[cat.slug] || '⚙️';
        const hasError = !!errors[cat.slug];

        return (
          <Card
            key={cat.id}
            ref={setCategoryRef(cat.slug)}
            className={`transition-colors ${hasError ? 'border-destructive' : ''}`}
          >
            <CardContent className="pt-6">
              {/* Category header */}
              <div className="mb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span>{icon}</span>
                  <span>{cat.name}</span>
                  {cat.inputType === 'MULTI_SELECT' && (
                    <span className="text-xs font-normal text-muted-foreground">(多选)</span>
                  )}
                </h2>
                <div className="mt-1 h-0.5 bg-primary" />
                {hasError && (
                  <p className="mt-1 text-sm text-destructive">{errors[cat.slug]}</p>
                )}
              </div>

              {/* Input based on type */}
              {cat.inputType === 'MULTI_SELECT' && (
                <MultiSelectGroup
                  options={cat.options}
                  selected={selections[cat.id] || new Set()}
                  onChange={(s) => updateSelection(cat.id, s)}
                />
              )}

              {cat.inputType === 'SINGLE_SELECT' && (
                <SingleSelectGroup
                  categoryId={cat.id}
                  options={cat.options}
                  selected={
                    selections[cat.id]?.size
                      ? Array.from(selections[cat.id])[0]
                      : null
                  }
                  onChange={(id) => updateSingleSelection(cat.id, id)}
                />
              )}

              {cat.inputType === 'HIERARCHICAL_MULTI' && (
                <HierarchicalSelectGroup
                  options={cat.options}
                  selected={selections[cat.id] || new Set()}
                  onChange={(s) => updateSelection(cat.id, s)}
                />
              )}

              {cat.inputType === 'SLIDER' && (
                <SliderGroup
                  sliders={cat.sliders}
                  values={sliderValues}
                  onChange={setSliderValues}
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Submit */}
      <div className="flex flex-col items-center gap-3 pb-8">
        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={isPending}
          className="min-w-[200px]"
        >
          {isPending ? '提交中...' : '确认并继续'}
        </Button>
        <p className="text-xs text-muted-foreground">
          提交后将进入职业认知问卷
        </p>
      </div>
    </div>
  );
}
