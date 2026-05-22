import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json() as { name?: string; description?: string };
  const [updated] = await db.update(projects)
    .set({ ...(body.name ? { name: body.name } : {}), ...(body.description !== undefined ? { description: body.description } : {}), updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))
    .returning();
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, session.user.id)));
  return NextResponse.json({ ok: true });
}
