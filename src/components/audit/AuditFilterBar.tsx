import { useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { AuditFilters } from '@/types/audit';

interface AuditFilterBarProps {
  filters: AuditFilters;
  onChange: (filters: AuditFilters) => void;
  availableCategories: string[];
}

const PRESETS: Array<{ label: string; days: number }> = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AuditFilterBar({ filters, onChange, availableCategories }: AuditFilterBarProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const setPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({ ...filters, from, to });
  };

  const toggleCategory = (cat: string) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter(c => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: next });
  };

  const clearAll = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    onChange({ from, to, categories: [], actorSearch: '', freeText: '' });
  };

  const hasActiveFilters = filters.categories.length > 0 || filters.actorSearch || filters.freeText;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date range presets */}
      <div className="flex items-center gap-1">
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPreset(p.days)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-slate hover:bg-lifted hover:text-ink transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* From date picker */}
      <Popover open={fromOpen} onOpenChange={setFromOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <CalendarIcon className="h-3.5 w-3.5" />
            {formatDate(filters.from)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.from}
            onSelect={(d) => { if (d) { onChange({ ...filters, from: d }); setFromOpen(false); } }}
            disabled={(d) => d > filters.to || d > new Date()}
          />
        </PopoverContent>
      </Popover>

      <span className="text-xs text-slate">to</span>

      {/* To date picker */}
      <Popover open={toOpen} onOpenChange={setToOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <CalendarIcon className="h-3.5 w-3.5" />
            {formatDate(filters.to)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.to}
            onSelect={(d) => { if (d) { onChange({ ...filters, to: d }); setToOpen(false); } }}
            disabled={(d) => d < filters.from || d > new Date()}
          />
        </PopoverContent>
      </Popover>

      {/* Category dropdown */}
      <Popover open={catOpen} onOpenChange={setCatOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            Category
            {filters.categories.length > 0 && (
              <span className="rounded-full bg-ink text-canvas px-1.5 text-[10px] font-bold">
                {filters.categories.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {availableCategories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  filters.categories.includes(cat)
                    ? 'bg-ink text-canvas'
                    : 'text-ink hover:bg-lifted',
                )}
              >
                {cat}
              </button>
            ))}
            {availableCategories.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-slate">Loading...</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Actor search */}
      <Input
        type="text"
        placeholder="Filter by actor..."
        value={filters.actorSearch}
        onChange={(e) => onChange({ ...filters, actorSearch: e.target.value })}
        className="h-8 w-40 rounded-full text-xs"
      />

      {/* Free-text search */}
      <Input
        type="text"
        placeholder="Search events..."
        value={filters.freeText}
        onChange={(e) => onChange({ ...filters, freeText: e.target.value })}
        className="h-8 w-48 rounded-full text-xs"
      />

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 text-xs text-slate hover:text-ink transition-colors"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}
