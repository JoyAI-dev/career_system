'use client';

type ChildOption = {
  id: string;
  label: string;
  value: string;
  order: number;
};

type ParentOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  isAutoSelected: boolean;
  requiresChild: boolean;
  children: ChildOption[];
};

type Props = {
  options: ParentOption[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
};

export function HierarchicalSelectGroup({ options, selected, onChange }: Props) {
  function toggleOption(optId: string, option: ParentOption | ChildOption, parent?: ParentOption) {
    const next = new Set(selected);

    if (parent) {
      // Toggling a child option
      if (next.has(optId)) {
        next.delete(optId);
        // Check if parent should be auto-deselected (no more children selected)
        if (parent.isAutoSelected) {
          const hasOtherChildSelected = parent.children.some(
            (c) => c.id !== optId && next.has(c.id),
          );
          if (!hasOtherChildSelected) {
            next.delete(parent.id);
          }
        }
      } else {
        next.add(optId);
        // Auto-select parent if it's auto-selected type
        if (parent.isAutoSelected) {
          next.add(parent.id);
        }
      }
    } else {
      // Toggling a top-level option
      const parentOpt = option as ParentOption;
      if (parentOpt.isAutoSelected) {
        // Auto-selected parents can't be directly toggled
        return;
      }
      // Regular top-level option (like 商人, 创业者)
      if (next.has(optId)) {
        next.delete(optId);
      } else {
        next.add(optId);
      }
    }

    onChange(next);
  }

  return (
    <div className="space-y-3">
      {options.map((opt) => {
        const hasChildren = opt.children.length > 0;
        const isParentSelected = selected.has(opt.id);

        if (hasChildren) {
          // Render as a group with parent header and child checkboxes
          return (
            <div key={opt.id} className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={isParentSelected}
                  disabled={opt.isAutoSelected}
                  onChange={() => toggleOption(opt.id, opt)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-60"
                />
                <span className={`text-sm font-medium ${opt.isAutoSelected ? 'text-muted-foreground' : ''}`}>
                  {opt.label}
                </span>
                {opt.isAutoSelected && (
                  <span className="text-xs text-muted-foreground">(auto)</span>
                )}
              </div>
              <div className="ml-6 grid grid-cols-2 gap-2">
                {opt.children.map((child) => (
                  <label
                    key={child.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selected.has(child.id)
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(child.id)}
                      onChange={() => toggleOption(child.id, child, opt)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span>{child.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        }

        // Regular flat option (no children)
        return (
          <label
            key={opt.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              isParentSelected
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-background hover:bg-muted/50'
            }`}
          >
            <input
              type="checkbox"
              checked={isParentSelected}
              onChange={() => toggleOption(opt.id, opt)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
