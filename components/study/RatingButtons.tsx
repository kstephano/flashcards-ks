'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RatingButtonsProps {
  onRate: (quality: number) => void;
}

const RATINGS = [
  { quality: 0, label: 'Again' },
  { quality: 1, label: 'Hard' },
  { quality: 2, label: 'Difficult' },
  { quality: 3, label: 'Good' },
  { quality: 4, label: 'Easy' },
  { quality: 5, label: 'Perfect' },
] as const;

export function RatingButtons({ onRate }: RatingButtonsProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const digit = parseInt(e.key, 10);
      if (digit >= 0 && digit <= 5) {
        onRate(digit);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRate]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-2xl mx-auto">
      <p className="text-sm text-muted-foreground">How well did you recall this? (press 0–5)</p>
      <div className="flex gap-2 flex-wrap justify-center">
        {RATINGS.map(({ quality, label }) => (
          <Button
            key={quality}
            onClick={() => onRate(quality)}
            variant="outline"
            size="sm"
            className={cn(
              'flex flex-col h-auto py-2 px-3 min-w-16',
              quality <= 2
                ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950'
                : 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950',
            )}
          >
            <span className="text-lg font-bold">{quality}</span>
            <span className="text-xs">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
