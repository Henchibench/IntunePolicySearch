import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

const typeColors: Record<string, string> = {
  "Device Configuration": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  "Compliance Policy": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  "App Protection": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  "Configuration Policy": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export function RecentlyModifiedTable({ policies }: RecentlyModifiedTableProps) {
  const displayPolicies = policies.slice(0, 8);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-lg font-semibold">Recently Modified</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {policies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No recent modifications</p>
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
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={typeColors[policy.type]} variant="outline">
                      {policy.type.replace("Configuration Policy", "Settings Catalog")}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">
                    {formatRelativeTime(policy.lastModified)}
                  </p>
                  {policy.createdBy && (
                    <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {policy.createdBy}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
