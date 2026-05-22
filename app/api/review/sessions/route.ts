import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { reviewSessions, cards, decks, sections, projects } from '@/lib/db/schema';
import { eq, and, lte } from 'drizzle-orm';

async function ownedDeck(deckId: string, userId: string) {
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, deckId) });
  if (!deck) return null;
  const section = await db.query.sections.findFirst({ where: eq(sections.id, deck.sectionId) });
  if (!section) return null;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, section.projectId), eq(projects.userId, userId)) });
  return project ? deck : null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  let body: { deckId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { deckId } = body;
  if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 });

  const deck = await ownedDeck(deckId, userId);
  if (!deck) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [reviewSession] = await db
    .insert(reviewSessions)
    .values({ userId, deckId })
    .returning();

  const now = new Date();
  const dueCards = await db
    .select()
    .from(cards)
    .where(and(eq(cards.deckId, deckId), lte(cards.dueDate, now)))
    .orderBy(cards.dueDate);

  return NextResponse.json(
    {
      session: {
        id: reviewSession.id,
        deckId: reviewSession.deckId,
        startedAt: reviewSession.startedAt,
      },
      dueCards,
    },
    { status: 201 },
  );
}
