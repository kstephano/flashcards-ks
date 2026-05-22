'use client';

interface Props {
  data: { date: string; count: number }[];
}

function getCellColor(count: number): string {
  if (count === 0) return 'bg-muted';
  if (count <= 2) return 'bg-green-200';
  if (count <= 5) return 'bg-green-400';
  return 'bg-green-600';
}

export function ReviewHeatmap({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet</p>;
  }

  // Build a map of date -> count
  const countMap = new Map<string, number>();
  for (const d of data) {
    countMap.set(d.date.slice(0, 10), d.count);
  }

  // Build last 91 days (13 weeks × 7 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start on the Sunday 13 weeks ago (or nearest Sunday before that)
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 90);
  // Align to Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // Build weeks array: 13 weeks, each with 7 days
  const weeks: { date: string; count: number }[][] = [];
  const monthLabels: { col: number; month: string }[] = [];

  let col = 0;
  let currentDate = new Date(startDate);

  while (col < 13) {
    const week: { date: string; count: number }[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      week.push({ date: dateStr, count: countMap.get(dateStr) ?? 0 });
      // Track month label on the first day of a month
      if (currentDate.getDate() === 1 || (col === 0 && dow === 0)) {
        const label = currentDate.toLocaleString('default', { month: 'short' });
        if (monthLabels.length === 0 || monthLabels[monthLabels.length - 1].month !== label) {
          monthLabels.push({ col, month: label });
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weeks.push(week);
    col++;
  }

  return (
    <div className="overflow-x-auto">
      {/* Month labels */}
      <div className="flex gap-1 mb-1 ml-0" style={{ paddingLeft: 0 }}>
        {weeks.map((_, i) => {
          const label = monthLabels.find((m) => m.col === i);
          return (
            <div key={i} className="w-3 text-[9px] text-muted-foreground leading-none">
              {label ? label.month : ''}
            </div>
          );
        })}
      </div>
      {/* Grid: rows = days of week, cols = weeks */}
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell) => {
              const cellDate = new Date(cell.date + 'T00:00:00');
              if (cellDate > today) {
                return (
                  <div
                    key={cell.date}
                    className="w-3 h-3 rounded-sm bg-transparent border border-dashed border-muted-foreground/20"
                  />
                );
              }
              return (
                <div
                  key={cell.date}
                  className={`w-3 h-3 rounded-sm ${getCellColor(cell.count)}`}
                  title={`${cell.date}: ${cell.count} review${cell.count !== 1 ? 's' : ''}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
