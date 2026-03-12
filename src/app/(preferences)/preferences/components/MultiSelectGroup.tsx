'use client';

type Option = {
  id: string;
  label: string;
  value: string;
  order: number;
};

type Props = {
  options: Option[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
};

export function MultiSelectGroup({ options, selected, onChange }: Props) {
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
            selected.has(opt.id)
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border bg-background hover:bg-muted/50'
          }`}
        >
          <input
            type="checkbox"
            checked={selected.has(opt.id)}
            onChange={() => toggle(opt.id)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
