'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  data: { day: string; totalUsd: number }[];
}

export function SpendBarChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet</p>;
  }

  const formatted = data.map((d) => ({
    ...d,
    label: d.day.slice(-5),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
        />
        <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Spend']} />
        <Bar dataKey="totalUsd" fill="#6366f1" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
