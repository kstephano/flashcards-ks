import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { cards, decks, sections, projects } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  // Verify ownership via deck → section → project
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, id) });
  if (!deck) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const section = await db.query.sections.findFirst({ where: eq(sections.id, deck.sectionId) });
  if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, section.projectId), eq(projects.userId, session.user.id)) });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const cardList = await db.query.cards.findMany({
    where: eq(cards.deckId, id),
    orderBy: asc(cards.createdAt),
  });
  return NextResponse.json(cardList);
}
