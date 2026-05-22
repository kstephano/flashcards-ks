'use client';

import { Button } from '@/components/ui/button';
import { DueCard } from '@/types/study';

interface StudyCardProps {
  card: DueCard;
  isRevealed: boolean;
  onReveal: () => void;
}

export function StudyCard({ card, isRevealed, onReveal }: StudyCardProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto">
      <div className="w-full rounded-2xl border bg-card shadow-lg p-8 min-h-64 flex flex-col justify-between">
        {/* Front */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">Question</p>
          <p className="text-xl font-medium leading-relaxed whitespace-pre-wrap">{card.front}</p>
        </div>

        {/* Divider + Answer */}
        {isRevealed && (
          <>
            <hr className="my-6 border-border" />
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">Answer</p>
              <p className="text-xl font-medium leading-relaxed whitespace-pre-wrap">{card.back}</p>
              {card.explanation && (
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-w-lg">
                  {card.explanation}
                </p>
              )}
            </div>
          </>
        )}

        {/* Source page */}
        {card.sourcePage != null && (
          <p className="mt-4 text-xs text-muted-foreground text-right">Page {card.sourcePage}</p>
        )}

        {/* Reveal button */}
        {!isRevealed && (
          <div className="mt-6 flex justify-center">
            <Button onClick={onReveal} variant="outline" size="lg">
              Show Answer <span className="ml-2 text-xs text-muted-foreground">(Space)</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
