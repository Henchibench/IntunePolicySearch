import { Clock } from "lucide-react";
import { EditorialCard } from "@/components/ui/EditorialCard";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
import { Policy } from "@/types/graph";

interface RecentlyModifiedTableProps {
  policies: Policy[];
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const SHORT_TYPE: Record<string, string> = {
  "Configuration Policy": "Settings Catalog",
};

export function RecentlyModifiedTable({ policies }: RecentlyModifiedTableProps) {
  const displayPolicies = policies.slice(0, 8);

  return (
    <EditorialCard radius="card" padding="lg" className="flex h-full flex-col">
      <EyebrowLabel>
        <Clock className="size-3 text-link" />
        Recently Modified
      </EyebrowLabel>

      {policies.length === 0 ? (
        <div className="mt-6 text-center text-sm font-[450] text-slate">
          No recent modifications.
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {displayPolicies.map((policy) => (
            <div
              key={policy.id}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">
                  {policy.name}
                </p>
                <span className="text-[10px] font-bold uppercase tracking-eyebrow text-slate">
                  {SHORT_TYPE[policy.type] || policy.type}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[12px] font-[450] tabular-nums text-slate">
                  {formatRelativeTime(policy.lastModified)}
                </p>
                {policy.createdBy && policy.createdBy !== "Unknown" && (
                  <p className="max-w-[100px] truncate text-[10px] text-dust">
                    {policy.createdBy}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </EditorialCard>
  );
}
