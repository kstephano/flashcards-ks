import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { decks, sections, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { sectionId, name } = await req.json() as { sectionId: string; name: string };
  if (!sectionId || !name?.trim()) return NextResponse.json({ error: 'sectionId and name required' }, { status: 400 });
  const section = await db.query.sections.findFirst({ where: eq(sections.id, sectionId) });
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, section.projectId), eq(projects.userId, session.user.id)) });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [deck] = await db.insert(decks).values({ sectionId, name: name.trim() }).returning();
  return NextResponse.json(deck, { status: 201 });
}
