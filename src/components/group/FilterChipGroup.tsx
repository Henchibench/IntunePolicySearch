import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FilterChipOption {
  value: string;
  label: string;
  count: number;
}

export interface FilterChipGroupProps {
  label: string;
  options: FilterChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export function FilterChipGroup({
  label,
  options,
  selected,
  onChange,
}: FilterChipGroupProps) {
  const visible = options.filter((o) => o.count > 0);
  if (visible.length === 0) return null;

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {visible.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            aria-pressed={active}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <Badge
              variant={active ? 'default' : 'outline'}
              className={cn('cursor-pointer', active && 'shadow-sm')}
            >
              {o.label} · {o.count}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
