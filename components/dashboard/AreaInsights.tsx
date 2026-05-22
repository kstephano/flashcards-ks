'use client';

interface Props {
  insights: string[];
}

export function AreaInsights({ insights }: Props) {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
      {insights.map((insight, i) => (
        <li key={insight}>{insight}</li>
      ))}
    </ul>
  );
}
