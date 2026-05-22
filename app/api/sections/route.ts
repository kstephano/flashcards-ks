import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { sections, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { projectId, name } = await req.json() as { projectId: string; name: string };
  if (!projectId || !name?.trim()) return NextResponse.json({ error: 'projectId and name required' }, { status: 400 });
  // Verify project ownership
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)) });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  // Find next order index
  const existing = await db.query.sections.findMany({ where: eq(sections.projectId, projectId) });
  const orderIndex = existing.length;
  const [section] = await db.insert(sections).values({ projectId, name: name.trim(), orderIndex }).returning();
  return NextResponse.json(section, { status: 201 });
}
