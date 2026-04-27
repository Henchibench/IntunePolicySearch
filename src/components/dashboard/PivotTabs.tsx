import { cn } from "@/lib/utils";

export type PivotKey = "reason" | "platform" | "user";

interface PivotTabsProps {
  value: PivotKey;
  onChange: (next: PivotKey) => void;
}

const TABS: Array<{ key: PivotKey; label: string }> = [
  { key: "reason", label: "By Reason" },
  { key: "platform", label: "By Platform" },
  { key: "user", label: "By User" },
];

export function PivotTabs({ value, onChange }: PivotTabsProps) {
  return (
    <div role="tablist" className="inline-flex gap-1 rounded-lg bg-muted p-1">
      {TABS.map(t => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm transition-colors",
            value === t.key
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
