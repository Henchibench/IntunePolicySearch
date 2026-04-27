import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiTileProps {
  label: string;
  value: ReactNode;
  subStat?: ReactNode;
  to?: string;
  disabled?: boolean;
  tone?: "default" | "warning" | "danger";
}

export function KpiTile({ label, value, subStat, to, disabled, tone = "default" }: KpiTileProps) {
  const navigate = useNavigate();

  const onClick = () => {
    if (disabled || !to) return;
    navigate(to);
  };

  const toneClass =
    tone === "danger" ? "text-red-500" : tone === "warning" ? "text-amber-500" : "text-foreground";

  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 transition-shadow",
        disabled ? "opacity-50 cursor-not-allowed" : to ? "cursor-pointer hover:shadow-md" : ""
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-3xl font-semibold mt-1", toneClass)}>{value}</div>
      {subStat && <div className="text-xs text-muted-foreground mt-1">{subStat}</div>}
      {disabled && <div className="text-xs text-muted-foreground mt-2 italic">Coming in v2</div>}
    </Card>
  );
}
