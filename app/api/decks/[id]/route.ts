import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { decks, sections, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function ownedDeck(id: string, userId: string) {
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, id) });
  if (!deck) return null;
  const section = await db.query.sections.findFirst({ where: eq(sections.id, deck.sectionId) });
  if (!section) return null;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, section.projectId), eq(projects.userId, userId)) });
  return project ? deck : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const deck = await ownedDeck(id, session.user.id);
  if (!deck) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(deck);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const deck = await ownedDeck(id, session.user.id);
  if (!deck) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json() as { name?: string };
  const [updated] = await db.update(decks).set({ ...(body.name ? { name: body.name } : {}), updatedAt: new Date() }).where(eq(decks.id, id)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const deck = await ownedDeck(id, session.user.id);
  if (!deck) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.delete(decks).where(eq(decks.id, id));
  return NextResponse.json({ ok: true });
}
