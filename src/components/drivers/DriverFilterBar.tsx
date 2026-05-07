import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DriverFilters, DriverInventory, CatalogEntry } from '@/types/drivers';

interface Props {
  filters: DriverFilters;
  onChange: (next: DriverFilters) => void;
  manufacturers: string[];
  driverClasses: string[];
  catalogAvailable: boolean;
}

const APPROVAL_OPTIONS: DriverInventory['approvalStatus'][] = [
  'needsReview', 'approved', 'declined', 'suspended',
];
const CRITICALITY_OPTIONS: CatalogEntry['criticality'][] = [
  'Urgent', 'Recommended', 'Optional', 'Other',
];

function MultiSelectButton({
  label,
  options,
  values,
  onChange,
  disabled,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const summary = values.length === 0 ? label : `${label} (${values.length})`;
  return (
    <details className="relative">
      <summary
        role="button"
        aria-label={label}
        aria-disabled={disabled ? 'true' : 'false'}
        className={cn(
          'cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        onClick={(e) => { if (disabled) e.preventDefault(); }}
      >
        {summary}
      </summary>
      {!disabled && (
        <div className="absolute z-10 mt-1 w-48 rounded-md border border-border bg-lifted p-2 shadow-md">
          {options.map((opt) => {
            const checked = values.includes(opt);
            return (
              <label key={opt} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    onChange(checked ? values.filter((v) => v !== opt) : [...values, opt]);
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}
    </details>
  );
}

export function DriverFilterBar({
  filters,
  onChange,
  manufacturers,
  driverClasses,
  catalogAvailable,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        placeholder="Search drivers, manufacturer, version..."
        value={filters.freeText}
        onChange={(e) => onChange({ ...filters, freeText: e.target.value })}
        className="max-w-xs"
      />
      <MultiSelectButton
        label="Manufacturer"
        options={manufacturers}
        values={filters.manufacturers}
        onChange={(next) => onChange({ ...filters, manufacturers: next })}
      />
      <MultiSelectButton
        label="Driver class"
        options={driverClasses}
        values={filters.driverClasses}
        onChange={(next) => onChange({ ...filters, driverClasses: next })}
      />
      <MultiSelectButton
        label="Approval"
        options={APPROVAL_OPTIONS}
        values={filters.approvalStatuses}
        onChange={(next) => onChange({ ...filters, approvalStatuses: next as DriverInventory['approvalStatus'][] })}
      />
      <MultiSelectButton
        label="Criticality"
        options={CRITICALITY_OPTIONS}
        values={filters.criticalities}
        onChange={(next) => onChange({ ...filters, criticalities: next as CatalogEntry['criticality'][] })}
        disabled={!catalogAvailable}
      />
      <Button
        type="button"
        variant={filters.affectsDevicesOnly ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange({ ...filters, affectsDevicesOnly: !filters.affectsDevicesOnly })}
        aria-label="Affects devices toggle"
      >
        Affects devices
      </Button>
    </div>
  );
}
