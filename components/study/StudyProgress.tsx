'use client';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface StudyProgressProps {
  current: number;
  total: number;
  onBury: () => void;
}

export function StudyProgress({ current, total, onBury }: StudyProgressProps) {
  const percentage = total > 0 ? Math.round(((current - 1) / total) * 100) : 0;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Card {current} of {total}
        </span>
        <Button variant="ghost" size="sm" onClick={onBury}>
          Bury
        </Button>
      </div>
      <Progress value={percentage} className="w-full" />
    </div>
  );
}
