import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { EyebrowLabel } from '@/components/ui/EyebrowLabel';
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
      <span className="text-xs italic text-slate">
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
          className="flex items-center gap-1 text-xs text-slate hover:text-ink transition-colors"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {expanded ? 'Collapse' : 'Expand value'}
        </button>
        {expanded && (
          <pre className="mt-1 overflow-x-auto rounded-lg bg-[#1e1e1e] px-3 py-2 text-xs leading-relaxed text-[#d4d4d4] font-mono">
            {value}
          </pre>
        )}
      </div>
    );
  }

  return (
    <span className={variant === 'old' ? 'text-xs text-slate line-through' : 'text-xs text-ink'}>
      {value}
    </span>
  );
}

export function AuditDiffSection({ resources }: AuditDiffSectionProps) {
  const allProps = resources.flatMap(r => r.modifiedProperties ?? []);
  if (allProps.length === 0) {
    return (
      <div>
        <EyebrowLabel>CHANGES</EyebrowLabel>
        <p className="mt-2 text-xs text-slate">No property changes recorded for this event.</p>
      </div>
    );
  }

  return (
    <div>
      <EyebrowLabel>CHANGES</EyebrowLabel>
      <div className="mt-3 space-y-0 rounded-xl border border-border bg-lifted overflow-hidden divide-y divide-border">
        {allProps.map((prop, i) => (
          <div key={`${prop.displayName}-${i}`} className="px-4 py-3">
            <div className="text-xs font-semibold text-ink mb-2">
              {formatSettingKey(prop.displayName)}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate block mb-1">Old</span>
                <ValueDisplay value={prop.oldValue} variant="old" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate block mb-1">New</span>
                <ValueDisplay value={prop.newValue} variant="new" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
