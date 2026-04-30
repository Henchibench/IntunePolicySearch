import { AlertTriangle } from "lucide-react";
import { EditorialCard } from "@/components/ui/EditorialCard";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
import { Policy } from "@/types/graph";

interface UnassignedPoliciesTableProps {
  policies: Policy[];
}

export function UnassignedPoliciesTable({ policies }: UnassignedPoliciesTableProps) {
  const displayPolicies = policies.slice(0, 8);
  const remaining = policies.length - displayPolicies.length;

  return (
    <EditorialCard radius="card" padding="lg" className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <EyebrowLabel>
          <AlertTriangle className="size-3 text-signal-light" />
          Unassigned Policies
        </EyebrowLabel>
        <span className="rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-ink">
          {policies.length}
        </span>
      </div>

      {policies.length === 0 ? (
        <div className="mt-6 text-center text-sm font-[450] text-slate">
          All policies are assigned.
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
                <p className="text-[11px] font-[450] text-slate">{policy.type}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-eyebrow text-slate">
                {policy.platform}
              </span>
            </div>
          ))}
          {remaining > 0 && (
            <p className="pt-3 text-center text-[11px] font-[450] text-dust">
              +{remaining} more unassigned
            </p>
          )}
        </div>
      )}
    </EditorialCard>
  );
}
