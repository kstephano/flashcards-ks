import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const list = await db.query.projects.findMany({
    where: eq(projects.userId, session.user.id),
    orderBy: desc(projects.createdAt),
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, description } = await req.json() as { name: string; description?: string };
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const [project] = await db.insert(projects).values({
    userId: session.user.id, name: name.trim(), description: description ?? null,
  }).returning();
  return NextResponse.json(project, { status: 201 });
}
