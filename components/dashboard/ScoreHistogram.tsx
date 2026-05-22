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
  data: { score: number; count: number }[];
}

export function ScoreHistogram({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <XAxis dataKey="score" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [v, 'Count']} />
        <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
