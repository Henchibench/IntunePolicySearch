import { PivotGroup } from "@/lib/compliance-pivots";
import { cn } from "@/lib/utils";

interface GroupListProps {
  groups: PivotGroup[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  total: number;
}

export function GroupList({ groups, selectedKey, onSelect, total }: GroupListProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card divide-y divide-border">
      {groups.length === 0 && (
        <div className="p-4 text-sm text-muted-foreground">No devices match.</div>
      )}
      {groups.map(g => {
        const pct = total ? Math.round((g.devices.length / total) * 100) : 0;
        const selected = selectedKey === g.key;
        return (
          <button
            key={g.key}
            onClick={() => onSelect(g.key)}
            className={cn(
              "w-full text-left p-3 hover:bg-accent/50 transition-colors flex items-center justify-between gap-3",
              selected && "bg-accent"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{g.label}</div>
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="text-sm tabular-nums">
              <span className="font-semibold">{g.devices.length}</span>
              <span className="text-muted-foreground"> ({pct}%)</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
