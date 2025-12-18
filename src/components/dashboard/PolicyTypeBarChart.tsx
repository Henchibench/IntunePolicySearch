import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TypeData {
  type: string;
  count: number;
  color: string;
}

interface PolicyTypeBarChartProps {
  data: TypeData[];
}

export function PolicyTypeBarChart({ data }: PolicyTypeBarChartProps) {
  // Shorten labels for display
  const shortLabels: Record<string, string> = {
    "Device Configuration": "Device Config",
    "Compliance Policy": "Compliance",
    "App Protection": "App Protection",
    "Configuration Policy": "Settings Catalog",
  };

  const chartData = data.map((item) => ({
    ...item,
    shortType: shortLabels[item.type] || item.type,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Policies by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="shortType"
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => [value, "Policies"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
