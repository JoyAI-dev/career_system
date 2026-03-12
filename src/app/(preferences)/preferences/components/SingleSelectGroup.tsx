'use client';

type Option = {
  id: string;
  label: string;
  value: string;
  order: number;
};

type Props = {
  categoryId: string;
  options: Option[];
  selected: string | null;
  onChange: (selected: string | null) => void;
};

export function SingleSelectGroup({ categoryId, options, selected, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
            selected === opt.id
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border bg-background hover:bg-muted/50'
          }`}
        >
          <input
            type="radio"
            name={`single-${categoryId}`}
            checked={selected === opt.id}
            onChange={() => onChange(opt.id)}
            className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
