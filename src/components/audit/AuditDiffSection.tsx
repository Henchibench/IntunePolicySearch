import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatSettingKey } from '@/lib/settingsExtractor';
import type { AuditResource } from '@/types/audit';

interface AuditDiffSectionProps {
  resources: AuditResource[];
}

function isLongValue(value: string | null): boolean {
  if (!value) return false;
  return value.length > 120 || value.includes('\n') || value.startsWith('{') || value.startsWith('[');
}

function ValueDisplay({ value, variant }: { value: string | null; variant: 'old' | 'new' }) {
  const [expanded, setExpanded] = useState(false);

  if (!value || value === '' || value === 'null') {
    return (
      <span className="text-xs italic text-muted-foreground">
        {variant === 'old' ? '(not set)' : '(removed)'}
      </span>
    );
  }

  if (isLongValue(value)) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {expanded ? 'Collapse' : 'Expand value'}
        </button>
        {expanded && (
          <pre className="mt-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-foreground font-mono">
            {value}
          </pre>
        )}
      </div>
    );
  }

  return (
    <span className={variant === 'old' ? 'text-xs text-muted-foreground line-through' : 'text-xs text-foreground'}>
      {value}
    </span>
  );
}

export function AuditDiffSection({ resources }: AuditDiffSectionProps) {
  const allProps = resources.flatMap(r => r.modifiedProperties ?? []);
  if (allProps.length === 0) {
    return (
      <div>
        <span className="text-sm font-semibold text-foreground">Changes</span>
        <p className="mt-2 text-xs text-muted-foreground">No property changes recorded for this event.</p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-sm font-semibold text-foreground">Changes</span>
      <div className="mt-3 space-y-0 rounded-2xl border border-border bg-card shadow-card overflow-hidden divide-y divide-border">
        {allProps.map((prop, i) => (
          <div key={`${prop.displayName}-${i}`} className="px-4 py-3">
            <div className="text-xs font-semibold text-foreground mb-2">
              {formatSettingKey(prop.displayName)}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1">Old</span>
                <ValueDisplay value={prop.oldValue} variant="old" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1">New</span>
                <ValueDisplay value={prop.newValue} variant="new" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
