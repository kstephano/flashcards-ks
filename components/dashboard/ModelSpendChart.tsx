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
  data: { model: string; totalUsd: number }[];
}

export function ModelSpendChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet</p>;
  }

  const formatted = data.map((d) => ({
    ...d,
    modelLabel: d.model.length > 15 ? d.model.slice(0, 14) + '…' : d.model,
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart
        layout="vertical"
        data={formatted}
        margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
      >
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
        <YAxis type="category" dataKey="modelLabel" tick={{ fontSize: 11 }} width={80} />
        <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Spend']} />
        <Bar dataKey="totalUsd" fill="#8b5cf6" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
