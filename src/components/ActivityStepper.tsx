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
    <div className="flex w-full items-start pb-2" role="list">
      {steps.map((step, index) => {
        const i18nKey = stepKeyMap[step.typeName];
        const label = i18nKey ? t(i18nKey) : step.typeName;
        const isLast = index === steps.length - 1;
        const connectorColor = step.state === 'completed' ? 'border-green-500' : 'border-gray-300';
        const arrowColor = step.state === 'completed' ? 'border-l-green-500' : 'border-l-gray-300';

        return (
          <div key={step.typeId} className={cn('flex items-start', !isLast && 'flex-1')} role="listitem">
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

            {/* Arrow connector */}
            {!isLast && (
              <div className="mt-5 flex flex-1 items-center">
                <div className={cn('h-0 flex-1 border-t-2', connectorColor)} />
                <div
                  className={cn(
                    'h-0 w-0 border-b-[5px] border-l-[7px] border-t-[5px] border-b-transparent border-t-transparent',
                    arrowColor,
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
