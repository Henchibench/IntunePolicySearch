import { LucideIcon } from "lucide-react";
import { EditorialCard } from "@/components/ui/EditorialCard";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, color, className }: StatCardProps) {
  return (
    <EditorialCard
      radius="card"
      padding="lg"
      className={cn("flex min-h-[120px] flex-col justify-between bg-card shadow-card", className)}
    >
      <div className="flex items-center justify-between">
        <EyebrowLabel withDot={false}>{title}</EyebrowLabel>
        <div
          className="flex size-9 items-center justify-center rounded-full"
          style={{ backgroundColor: color ? `${color}18` : undefined }}
        >
          <Icon className="size-4" style={{ color }} />
        </div>
      </div>
      <div
        className="mt-3 text-[32px] font-semibold leading-none"
        style={{ color }}
      >
        {value.toLocaleString()}
      </div>
    </EditorialCard>
  );
}
