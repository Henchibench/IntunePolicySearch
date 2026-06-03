import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { EditorialCard } from "@/components/ui/EditorialCard";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";

interface PlatformData {
  platform: string;
  count: number;
  color: string;
}

interface PlatformDonutChartProps {
  data: PlatformData[];
}

export function PlatformDonutChart({ data }: PlatformDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <EditorialCard radius="card" padding="lg" className="flex h-full flex-col bg-card shadow-card">
      <EyebrowLabel>Policies by Platform</EyebrowLabel>

      <div className="mt-4 h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={92}
              paddingAngle={2}
              dataKey="count"
              nameKey="platform"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} (${((value / total) * 100).toFixed(1)}%)`,
                name,
              ]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 400,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {data.map((entry) => (
          <div key={entry.platform} className="flex items-center gap-1.5 text-xs text-slate">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.platform}
            <span className="tabular-nums font-semibold text-ink">
              {entry.count}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-border pt-3 text-center">
        <span className="text-[28px] font-semibold leading-none text-ink">
          {total}
        </span>
        <span className="ml-2 text-xs text-slate">total policies</span>
      </div>
    </EditorialCard>
  );
}
