import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Policy } from "@/types/graph";

interface UnassignedPoliciesTableProps {
  policies: Policy[];
}

const platformColors: Record<string, string> = {
  Windows: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  iOS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Android: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  macOS: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  "All Platforms": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export function UnassignedPoliciesTable({ policies }: UnassignedPoliciesTableProps) {
  const displayPolicies = policies.slice(0, 8);
  const remaining = policies.length - displayPolicies.length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-lg font-semibold">Unassigned Policies</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {policies.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {policies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">All policies are assigned!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayPolicies.map((policy) => (
              <div
                key={policy.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{policy.name}</p>
                  <p className="text-xs text-muted-foreground">{policy.type}</p>
                </div>
                <Badge className={platformColors[policy.platform]} variant="outline">
                  {policy.platform}
                </Badge>
              </div>
            ))}
            {remaining > 0 && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                +{remaining} more unassigned policies
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
