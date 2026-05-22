'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  data: { week: string; avgAccuracy: number; avgRelevance: number }[];
}

export function JudgeScoreChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="avgAccuracy"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          name="Accuracy"
        />
        <Line
          type="monotone"
          dataKey="avgRelevance"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          name="Relevance"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
