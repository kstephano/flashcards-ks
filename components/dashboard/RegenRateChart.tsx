'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  data: { week: string; regenCount: number; totalCount: number }[];
}

export function RegenRateChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet</p>;
  }

  const formatted = data.map((d) => ({
    ...d,
    regenPct:
      d.totalCount > 0 ? Math.round((d.regenCount / d.totalCount) * 100) : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart
        data={formatted}
        margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
      >
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip formatter={(v) => [`${v}%`, 'Regen Rate']} />
        <Line
          type="monotone"
          dataKey="regenPct"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
