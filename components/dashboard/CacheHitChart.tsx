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
  data: { day: string; hitRatePct: number }[];
}

export function CacheHitChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip formatter={(v) => [`${v}%`, 'Cache Hit Rate']} />
        <Line
          type="monotone"
          dataKey="hitRatePct"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
