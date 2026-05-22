'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StudyCard } from '@/components/study/StudyCard';
import { RatingButtons } from '@/components/study/RatingButtons';
import { StudyProgress } from '@/components/study/StudyProgress';
import { DueCard } from '@/types/study';

export default function StudyPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [session, setSession] = useState<{ id: string } | null>(null);
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const buriedIds = useRef<Set<string>>(new Set());

  // Start review session on mount
  useEffect(() => {
    async function startSession() {
      try {
        const res = await fetch('/api/review/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deckId: id }),
        });
        if (!res.ok) {
          setError('Failed to start study session. Please try again.');
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        setSession(data.session);
        setDueCards(data.dueCards);
      } catch (err) {
        console.error(err);
        setError('Failed to start study session. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    startSession();
  }, [id]);

  // Spacebar to reveal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' && !isRevealed && !isFinished) {
        e.preventDefault();
        setIsRevealed(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, isFinished]);

  const handleRate = useCallback(
    async (quality: number) => {
      if (!session || !dueCards[currentIndex]) return;

      const currentCard = dueCards[currentIndex];
      const nextIndex = currentIndex + 1;
      const done = nextIndex >= dueCards.length;

      // Fire-and-forget the event (we optimistically advance)
      fetch(`/api/review/sessions/${session.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: currentCard.id, quality }),
      }).catch(console.error);

      setReviewedCount((c) => c + 1);
      setCurrentIndex(nextIndex);
      setIsRevealed(false);

      if (done) {
        setIsFinished(true);
        // Close the session
        fetch(`/api/review/sessions/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        }).catch(console.error);
      }
    },
    [session, dueCards, currentIndex],
  );

  const handleBury = useCallback(() => {
    const currentCard = dueCards[currentIndex];
    if (!currentCard) return;

    if (buriedIds.current.has(currentCard.id)) {
      // Card already buried once — force review with "Again" instead of burying again
      handleRate(0);
      return;
    }

    buriedIds.current.add(currentCard.id);
    setDueCards((prev) => {
      const next = [...prev];
      const [buried] = next.splice(currentIndex, 1);
      return [...next, buried];
    });
    // currentIndex stays the same, which now points to the next card
    setIsRevealed(false);
  }, [currentIndex, dueCards, handleRate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4">
        <p className="text-xl font-medium">Something went wrong</p>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => router.push(`/decks/${id}`)}>
          Go back
        </Button>
      </div>
    );
  }

  // No due cards
  if (!isLoading && dueCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4">
        <p className="text-xl font-medium">No cards due!</p>
        <p className="text-muted-foreground">Come back later to continue studying.</p>
        <Link href={`/decks/${id}`}>
          <Button variant="outline">Back to Deck</Button>
        </Link>
      </div>
    );
  }

  // Session complete
  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4">
        <p className="text-xl font-medium">Session complete!</p>
        <p className="text-muted-foreground">You reviewed {reviewedCount} card{reviewedCount !== 1 ? 's' : ''}.</p>
        <Link href={`/decks/${id}`}>
          <Button variant="default">Back to Deck</Button>
        </Link>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/decks/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to Deck
        </Link>
        <h1 className="text-lg font-semibold">Study Session</h1>
        <div />
      </div>

      <StudyProgress
        current={currentIndex + 1}
        total={dueCards.length}
        onBury={handleBury}
      />

      <StudyCard
        card={currentCard}
        isRevealed={isRevealed}
        onReveal={() => setIsRevealed(true)}
      />

      {isRevealed && <RatingButtons onRate={handleRate} />}
    </div>
  );
}
