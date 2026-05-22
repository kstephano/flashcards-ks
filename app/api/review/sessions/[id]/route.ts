import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { reviewSessions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const { id } = await params;

  const reviewSession = await db.query.reviewSessions.findFirst({
    where: and(eq(reviewSessions.id, id), eq(reviewSessions.userId, userId)),
  });
  if (!reviewSession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [updated] = await db
    .update(reviewSessions)
    .set({ endedAt: new Date() })
    .where(eq(reviewSessions.id, id))
    .returning();

  return NextResponse.json(updated);
}
