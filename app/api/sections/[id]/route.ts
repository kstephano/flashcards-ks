import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { sections, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function ownedSection(id: string, userId: string) {
  const section = await db.query.sections.findFirst({ where: eq(sections.id, id) });
  if (!section) return null;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, section.projectId), eq(projects.userId, userId)) });
  return project ? section : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const section = await ownedSection(id, session.user.id);
  if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(section);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const section = await ownedSection(id, session.user.id);
  if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json() as { name?: string; orderIndex?: number };
  const [updated] = await db.update(sections)
    .set({ ...(body.name ? { name: body.name } : {}), ...(body.orderIndex !== undefined ? { orderIndex: body.orderIndex } : {}), updatedAt: new Date() })
    .where(eq(sections.id, id)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const section = await ownedSection(id, session.user.id);
  if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.delete(sections).where(eq(sections.id, id));
  return NextResponse.json({ ok: true });
}
