import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { EditorialCard } from "@/components/ui/EditorialCard";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";

interface TypeData {
  type: string;
  count: number;
  color: string;
}

interface PolicyTypeBarChartProps {
  data: TypeData[];
}

const shortLabels: Record<string, string> = {
  "Device Configuration": "Device Config",
  "Compliance Policy": "Compliance",
  "App Protection": "App Protection",
  "Configuration Policy": "Settings Catalog",
  "Group Policy": "Group Policy",
  "Security Baseline": "Sec. Baseline",
  "Enrollment Configuration": "Enrollment",
};

export function PolicyTypeBarChart({ data }: PolicyTypeBarChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    shortType: shortLabels[item.type] || item.type,
  }));

  return (
    <EditorialCard radius="card" padding="lg" className="flex h-full flex-col bg-card shadow-card">
      <EyebrowLabel>Policies by Type</EyebrowLabel>

      <div className="mt-4 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#616161" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="shortType"
              width={100}
              tick={{ fontSize: 11, fontWeight: 600, fill: "#242424" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [value, "Policies"]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 400,
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </EditorialCard>
  );
}
