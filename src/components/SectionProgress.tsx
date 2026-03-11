'use client';

type Props = {
  answered: number;
  total: number;
  label: string;
};

export function SectionProgress({ answered, total, label }: Props) {
  const pct = total > 0 ? (answered / total) * 100 : 0;
  const isComplete = answered === total;

  return (
    <div className="sticky top-24 z-10 -mx-4 flex items-center gap-3 border-b bg-background/95 px-4 py-1.5 backdrop-blur-sm md:top-28">
      <div className="flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className={`flex-shrink-0 text-xs font-medium ${isComplete ? 'text-green-600' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}
