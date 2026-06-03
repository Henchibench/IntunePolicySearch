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
    <div role="tablist" className="inline-flex gap-1 border-b border-border">
      {TABS.map(t => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "relative px-3 py-2 text-sm transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
            value === t.key
              ? "font-semibold text-foreground after:bg-primary"
              : "text-muted-foreground hover:text-foreground after:bg-transparent"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
