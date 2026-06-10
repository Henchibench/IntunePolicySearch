import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { EditorialCard } from "@/components/ui/EditorialCard";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";

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

  const valueTone =
    tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-ink";

  return (
    <EditorialCard
      radius="card"
      padding="lg"
      onClick={onClick}
      className={cn(
        "flex min-h-[140px] flex-col justify-between bg-card shadow-card transition-shadow",
        disabled
          ? "cursor-not-allowed opacity-50"
          : to
            ? "cursor-pointer hover:shadow-pill-light"
            : "",
      )}
    >
      <EyebrowLabel>{label}</EyebrowLabel>
      <div
        className={cn(
          "mt-4 text-[40px] font-semibold leading-none",
          valueTone,
        )}
      >
        {value}
      </div>
      {subStat && (
        <div className="mt-2 text-xs text-slate">{subStat}</div>
      )}
      {disabled && (
        <div className="mt-2 text-xs italic text-slate">Coming in v2</div>
      )}
    </EditorialCard>
  );
}
