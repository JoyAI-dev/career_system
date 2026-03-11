'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type StepState } from '@/server/queries/activity';

// Maps activity type name (stable) to i18n translation key
const stepKeyMap: Record<string, string> = {
  '圆桌会议': 'roundtable',
  '探索搭子': 'studyBuddy',
  '深度探索': 'deepExplore',
  '竞赛': 'competition',
  '试水案例': 'trialCase',
  '聚焦讨论': 'focusDiscussion',
  '导师拍卖': 'mentorAuction',
  '实习拍卖': 'internAuction',
};

interface ActivityStepperProps {
  steps: Array<{
    typeId: string;
    typeName: string;
    order: number;
    state: StepState;
  }>;
}

export function ActivityStepper({ steps }: ActivityStepperProps) {
  const t = useTranslations('stepper');

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2 scrollbar-none" role="list">
      {steps.map((step, index) => {
        const i18nKey = stepKeyMap[step.typeName];
        const label = i18nKey ? t(i18nKey) : step.typeName;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.typeId} className="flex items-start" role="listitem">
            <div className="flex flex-col items-center">
              {/* Circle */}
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                  step.state === 'completed' && 'border-green-500 bg-green-500 text-white',
                  step.state === 'current' && 'border-orange-400 bg-orange-400 text-white',
                  step.state === 'locked' && 'border-gray-300 bg-transparent text-gray-400',
                )}
              >
                {step.state === 'completed' ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              {/* Label */}
              <span
                className={cn(
                  'mt-2 max-w-[72px] text-center text-xs leading-tight',
                  step.state === 'completed' && 'font-medium text-green-700',
                  step.state === 'current' && 'font-medium text-orange-600',
                  step.state === 'locked' && 'text-gray-400',
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'mt-5 h-0.5 w-8 shrink-0 md:w-12',
                  step.state === 'completed' ? 'bg-green-500' : 'bg-gray-300',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
