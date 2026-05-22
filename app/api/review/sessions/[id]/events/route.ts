import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { reviewSessions, reviewEvents, cards } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { applySm2 } from '@/lib/srs/sm2';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const { id } = await params;
  const { cardId, quality } = await req.json() as { cardId: string; quality: number };

  const reviewSession = await db.query.reviewSessions.findFirst({
    where: and(eq(reviewSessions.id, id), eq(reviewSessions.userId, userId)),
  });
  if (!reviewSession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    return NextResponse.json({ error: 'quality must be an integer 0–5' }, { status: 400 });
  }

  const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
  if (!card || card.deckId !== reviewSession.deckId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const srsUpdate = applySm2(
    { easeFactor: card.easeFactor, intervalDays: card.intervalDays, repetitions: card.repetitions },
    quality,
  );

  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const [updatedCard] = await tx
      .update(cards)
      .set({
        easeFactor: srsUpdate.easeFactor,
        intervalDays: srsUpdate.intervalDays,
        repetitions: srsUpdate.repetitions,
        dueDate: srsUpdate.dueDate,
        lastReviewedAt: now,
        lastReviewQuality: quality,
        updatedAt: now,
      })
      .where(eq(cards.id, cardId))
      .returning();

    const [event] = await tx
      .insert(reviewEvents)
      .values({
        sessionId: id,
        cardId,
        quality,
        prevEaseFactor: card.easeFactor,
        newEaseFactor: srsUpdate.easeFactor,
        prevInterval: card.intervalDays,
        newInterval: srsUpdate.intervalDays,
      })
      .returning();

    const sessionUpdate: { cardsReviewed: ReturnType<typeof sql> ; cardsCorrect?: ReturnType<typeof sql> } = {
      cardsReviewed: sql`${reviewSessions.cardsReviewed} + 1`,
    };
    if (quality >= 3) {
      sessionUpdate.cardsCorrect = sql`${reviewSessions.cardsCorrect} + 1`;
    }
    await tx
      .update(reviewSessions)
      .set(sessionUpdate)
      .where(eq(reviewSessions.id, id));

    return { event, updatedCard };
  });

  return NextResponse.json({
    event: {
      id: result.event.id,
      sessionId: result.event.sessionId,
      cardId: result.event.cardId,
      quality: result.event.quality,
      reviewedAt: result.event.reviewedAt,
    },
    cardUpdate: {
      easeFactor: result.updatedCard.easeFactor,
      intervalDays: result.updatedCard.intervalDays,
      repetitions: result.updatedCard.repetitions,
      dueDate: result.updatedCard.dueDate,
    },
  });
}
