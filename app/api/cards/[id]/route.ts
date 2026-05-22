import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { cards, decks, sections, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function ownedCard(cardId: string, userId: string) {
  const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
  if (!card) return null;
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, card.deckId) });
  if (!deck) return null;
  const section = await db.query.sections.findFirst({ where: eq(sections.id, deck.sectionId) });
  if (!section) return null;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, section.projectId), eq(projects.userId, userId)) });
  return project ? card : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const card = await ownedCard(id, session.user.id);
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json() as { front?: string; back?: string; explanation?: string };
  // Save originals on first edit
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    humanEdited: true,
    editedAt: new Date(),
  };
  if (body.front !== undefined) {
    if (!card.humanEdited) updates.originalFront = card.front;
    updates.front = body.front;
  }
  if (body.back !== undefined) {
    if (!card.humanEdited) updates.originalBack = card.back;
    updates.back = body.back;
  }
  if (body.explanation !== undefined) updates.explanation = body.explanation;
  const [updated] = await db.update(cards).set(updates).where(eq(cards.id, id)).returning();
  return NextResponse.json(updated);
}
