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
  data: { deckName: string; retentionPct: number; totalCards: number }[];
}

export function RetentionChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet</p>;
  }

  const formatted = data.map((d) => ({
    ...d,
    deckLabel: d.deckName.length > 20 ? d.deckName.slice(0, 20) + '…' : d.deckName,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        layout="vertical"
        data={formatted}
        margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
      >
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="deckLabel"
          tick={{ fontSize: 11 }}
          width={120}
        />
        <Tooltip
          formatter={(v) => [`${v}%`, 'Retention']}
        />
        <Bar dataKey="retentionPct" fill="#10b981" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
